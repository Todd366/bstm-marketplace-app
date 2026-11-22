import { test, open, settle } from "../run.mjs";
import { U, R, world } from "../fixtures.mjs";

// Five workspaces (Buyer, Seller, Agent, Admin, Government): each has its own menu, home page and pages.
// js/core/workspaces.js is the single definition; these scenarios drive the real pages.

const GOV = { id: "00000000-0000-4000-8000-000000000009", email: "gov@test.bw", role: "government", phone: null };
const staffBuyer = () => { const db = world(); db.room_roles.push({ id: "rr-1", room_id: R.r1, user_id: U.buyer.id, role_id: "EMPLOYEE" }); return db; };
const govWorld = () => { const db = world(); db.profiles.push({ ...GOV, thb_balance: 0, created_at: "2026-01-01T00:00:00Z", location: null, notification_prefs: null, wallet_address: null }); return db; };

const top = (page) =>
  page.locator("#desktop-nav > a, #desktop-nav > details").evaluateAll((els) =>
    els.map((e) => (e.tagName === "DETAILS" ? e.querySelector("summary").innerText : (e.childNodes[0].textContent || e.innerText)).trim()));
const inMore = (page) => page.locator("#desktop-nav .nav-menu a").evaluateAll((els) => els.map((e) => e.textContent.trim()));
const where = (page) => page.evaluate(() => document.getElementById("bstm-nav-bar").dataset.workspace);
const chip = async (page) => (await page.locator("#ws-switch .ws-chip").innerText()).replace(/\s+/g, " ").trim();
const count = (page, sel) => page.locator(sel).count();
async function ready(page, w = 800) { await page.waitForSelector("#desktop-nav a"); await settle(page, w); }
async function phone(page) { await page.setViewportSize({ width: 390, height: 800 }); await page.waitForSelector("#menu-btn"); await settle(page, 700); await page.click("#menu-btn"); await page.waitForSelector("#mobile-menu.open"); }
const ADMIN_ONLY = ["admin-dashboard.html", "admin-payments.html", "monitoring-dashboard.html", "gov-dashboard.html"];
const SELLER_ONLY = ["seller-dashboard.html", "upload-product.html", "counter.html", "daily-sheet.html", "earnings.html", "analytics.html"];

test("workspaces: a logged-out visitor sees the public menu only and no workspace switch", async (t) => {
  const page = await open(t, "/index.html", { user: null, db: world() });
  await ready(page, 500);
  t.eq(await top(page), ["Marketplace", "Farm", "Help"], "public menu");
  t.eq(await where(page), "public", "no workspace");
  t.eq(await page.locator("#ws-switch").isVisible(), false, "switch hidden");
  await phone(page);
  t.eq(await page.locator("#mobile-menu .ws-phone").count(), 0, "no workspace block on the phone menu");
});

test("workspaces: a buyer has only the Buyer workspace; no seller or admin page appears in any menu", async (t) => {
  const page = await open(t, "/buyer-dashboard.html", { user: U.buyer, db: world() });
  await ready(page);
  t.eq(await where(page), "buyer", "workspace");
  t.eq(await chip(page), "🛍️ Buyer", "chip");
  t.eq(await top(page), ["Mall", "Farm", "CabLink", "My Orders", "Wallet", "Cart", "More"].map((x) => x).map((x) => (x === "Mall" ? "Marketplace" : x === "Wallet" ? "THB Wallet" : x)), "buyer menu");
  for (const h of [...ADMIN_ONLY, ...SELLER_ONLY]) t.eq(await count(page, `#desktop-nav a[href="${h}"], #mobile-menu a[href="${h}"]`), 0, `${h} not in the buyer's menus`);
  await page.click("#ws-switch summary");
  t.eq(await page.locator("#ws-switch .ws-option[href='open-room.html']").isVisible(), true, "a buyer is offered 'Start selling'");
  t.eq(await count(page, "#ws-switch .ws-option[data-ws]"), 0, "no other workspace to switch to");
});

test("workspaces: a seller works in a Seller workspace with no buyer clutter, and switches to Buyer and back", async (t) => {
  const page = await open(t, "/seller-dashboard.html", { user: U.seller, db: world() });
  await ready(page, 1000);
  t.eq(await where(page), "seller", "workspace");
  t.eq(await chip(page), "🏪 Seller", "chip");
  t.eq(await top(page), ["My Room", "Add Product", "Counter Sale", "Daily Sheet", "Earnings", "More"], "seller menu");
  t.eq(await inMore(page), ["Analytics", "Messages", "Help"], "More group");
  for (const h of ["checkout.html", "thb-wallet.html", "wishlist.html", "cablink.html", ...ADMIN_ONLY]) t.eq(await count(page, `#desktop-nav a[href="${h}"]`), 0, `${h} is not in the Seller menu`);
  await page.click("#ws-switch summary");
  await page.click("#ws-switch .ws-option[data-ws='buyer']");
  await page.waitForURL(/buyer-dashboard\.html/);
  await ready(page, 1000);
  t.eq(await where(page), "buyer", "now Buyer");
  t.eq(await count(page, '#desktop-nav a[href="counter.html"]'), 0, "no Counter Sale in the Buyer menu");
  await page.goto(new URL("/settings.html", page.url()).href);
  await ready(page, 1000);
  t.eq(await where(page), "buyer", "a shared account page keeps the workspace you were in");
  await page.goto(new URL("/earnings.html", page.url()).href);
  await ready(page, 1000);
  t.eq(await where(page), "seller", "a seller page puts you in the Seller workspace");
  await page.goto(new URL("/marketplace.html", page.url()).href);
  await ready(page, 1000);
  await page.goto(new URL("/messages.html", page.url()).href);
  await ready(page, 1000);
  t.eq(await where(page), "buyer", "after browsing the Mall, a shared page stays in Buyer");
});

test("workspaces: room staff keep profiles.role buyer but get the Seller workspace", async (t) => {
  const page = await open(t, "/buyer-dashboard.html", { user: U.buyer, db: staffBuyer() });
  await ready(page, 1200);
  await page.click("#ws-switch summary");
  t.eq(await page.locator("#ws-switch .ws-option[data-ws='seller']").isVisible(), true, "Seller offered to room staff");
  t.eq(await page.evaluate(() => window.BSTM.workspaceHome()), "seller-dashboard.html", "their login home is the Seller workspace");
});

test("workspaces: an agent has an Agent workspace with only the agent desk", async (t) => {
  const page = await open(t, "/admin-dashboard.html", { user: U.agent, db: world() });
  await ready(page, 1000);
  t.eq(await where(page), "agent", "workspace");
  t.eq(await top(page), ["Agent Desk", "Messages", "Help"], "agent menu");
  for (const h of ["admin-payments.html", "gov-dashboard.html", "monitoring-dashboard.html"]) t.eq(await count(page, `#desktop-nav a[href="${h}"], #mobile-menu a[href="${h}"]`), 0, `${h} not shown to an agent`);
  await page.click("#ws-switch summary");
  t.eq(await page.locator("#ws-switch .ws-option[data-ws='buyer']").isVisible(), true, "an agent can still switch to Buyer");
});

for (const [label, user, withControl] of [["admin", U.admin, false], ["super_admin", U.superAdmin, true]]) {
  test(`workspaces: ${label} has an Admin workspace (Payments${withControl ? ", Control Center" : ""})`, async (t) => {
    const page = await open(t, "/admin-payments.html", { user, db: world() });
    await ready(page, 1000);
    t.eq(await where(page), "admin", "workspace");
    t.eq(await top(page), ["Admin", "Payments", "Monitoring", ...(withControl ? ["Control Center"] : []), "Help"], "admin menu");
    t.eq(await count(page, '#desktop-nav a[href="gov-dashboard.html"]'), withControl ? 1 : 0, "Control Center is super_admin only");
    t.eq(await count(page, "#desktop-nav a[href='checkout.html']"), 0, "no Cart in the Admin workspace");
    t.eq(await page.evaluate(() => window.BSTM.workspaceHome()), "admin-dashboard.html", "login home");
  });
}

test("workspaces: government has a Government workspace with Monitoring only", async (t) => {
  const page = await open(t, "/monitoring-dashboard.html", { user: GOV, db: govWorld() });
  await ready(page, 1000);
  t.eq(await where(page), "government", "workspace");
  t.eq(await top(page), ["Monitoring", "Help"], "government menu");
  t.eq(await page.evaluate(() => window.BSTM.workspaceHome()), "monitoring-dashboard.html", "login home");
});

test("workspaces: login home for every kind of person", async (t) => {
  for (const [label, user, db, home] of [
    ["buyer", U.buyer, world(), "buyer-dashboard.html"], ["seller", U.seller, world(), "seller-dashboard.html"],
    ["agent", U.agent, world(), "admin-dashboard.html"], ["admin", U.admin, world(), "admin-dashboard.html"],
    ["government", GOV, govWorld(), "monitoring-dashboard.html"],
  ]) {
    const page = await open(t, "/help.html", { user, db });
    await ready(page, 900);
    t.eq(await page.evaluate(() => window.BSTM.workspaceHome()), home, `${label} lands in ${home}`);
  }
});

test("workspaces: signing in sends a seller straight to the Seller workspace", async (t) => {
  const page = await open(t, "/login.html", { user: U.seller, db: world() });
  await page.waitForURL(/seller-dashboard\.html/, { timeout: 10000 });
  t.ok(true, "redirected to seller-dashboard.html");
});

test("workspaces: the cart count belongs to the Buyer workspace only", async (t) => {
  const cart = [{ id: "a", name: "A", price: 10, qty: 2 }, { id: "b", name: "B", price: 5, qty: 3 }];
  let page = await open(t, "/marketplace.html", { user: U.buyer, db: world(), cart });
  await ready(page);
  t.eq((await page.locator("#desktop-nav .nav-cart-count").innerText()).trim(), "5", "desktop badge");
  await phone(page);
  t.eq((await page.locator("#mobile-menu .nav-cart-count").textContent()).trim(), "5", "phone badge");
  page = await open(t, "/marketplace.html", { user: U.buyer, db: world() });
  await ready(page);
  t.eq(await page.locator("#desktop-nav .nav-cart-count").isVisible(), false, "empty cart: no badge");
  page = await open(t, "/seller-dashboard.html", { user: U.seller, db: world(), cart });
  await ready(page, 1000);
  t.eq(await count(page, ".nav-cart-count"), 0, "no cart badge in the Seller workspace");
});

test("workspaces: the switch and More menus close on outside click and Escape; one open at a time", async (t) => {
  const page = await open(t, "/seller-dashboard.html", { user: U.seller, db: world() });
  await ready(page, 1000);
  const sw = "#ws-switch details", more = "#desktop-nav details";
  await page.click(`${sw} summary`);
  t.eq(await page.locator(sw).evaluate((e) => e.open), true, "switch opens");
  await page.click(`${more} summary`);
  t.eq([await page.locator(sw).evaluate((e) => e.open), await page.locator(more).evaluate((e) => e.open)], [false, true], "opening More closes the switch");
  await page.keyboard.press("Escape");
  t.eq(await page.locator(more).evaluate((e) => e.open), false, "Escape closes");
  await page.click(`${more} summary`);
  await page.click("body", { position: { x: 5, y: 500 } });
  t.eq(await page.locator(more).evaluate((e) => e.open), false, "outside click closes");
});

test("workspaces: the page you are on is highlighted in its own menu", async (t) => {
  const page = await open(t, "/earnings.html", { user: U.seller, db: world() });
  await ready(page, 1000);
  t.eq(await page.locator("#desktop-nav a[href='earnings.html']").getAttribute("aria-current"), "page", "Earnings is current");
  t.eq(await page.locator("#desktop-nav a[href='counter.html']").getAttribute("aria-current"), null, "Counter Sale is not");
});

test("workspaces: phone menu shows the workspace, a switch between workspaces, then only that workspace's links and the account pages", async (t) => {
  const page = await open(t, "/seller-dashboard.html", { user: U.seller, db: world() });
  await ready(page, 1000);
  await phone(page);
  t.eq((await page.locator("#mobile-menu .ws-phone-label").innerText()).trim().includes("Seller"), true, "workspace named at the top");
  t.eq(await page.locator("#mobile-menu .ws-seg").evaluateAll((els) => els.map((e) => e.dataset.ws)), ["buyer", "seller"], "switch buttons");
  t.eq(await page.locator("#mobile-menu a[href='counter.html']").isVisible(), true, "Counter Sale in the Seller phone menu");
  t.eq(await count(page, "#mobile-menu a[href='checkout.html'], #mobile-menu a[href='thb-wallet.html']"), 0, "no buyer links");
  t.eq(await page.locator("#mobile-menu a[href='settings.html']").isVisible(), true, "account pages are always there");
  await page.click("#mobile-menu .ws-seg[data-ws='buyer']");
  await page.waitForURL(/buyer-dashboard\.html/);
  t.ok(true, "phone switch goes to the Buyer home");
});

test("workspaces: the user menu holds only personal pages (no workspace pages)", async (t) => {
  const page = await open(t, "/seller-dashboard.html", { user: U.seller, db: world() });
  await ready(page, 1000);
  const hrefs = await page.locator("#nav-user-dropdown a").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  t.eq(hrefs, ["profile.html", "settings.html", "notifications-all.html", "kyc-verification.html"], "personal pages only");
});

test("workspaces: the workspace you choose with the switch is where the next login starts", async (t) => {
  const page = await open(t, "/seller-dashboard.html", { user: U.seller, db: world() });
  await ready(page, 1000);
  t.eq(await page.evaluate(() => window.BSTM.workspaceHome()), "seller-dashboard.html", "default for a seller");
  await page.click("#ws-switch summary");
  await page.click("#ws-switch .ws-option[data-ws='buyer']");
  await page.waitForURL(/buyer-dashboard\.html/);
  await ready(page, 1000);
  t.eq(await page.evaluate(() => window.BSTM.workspaceHome()), "buyer-dashboard.html", "after choosing Buyer, login starts in Buyer");
});

for (const [label, user, db, path] of [
  ["buyer", U.buyer, () => world(), "/marketplace.html"], ["seller", U.seller, () => world(), "/seller-dashboard.html"],
  ["agent", U.agent, () => world(), "/admin-dashboard.html"], ["admin", U.superAdmin, () => world(), "/admin-payments.html"],
  ["government", GOV, govWorld, "/monitoring-dashboard.html"],
]) {
  test(`workspaces: the ${label} header fits a small phone (360 and 390 px wide, no sideways scrolling)`, async (t) => {
    const page = await open(t, path, { user, db: db() });
    await ready(page, 1000);
    for (const w of [360, 390]) {
      await page.setViewportSize({ width: w, height: 760 });
      await settle(page, 300);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      t.ok(over <= 0, `${w}px: no horizontal overflow (over by ${over}px)`);
      t.eq(await page.locator("#ws-switch .ws-chip").isVisible(), true, `${w}px: workspace chip visible`);
    }
  });
}

const footer = (page) => page.locator("#footer-quick-links a, #footer-support-links a").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
test("workspaces: the footer follows the workspace (no Seller Dashboard for a buyer, no Buyer Dashboard for a seller, no Login once signed in)", async (t) => {
  let page = await open(t, "/marketplace.html", { user: null, db: world() });
  await page.waitForSelector("#footer-support-links a"); await settle(page, 500);
  t.eq(await footer(page), ["index.html", "marketplace.html", "agriculture.html", "ecosystem-hub.html", "help.html", "terms.html", "login.html"], "logged out");
  page = await open(t, "/marketplace.html", { user: U.buyer, db: world() });
  await page.waitForSelector("#footer-support-links a"); await settle(page, 900);
  t.eq(await footer(page), ["index.html", "marketplace.html", "buyer-dashboard.html", "thb-wallet.html", "ecosystem-hub.html", "help.html", "terms.html"], "buyer");
  page = await open(t, "/seller-dashboard.html", { user: U.seller, db: world() });
  await page.waitForSelector("#footer-support-links a"); await settle(page, 900);
  t.eq(await footer(page), ["seller-dashboard.html", "upload-product.html", "counter.html", "earnings.html", "help.html", "terms.html"], "seller");
  page = await open(t, "/admin-dashboard.html", { user: U.agent, db: world() });
  await page.waitForSelector("#footer-support-links a"); await settle(page, 900);
  t.eq(await footer(page), ["admin-dashboard.html", "help.html", "terms.html"], "agent");
  page = await open(t, "/admin-dashboard.html", { user: U.admin, db: world() });
  await page.waitForSelector("#footer-support-links a"); await settle(page, 900);
  t.eq(await footer(page), ["admin-dashboard.html", "admin-payments.html", "monitoring-dashboard.html", "help.html", "terms.html"], "admin");
});
