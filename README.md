# Unified Cart — Chrome Extension

Captures "add to cart" clicks on any shopping site and forwards a lightweight
product record to your backend, so users build one unified cart across every
store they shop on.

## Load it locally

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select this folder
4. Click the extension icon → **Backend settings** → set your backend base
   URL (defaults to a placeholder until you do)

## How detection works

- **Site-specific overrides** (`site-overrides.js`): a small config of known
  CSS selectors per retailer (Amazon, eBay, Etsy, Walmart, Target, Best Buy,
  generic Shopify). Add new entries here as you find sites worth
  special-casing — highest confidence, least false-positive risk.
- **Universal fallback** (`content.js`): if no override matches, any clicked
  button/link/role="button" element is checked against its visible text,
  `aria-label`, `value`, and id/class for patterns like "add to cart", "add
  to bag", "buy now". This is what makes it work on sites you haven't
  special-cased yet.
- A 5-second per-URL de-dupe window prevents double-sends from rapid
  double-clicks or repeated event bubbling.

On a match, the content script scrapes best-effort product info (title,
price, currency, image) from JSON-LD `Product` schema and Open Graph meta
tags — whatever's cheap to grab client-side. The extension deliberately
stays lightweight here per your call to keep it thin and let the backend
re-fetch/enrich later (e.g. for sites with no structured data, or to get
higher-quality images).

## Auth flow (OAuth-style)

Uses `chrome.identity.launchWebAuthFlow`, Chrome's standard mechanism for
this — no custom protocol handlers needed, and the redirect URI is locked to
`https://<extension-id>.chromiumapp.org/`, which only your extension can
receive.

Flow:
1. User clicks **Sign in** in the popup
2. Extension opens `{backendUrl}/extension/authorize?client_id=unified-cart-extension&redirect_uri=<chromiumapp-url>`
3. Your site handles login/consent however you like
4. Your site redirects to `<redirect_uri>#access_token=<TOKEN>`
5. Extension captures the token from the redirect and stores it in
   `chrome.storage.local`

**Your backend needs to implement:**

```
GET /extension/authorize?client_id=unified-cart-extension&redirect_uri=<uri>
  -> show your normal login/consent UI
  -> on success, redirect to `${redirect_uri}#access_token=<TOKEN>`
```

Token format is up to you (JWT, opaque session token, etc.) — the extension
just stores and replays it as a Bearer token.

## Item capture API contract

```
POST /api/cart-items
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://www.example.com/product/123",
  "domain": "www.example.com",
  "title": "Product name" | null,
  "price": "29.99" | null,
  "currency": "USD" | null,
  "image": "https://.../image.jpg" | null,
  "capturedAt": "2026-07-18T10:15:00.000Z"
}
```

- Return `401` if the token is invalid/expired — the extension will clear
  the stored token and prompt the user to sign in again next time.
- Return `2xx` on success; anything else is treated as a soft failure (shown
  as a toast, item is not retried/queued in this version).

## Known limitations / good next steps

- No offline queue yet — if the backend call fails, the item is not
  retried. Worth adding a small retry queue in `background.js` if you expect
  flaky connectivity.
- Universal heuristic can occasionally mis-fire on unrelated buttons whose
  text happens to match (e.g. "Add to comparison cart" on some sites) —
  tune `UNIVERSAL_TEXT_PATTERN`/`UNIVERSAL_ATTR_PATTERN` in `content.js` as
  you see false positives in the wild.
- No image is re-hosted — the `image` field is just whatever URL was on the
  page, which can rot. Re-fetching/caching on the backend side handles this
  per your earlier call.
- Token refresh isn't implemented — if your tokens expire, either issue
  long-lived ones for now or add a refresh-token flow later.

## Contributing

Two-person repo — see [CONTRIBUTING.md](CONTRIBUTING.md) for branch/PR
conventions and [BACKLOG.md](BACKLOG.md) for the task list.

## File map

- `manifest.json` — extension config (Manifest V3)
- `background.js` — service worker: auth flow + API relay
- `content.js` — click detection + product scraping + toast UI
- `site-overrides.js` — per-site selector config
- `popup.html/.css/.js` — sign in/out UI
- `options.html/.js` — backend URL configuration (for dev/testing)
