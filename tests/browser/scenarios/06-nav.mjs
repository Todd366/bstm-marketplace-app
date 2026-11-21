import { test, open, settle } from "../run.mjs";
import { U, world } from "../fixtures.mjs";

const vis = (page, sel) => page.locator(sel).evaluateAll((els) => els.map((e) => e.style.display !== "none"));

for (const [label, user, expected] of [
  ["logged out", null, false], ["buyer", U.buyer, false], ["seller", U.seller, false], ["agent", U.agent, false],
  ["admin", U.admin, true], ["super_admin", U.superAdmin, true],
]) {
  test(`nav: Payments link ${expected ? "is shown to" : "is hidden from"} ${label} (desktop + mobile menu)`, async (t) => {
    const page = await open(t, "/index.html", { user, db: world() });
    await page.waitForSelector("#desktop-nav a");
    await settle(page, 700);
    t.eq(await vis(page, '#desktop-nav a[href="admin-payments.html"]'), [expected], "desktop link");
    t.eq(await vis(page, '#mobile-menu a[href="admin-payments.html"]'), [expected], "mobile menu link");
    const adminLink = label === "agent" || expected;
    t.eq(await vis(page, '#desktop-nav a[href="admin-dashboard.html"]'), [adminLink], "Admin link unchanged (agent, admin, super_admin)");
    t.eq(await vis(page, '#desktop-nav a[href="gov-dashboard.html"]'), [label === "super_admin"], "Control Center unchanged (super_admin only)");
  });
}

test("nav: on a phone, the admin opens the menu and sees Payments; a buyer does not", async (t) => {
  for (const [user, expected] of [[U.admin, true], [U.buyer, false]]) {
    const page = await open(t, "/index.html", { user, db: world() });
    await page.setViewportSize({ width: 390, height: 800 });
    await page.waitForSelector("#menu-btn"); await settle(page, 600);
    await page.click("#menu-btn");
    await page.waitForSelector("#mobile-menu.open");
    t.eq(await page.locator('#mobile-menu a[href="admin-payments.html"]').isVisible(), expected, `${user.role}: Payments link visible in the open phone menu`);
  }
});

// ---- grouped navigation (release 2d): Shop / Sell / Me / Admin / Help ----
const topLevelVisible = (page) =>
  page.locator("#desktop-nav > a, #desktop-nav > details").evaluateAll((els) =>
    els.filter((e) => e.style.display !== "none").map((e) => (e.tagName === "DETAILS" ? e.querySelector("summary").innerText : e.innerText).trim()));

test("nav: logged-out visitor sees only Marketplace, Farm and Help (no Sell/Me/Admin groups, no Cart)", async (t) => {
  const page = await open(t, "/index.html", { user: null, db: world() });
  await page.waitForSelector("#desktop-nav a"); await settle(page, 500);
  t.eq(await topLevelVisible(page), ["Marketplace", "Farm", "Help"], "top-level items");
});

test("nav: buyer sees Marketplace, Farm, CabLink, THB Wallet, Cart, Sell, Me, Help (no Admin); Sell holds only Open a Room", async (t) => {
  const page = await open(t, "/index.html", { user: U.buyer, db: world() });
  await page.waitForSelector("#desktop-nav a"); await settle(page, 700);
  t.eq(await topLevelVisible(page), ["Marketplace", "Farm", "CabLink", "THB Wallet", "Cart", "Sell", "Me", "Help"], "top-level items");
  await page.click("#desktop-nav details:has(a[href='open-room.html']) summary");
  t.eq(await page.locator("#desktop-nav .nav-menu a[href='open-room.html']").isVisible(), true, "Open a Room visible");
  t.eq(await page.locator("#desktop-nav .nav-menu a[href='seller-dashboard.html']").isVisible(), false, "Seller Dashboard hidden from a buyer");
  t.eq(await page.locator("#desktop-nav .nav-menu a[href='upload-product.html']").isVisible(), false, "Add Product hidden from a buyer");
});

test("nav: seller sees the full Sell menu; admin sees the Admin group", async (t) => {
  let page = await open(t, "/index.html", { user: U.seller, db: world() });
  await page.waitForSelector("#desktop-nav a"); await settle(page, 700);
  await page.click("#desktop-nav details:has(a[href='open-room.html']) summary");
  for (const h of ["seller-dashboard.html", "upload-product.html", "counter.html", "daily-sheet.html", "earnings.html", "analytics.html", "open-room.html"]) {
    t.eq(await page.locator(`#desktop-nav .nav-menu a[href='${h}']`).isVisible(), true, `seller sees ${h}`);
  }
  t.ok(!(await topLevelVisible(page)).includes("Admin"), "seller has no Admin group");
  page = await open(t, "/index.html", { user: U.admin, db: world() });
  await page.waitForSelector("#desktop-nav a"); await settle(page, 700);
  t.ok((await topLevelVisible(page)).includes("Admin"), "admin has the Admin group");
});

test("nav: dropdown closes on outside click and on Escape; only one open at a time", async (t) => {
  const page = await open(t, "/index.html", { user: U.seller, db: world() });
  await page.waitForSelector("#desktop-nav a"); await settle(page, 700);
  const sell = "#desktop-nav details:has(a[href='open-room.html'])", me = "#desktop-nav details:has(a[href='profile.html'])";
  await page.click(`${sell} summary`);
  t.eq(await page.locator(sell).evaluate((e) => e.open), true, "Sell opens");
  await page.click(`${me} summary`);
  t.eq([await page.locator(sell).evaluate((e) => e.open), await page.locator(me).evaluate((e) => e.open)], [false, true], "opening Me closes Sell");
  await page.keyboard.press("Escape");
  t.eq(await page.locator(me).evaluate((e) => e.open), false, "Escape closes");
  await page.click(`${me} summary`);
  await page.click("h1, main, body", { position: { x: 5, y: 400 } });
  t.eq(await page.locator(me).evaluate((e) => e.open), false, "outside click closes");
});

test("nav: current page is highlighted (aria-current) in the menu", async (t) => {
  const page = await open(t, "/marketplace.html", { user: U.buyer, db: world() });
  await page.waitForSelector("#desktop-nav a"); await settle(page, 700);
  t.eq(await page.locator("#desktop-nav a[href='marketplace.html']").getAttribute("aria-current"), "page", "Mall is current");
  t.eq(await page.locator("#desktop-nav a[href='farm.html'], #desktop-nav a[href='agriculture.html']").first().getAttribute("aria-current"), null, "Farm is not");
});

test("nav: cart count badge follows the real cart (desktop + phone menu)", async (t) => {
  const cart = [{ id: "a", name: "A", price: 10, qty: 2 }, { id: "b", name: "B", price: 5, qty: 3 }];
  let page = await open(t, "/index.html", { user: U.buyer, db: world(), cart });
  await page.waitForSelector("#desktop-nav a"); await settle(page, 700);
  t.eq((await page.locator("#desktop-nav .nav-cart-count").innerText()).trim(), "5", "desktop badge shows 5");
  t.eq((await page.locator("#mobile-menu .nav-cart-count").textContent()).trim(), "5", "phone menu badge shows 5");
  page = await open(t, "/index.html", { user: U.buyer, db: world() });
  await page.waitForSelector("#desktop-nav a"); await settle(page, 700);
  t.eq(await page.locator("#desktop-nav .nav-cart-count").isVisible(), false, "empty cart: no badge");
});

test("nav: phone menu is grouped under section headings, filtered by role", async (t) => {
  const heads = (page) => page.locator("#mobile-menu .mm-head").evaluateAll((els) => els.filter((e) => e.style.display !== "none").map((e) => e.textContent.trim()));
  let page = await open(t, "/index.html", { user: null, db: world() });
  await page.setViewportSize({ width: 390, height: 800 });
  await page.waitForSelector("#menu-btn"); await settle(page, 600);
  t.eq(await heads(page), ["Shop", "Help"], "logged out sections");
  page = await open(t, "/index.html", { user: U.admin, db: world() });
  await page.setViewportSize({ width: 390, height: 800 });
  await page.waitForSelector("#menu-btn"); await settle(page, 700);
  t.eq(await heads(page), ["Shop", "Sell", "My Account", "Admin", "Help"], "admin sections");
  page = await open(t, "/index.html", { user: U.buyer, db: world() });
  await page.setViewportSize({ width: 390, height: 800 });
  await page.waitForSelector("#menu-btn"); await settle(page, 700);
  t.eq(await heads(page), ["Shop", "Sell", "My Account", "Help"], "buyer sections");
});
