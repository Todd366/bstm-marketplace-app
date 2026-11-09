# BSTM Digital Mall — ROADMAP

Written 2026-11-09 by Claude (senior-architect session) for Todd. The next session must **re-inspect before trusting this file**: it is context, not proof.
Lines in "My rules" and "Decisions only I can make" are Todd's own statements, in first person. Everything else is Claude's finding.

Labels: **CONFIRMED** (seen in live data/code) · **VERIFIED** (checked by running something) · **INFERRED** (reasoned, not run) · **PROPOSED** (suggestion) · **UNKNOWN** (needs a fact) · **BLOCKED** (cause named).

---

## 1. My rules (Todd)

- I want builds, not talk. I verify before anything is called fixed. Free tier only. I do not want anything I cancelled re-routed. I must not be promoted to super_admin. No database function is dropped without my explicit approval.
- I am non-technical and only paste Termux bash blocks. Every deploy is ONE complete, self-contained block: never "the block above", never placeholders.
- I want to be told things in code blocks. The explanation lives in this roadmap.
- CabLink, ELOS, Activation and Forge share the Supabase project (`tvtfxkavjqvurdezhyvu`). They are mine too, but this repo does not change them.
- If a database call comes back `{"status":"cancelled"}`, stop and report BLOCKED. Do not find another route.
- I want to be asked for a fact rather than have it guessed (for example the repo folder name).

## 2. State on 2026-11-09

| Fact | Label |
|---|---|
| Production (Vercel project `prj_2l5sAzKK6qDNA84cSRvmerhFIZW9`) = commit `e59022d`, state READY. No newer production deployment exists. | VERIFIED (Vercel, 2026-11-09) |
| Edge functions: `payments` v2 (verify_jwt off, JWT checked inside), `dispatch-to-cablink` v10, `paystack-webhook` v10 (stale; the Paystack path is not used). | VERIFIED |
| 0 payment providers switched on, 0 `payment_groups`, 15 orders and all are cash on delivery, 0 delivery requests handed to CabLink. Cron `payments-expire-stale` is active. | VERIFIED |
| 0 users have role `super_admin`. | VERIFIED |
| 58 tables in `public`. Old `database/schema.sql` and `database/schema/*.sql` are stale against them. | VERIFIED / CONFIRMED |
| Reward trigger does not exist; `credit_purchase_reward` does not check that the order is delivered; 10 order rewards exist in `wallet_ledger` and 8 of them are for orders that are not delivered. | VERIFIED |
| Security advisors: 1 ERROR `seller_public_info` exposes auth.users data to anon; 2 ERROR security-definer views (`seller_public_info`, `seller_verification`); 22 SECURITY DEFINER functions executable by anon; 46 by signed-in users; leaked-password protection off; `pg_net` in `public`. The 35 "RLS enabled, no policy" notices are `activation.*` (another project) and the server-only payment tables (intended). | VERIFIED (advisor run 2026-11-09) |

## 3. What this release (payments frontend) is

The server side of payments was already live and unused. This release adds the pages that ask it to work:

- `checkout` (online methods come from the database; the provider is checked **before** stock is reserved; at most 20 rooms per online payment; no CabLink hand-off until paid), `payment-status` (new), `order-tracking`, `seller-dashboard`, `buyer-dashboard`, `admin-dashboard`, `admin-payments` (new; admin and super_admin only), nav links.
- Money rules stay on the server. The pages only ask, show, and send the buyer to the right place.

**Browser-test evidence (VERIFIED, 2026-11-09):** 78 scenarios, 498 checks, 0 failed, in real Chromium. Mutation checks confirm the tests fail when page logic is broken (seller revenue filter, admin 24h filter, CabLink auto-dispatch, admin role gate, confirm tick, onboarding gate).
**What that does not prove:** the Supabase client is a stand-in that rejects unknown tables and columns; the server's behaviour is emulated from the live function definitions; **row-level security is not emulated**; no real signed-in session on production has run; no real payment gateway has been called.

**Real bugs the tests found and this release fixes**
1. Seller "Total Revenue" counted cancelled orders and online orders nobody had paid for. Now only counts non-cancelled orders that are cash-on-delivery or paid. "Orders Received" is unchanged.
2. `thb-wallet.html` had no sign-in wall: a logged-out visitor saw an empty wallet. Now sent to login and brought back.
3. Test harness: the edge-call log was lost on every page change (test tool only).

**Housekeeping in the same release:** 29 unreferenced files moved to `archive/` (index in `archive/ARCHIVE_INDEX.md`); `.env.production` untracked (it was in `.gitignore` but committed; its values look like placeholders — INFERRED); `tests/browser/` added.

## 4. Turning payments on (in this order)

1. Release this code. Nothing changes for buyers: every provider is off, so checkout offers cash on delivery only (VERIFIED in test: "every provider off → only Cash on Delivery").
2. **Manual rails first** (MyZaka/Mascom, Smega/BTC, bank EFT): need no keys. Open Payments (admin) → the method → fill in the instructions, account number and USSD → Save → Switch on. I need to give: the merchant number or bank details and the wording buyers should see. UNKNOWN: the exact names of "Real something" and "Upstart"; any manual rail can be added from the page, a gateway needs their API documents.
3. Walk one real order through it with a test buyer: place → pay → send reference → staff confirm → order becomes paid/confirmed → CabLink request. The staff-confirm step is a person and the admin page is where it happens.
4. **Gateways** (DPO, Orange Money) need secrets set in Supabase (names only are shown on the page; values never): DPO `DPO_COMPANY_TOKEN`, `DPO_SERVICE_TYPE`; Orange `ORANGE_CLIENT_ID`, `ORANGE_CLIENT_SECRET`, `ORANGE_MERCHANT_KEY`, `ORANGE_COUNTRY`. The page refuses to switch a gateway on while a secret is missing.
5. Both gateway adapters are **UNEXERCISED** against a real sandbox. DPO result-code mapping came from third-party sources (UNVERIFIED against DPO's own documents). Whether Orange Botswana offers this payment API is UNKNOWN. DPO declined my offer; I want it ready for later, not live now.

## 5. Work still to do

### Before real money moves (PROPOSED order)
| # | Item | Label / state |
|---|---|---|
| 1 | **Reward trigger.** `credit_purchase_reward` has no order-state check; 8 of 10 existing rewards are for orders that were not delivered. Fix: trigger `award_purchase_reward_on_delivery` after update of `status` on `orders` (1% of item total, once per order, checked through `wallet_ledger`), harden the function to return `order_not_delivered`, catch-up for delivered orders. | **BLOCKED**: the database confirmation gate cancelled it. Needs my explicit approval, or I paste the SQL in the Supabase SQL editor myself. Not re-routed. |
| 2 | **Batch-1 migration** (staff privilege/PII hole, `seller_public_info`, `set_user_role`, `agent_permissions`, reward + stock restore, notifications). Saved in the project as `claude/batch1-migration-unapplied.md`. | **BLOCKED**, unapplied. Written 2026-10-16: every statement must be re-verified against today's schema first (payments added columns, triggers and functions since). |
| 3 | **Server-side CabLink dispatch after payment.** Today the hand-off runs from the buyer's browser, so it depends on the buyer coming back to the page. The dispatch function is buyer-only by design. | PROPOSED. Needs a service-role path (payments function calls dispatch after `payments_apply_outcome`). |
| 4 | **`place_order` RPC** (server-side order + stock + items in one transaction) and revoke `decrement_product_stock` / `restore_product_stock` from signed-in users. Today any signed-in user can call them for any product; a failed `order_items` insert can leave an empty order. | CONFIRMED gap, PROPOSED fix. |
| 5 | `MARKETPLACE_API_KEY` secret set on both the Mall and CabLink sides? | UNKNOWN (secrets are unreadable by tools). 0 of the 12 delivery requests ever reached CabLink (VERIFIED 2026-11-09). |
| 6 | Admin revenue figures (Gross Order Value, 5% Platform Commission, Seller Payout (est.), per-room revenue) still add up every order including cancelled and unpaid online ones. Only the top tile says "all statuses". They will mislead once online orders exist. | CONFIRMED (code), PROPOSED fix (same filter as the seller fix). |

### Security (advisors, 2026-11-09)
- `seller_public_info`: SECURITY DEFINER view exposing auth.users-derived names to anon → part of batch 1. CONFIRMED.
- 22 anon-executable and 46 signed-in-executable SECURITY DEFINER functions: most are trigger functions that should not be callable at all; a few are real RPCs (`credit_purchase_reward`, `advance_order_status`, `admin_distribute_thb`, `transfer_thb`, `request_thb_withdrawal`, `recompute_thb_balance`, `record_counter_sale`). Review each; revoke where it is not meant to be called from the browser. `recompute_thb_balance` showing no auth check is INFERRED, not tested.
- Leaked-password protection: off. A dashboard switch in Supabase Auth; free tier availability UNKNOWN.
- `pg_net` lives in `public` (advisor WARN); moving an extension can break the payments cron, so test first.
- Drops that need my explicit approval: old 6-argument `record_counter_sale`, stale `process_paystack_webhook`. 3 overloads of those two names exist today (VERIFIED).

### Features and integrations
- THB withdrawal admin queue: buyers can request a withdrawal (`request_thb_withdrawal`), there is no admin screen to action them. PROPOSED.
- CabLink status-return webhook (so order status follows the driver). PROPOSED.
- ELOS `ORDER_PLACED` event: the call was removed from checkout; `js/core/elosEvents.js` is kept in the tree for it. Re-wire from the server, not the browser. PROPOSED.
- Admin payment history / reconciliation (only things needing attention are listable today); a cron that re-checks gateway payments whose webhook never arrived. PROPOSED.
- Orange developer console: app "Bstm Digital mall", API "SMS Botswana v2.0", status Pending. What I want from it (SMS, or Orange as a payment provider) is UNKNOWN.
- Rooms model (see `claude/room-reality-tests.md` in the project): combos, loyalty, referrals, prepaid packages, quotes/catering (check Forge tables for reuse first), optional Room Group table. Only after measurement exists.
- 1 order has `room_id` NULL and is invisible to the daily sheet (VERIFIED 2026-11-09; the older register said 4).
- Real signed-in session on production (till sale, void, daily sheet, shelf product) has never been run. UNKNOWN until done.

### Repo hygiene
- **CI.** The old GitHub workflow was archived (it could not pass: `npm ci` with no lock file). Replace with a small working one: HTMLHint + a `pk_live_`/`sk_live_` secret grep + the browser tests (Playwright is not available in Termux, so CI is where they run). PROPOSED. CI run history could not be read (GitHub API 403): UNKNOWN.
- `.env.production` is untracked from this release. If it ever held a real key, that key is in git history: rotate it. UNKNOWN whether it ever did; the current values are placeholder-shaped.
- `README.md` lists files that do not exist (`bstm-auth.js`, `paystack.js`, …). Rewrite from the real tree. CONFIRMED.
- `database/schema.sql` and `database/schema/*.sql` are stale. The live database is the authority. A read-only mirror of 108 migrations (343 KB, redacted) is in the project as `claude/migrations-mirror.sql`; it was **not** added to the repo in this release because it is too large to paste through Termux in one block. PROPOSED: ship it as a zip I send you, unzipped by one block into `database/migrations/`.
- Orphans left in place: `components/global-search.html` (its script is archived and was fake), `js/pages/*` that no page loads are archived already.
- `css/tailwind.css` is a purged build: classes not already used (`uppercase`, `opacity-60`, `break-all`, …) do nothing. New pages carry their own scoped styles. Rebuild with `npm run build:css` when adding classes.

## 6. Decisions only I can make

- Approve (or not) the reward trigger SQL (BLOCKED above).
- Approve (or not) the batch-1 migration after re-verification.
- Approve (or not) each DROP listed above.
- Give: merchant numbers / bank details / wording for the manual rails; the names "Real something" and "Upstart"; whether `MARKETPLACE_API_KEY` is set; what the Orange SMS app is for.
- I am not promoted to super_admin unless I say so.

## 7. Free-tier limits to keep in mind

As far as I know (UNKNOWN until read from the dashboards): Supabase free has a small database and a monthly edge-function call allowance, pauses projects after a quiet spell, and has no scheduled backups; Vercel Hobby is for personal, non-commercial use, so check its terms before taking real money; GitHub Actions has free minutes. No paid upgrade is part of any plan here. Real Paystack is out: no bank account yet.

## 8. Ecosystem boundaries

One Supabase project serves several of my systems. Tables outside the Mall (`forge_*`, `act_*`, `activation.*`, `bwp_wallet_*`, `cablink_store`, `payment_account_connections`, `seller_payout_queue`, `analytics_events`) are other projects' or unexplored. Before building anything for payouts or wallets, inspect them first: reuse before rebuild.

## 9. How the tests work

`node tests/browser/run.mjs [name-filter]` (needs Node + Playwright, which Claude sessions have; Termux does not). It serves the repo, drives Chromium, replaces `supabase-js` with `tests/browser/harness/stub-supabase.js`, and emulates the server contract in `tests/browser/harness/backend.js`. Scenarios are in `tests/browser/scenarios/` (checkout, payment-status, order-tracking, dashboards, admin-payments, nav, wallet). `REPORT=file.json` writes the result. Update `harness/schema.cjs` from the live column list when the database changes, or the stub will wrongly accept or reject columns.

## 10. Release log

- 2026-11-09: payments frontend + seller-revenue fix + wallet sign-in + archive + tests + this roadmap. Base `e59022d`. Verified by 78 browser scenarios (498 checks) in the build sandbox; not yet pushed when this was written — check `git log` and the Vercel deployment list for the truth.
