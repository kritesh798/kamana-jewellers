# New Kamana Jewellers website (with backend)

Frontend: HTML, CSS, vanilla JS. Backend: Node.js (22.13 or newer) with the built-in SQLite. **No npm install, no dependencies.**

## Run
1. `ADMIN_PASSWORD='a long password' node server/create-admin.js you@example.com "Your Name"` (creates the first admin; run again to reset that admin's password)
2. `npm start` then open http://localhost:3000
3. Sign in at `/admin.html` to manage the shop.

For a live site, set `NODE_ENV=production` and put the app behind an HTTPS reverse proxy. Production startup requires `TRUST_PROXY=1`, and requests without `X-Forwarded-Proto: https` are rejected. The app binds to `127.0.0.1` by default; keep its port private. Set `TRUST_PROXY=1` only behind a trusted proxy that overwrites forwarded headers. Other settings: `HOST`, `PORT`, `DB_PATH`.

## What the server does
- Admin access: admins sign in at `/admin.html` using accounts created by the command above. Passwords use scrypt hashes and HttpOnly session cookies that expire after 14 days; login is rate-limited. Customer accounts and sign-up are not available; previously stored customer accounts are not accepted for sign-in.
- Public API: `GET /api/rates`, `GET /api/products`. The shop page reads these, and falls back to `data/*.json` if the server is not running.
- Daily rate sync: the server fetches the Federation of Nepal Gold and Silver Dealers’ Association's official 1-tola hallmark gold and silver rates at startup and daily at 10:00 Nepal time. If no rate has been published today, it uses the latest valid published pair available from the Federation and shows its actual update date. The shop page applies the same fallback when the server/API is unavailable (including local file previews); if no valid pair can be fetched, it keeps the latest saved website rates.
- Requests: the order and repair form saves the request in the database and opens WhatsApp. Admins can review requests and update their status.
- Home page: Visit and Follow sections have been consolidated into a responsive footer with the shop address, hours, WhatsApp contact, and social links. The email remains unpublished until confirmed.
- Admin page: use the large, step-by-step category and product sections to add, rename, and remove empty categories; add products to a chosen category; and edit product names, categories, photos, and details. Category removal is disabled while products remain in that category. Search the product list by name or category. The less-frequent rate, request, and admin-account tools are grouped under “Other admin tasks.” Uploaded JPEG/PNG photos are stored in `assets/photos/uploads/`; uploads are admin-only, limited to 8 MB each, checked by file signature and image dimensions, stripped of common GPS/text metadata, and capped at 250 MB total.
- Security: JSON-only writes with origin check, parameterised SQL, escaped output, strict Content-Security-Policy, fail-closed password verification, and only listed files are served (the database and `server/` are never public). The public `data/site.json` must contain publishable information only.

## Cloudflare Workers deployment

The Cloudflare Worker is an alternative backend for the same frontend. It serves only a generated allowlist of public site files, uses D1 for products, categories, rates, admin accounts, sessions and requests, and refreshes the latest published Federation rates on the 10:00 Nepal-time cron. Existing catalog images are included as static assets. Admin-uploaded JPEG and PNG photos are committed to this GitHub repository under `assets/photos/uploads/` using a fine-grained GitHub token; the Worker serves them through a same-origin image route. Each upload creates a commit on `main`, which triggers the existing deployment workflow. Uploads are limited to 8 MB each and 20 per administrator per day, dimensions are capped at 20 megapixels, and common location/text metadata is removed. No R2 subscription or credit card is required. Repository size grows with uploaded photos, so keep uploads optimized and remove unused files from the repository when appropriate.

To prepare the Worker:

1. Install dependencies with `npm ci`, then authenticate Wrangler with `npx wrangler login`.
2. Create a D1 database named `kamana-jewellers` in the Cloudflare dashboard or with `npx wrangler d1 create kamana-jewellers`. Copy its database ID into `wrangler.jsonc`.
3. Create a [fine-grained GitHub personal access token](https://github.com/settings/personal-access-tokens/new), restricted to the `kritesh798/kamana-jewellers` repository with **Contents: Read and write** permission. Do not paste the token into chat or commit it. From the project directory, run `npx wrangler secret put GITHUB_TOKEN` and paste it into the hidden terminal prompt. The Worker uses it only to add uploaded photos to the repository.
4. Apply the schema with `npm run db:migrate:cloudflare`.
5. Generate the one-time admin SQL with `ADMIN_PASSWORD` set to a unique password of at least 10 characters, then run that SQL in the D1 dashboard console. For PowerShell:

   ```powershell
   $env:ADMIN_PASSWORD = "use a unique password of at least 10 characters"
   npm run create-cloudflare-admin -- admin@example.com "Admin Name"
   Remove-Item Env:ADMIN_PASSWORD
   ```

   The command outputs a PBKDF2 password hash in an `INSERT` statement; it never outputs the password. Do not commit the generated statement or paste it into chat.
6. In Cloudflare Workers Builds, configure `npm run build:cloudflare` as the build command and `npm run deploy:cloudflare` as the deploy command. The D1 database ID must be set before the first deployment. Build output is generated under `.cloudflare-assets/`, which is ignored by Git and contains only the public files and media referenced by the shop.

The initial D1 bootstrap seeds the static catalog and fallback rates on first API use. It does not import an existing local SQLite database, customer requests, locally created admin accounts or locally uploaded photos. Existing admin passwords use a different hash format; create a Cloudflare admin account as above. Photos already stored on the Node host are not automatically copied to GitHub. Run `npm test` to validate the Worker and existing Node backend before deployment.

### Automatic GitHub deployment

The `.github/workflows/deploy-cloudflare.yml` workflow builds and deploys the Worker whenever changes are pushed to `main`, and can also be started manually from the repository's Actions tab. In the GitHub repository settings, add these Actions secrets:

- `CLOUDFLARE_API_TOKEN`: a scoped token with Workers Scripts Edit, D1 Edit, and Account Settings Read for the account containing this Worker and database.
The Cloudflare account ID is configured in `wrangler.jsonc`. The workflow installs dependencies, builds the static assets, applies any pending D1 migrations, and deploys the Worker. Changes must be committed and pushed to `main` for the automatic deployment to run. No Cloudflare Workers Builds setup is required.

## Deploy on an Oracle Cloud Always Free VM
The existing Node.js + SQLite app can run on an Oracle Cloud Always Free VM without changing its backend. Free VM capacity is not guaranteed, a payment card is required for identity verification, and Oracle may reclaim instances it classifies as idle; this is not an uptime guarantee. During signup and VM creation, select Always Free resources only and review the console's estimated cost before creating anything. Oracle's free allowances and policies can change.

Create an Ubuntu 24.04 VM in the account's home region and assign a public IPv4 address. Configure DNS for your domain to point to that address. Allow inbound SSH (port 22) only from trusted addresses where practical, plus HTTP (port 80) and HTTPS (port 443); do not expose the app port. Install Node.js 22.13 or newer, deploy this repository, and run it as a dedicated unprivileged user under a system service. Set `NODE_ENV=production`, `HOST=127.0.0.1`, `PORT=3000`, `TRUST_PROXY=1`, and `DB_PATH` to a restricted directory on the VM's persistent boot volume.

Install and configure a maintained reverse proxy such as Nginx with a trusted TLS certificate (for example, Let's Encrypt). Redirect HTTP to HTTPS and proxy requests to `http://127.0.0.1:3000`. The proxy must overwrite `X-Forwarded-Proto` with the actual scheme and `X-Forwarded-For` with the connecting client's address; never trust client-supplied forwarding headers. Production app requests require `X-Forwarded-Proto: https`, and admin cookies are marked Secure. Verify HTTP redirects to HTTPS, HTTPS works, and port 3000 is unreachable externally before creating or using an admin account.

After deployment, create the first administrator on the VM with `ADMIN_PASSWORD` set to a unique password of at least 10 characters, then unset it from the shell environment. Run `node server/create-admin.js you@example.com "Your Name"`. From `/admin.html` on a phone, choose a JPEG or PNG photo (up to 8 MB; HEIC is not accepted) and tap Upload photo; the app inserts the generated safe path into the product form and removes common GPS/text metadata. Add and manage category display names there too. Category IDs are generated by the server and persist in SQLite; a category can only be deleted once it has no products, and at least one category must remain. Confirm the public phone number and opening hours, keep unconfirmed personal/contact details out of `data/site.json`, and verify the request privacy notice and applicable data-retention process. Back up the SQLite database and `assets/photos/uploads/` together and test restoring both. Keep Node.js, the operating system, and the proxy patched; monitor service logs and renewal of the TLS certificate. If you edit the inline script in `index.html`, restart the server (its CSP hash is computed at startup). GitHub Pages, Netlify static, and Cloudflare Pages alone will not run this backend.

## Images
The hero uses the shop photo `assets/photos/shop-overview-camera.jpg`; the full-bleed About feature uses `assets/photos/Bride_wearing_gold_jewellery_20261025115042.jpg`. The bridal photo is not listed as a product. Product photos are JPEGs in `assets/photos/products/`; pages from the organised Bracelet, Gedis and chandrahar, Mangalsutra, Rings, Sikiri and Tops PDF scans are extracted there and listed in the matching collection categories. The collection categories are Bracelets, Chandrama, Nau gedis, Soli gedis, Mangalsutra, Pendal, Silver Sikiri, Tilhari, Tops and Rings. The uploaded shop-interior photos are kept in the source photo folder rather than shown as products. Product weights, purity and prices remain unpublished until confirmed. Sparkles are set up in `index.html` and `?place=1`. Only confirmed, publishable contact details and hours belong in `data/site.json`.

## Not included yet
Email-based admin password recovery (admin passwords can be reset with the CLI), two-factor sign-in, and automatic backups.

## TODO list
- Confirm the number for Call and WhatsApp; other numbers stay unpublished
- Confirm opening days; email stays unpublished
- Confirm product names, weights and purity; add ring photos when available
- Sparkle coordinates (`?place=1`), About text, TikTok video links
- Confirm the Google Maps listing after any shop relocation
- Replace the temporary workers.dev canonical URL, sitemap URL, and social-sharing metadata after confirming a custom domain
- Ask the owner before making any guarantee or hallmark claim
- Confirm the request privacy notice, data-retention process, and applicable privacy requirements before launch
- Not yet run: browser testing, Lighthouse, screenshots at 375/768/1280 px
