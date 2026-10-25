# New Kamana Jewellers website (with backend)

Frontend: HTML, CSS, vanilla JS. Backend: Node.js (22.13 or newer) with the built-in SQLite. **No npm install, no dependencies.**

## Run
1. `ADMIN_PASSWORD='a long password' node server/create-admin.js you@example.com "Your Name"` (creates the first admin; run again to reset that admin's password)
2. `npm start` then open http://localhost:3000
3. Sign in at `/admin.html` to manage the shop.

For a live site set `NODE_ENV=production` (adds the Secure cookie flag, so serve over HTTPS) and, behind a proxy, `TRUST_PROXY=1`. Other settings: `PORT`, `DB_PATH`.

## What the server does
- Admin access: admins sign in at `/admin.html` using accounts created by the command above. Passwords use scrypt hashes and HttpOnly session cookies that expire after 14 days; login is rate-limited. Customer accounts and sign-up are not available; previously stored customer accounts are not accepted for sign-in.
- Public API: `GET /api/rates`, `GET /api/products`. The shop page reads these, and falls back to `data/*.json` if the server is not running.
- Daily rate sync: the server fetches the Federation of Nepal Gold and Silver Dealers’ Association's official 1-tola hallmark gold and silver rates at startup and daily at 12:00 Nepal time. The shop page also fetches today's rates directly when the server/API is unavailable (including local file previews). It only accepts valid rates dated today in Nepal; if the source is unavailable or hasn't published today's rates, it retains the last saved values and logs the issue.
- Requests: the order and repair form saves the request in the database and opens WhatsApp. Admins can review requests and update their status.
- Home page: Visit and Follow sections have been consolidated into a responsive footer with the shop address, hours, WhatsApp contact, and social links. The email remains unpublished until confirmed.
- Admin page: update the rate (the update time is set by the server), add, edit and delete products, see requests and set their status, and list admin accounts.
- Security: JSON-only writes with origin check, parameterised SQL, escaped output, strict Content-Security-Policy, only listed files are served (the database and `server/` are never public).

## Deploy
Needs a host that runs Node with a persistent disk (Render, Railway, Fly.io or a small VPS). GitHub Pages, Netlify static and Cloudflare Pages alone will not run the backend. Keep `server/data/` on the persistent disk and back it up. If you edit the inline script in `index.html`, restart the server (its CSP hash is computed at start).

## Images
The hero uses the static image `assets/photos/Bride_wearing_gold_jewellery_20261025115042.jpg`; the About section uses `assets/photos/shop-overview-camera.jpg`, with the shop owner positioned on the left and copy on the right. The bridal photo is not listed as a product. Product photos are optimised JPEGs in `assets/photos/products/` and are listed with distinct descriptive names in `data/collection.json`; duplicate Tilhari views and numbered starter listings are consolidated. The uploaded shop-interior photos are kept in the source photo folder rather than shown as products. No ring photos were included, so the Rings category has no product listing yet. Product weights, purity and prices remain unpublished until confirmed. Sparkles are set up in `index.html` and `?place=1`. Contact details and opening hours stay in `data/site.json`.

## Not included yet
Email-based admin password recovery (admin passwords can be reset with the CLI), photo upload in the admin page, two-factor sign-in, and automatic backups.

## TODO list
- Confirm the number for Call and WhatsApp; other numbers stay unpublished
- Confirm opening days; email stays unpublished
- Confirm product names, weights and purity; add ring photos when available
- Sparkle coordinates (`?place=1`), About text, TikTok video links
- Confirm the Google Maps listing after any shop relocation
- Domain, sitemap, og:image and og:url
- Ask the owner before making any guarantee or hallmark claim
- Customer phone numbers are now stored: add a short privacy note before launch
- Not yet run: browser testing, Lighthouse, screenshots at 375/768/1280 px
