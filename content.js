// content.js
// Runs on every page. Detects "add to cart" clicks via:
//   1. Site-specific selector overrides (site-overrides.js) — high confidence
//   2. Universal heuristic based on visible text / aria-label / class-id patterns
// On a match, scrapes lightweight product info and forwards it to the
// background service worker, which handles auth + the actual API call.

(function () {
  // English "add to cart"/"buy now" plus common Georgian equivalents
  // ("ყიდვა" = buy, "დამატება" = add) seen on ge-market storefronts. Deliberately
  // excludes bare "კალათა" (cart/basket, a noun) since that also labels the
  // header cart-icon link, which would cause false-positive captures.
  const UNIVERSAL_TEXT_PATTERN = /add\s*(to)?\s*(cart|bag|basket|trolley)|buy\s*now|ყიდვა|დამატება/i;
  const UNIVERSAL_ATTR_PATTERN = /add.?to.?(cart|bag|basket)|atc[-_]?(btn|button)/i;

  const recentlySent = new Map(); // url -> timestamp, for de-duping rapid double-clicks
  const DEDUPE_WINDOW_MS = 5000;

  function isDuplicate(url) {
    const last = recentlySent.get(url);
    const now = Date.now();
    if (last && now - last < DEDUPE_WINDOW_MS) return true;
    recentlySent.set(url, now);
    return false;
  }

  function findClickableAncestor(el) {
    let node = el;
    let depth = 0;
    while (node && depth < 6) {
      const tag = node.tagName;
      if (tag === "BUTTON" || tag === "A" || (tag === "INPUT" && /submit|button/i.test(node.type))) {
        return node;
      }
      const role = node.getAttribute && node.getAttribute("role");
      if (role === "button") return node;
      node = node.parentElement;
      depth++;
    }
    return null;
  }

  // Site-specific override selectors take priority, and unlike the universal
  // heuristic below, they're allowed to match non-interactive elements (some
  // sites build "buttons" out of plain styled <div>s with no button/link/role).
  function findOverrideMatch(el, override) {
    if (!override || !override.selectors) return null;
    let node = el;
    let depth = 0;
    while (node && depth < 6) {
      for (const sel of override.selectors) {
        try {
          if (node.matches && node.matches(sel)) return node;
        } catch (e) {
          /* invalid selector on this page, ignore */
        }
      }
      node = node.parentElement;
      depth++;
    }
    return null;
  }

  function elementLooksLikeAddToCart(el) {
    if (!el) return false;

    // Universal heuristic: visible text, aria-label, value, id/class.
    const text = (el.innerText || el.textContent || "").trim();
    const ariaLabel = el.getAttribute("aria-label") || "";
    const value = el.value || "";
    const idClass = `${el.id || ""} ${el.className || ""}`;

    if (UNIVERSAL_TEXT_PATTERN.test(text) || UNIVERSAL_TEXT_PATTERN.test(ariaLabel) || UNIVERSAL_TEXT_PATTERN.test(value)) {
      return true;
    }
    if (UNIVERSAL_ATTR_PATTERN.test(idClass)) {
      return true;
    }
    return false;
  }

  function getMeta(name) {
    const el =
      document.querySelector(`meta[property='${name}']`) || document.querySelector(`meta[name='${name}']`);
    return el ? el.getAttribute("content") : null;
  }

  function getJsonLdProduct() {
    const scripts = document.querySelectorAll("script[type='application/ld+json']");
    for (const s of scripts) {
      try {
        const data = JSON.parse(s.textContent);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          const candidates = item["@graph"] ? item["@graph"] : [item];
          for (const c of candidates) {
            if (c && (c["@type"] === "Product" || (Array.isArray(c["@type"]) && c["@type"].includes("Product")))) {
              return c;
            }
          }
        }
      } catch (e) {
        /* not valid/parsable JSON-LD, skip */
      }
    }
    return null;
  }

  const PRICE_TEXT_PATTERN = /([$€£¥₾]|USD|EUR|GBP|GEL)\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/i;
  const CURRENCY_SYMBOL_MAP = { "$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "₾": "GEL" };

  function parsePriceText(text) {
    if (!text) return null;
    const match = PRICE_TEXT_PATTERN.exec(text);
    if (!match) return null;
    const symbolOrCode = match[1];
    return {
      price: match[2],
      currency: CURRENCY_SYMBOL_MAP[symbolOrCode] || symbolOrCode.toUpperCase()
    };
  }

  // Site-specific price selectors (see site-overrides.js) take priority — the
  // generic JSON-LD/meta-tag fallback below often grabs an unrelated "*price*"
  // element on pages with lots of widgets (e.g. Amazon's currency estimates).
  function scrapePriceFromOverride(override) {
    if (!override || !override.priceSelectors) return null;
    for (const sel of override.priceSelectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const text = el.getAttribute("content") || el.textContent;
      const parsed = parsePriceText(text);
      if (parsed) return parsed;
    }
    return null;
  }

  // JSON-LD "image" can be a plain URL string, an ImageObject
  // ({"@type":"ImageObject","url":"..."}), or an array of either — this
  // always resolves to a plain URL string (or null), never a raw object.
  function extractImageUrl(imageNode) {
    if (!imageNode) return null;
    if (Array.isArray(imageNode)) return extractImageUrl(imageNode[0]);
    if (typeof imageNode === "string") return imageNode;
    if (typeof imageNode === "object") return imageNode.url || imageNode.contentUrl || null;
    return null;
  }

  // Site-specific image selectors (see site-overrides.js) take priority — some
  // sites (e.g. Amazon) have no og:image meta tag and no JSON-LD at all, so the
  // generic fallback below has nothing to work with.
  function scrapeImageFromOverride(override) {
    if (!override || !override.imageSelectors) return null;
    for (const sel of override.imageSelectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const url = el.src || el.getAttribute("content") || el.getAttribute("href");
      if (url) return url;
    }
    return null;
  }

  function scrapeProductInfo(override) {
    const product = getJsonLdProduct();

    let title = (product && product.name) || getMeta("og:title") || document.title || null;
    let image =
      scrapeImageFromOverride(override) || (product && extractImageUrl(product.image)) || getMeta("og:image") || null;

    const overridePrice = scrapePriceFromOverride(override);

    let price = overridePrice ? overridePrice.price : null;
    let currency = overridePrice ? overridePrice.currency : null;

    if (!price && product && product.offers) {
      const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
      price = offer && (offer.price || (offer.priceSpecification && offer.priceSpecification.price));
      currency = currency || (offer && offer.priceCurrency);
    }
    if (!price) {
      const priceMeta = getMeta("product:price:amount") || getMeta("og:price:amount");
      if (priceMeta) price = priceMeta;
    }
    currency = currency || getMeta("og:price:currency") || null;

    return {
      title: title ? String(title).trim().slice(0, 300) : null,
      price: price ? String(price).trim() : null,
      currency: currency || null,
      image: image || null
    };
  }

  function showToast(message, isError) {
    const existing = document.getElementById("__unified_cart_toast__");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "__unified_cart_toast__";
    toast.textContent = message;
    Object.assign(toast.style, {
      position: "fixed",
      bottom: "24px",
      right: "24px",
      zIndex: 2147483647,
      background: isError ? "#dc2626" : "#111827",
      color: "#fff",
      padding: "10px 16px",
      borderRadius: "8px",
      fontFamily: "system-ui, sans-serif",
      fontSize: "13px",
      boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
      opacity: "0",
      transition: "opacity 0.2s ease"
    });
    document.documentElement.appendChild(toast);
    requestAnimationFrame(() => (toast.style.opacity = "1"));
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 250);
    }, 2500);
  }

  function handlePotentialAddToCart(el, override) {
    const url = window.location.href;
    if (isDuplicate(url)) return;

    const info = scrapeProductInfo(override);
    const payload = {
      url,
      domain: window.location.hostname,
      title: info.title,
      price: info.price,
      currency: info.currency,
      image: info.image,
      capturedAt: new Date().toISOString()
    };

    showToast("Added to Unified Cart…");

    chrome.runtime.sendMessage({ type: "CART_ITEM_CAPTURED", payload }, (response) => {
      if (chrome.runtime.lastError) {
        showToast("Unified Cart: couldn't reach extension.", true);
        return;
      }
      if (response && response.ok) {
        showToast("Added to Unified Cart ✓");
      } else if (response && response.needsAuth) {
        showToast("Unified Cart: sign in from the extension popup.", true);
      } else {
        showToast("Unified Cart: failed to save item.", true);
      }
    });
  }

  document.addEventListener(
    "click",
    (event) => {
      const override = unifiedCartGetSiteOverride(window.location.hostname);

      const overrideMatch = findOverrideMatch(event.target, override);
      if (overrideMatch) {
        handlePotentialAddToCart(overrideMatch, override);
        return;
      }

      const clickable = findClickableAncestor(event.target);
      if (!clickable) return;
      if (elementLooksLikeAddToCart(clickable)) {
        handlePotentialAddToCart(clickable, override);
      }
    },
    true // capture phase, so we see the click even if the site stops propagation
  );
})();
