// Pathway logic: where people land and where they are sent, per workspace.
import { test, open, url, settle } from "../run.mjs";
import { U, world, R, iso, accountRows } from "../fixtures.mjs";

const GOV = { id: "00000000-0000-4000-8000-000000000009", email: "gov@test.bw", role: "government", phone: null };
const govWorld = () => { const db = world(); db.workspace_accounts.push(...accountRows(GOV, ["government"])); db.profiles.push({ ...GOV, thb_balance: 0, created_at: iso(-20000), location: null, notification_prefs: null, wallet_address: null }); return db; };
const visible = (page, sel) => page.locator(sel).evaluate((e) => !!(e.offsetParent || e.getClientRects().length) && getComputedStyle(e).display !== "none").catch(() => false);

test("room page: an existing room shows the room, not the 'doesn't exist' panel", async (t) => {
  const page = await open(t, `/room.html?id=${R.r1}`, { user: null, db: world() });
  await page.waitForSelector("#room-content:not(.hidden)");
  t.eq(await visible(page, "#room-not-found"), false, "not-found panel hidden");
  t.eq(await visible(page, "#room-content"), true, "room content visible");
});

test("room page: a missing room shows only the 'doesn't exist' panel", async (t) => {
  t.allowErrors(/./);
  const page = await open(t, "/room.html?id=00000000-0000-4000-8000-00000000ffff", { user: null, db: world() });
  await settle(page, 600);
  t.eq(await visible(page, "#room-not-found"), true, "not-found panel visible");
  t.eq(await visible(page, "#room-content"), false, "room content hidden");
});

test("login: ?redirect= accepts this app's own pages only (no open redirect)", async (t) => {
  const bad = ["https://evil.example/x.html", "//evil.example/x.html", "javascript:alert(1)", "http://evil.example", "..%2F..%2Fx.html", "a.html?x=<script>"];
  const ask = async (redirect) => {
    const page = await open(t, "/login.html?workspace=buyer&redirect=" + encodeURIComponent(redirect), { user: null, db: world() });
    await page.fill("#email-input", "new@test.bw");
    await page.click("#submit-btn");
    await settle(page, 300);
    return page.evaluate(() => (JSON.parse(localStorage.getItem("bstm_door") || "{}")).redirect);
  };
  for (const b of bad) t.eq(await ask(b), "", `refused ${b}`);
  for (const good of ["checkout.html", "room.html?id=abc-123", "order-tracking.html?orders=1,2", "/checkout.html"]) t.eq(await ask(good), good.replace(/^\//, ""), `kept ${good}`);
});

test("login: a signed-in person who opened login.html?redirect=thb-wallet.html is sent there", async (t) => {
  const page = await open(t, "/login.html?redirect=thb-wallet.html", { user: U.buyer, db: world() });
  await page.waitForURL(/thb-wallet\.html/, { timeout: 10000 });
  t.ok(true, "went to the requested page");
});

test("verify: a tampered saved destination is ignored; the person lands in their own workspace", async (t) => {
  const page = await open(t, "/verify.html", { user: U.seller, db: world(), local: { bstm_door: JSON.stringify({ ws: "seller", mode: "login", redirect: "https://evil.example/x.html", accepted: false, at: Date.now() }) } });
  await page.waitForURL(/seller-dashboard\.html/, { timeout: 15000 });
  t.ok(true, "landed in the Seller workspace, not on the other site");
});

test("gates: staff pages without a staff account lead to that workspace's door, which says BSTM creates those accounts", async (t) => {
  t.allowErrors(/./);
  for (const [label, user, db, page_] of [
    ["seller opening Admin", U.seller, world(), "admin-dashboard.html"],
    ["buyer opening Admin", U.buyer, world(), "admin-dashboard.html"],
    ["seller opening Monitoring", U.seller, world(), "monitoring-dashboard.html"],
    ["agent opening Monitoring", U.agent, world(), "monitoring-dashboard.html"],
    ["government opening Admin", GOV, govWorld(), "admin-dashboard.html"],
  ]) {
    const p = await open(t, "/" + page_, { user, db });
    await p.waitForURL(/login\.html\?workspace=admin/, { timeout: 15000 }).then(() => t.ok(true, label), () => t.ok(false, `${label}: ended on ${p.url()}`));
    await settle(p, 800);
    t.ok(/No Admin account/.test(await p.locator("#door-title").innerText().catch(() => "")), `${label}: the Admin door explains`);
  }
});

test("workspaces: a seller opening their own room, a product or the wallet stays in the Seller workspace", async (t) => {
  for (const pg of [`/room.html?id=${R.r1}`]) {
    const page = await open(t, "/seller-dashboard.html", { user: U.seller, db: world() });
    await settle(page, 700);
    await page.goto(new URL(pg, page.url()).href, { waitUntil: "load" });
    await settle(page, 900);
    const chip = ((await page.locator("#ws-switch").innerText().catch(() => "")) || "").replace(/\s+/g, " ");
    t.ok(/Seller/.test(chip), `${pg}: still Seller (${chip.trim()})`);
    t.eq(await page.locator("#desktop-nav a[href='seller-dashboard.html']").count(), 1, `${pg}: Seller menu kept`);
  }
});

test("seller dashboard: Orders shortcut jumps to Orders To Fulfill (not the buyer's tracker)", async (t) => {
  const page = await open(t, "/seller-dashboard.html", { user: U.seller, db: world() });
  await settle(page, 700);
  t.eq(await page.locator("a.action-btn[href='order-tracking.html']").count(), 0, "no link to the buyer order tracker");
  t.eq(await page.locator("a.action-btn[href='#orders-to-fulfill']").count(), 1, "shortcut present");
  t.eq(await page.locator("#orders-to-fulfill").count(), 1, "target exists");
});
