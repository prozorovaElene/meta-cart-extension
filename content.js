// content.js
// Runs on every page. Detects "add to cart" clicks via:
//   1. Site-specific selector overrides (site-overrides.js) — high confidence
//   2. Universal heuristic based on visible text / aria-label / class-id patterns
// On a match, scrapes lightweight product info and forwards it to the
// background service worker, which handles auth + the actual API call.

(function () {
  const UNIVERSAL_TEXT_PATTERN = /add\s*(to)?\s*(cart|bag|basket|trolley)|buy\s*now/i;
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

  function elementLooksLikeAddToCart(el, override) {
    if (!el) return false;

    // 1. Site-specific override selectors take priority.
    if (override && override.selectors) {
      for (const sel of override.selectors) {
        try {
          if (el.matches(sel) || el.closest(sel)) return true;
        } catch (e) {
          /* invalid selector on this page, ignore */
        }
      }
    }

    // 2. Universal heuristic: visible text, aria-label, value, id/class.
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

  function scrapeProductInfo() {
    const product = getJsonLdProduct();

    let title = (product && product.name) || getMeta("og:title") || document.title || null;

    let price = null;
    if (product && product.offers) {
      const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
      price = offer && (offer.price || (offer.priceSpecification && offer.priceSpecification.price));
    }
    if (!price) {
      const priceMeta = getMeta("product:price:amount") || getMeta("og:price:amount");
      if (priceMeta) price = priceMeta;
    }

    let image = (product && (Array.isArray(product.image) ? product.image[0] : product.image)) || getMeta("og:image") || null;

    let currency = null;
    if (product && product.offers) {
      const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
      currency = offer && offer.priceCurrency;
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

  function handlePotentialAddToCart(el) {
    const url = window.location.href;
    if (isDuplicate(url)) return;

    const info = scrapeProductInfo();
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
      const clickable = findClickableAncestor(event.target);
      if (!clickable) return;
      if (elementLooksLikeAddToCart(clickable, override)) {
        handlePotentialAddToCart(clickable);
      }
    },
    true // capture phase, so we see the click even if the site stops propagation
  );
})();
