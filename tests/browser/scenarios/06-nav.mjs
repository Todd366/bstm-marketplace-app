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
