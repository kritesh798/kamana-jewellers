# New Kamana Jewellers website (with backend)

Frontend: HTML, CSS, vanilla JS. Backend: Node.js (22.13 or newer) with the built-in SQLite. **No npm install, no dependencies.**

## Run
1. `ADMIN_PASSWORD='a long password' node server/create-admin.js you@example.com "Your Name"` (creates the first admin; run again to reset that admin's password)
2. `npm start` then open http://localhost:3000
3. Sign in at `/account.html`, then open `/admin.html`.

For a live site set `NODE_ENV=production` (adds the Secure cookie flag, so serve over HTTPS) and, behind a proxy, `TRUST_PROXY=1`. Other settings: `PORT`, `DB_PATH`.

## What the server does
- Accounts: sign up and sign in (scrypt password hashes, HttpOnly session cookies, 14-day sessions, login and sign-up rate limits). Roles: `user` and `admin`. Admins are only created with the command above.
- Public API: `GET /api/rates`, `GET /api/products`. The shop page reads these, and falls back to `data/*.json` if the server is not running.
- Requests: the order and repair form saves the request in the database and opens WhatsApp. Signed-in customers see their requests and status in `/account.html`.
- Admin page: update the rate (the update time is set by the server), add, edit and delete products, see requests and set their status, list accounts.
- Security: JSON-only writes with origin check, parameterised SQL, escaped output, strict Content-Security-Policy, only listed files are served (the database and `server/` are never public).

## Deploy
Needs a host that runs Node with a persistent disk (Render, Railway, Fly.io or a small VPS). GitHub Pages, Netlify static and Cloudflare Pages alone will not run the backend. Keep `server/data/` on the persistent disk and back it up. If you edit the inline script in `index.html`, restart the server (its CSP hash is computed at start).

## Images
Copy optimised WebP files into `assets/photos/`, then enter the path (e.g. `assets/photos/ring-1.webp`) in the admin product form. The hero photo and sparkles are set up as before: see `index.html` and `?place=1`. Contact details and opening hours stay in `data/site.json`.

## Not included yet
Password reset by email (no email service), photo upload in the admin page, two-factor sign-in, and automatic backups.

## TODO list
- Confirm the number for Call and WhatsApp; other numbers stay unpublished
- Confirm opening days; email stays unpublished
- Real hero and product photos, names, weights and purity; delete the 6 placeholder products in admin
- Sparkle coordinates (`?place=1`), About text, TikTok video links
- Verify map coordinates and replace the Google share link
- Domain, sitemap, og:image and og:url
- Ask the owner before making any guarantee or hallmark claim
- Customer phone numbers are now stored: add a short privacy note before launch
- Not yet run: browser testing, Lighthouse, screenshots at 375/768/1280 px
