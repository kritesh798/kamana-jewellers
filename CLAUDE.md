---
name: kamana
description: Kamana Jewellers website — documentation of structure, conventions, and how to run/extend it
metadata:
  type: project
---

# Kamana Jewellers

A gold and silver jewellery shop in Pokhara, Nepal, with a vanilla-JS frontend (no build tools or dependencies) and a Node.js + SQLite backend. No `npm install` needed — just `node server/server.js`. See [README.md](README.md) for full run instructions.

## Files at a glance

| File | Role |
|---|---|
| `index.html` | Shop page: hero, rates, collection grid, filters, search panel, request form, visit, follow, about. Inline schema `application/ld+json`. |
| `styles.css` | Theming, layout, hero zoom/sweep animations, reduced-motion fallbacks, responsive breakpoints, dialogs. |
| `script.js` | All interactivity: hero, site data from `data/site.json`, rates, collection render with filters + category preview, request form → `/api/requests`, reveals sections on scroll, plus the search UI (categories list, live `matches()` text search up to 6 results, category hover/focus preview, image lightbox). |
| `account.html` / `account.js` | Customer account sign-in, sign-up, request history view. Calls `/api/me`, `/api/login`, `/api/register`, `/api/logout`, `/api/my/requests`. |
| `admin.html` / `admin.js` | Admin dashboard: rate update (`PUT /api/admin/rates`), requests table with status dropdown, products CRUD, accounts list. |
| `server/server.js` | HTTP server: JSON-only writes with origin check, parameterised SQL via `db.prepare`, strict CSP with sha256 hashes of inline scripts, only `server/*.js` routes are private (404), session cookies scrypt-hashed, 14-day sessions, login/register/request rate limits, admin gate at `/api/admin/*`. |
| `server/db.js` | Database module: in-memory sync SQLite at `server/data/kamana.db` (WAL mode), tables `users` / `sessions` / `products` / `requests` / `settings`, seeded from `data/*.json`. Password hashing is random-salt scrypt. |
| `server/create-admin.js` | One-shot CLI to create or reset an admin password. Enforces 10+ char password. |
| `data/site.json` | Site-wide config: contact numbers/WhatsApp, hours, map coordinates, social links, banner, video assets, sparkle coordinates, owner `about` text. Falls back to bundled static JSON if no server is running. |
| `data/rates.json` | Indicative market rates. `null` means "Call for rate". `updated_at` + `updated_bs` set by the admin UI. |
| `data/collection.json` | Categories + placeholder items. Real product data lives in the `products` DB table once the server starts; this file seeds it on first boot. |
| `assets/video/hero.mp4` / `hero.webm` | Hero background video. |
| `test_search.js` | Node test suite for `matches()` / `draw()` using a bundled copy of `collection.json` (no DB or HTTP dependency). |
| `robots.txt` | `Allow: /`; TODO add sitemap. |

## Project structure

```
KamanaJewellers/
├── index.html            # Shop page
├── styles.css             # Stylesheets
├── script.js              # Frontend logic (vanilla ES module IIFE)
├── account.html           # Customer account page
├── account.js             # Account page logic
├── admin.html             # Admin dashboard page
├── admin.js               # Admin dashboard logic
├── test_search.js         # Search tests (pure JS, no deps)
├── robots.txt
├── package.json           # Scripts: start, create-admin, test
├── README.md              # How to run, what each file does, deployment notes
├── .gitignore             # Ignore db files, node_modules, .env, .claude/settings.local.json
├── data/                  # Static JSON fallback files
│   ├── site.json
│   ├── rates.json
│   └── collection.json
├── assets/                # Static media
│   └── video/
│       ├── hero.mp4
│       └── hero.webm
└── server/                # Backend (Node.js ESM, no npm dependencies)
    ├── server.js          # Express-less http server
    ├── db.js             # SQLite connection + schema + seeding + helpers
    ├── create-admin.js    # Admin bootstrap CLI
    └── data/              # Persistent SQLite store (gitignored)
        ├── kamana.db
        ├── kamana.db-wal
        └── kamana.db-shm
```

## Running locally

1. `node server/create-admin.js you@example.com "Your Name"` — must run before any protected route works. **Use a 10+ character ADMIN_PASSWORD.** Re-run to reset that admin's password.
2. `npm start` (or `node server/server.js`) then open http://localhost:3000. The shop page serves static files from root and reads config from `server/data/kamana.db`; falls back to `data/*.json` if the server is not running.
3. Sign in at `/account.html`, then open `/admin.html`.

Environment variables: `PORT` (default 3000), `DB_PATH` (default `server/data/kamana.db`), `NODE_ENV=production` for Secure cookie flag (needs HTTPS), `TRUST_PROXY=1` behind a proxy.

## API surface

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| GET | `/api/rates` | – | – | Public; returns `rates.json` values, no `_howto`. |
| GET | `/api/products` | – | – | Public; returns categories + all products from DB. |
| GET | `/api/me` | cookie | – | Returns the current user (or null). |
| POST | `/api/register` | IP limit 10/9 min | name, email, phone, password | Email must be valid, password 8–100 chars. |
| POST | `/api/login` | IP limit 10/9 min | email, password | Wrong credentials → 401. |
| POST | `/api/logout` | – | – | Clears session cookie. |
| POST | `/api/requests` | optional | name, phone, type, description/desc, time | Opens WhatsApp; inserts into `requests` table with `user_id=null`. |
| GET | `/api/my/requests` | user | – | Lists current user's requests. |
| PUT | `/api/admin/rates` | admin | hallmark_gold, tejabi_gold, silver, updated_bs | Saves rates to `settings`. |
| GET | `/api/admin/requests` | admin | – | All requests, newest first, top 500. |
| GET | `/api/admin/users` | admin | – | All users. |
| POST | `/api/admin/products` | admin | name, category, metal, purity, weight_tola, price, image, alt | Image path must start with `assets/photos/`. |
| PUT | `/api/admin/products/:id` | admin | same as above | Updates one product. |
| DELETE | `/api/admin/products/:id` | admin | – | Deletes one product. |
| PUT | `/api/admin/requests/:id` | admin | status (`new`/`in progress`/`done`/`cancelled`) | Status change only. |

## Client-side conventions (`script.js`)

- Pure IIFE, `const $`, `const $$`, `const esc` (HTML escaping helper reused everywhere), helper `J` (fetch + JSON parse + catch→null), `JF(a, b)` (fetch a, fall back to b).
- `lite` class added when `navigator.connection.saveData` is on or effective type is `2g`/`3g`/`slow-2g`: disables hero zoom/sweep, sparkles and video playback; CSS hides those effects too.
- `reduce` class when `prefers-reduced-motion: reduce`: CSS kills all animations, JS skips hero effects entirely.
- Collections load in parallel via `Promise.all([J('data/site.json'), JF('/api/rates', 'data/rates.json'), JF('/api/products', 'data/collection.json')])`. Each client only renders what resolves.
- `reveal()` uses IntersectionObserver at `.rv` sections with `threshold:.1` so sections fade in as you scroll. Without IO it just shows them all.
- Search panel has category list, live `input` event filtering with a hard cap of 6 results, hover/focus on categories to show a category preview image, Esc to close, click outside to close, and an empty-state message. Category clicks clear the input and filter to that category in the collection grid.
- Rate display uses `Number().toLocaleString('en-IN')` for Nepali formatting, plus optional Nepali date (`updated_bs`) appended to the English date for the "out of date" warning logic.
- Request form build is simple template string joining field values into a WhatsApp message; on server failure it keeps showing the message but surfaces the error in `#fallback`.

## Server conventions (`server/server.js`, `server/db.js`)

- Protocol handlers are a plain `http.createServer`, no framework, single route dispatch (`p = new URL(req.url,'http://x').pathname`, try/catch around everything, `res.headersSent` guard).
- All state lives in SQLite (`server/data/kamana.db`); config cache lives in the `settings` table as JSON strings keyed `rates`, `categories`.
- Security: Content-Security-Policy lists self script hashes computed from inline `<script>` blocks (recomputed on every startup, as noted in README); only listed paths are served (the `server/` directory and DB files never expose under `/`); JSON-only writes with Origin check; parameterised queries everywhere; no `../../` traversal allowed even via encodeURIComponent; request bodies capped at 20 KB (413).
- Sessions: `sid=<base64url>` HttpOnly SameSite=Lax cookie, 14-day expiry stored as a unix timestamp, verified against a `sessions` table joined to `users`; `hashPw` uses random 16-byte salt + scrypt PBKDF2-equivalent with 64-byte output, stored as `salthex:hashhex`.
- Rate limiting: per-IP fixed window (`limited(key, max, windowMs)`), checked on register (10/9 min) and login (10/9 min) and requests (20/360k ms), returning 429 with a helpful message.
- Error format: `{error: 'human-readable message'}` on HTTP errors (>400), or `{error}` on 4xx/5xx inside handlers. Server errors go to `console.error` then `500 {error:'Server error'}`.

## Data file contracts

**`data/site.json`** — top-level keys used by `script.js`:
- `contact.{whatsapp, call, email}` (call has TODO placeholder)
- `hours` (String, rendered into `[data-hours]`)
- `map.{share, lat, lng}` (lat/lng rendered into Google Maps directions link)
- `banner.{enabled, text}`
- `social.{facebook, tiktok, tiktok_videos:[{url,title}]}`
- `about` (String; script only renders if no `TODO:` marker remains)
- `hero.{video:{enabled, webm, mp4}, sparkles:[{x, y, size, delay}]}`

**`data/rates.json`** — keys: `unit` (default `"tola"`), `currency` (default `"NPR"`), `hallmark_gold` (Number or null), `tejabi_gold` (Number or null), `silver` (Number or null), `updated_at` (ISO string), `updated_bs` (Nepali date or `""`). Keys prefixed `_howto` are informational; the seeder strips that key.

**`data/collection.json`** — `categories` array of `{id, label}`, `items` array of `{id, name, category, metal, purity?, weight_tola? (Number), price? (String|null), image? (String path), alt? (String)}`. Items without `image` get a CSS placeholder span instead of an img.

**Seeding order** (first run only, once per process):
1. Rates read from `data/rates.json`, `_howto` deleted, written to `settings`.
2. Categories read from `data/collection.json`; `categories` cached; every item's non-empty fields stored in `products`.

When the server is running, `/api/products` bypasses `collection.json` entirely. When it is **not** running, `script.js` calls `fetch('/api/products')` which will 404, then falls back to `data/collection.json` directly — note the `JF` second argument signature is `JF(a, b)` where `b` is a URL path; this only works because `b` resolves to a file and the static server serves `data/collection.json` at `/data/collection.json`, **not** `/api/products` from the static server. See `server/server.js` line 55 for the `OK` whitelist — `data/collection.json` is served at `/data/collection.json`, so calling `data/collection.json` resolves to `/data/collection.json` which matches the allowlist.

## Testing

```bash
npm test
```

Runs `test_search.js`, which bundles a copy of `collection.json` and tests `matches()`, `draw()` (live search results), case-insensitivity, max 6 result cap, empty-term, and no-match states. Expects no external dependencies.

## Known TODO items (per README)

- Confirm Call and WhatsApp numbers; other numbers stay unpublished
- Confirm opening days; email stays unpublished
- Real hero and product photos, names, weights and purity; delete the 6 placeholder products in admin
- Sparkle coordinates (`?place=1`), About text, TikTok video links
- Verify map coordinates and replace the Google share link
- Domain, sitemap, og:image and og:url
- Ask the owner before making any guarantee or hallmark claim
- Customer phone numbers: add a short privacy note before launch
- Browser testing, Lighthouse, screenshots at 375/768/1280 px

## Commands

- `npm start` — run the backend
- `ADMIN_PASSWORD='long password' npm run create-admin <email> "<Name>"` — bootstrap first admin
- `npm test` — search functionality tests
