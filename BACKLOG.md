# Backlog

Lightweight task list so we're not duplicating work. Move an item to
"In progress" with your name when you start it, to "Done" when it's merged.
If/when this gets noisy, switch to GitHub Issues instead — this is just to
get moving without ceremony.

## Backend (not started)

The extension expects these two endpoints — see
[README.md](README.md#auth-flow-oauth-style) for the full contract:

- `GET /extension/authorize?client_id=unified-cart-extension&redirect_uri=<uri>`
  — login/consent UI, redirects back with `#access_token=<TOKEN>`
- `POST /api/cart-items` (Bearer auth) — receives `{ url, domain, title,
  price, currency, image, capturedAt }`, returns 401 on bad/expired token

- [ ] Decide backend stack + repo
- [ ] `/extension/authorize` (login/consent → redirect with token)
- [ ] `/api/cart-items` (accept + store the payload)
- [ ] Re-fetch/enrich product data server-side (title/price/image beyond
      what the extension scrapes client-side)
- [ ] Unified cart view (the actual product people came here for)

## Extension

- [ ] No offline queue — failed `POST /api/cart-items` calls aren't
      retried. Worth a small retry queue in `background.js` if backend
      downtime/flakiness turns out to matter.
- [ ] Universal heuristic false positives — "Add to comparison cart" etc.
      Tune `UNIVERSAL_TEXT_PATTERN` / `UNIVERSAL_ATTR_PATTERN` in
      `content.js` as real false positives show up.
- [ ] Token refresh — currently no refresh flow; tokens need to be
      long-lived or this needs adding once the backend issues short-lived
      ones.
- [ ] More site overrides as we find sites that need them (add to
      `site-overrides.js`, see `CONTRIBUTING.md` / issue template for the
      format).

## In progress

_(move items here with your name, e.g. "- [ ] Retry queue — liza")_

## Done

_(move finished items here, or just close the PR/issue — either is fine)_
