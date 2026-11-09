# archive/ — files moved out of the live tree

Nothing here is loaded by any page, the service worker, `manifest.json`, `vercel.json`, `_headers` or `sitemap.xml`.
Moved with `git mv`, so history is intact (`git log --follow archive/<path>`).
To bring a file back: `git mv archive/<path> <original path>`.

**How "unreferenced" was established (VERIFIED, 2026-11-08, tree at commit e59022d + payments work):**
every tracked `.html` / `.js` / `.mjs` / `.sh` / `.yml` file was searched for the candidate's file name (and its name without extension)
in every other tracked file; dynamic loading (`createElement('script')`, `import()`, `importScripts`) was searched for;
the service worker's cache list only names `index.html`, `manifest.json`, `css/tailwind.css` and one CDN stylesheet.
After the move a link checker walked every `src` / `href` / `import` in the live tree: no reference points at a moved file
(the 42 hits it reports are `components/*.html` links that are written relative to the page that includes them, and all of them exist from the site root; the same 41 are reported on the old tree).

## Browser scripts (`archive/js/`)

| File | What it was built for | Salvage if rebuilt |
|---|---|---|
| `ab-testing.js` | Client-side A/B variant picker | Idea only. Needs server-side assignment + the `events` table to mean anything. |
| `advanced-search.js` | Fuzzy search, filters, sorting over products | Filter/sort UI ideas. Real search belongs in a Supabase query (see `pages/global-search.js`). |
| `analytics-tracking.js` | `gtag` wrapper for Google Analytics | The wrapper is trivial. No GA property is configured, so nothing was reporting. |
| `cache-manager.js` | Browser Cache Storage helper (open / clear caches) | Superseded by `sw.js` (network-first). |
| `image-lazy-load.js` | `IntersectionObserver` lazy images for `img[data-src]` | Works as is. Browsers now do this natively with `loading="lazy"`. |
| `infinite-scroll.js` | Page-by-page loader callback | Reusable pattern for long product lists. |
| `location-services.js` | Geolocation for delivery / nearby products | Useful when CabLink pickup/drop-off needs coordinates. |
| `performance-optimizer.js` | Lazy images, deferred non-critical scripts, page prefetch | Superseded by `sw.js` and `loading="lazy"`. |
| `push-notifications.js` | Notification permission + service-worker notifications | No push subscription / VAPID key in it. `sw.js` already has the `push` and `notificationclick` handlers; real push needs a server that sends them. |
| `qr-code-generator.js` | QR codes for order verification (loads qrcode.js from a CDN) | Order pickup/hand-over verification. |
| `qr-generator.js` | QR for referrals and payments | Referral QR once referrals are real. |
| `share-api.js` | `navigator.share` wrapper | Share-a-room / share-a-product buttons. |
| `voice-search.js` | Web Speech API search | Idea only. Needs a real search first. |
| `dark-mode.js` | Theme toggle with persistence | Pages are not built with theme variables, so it would only repaint some of them. |
| `mobile-optimization.js` | Its header says: responsive navigation, PWA install prompts, mobile gestures (touch swipe to close the menu is in it) | Revive the install prompt together with `manifest.json` if wanted. |
| `thb-rewards.js` | Login streaks, milestones and a reward log, all kept in `localStorage` (it makes no database call, so it never paid out anything real) | **Do not revive as is.** Anything stored in the browser can be edited by the user. Rewards must be issued by the database (see ROADMAP: reward trigger). Keep it only to see which behaviours were meant to earn THB. |

## Page scripts and pages (`archive/js/pages/`, `archive/html/`)

| File | What it was | Note |
|---|---|---|
| `js/pages/global-search.js` | Search box for `components/global-search.html` | Its own header says it is fake: it always answers "No results". `components/global-search.html` is still in `components/` and is also unreferenced. |
| `js/pages/universal-footer.js` | Footer loader | Duplicate of what `components/smart-loader.js` does. |
| `js/pages/order-success.js` + `html/order-success.html` | The old "order placed" page | Checkout now goes to `order-tracking.html` (cash on delivery) or `payment-status.html` (online). Nothing links to it. |
| `js/pages/navbar.js` | 4-line stub under `js/pages/frontend/public/components/` | Logged one line. |

## Scripts and automation

| File | What it was | Note |
|---|---|---|
| `scripts/backup-script.sh` | Daily database backup via cron | Contains `YOUR_PROJECT_ID` placeholder: never configured. As far as I know the Supabase free tier has no scheduled backups (UNKNOWN until checked in the dashboard); see ROADMAP. |
| `scripts/test-supabase.mjs` | One-off connection test | Holds the **publishable** (anon) key, which is public by design. Needs `@supabase/supabase-js` installed to run. |
| `patch-scripts/bstm_patch*.sh`, `deploy.sh` | Termux heredoc scripts that wrote whole files into the repo (roles tier, footer link, SQL migrations, a base64 copy of `js/bstm-core.js`) | **Running any of them would overwrite current files with old versions.** Kept for history only. The SQL they wrote is already in `database/`. |
| `github-workflows/deploy.yml` | GitHub Actions: HTMLHint, secret grep, deploy to GitHub Pages (`bstm.bw`), Telegram notice | INFERRED to have been failing: its first step is `npm ci`, and `package-lock.json` is in `.gitignore` so it is not in the repo. Production is on Vercel. Its secret scan (`pk_live_` + 20 chars) is worth keeping in a new, working workflow (ROADMAP). |

## Not archived on purpose

* `js/core/elosEvents.js` — nothing imports it today, but it is the seam that sends real transaction events to ELOS. Wiring it in is an integration task, not cleanup.
* `tailwind.config.js` — needed to rebuild `css/tailwind.css` (`npm run build:css`).
* `404.html`, `sitemap.xml`, `robots.txt`, `_headers` — served by Vercel without being linked.

## Also changed in the same commit

* `.env.production` is **untracked** (`git rm --cached`). `.gitignore` already listed it, but it had been committed. Its Paystack values have the shape `pk_live_aaaa-aaaa-aaa-aaaa` (hyphenated words), which is how a placeholder looks, not a real key (INFERRED; the values were deliberately not printed). The file stays on disk, ignored.
