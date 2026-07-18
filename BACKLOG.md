# Backlog

Lightweight task list so we're not duplicating work. Move an item to
"In progress" with your name when you start it, to "Done" when it's merged.
If/when this gets noisy, switch to GitHub Issues instead — this is just to
get moving without ceremony.

## Backend

Built at [meta-cart-backend](https://github.com/prozorovaElene/meta-cart-backend)
(Spring Boot, Java 21) — implements the two endpoints the extension expects,
see [README.md](README.md#auth-flow-oauth-style) for the contract. Point the
extension's Backend settings at `http://localhost:8080` to test against it
locally (`mvn spring-boot:run`, ships with a zero-setup H2 file DB).

Already done:
- [x] Backend stack + repo
- [x] `/extension/authorize` (login/register page → redirect with token)
- [x] `/auth/register`, `/auth/login` (email/password, JWT)
- [x] `/api/cart-items` POST (capture) + GET (list, for the website UI)
- [x] Server-side enrichment at capture time when the extension's
      client-side scrape misses title/price/image
- [x] Daily scheduled price re-check + price-drop detection
      (`priceDropDetectedAt` on the row)

Still open (from the backend's own README "Notes / next steps"):
- [ ] Lock down CORS before production (currently wide open —
      `chrome-extension://*`, `localhost:*`, `https://*`)
- [ ] Refresh tokens (JWTs are long-lived, 30 days, for now)
- [ ] Image re-hosting/caching (currently just stores whatever URL was
      scraped, which can rot)
- [ ] Password reset / email verification
- [ ] Actual notifications (email/push) when `priceDropDetectedAt` is set —
      right now it's just a field on the row, nothing acts on it
- [ ] Move off H2 to Postgres/Supabase before real users (config swap only,
      documented in the backend README)
- [x] Unified cart view — React + Vite app in `meta-cart-backend/frontend`,
      builds into the backend's `src/main/resources/static` and is served
      by the same Spring Boot process. `http://localhost:8080` → sign in /
      register → cart grid over `GET /api/cart-items`, "Refresh prices"
      button, price-drop badge. Needs `cd frontend && npm install && npm
      run build` before it'll show up (gitignored generated output, see
      backend README).

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
