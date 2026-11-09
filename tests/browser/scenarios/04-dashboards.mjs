import { test, open, text, bodyText, dbOf, settle } from "../run.mjs";
import { U, world, onlineOrder, groupFor, iso } from "../fixtures.mjs";

const orderCard = (page, o) => page.locator(`#seller-orders-list > *`).filter({ has: page.locator(`[data-order-id="${o.id}"]`) });

// ------------------------------------------------------------------ seller
test("seller-dashboard: unpaid online order -> 'waiting for the buyer', no Confirm button; paid order -> Confirm works", async (t) => {
  const db = world();
  const unpaid = onlineOrder(db, { provider: "dpo", pay: "unpaid" });
  const paid = onlineOrder(db, { provider: "dpo", pay: "paid", status: "confirmed" });
  const cod = onlineOrder(db, { provider: "cod", pay: "unpaid", status: "pending" });
  const page = await open(t, "/seller-dashboard.html", { user: U.seller, db });
  await page.waitForSelector("#seller-orders-list .seller-advance-btn");
  const list = await text(page, "#seller-orders-list");
  t.has(list, "Waiting for the buyer to pay", "unpaid online order says so");
  t.has(list, "Awaiting payment", "unpaid badge");
  t.has(list, "Payment: Cash on Delivery", "COD line");
  const btns = await page.locator(".seller-advance-btn").evaluateAll((b) => b.map((x) => [x.dataset.orderId, x.dataset.nextStatus]));
  t.eq(btns.map((b) => b[0]).sort(), [paid.id, cod.id].sort(), "advance buttons exist ONLY for the paid and the COD order");
  t.eq(btns.find((b) => b[0] === unpaid.id), undefined, "no advance button for the unpaid online order");
  t.eq(btns.find((b) => b[0] === paid.id)[1], "shipped", "paid+confirmed order offers Mark Shipped");
  t.eq(btns.find((b) => b[0] === cod.id)[1], "confirmed", "COD pending order offers Confirm");
  await page.click(`.seller-advance-btn[data-order-id="${cod.id}"]`);
  await page.waitForFunction((id) => window.__DB && window.__DB.orders.find((o) => o.id === id).status === "confirmed", cod.id);
  t.eq((await dbOf(page)).orders.find((o) => o.id === cod.id).status, "confirmed", "COD order advanced through the real RPC");
});

test("seller-dashboard: if the order is unpaid when Confirm is pressed, the buyer-must-pay message shows (database refuses)", async (t) => {
  t.allowErrors(/Couldn't advance order/);
  const db = world();
  const o = onlineOrder(db, { provider: "dpo", pay: "paid", status: "pending" });
  const page = await open(t, "/seller-dashboard.html", { user: U.seller, db });
  await page.waitForSelector(`.seller-advance-btn[data-order-id="${o.id}"]`);
  // payment is reversed after the page loaded (e.g. refunded / put in review)
  await page.evaluate(() => { window.__DB.orders.forEach((x) => { x.payment_status = "review"; }); });
  let msg = null; page.on("dialog", async (d) => { msg = d.message(); await d.dismiss(); });
  await page.click(`.seller-advance-btn[data-order-id="${o.id}"]`);
  await page.waitForFunction(() => true); await settle(page, 400);
  t.has(msg || "", "waiting for the buyer's payment", "friendly message instead of a raw database error");
  t.eq(await page.locator(`.seller-advance-btn[data-order-id="${o.id}"]`).isDisabled(), false, "button usable again");
  t.eq((await dbOf(page)).orders[0].status, "pending", "order not advanced");
});

test("seller-dashboard: revenue excludes cancelled orders and unpaid online orders", async (t) => {
  const db = world();
  onlineOrder(db, { provider: "dpo", pay: "paid", status: "confirmed", amount: 100 });          // counts
  onlineOrder(db, { provider: "cod", pay: "unpaid", status: "pending", amount: 40 });            // counts (cash order, existing behaviour)
  onlineOrder(db, { provider: "dpo", pay: "unpaid", status: "pending", amount: 500 });           // waiting for buyer -> no
  onlineOrder(db, { provider: "dpo", pay: "failed", status: "cancelled", amount: 700 });          // expired / cancelled -> no
  onlineOrder(db, { provider: "cod", pay: "unpaid", status: "cancelled", amount: 900 });          // cancelled cash order -> no
  const page = await open(t, "/seller-dashboard.html", { user: U.seller, db });
  await page.waitForSelector("#seller-orders-list .seller-advance-btn");
  t.eq(await text(page, "#stat-revenue"), "P140.00", "revenue = paid 100 + cash 40 only");
  t.eq(await text(page, "#stat-orders"), "5", "orders received still counts every order (unchanged)");
});

// ------------------------------------------------------------------ buyer
test("buyer-dashboard: 'waiting for payment' notice lists only unpaid online orders with the right links", async (t) => {
  const db = world();
  const a = onlineOrder(db, { provider: "dpo", pay: "unpaid" });                                   // no group -> ?orders=
  const b = onlineOrder(db, { provider: "mascom_myzaka", pay: "pending" }); groupFor(db, { provider: "mascom_myzaka", status: "pending", orders: [b] });
  onlineOrder(db, { provider: "dpo", pay: "paid", status: "confirmed" });                          // paid -> not listed
  onlineOrder(db, { provider: "cod", pay: "unpaid" });                                             // cod -> not listed
  onlineOrder(db, { provider: "dpo", pay: "failed", status: "cancelled" });                        // cancelled -> not listed
  onlineOrder(db, { buyer: U.buyer2, provider: "dpo", pay: "unpaid" });                            // someone else's
  const page = await open(t, "/buyer-dashboard.html", { user: U.buyer, db });
  await page.waitForSelector("#payment-due-notice a");
  t.has(await text(page, "#payment-due-notice"), "2 orders are waiting for payment", "count");
  const links = await page.locator("#payment-due-notice a").evaluateAll((e) => e.map((x) => [x.getAttribute("href"), x.textContent]));
  t.eq(links.length, 2, "two rows");
  t.ok(links.some(([h, l]) => h === `payment-status.html?orders=${a.id}` && l === "Pay now"), "unpaid order -> Pay now by order id");
  t.ok(links.some(([h, l]) => h.startsWith("payment-status.html?group=") && l === "View payment"), "in-progress order -> View payment by group");
});

test("buyer-dashboard: no notice when nothing is owed", async (t) => {
  const db = world();
  onlineOrder(db, { provider: "cod", pay: "unpaid" });
  onlineOrder(db, { provider: "dpo", pay: "paid", status: "confirmed" });
  const page = await open(t, "/buyer-dashboard.html", { user: U.buyer, db });
  await page.waitForSelector("text=Total Orders"); await settle(page, 600);
  t.eq(await page.locator("#payment-due-notice").isVisible(), false, "notice hidden");
});

// ------------------------------------------------------------------ admin
test("admin-dashboard: recent orders — unpaid online order can only be cancelled; paid / COD keep their actions", async (t) => {
  const db = world();
  const unpaid = onlineOrder(db, { provider: "dpo", pay: "unpaid" });
  const paid = onlineOrder(db, { provider: "dpo", pay: "paid", status: "confirmed" });
  const cod = onlineOrder(db, { provider: "cod", pay: "unpaid" });
  const page = await open(t, "/admin-dashboard.html", { user: U.admin, db });
  await page.waitForSelector("text=Recent Orders").catch(() => {});
  await settle(page, 800);
  const rows = await page.locator("[data-order-id]").evaluateAll((b) => b.map((x) => [x.dataset.orderId, x.dataset.nextStatus || x.dataset.next, x.textContent.trim()]));
  const forOrder = (o) => rows.filter((r) => r[0] === o.id).map((r) => r[2]);
  t.eq(forOrder(unpaid), ["Cancel"], "unpaid online order: Cancel only");
  t.ok(forOrder(paid).includes("Mark Shipped") && forOrder(paid).includes("Cancel"), "paid order: Mark Shipped + Cancel");
  t.ok(forOrder(cod).includes("Confirm"), "COD order: Confirm available");
  t.has((await bodyText(page)).toLowerCase(), "awaiting payment", "badge shown next to the unpaid order (page capitalises it)");
});

test("admin-dashboard: payments card counts the queue, turns red when something is in review", async (t) => {
  const db = world();
  const o1 = onlineOrder(db, { provider: "mascom_myzaka", pay: "pending" }); groupFor(db, { provider: "mascom_myzaka", status: "awaiting_confirmation", orders: [o1], reference: "MZ-1" });
  const page = await open(t, "/admin-dashboard.html", { user: U.admin, db });
  await page.waitForSelector("text=Payments to confirm or review");
  const card = page.locator("#needs-attention-list a[href='admin-payments.html']");
  t.eq((await card.innerText()).replace(/\s+/g, " ").trim().startsWith("1 Payments to confirm or review"), true, "one open payment");
  t.eq(await card.evaluate((e) => e.className.includes("bg-purple-50")), true, "neutral colour when nothing is in review");
  const db2 = world();
  const o2 = onlineOrder(db2, { provider: "dpo", pay: "review" }); groupFor(db2, { provider: "dpo", status: "review", orders: [o2], reason: "amount_mismatch" });
  const p2 = await open(t, "/admin-dashboard.html", { user: U.admin, db: db2 });
  await p2.waitForSelector("text=under review");
  const c2 = p2.locator("#needs-attention-list a[href='admin-payments.html']");
  t.has((await c2.innerText()).replace(/\s+/g, " "), "(1 under review)", "review count in the label");
  t.eq(await c2.evaluate((e) => e.className.includes("bg-red-50")), true, "red when a payment is in review");
});

test("admin-dashboard: 'pending >24h' ignores unpaid online orders but still counts stale COD orders", async (t) => {
  const db = world();
  const stale = (o) => { o.created_at = iso(-60 * 30); return o; };
  stale(onlineOrder(db, { provider: "dpo", pay: "unpaid" }));
  stale(onlineOrder(db, { provider: "cod", pay: "unpaid" }));
  const page = await open(t, "/admin-dashboard.html", { user: U.admin, db });
  await page.waitForSelector("text=unconfirmed");
  await settle(page, 600);
  const card = page.locator("#needs-attention-list > *", { hasText: "pending >24h" });
  t.eq((await card.innerText()).trim().split(/\s+/)[0], "1", "only the COD order is 'stuck'");
});

test("admin-dashboard: agent sees no payments card and no Payments button; admin sees both", async (t) => {
  const db = world();
  const agent = await open(t, "/admin-dashboard.html", { user: U.agent, db });
  await agent.waitForSelector("#needs-attention-list", { state: "attached" }); await settle(agent, 900);
  t.eq((await bodyText(agent)).includes("Payments to confirm or review"), false, "no payments card for an agent");
  t.eq(await agent.locator("a[href='admin-payments.html']").locator("visible=true").count(), 0, "no visible link to the payments page for an agent");
  const admin = await open(t, "/admin-dashboard.html", { user: U.admin, db: world() });
  await admin.waitForSelector("text=Payments to confirm or review");
  t.ok((await admin.locator("a[href='admin-payments.html']").locator("visible=true").count()) >= 1, "admin sees a link to the payments page");
});

test("admin-dashboard: queue read failing does not break the dashboard", async (t) => {
  t.allowErrors(/payment queue/);
  const db = world();
  const page = await open(t, "/admin-dashboard.html", { user: U.admin, db, scen: { queueDown: true } });
  await page.waitForSelector("#needs-attention-list", { state: "attached" }); await settle(page, 900);
  t.has(await text(page, "#needs-attention-list"), "Pending KYC reviews", "other needs-attention cards still render");
  t.eq((await bodyText(page)).includes("Payments to confirm or review"), false, "no misleading '0' card when the queue couldn't be read");
});
