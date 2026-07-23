// site-overrides.js
// Per-site "add to cart" selector overrides. Matched against location.hostname
// using simple substring matching (checked in the order defined below).
// These take priority over the universal heuristic in content.js because
// they're more precise and less prone to false positives on known sites.
//
// To add a new site: add a key (a substring of the hostname) with a list of
// CSS selectors for its "add to cart" / "buy now" style buttons.

const UNIFIED_CART_SITE_OVERRIDES = {
  "amazon.": {
    selectors: ["#add-to-cart-button", "#buy-now-button", "input[name='submit.add-to-cart']"],
    // The generic "*price*" heuristic in content.js/ProductInfoExtractor often grabs an
    // unrelated widget (currency-conversion estimates, related-product carousels) on Amazon's
    // busy pages, so we point directly at the real price element instead.
    priceSelectors: [
      "#corePriceDisplay_desktop_feature_div .a-price .a-offscreen",
      "#corePrice_feature_div .a-price .a-offscreen",
      "span.a-price .a-offscreen"
    ],
    // Amazon product pages have no og:image meta tag and no JSON-LD at all —
    // the image only exists as this real <img> element.
    imageSelectors: ["#landingImage", "#imgTagWrapperId img"]
  },
  "ebay.": {
    selectors: ["a.vi-cta-button", "[data-testid='atcBtn']", "#binBtn_btn"]
  },
  "etsy.": {
    selectors: ["button[data-buy-box-add-to-cart]", "button[data-selector='add-to-cart-button']"]
  },
  "walmart.": {
    selectors: ["button[data-tl-id='ProductPrimaryCTA-cta_add_to_cart']", "button[data-automation-id='atc']"]
  },
  "target.": {
    selectors: ["button[data-test='shippingAddToCartButton']", "button[data-test='addToCartButton']"]
  },
  "bestbuy.": {
    selectors: ["button.add-to-cart-button", "button[data-button-state='ADD_TO_CART']"]
  },
  "shopify": {
    // covers many independent shopify storefronts loaded via CDN assets, not a perfect signal
    selectors: ["button[name='add']", "button.product-form__submit"]
  },
  "zoommer.": {
    // Their "add to cart" control is a plain styled <div type="add">, not a real
    // button/link — this exact attribute is used consistently across the whole site.
    selectors: ["div[type='add']"]
  }
};

// Returns the matching override config for the current hostname, or null.
function unifiedCartGetSiteOverride(hostname) {
  const host = hostname.toLowerCase();
  for (const key of Object.keys(UNIFIED_CART_SITE_OVERRIDES)) {
    if (host.includes(key)) {
      return UNIFIED_CART_SITE_OVERRIDES[key];
    }
  }
  return null;
}
