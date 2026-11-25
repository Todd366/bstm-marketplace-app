// One account per workspace: the front door (welcome), each workspace's own door (login), the page gate, registration,
// recorded Terms acceptance, and strict separation. Drives the real pages; the database side is proven separately
// (database/migrations/20261122_stage3_workspace_accounts.sql).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, open, settle, dbOf, url } from "../run.mjs";
import { U, world, accountRows, TERMS_VERSION } from "../fixtures.mjs";
import { PAGE_WORKSPACE } from "../../../js/core/workspaces.js";

const NEWBIE = { id: "00000000-0000-4000-8000-0000000000a1", email: "newbie@test.bw", role: "buyer", phone: null };
const withNewbie = (db) => { db.profiles.push({ ...NEWBIE, thb_balance: 0, created_at: "2026-11-20T00:00:00Z", location: null, notification_prefs: null, wallet_address: null }); return db; };
const without = (db, user, ws) => { db.workspace_accounts = db.workspace_accounts.filter((r) => !(r.user_id === user.id && r.workspace === ws)); return db; };
const sellerOnly = () => without(world(), U.seller, "buyer");
const buyerOnly = () => world(); // U.buyer holds Buyer only
const setRow = (db, user, ws, patch) => { Object.assign(db.workspace_accounts.find((r) => r.user_id === user.id && r.workspace === ws), patch); return db; };
const accountsOf = async (page, user) => (await dbOf(page)).workspace_accounts.filter((r) => r.user_id === user.id);
const text = (page, sel) => page.locator(sel).innerText().then((x) => x.replace(/\s+/g, " ").trim());
const visible = (page, sel) => page.locator(sel).isVisible();
const where = (page) => { const u = url(page); return u.pathname.replace(/^\//, "") + u.search; };

// ------------------------------------------------------------------ the front door
test("welcome: explains the workspaces; Buyer and Seller can sign in or create an account; staff can only sign in", async (t) => {
  const page = await open(t, "/welcome.html", { user: null, db: world(), local: { bstm_welcomed: "" } });
  await settle(page, 500);
  t.eq(await page.$$eval("#chooser .w-card", (e) => e.map((x) => x.dataset.workspace)), ["buyer", "seller"], "two self-service workspaces");
  t.eq(await page.$$eval("#chooser a", (a) => a.map((x) => x.getAttribute("href"))), ["login.html?workspace=buyer", "login.html?workspace=buyer&mode=register", "login.html?workspace=seller", "login.html?workspace=seller&mode=register"], "each has its own sign-in and create-account door");
  t.eq(await page.$$eval("#staff-links a", (a) => a.map((x) => x.getAttribute("href"))), ["login.html?workspace=agent", "login.html?workspace=admin", "login.html?workspace=government"], "staff doors: sign-in only");
  t.ok(/own account/i.test(await text(page, "main")), "says each workspace has its own account");
  t.eq(await page.evaluate(() => localStorage.getItem("bstm_welcomed")), "1", "the browser is marked as welcomed");
});

test("welcome: the start page sends a first-time visitor here once", async (t) => {
  let page = await open(t, "/index.html", { user: null, db: world(), local: { bstm_welcomed: "" } });
  await page.waitForURL(/welcome\.html/, { timeout: 10000 });
  t.ok(true, "first visit goes to welcome.html");
  page = await open(t, "/index.html", { user: null, db: world() });
  await settle(page, 800);
  t.eq(where(page), "index.html", "a welcomed browser stays on the Mall start page");
});

test("welcome: signed in, it shows only the workspaces you can open and offers the ones you can create", async (t) => {
  const page = await open(t, "/welcome.html", { user: U.buyer, db: world() });
  await settle(page, 700);
  t.eq(await page.$$eval("#chooser a", (a) => a.map((x) => x.getAttribute("href"))), ["login.html?workspace=buyer", "login.html?workspace=seller&mode=register"], "Open Buyer, Create Seller");
  t.eq(await visible(page, "#staff"), false, "no staff doors for someone with no staff account");
  t.ok(/buyer@test\.bw/.test(await text(page, "#signed-in-bar")), "shows who is signed in");
});

// ------------------------------------------------------------------ a workspace's own door
test("door: Buyer door signs in or creates an account; creating requires the Terms and sends the link", async (t) => {
  const page = await open(t, "/login.html?workspace=buyer", { user: null, db: world() });
  await settle(page, 500);
  t.ok(/Buyer sign-in/.test(await text(page, "#door-title")), "Buyer sign-in");
  t.eq(await visible(page, "#tabs"), true, "can switch to Create account");
  t.eq(await visible(page, "#terms-row"), false, "no Terms box when signing in");
  await page.click("#tab-register");
  t.eq(await visible(page, "#terms-row"), true, "Terms box when creating");
  t.ok(/mode=register/.test(page.url()), "the mode is in the address");
  await page.fill("#email-input", "newbie@test.bw");
  await page.click("#submit-btn");
  t.ok(/accept the Terms/i.test(await text(page, "#status")), "refused without accepting the Terms");
  t.eq(await page.evaluate(() => JSON.parse(sessionStorage.getItem("__OTP") || "[]").length), 0, "no link sent");
  await page.check("#terms-check");
  await page.click("#submit-btn");
  await settle(page, 400);
  const sent = await page.evaluate(() => JSON.parse(sessionStorage.getItem("__OTP") || "[]"));
  t.eq(sent.length, 1, "one link sent");
  t.eq(sent[0].email, "newbie@test.bw", "to that email");
  t.eq(sent[0].options.emailRedirectTo, new URL(page.url()).origin + "/verify.html", "link target is exactly verify.html (no query)");
  const intent = await page.evaluate(() => JSON.parse(localStorage.getItem("bstm_door")));
  t.eq([intent.ws, intent.mode, intent.accepted], ["buyer", "register", true], "what was asked is remembered for the link");
});

test("door: staff doors have no create-account option and say BSTM creates those accounts", async (t) => {
  for (const ws of ["agent", "admin", "government"]) {
    const page = await open(t, `/login.html?workspace=${ws}&mode=register`, { user: null, db: world() });
    await settle(page, 400);
    t.eq(await visible(page, "#tabs"), false, `${ws}: no Create account tab`);
    t.eq(await visible(page, "#terms-row"), false, `${ws}: no Terms box (nothing to create)`);
    t.ok(/created by BSTM/.test(await text(page, "#door-sub")), `${ws}: says BSTM creates the account`);
  }
});

test("door: which door? named, implied by the page being asked for, or chosen first", async (t) => {
  let page = await open(t, "/login.html", { user: null, db: world() });
  await page.waitForURL(/welcome\.html/, { timeout: 10000 });
  t.ok(true, "no workspace named: the chooser");
  page = await open(t, "/login.html?redirect=checkout.html", { user: null, db: world() });
  await settle(page, 400);
  t.ok(/Buyer sign-in/.test(await text(page, "#door-title")), "checkout.html belongs to Buyer");
  page = await open(t, "/login.html?redirect=earnings.html", { user: null, db: world() });
  await settle(page, 400);
  t.ok(/Seller sign-in/.test(await text(page, "#door-title")), "earnings.html belongs to Seller");
  page = await open(t, "/login.html?redirect=admin-dashboard.html", { user: null, db: world() });
  await page.waitForURL(/welcome\.html\?redirect=admin-dashboard\.html/, { timeout: 10000 });
  t.ok(true, "a page two workspaces share (Admin and Agent): the person chooses, the destination is kept");
});

test("door: signing in lands in THAT workspace and never on a page of another one", async (t) => {
  let page = await open(t, "/login.html?workspace=seller", { user: U.seller, db: world() });
  await page.waitForURL(/seller-dashboard\.html/, { timeout: 10000 });
  t.ok(true, "Seller door -> Seller home");
  page = await open(t, "/login.html?workspace=seller&redirect=earnings.html", { user: U.seller, db: world() });
  await page.waitForURL(/earnings\.html/, { timeout: 10000 });
  t.ok(true, "a Seller page asked for is honoured");
  page = await open(t, "/login.html?workspace=seller&redirect=checkout.html", { user: U.seller, db: world() });
  await page.waitForURL(/seller-dashboard\.html/, { timeout: 10000 });
  t.ok(true, "a Buyer page asked for at the Seller door is ignored");
  t.eq(await page.evaluate(() => JSON.parse(sessionStorage.getItem("bstm_workspace_now")).ws), "seller", "the tab works in Seller");
});

// ------------------------------------------------------------------ registration: one account per workspace
test("register: a seller who wants to shop must create a Buyer account (Terms required, recorded)", async (t) => {
  const page = await open(t, "/login.html?workspace=buyer", { user: U.seller, db: sellerOnly() });
  await settle(page, 700);
  t.ok(/Create your Buyer account/.test(await text(page, "#door-title")), "asks to create the Buyer account");
  t.eq(await page.locator("#act-btn").isDisabled(), true, "disabled until the Terms are accepted");
  await page.check("#act-terms-check");
  await page.click("#act-btn");
  await page.waitForURL(/buyer-dashboard\.html/, { timeout: 10000 });
  const rows = await accountsOf(page, U.seller);
  const buyer = rows.find((r) => r.workspace === "buyer");
  t.eq([buyer.status, buyer.registered_via, buyer.terms_version], ["active", "self", TERMS_VERSION], "Buyer account recorded with the Terms version");
  t.ok(!!buyer.terms_accepted_at, "and when it was accepted");
  t.eq(rows.map((r) => r.workspace).sort(), ["buyer", "seller"], "the Seller account is untouched");
  await settle(page, 700);
  t.eq(await page.evaluate(() => window.BSTM.workspaces()), ["buyer", "seller"], "now holds both, so the switch is offered");
});

test("register: a buyer who wants to sell creates a Seller account at the Seller door", async (t) => {
  const page = await open(t, "/login.html?workspace=seller&mode=register", { user: U.buyer, db: buyerOnly() });
  await settle(page, 700);
  t.ok(/Create your Seller account/.test(await text(page, "#door-title")), "asks to create the Seller account");
  await page.check("#act-terms-check");
  await page.click("#act-btn");
  await page.waitForURL(/seller-dashboard\.html/, { timeout: 10000 });
  t.eq((await accountsOf(page, U.buyer)).map((r) => r.workspace).sort(), ["buyer", "seller"], "Seller account created next to Buyer");
});

test("register: staff accounts cannot be created here", async (t) => {
  const page = await open(t, "/login.html?workspace=admin", { user: U.buyer, db: world() });
  await settle(page, 700);
  t.ok(/No Admin account/.test(await text(page, "#door-title")), "says there is no Admin account");
  t.ok(/created by BSTM/.test(await text(page, "#door-sub")), "and who creates it");
  t.eq(await visible(page, "#act-btn"), false, "no button to create one");
  t.eq((await accountsOf(page, U.buyer)).map((r) => r.workspace), ["buyer"], "nothing was created");
  // the server refuses it too (the RPC the door would call)
  const err = await page.evaluate(async () => { const { supabase } = await import("/js/core/supabase-client.js"); const r = await supabase.rpc("register_workspace", { p_workspace: "admin", p_terms_version: "x" }); return r.error && r.error.message; });
  t.ok(/created by BSTM/.test(err || ""), "register_workspace refuses staff workspaces");
});

test("register: the emailed link finishes what was asked at the door", async (t) => {
  const intent = (o) => ({ bstm_door: JSON.stringify({ ws: "seller", mode: "register", redirect: "", accepted: true, at: Date.now(), ...o }) });
  // a buyer who asked to create a Seller account and ticked the Terms
  let page = await open(t, "/verify.html", { user: U.buyer, db: buyerOnly(), local: intent({}) });
  await page.waitForURL(/seller-dashboard\.html/, { timeout: 15000 });
  t.eq((await accountsOf(page, U.buyer)).filter((r) => r.workspace === "seller").length, 1, "Seller account created by the link");
  // a brand-new person who asked for a Buyer account
  page = await open(t, "/verify.html", { user: NEWBIE, db: withNewbie(world()), local: intent({ ws: "buyer" }) });
  await page.waitForURL(/buyer-dashboard\.html/, { timeout: 15000 });
  const rows = await accountsOf(page, NEWBIE);
  t.eq(rows.map((r) => r.workspace), ["buyer"], "a new person gets exactly the account they asked for");
  t.eq(rows[0].terms_version, TERMS_VERSION, "with the Terms recorded");
  // a brand-new person whose link opened in another browser (nothing remembered): chosen at the front door, nothing assumed
  page = await open(t, "/verify.html", { user: NEWBIE, db: withNewbie(world()) });
  await page.waitForURL(/welcome\.html/, { timeout: 15000 });
  t.eq((await accountsOf(page, NEWBIE)).length, 0, "no account is invented");
  // asked for a staff workspace they do not hold: back to that door, which explains
  page = await open(t, "/verify.html", { user: U.buyer, db: world(), local: intent({ ws: "admin", mode: "login", accepted: false }) });
  await page.waitForURL(/login\.html\?workspace=admin/, { timeout: 15000 });
  t.ok(true, "sent to the Admin door");
});

// ------------------------------------------------------------------ the page gate
test("gate: a page of a workspace you hold no account in sends you to that workspace's door", async (t) => {
  let page = await open(t, "/marketplace.html", { user: U.seller, db: sellerOnly() });
  await page.waitForURL(/login\.html\?workspace=buyer/, { timeout: 10000 });
  t.ok(true, "a seller without a Buyer account cannot browse the Buyer workspace");
  page = await open(t, "/seller-dashboard.html", { user: U.buyer, db: world() });
  await page.waitForURL(/login\.html\?workspace=seller&redirect=seller-dashboard\.html/, { timeout: 10000 });
  t.ok(true, "a buyer is sent to the Seller door, and brought back after");
  page = await open(t, "/buyer-dashboard.html", { user: U.agent, db: world() });
  await page.waitForURL(/login\.html\?workspace=buyer/, { timeout: 10000 });
  t.ok(true, "an agent has no Buyer account either");
  page = await open(t, "/profile.html", { user: NEWBIE, db: withNewbie(world()) });
  await page.waitForURL(/welcome\.html/, { timeout: 10000 });
  t.ok(true, "no account anywhere: the front door");
  page = await open(t, "/marketplace.html", { user: null, db: world() });
  await settle(page, 700);
  t.eq(where(page), "marketplace.html", "the public Mall stays open to visitors");
});

test("gate: updated Terms must be accepted again; the acceptance is recorded", async (t) => {
  const db = setRow(world(), U.buyer, "buyer", { terms_version: "2026-01-01" });
  const page = await open(t, "/buyer-dashboard.html", { user: U.buyer, db });
  await page.waitForURL(/login\.html\?workspace=buyer&redirect=buyer-dashboard\.html/, { timeout: 10000 });
  t.ok(/Updated Terms/.test(await text(page, "#door-title")), "asks to accept the new Terms");
  t.ok(new RegExp(TERMS_VERSION).test(await text(page, "#door-sub")), "names the version");
  await page.check("#act-terms-check");
  await page.click("#act-btn");
  await page.waitForURL(/buyer-dashboard\.html$/, { timeout: 10000 });
  const row = (await accountsOf(page, U.buyer)).find((r) => r.workspace === "buyer");
  t.eq(row.terms_version, TERMS_VERSION, "the new version is recorded");
  await settle(page, 700);
  t.eq(where(page), "buyer-dashboard.html", "and the person is not asked again");
});

test("gate: an account with no recorded acceptance (migrated) is asked once, in plain words", async (t) => {
  const db = setRow(world(), U.seller, "seller", { terms_version: null, terms_accepted_at: null, registered_via: "migrated" });
  const page = await open(t, "/seller-dashboard.html", { user: U.seller, db });
  await page.waitForURL(/login\.html\?workspace=seller&redirect=seller-dashboard\.html/, { timeout: 10000 });
  t.ok(/Accept the Terms/.test(await text(page, "#door-title")), "first acceptance, not called an update");
  t.ok(/records your acceptance/.test(await text(page, "#door-sub")), "says it is recorded");
  await page.check("#act-terms-check");
  await page.click("#act-btn");
  await page.waitForURL(/seller-dashboard\.html$/, { timeout: 10000 });
  const row = (await accountsOf(page, U.seller)).find((r) => r.workspace === "seller");
  t.eq([row.terms_version, row.registered_via], [TERMS_VERSION, "migrated"], "acceptance recorded; the account keeps its origin");
});

test("gate: a suspended account gets no workspace and a plain message", async (t) => {
  const db = setRow(world(), U.buyer, "buyer", { status: "suspended" });
  const page = await open(t, "/buyer-dashboard.html", { user: U.buyer, db });
  await page.waitForURL(/login\.html\?workspace=buyer/, { timeout: 10000 });
  t.ok(/suspended/i.test(await text(page, "#door-title")), "says the account is suspended");
  t.eq(await visible(page, "#act-btn"), false, "nothing to click");
});

test("gate: if the accounts table cannot be read nobody is locked out (the older rule applies)", async (t) => {
  const page = await open(t, "/seller-dashboard.html", { user: U.seller, db: world(), scen: { accountsDown: true } });
  await settle(page, 1200);
  t.eq(where(page), "seller-dashboard.html", "a seller still reaches the Seller workspace");
  t.eq(await page.evaluate(() => window.BSTM.workspaces()), ["buyer", "seller"], "by the role rule");
});

// ------------------------------------------------------------------ separation + logout
test("logout: leaves nothing of the workspaces behind and returns to the front door", async (t) => {
  const page = await open(t, "/buyer-dashboard.html", { user: U.buyer, db: world() });
  await settle(page, 900);
  t.ok(await page.evaluate(() => !!localStorage.getItem("bstm_workspace")), "workspace remembered while signed in");
  await page.evaluate(() => window.BSTM.logout());
  await page.waitForURL(/welcome\.html/, { timeout: 10000 });
  t.eq(await page.evaluate(() => [localStorage.getItem("bstm_workspace"), sessionStorage.getItem("bstm_workspace_now"), localStorage.getItem("bstm_door")]), [null, null, null], "nothing remembered");
});

test("separation: no page of one workspace links to a page of another", async (t) => {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const ws = (p) => [].concat(PAGE_WORKSPACE[p] || []);
  const srcs = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).map((f) => [f, f]);
  for (const f of fs.readdirSync(path.join(ROOT, "js/pages"))) srcs.push([f.replace(/\.js$/, ".html"), "js/pages/" + f]);
  const bad = [];
  for (const [page, file] of srcs) {
    const own = ws(page);
    if (!own.length || page === "index.html") continue;
    const src = fs.readFileSync(path.join(ROOT, file), "utf8");
    for (const m of src.matchAll(/([A-Za-z0-9-]+\.html)/g)) {
      const target = m[1].toLowerCase(); const tw = ws(target);
      if (!tw.length || target === page || tw.some((x) => own.includes(x))) continue;
      // a redirect used only as "where to go when this page is not for you" is allowed to name the chooser, nothing else
      bad.push(`${file} -> ${target}`);
    }
  }
  t.eq([...new Set(bad)], [], "no cross-workspace links in any page or page script");
});

// ------------------------------------------------------------------ staff sessions end when idle
test("idle: Admin, Agent and Government sessions end after 30 minutes without activity; Buyer and Seller do not", async (t) => {
  const ago = (min) => ({ bstm_last_active: String(Date.now() - min * 60000) });
  let page = await open(t, "/admin-dashboard.html", { user: U.admin, db: world(), local: ago(31) });
  await page.waitForURL(/welcome\.html\?reason=idle/, { timeout: 10000 });
  t.eq(await visible(page, "#idle-note"), true, "says why");
  t.eq(await page.evaluate(() => sessionStorage.getItem("__SIGNED_OUT")), "1", "signed out");
  page = await open(t, "/admin-dashboard.html", { user: U.admin, db: world(), local: ago(5) });
  await settle(page, 1200);
  t.eq(where(page), "admin-dashboard.html", "5 minutes idle: still signed in");
  page = await open(t, "/seller-dashboard.html", { user: U.seller, db: world(), local: ago(120) });
  await settle(page, 1200);
  t.eq(where(page), "seller-dashboard.html", "a seller is not timed out");
  page = await open(t, "/buyer-dashboard.html", { user: U.buyer, db: world(), local: ago(120) });
  await settle(page, 1200);
  t.eq(where(page), "buyer-dashboard.html", "a buyer is not timed out");
});
