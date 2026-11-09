import { test, open, url, text, bodyText, dbOf, scen, settle } from "../run.mjs";
import { U, world, onlineOrder, groupFor } from "../fixtures.mjs";

const ready = (page) => page.waitForSelector("#order-content:not(.hidden)");
const banner = (page) => text(page, "#order-banner-title");
const panelVisible = (page) => page.locator("#payment-panel").evaluate((e) => !e.classList.contains("hidden"));
const ref = (o) => "BSTM-" + o.id.split("-")[0].toUpperCase();

async function track(t, build, opts = {}) {
  const db = world();
  const o = build(db);
  const page = await open(t, `/order-tracking.html?order=${o.id}`, { user: opts.user || U.buyer, db, scen: opts.scen });
  await ready(page);
  await settle(page, 250);
  return { page, o, db };
}

test("order-tracking: unpaid online order -> 'Waiting for payment', Pay now link, no driver requested", async (t) => {
  const { page, o } = await track(t, (db) => onlineOrder(db, { provider: "dpo", pay: "unpaid" }));
  t.eq(await text(page, "#order-number"), ref(o), "order reference");
  t.eq(await banner(page), "Waiting for payment", "banner");
  t.eq(await panelVisible(page), true, "payment panel shown");
  t.eq(await text(page, "#payment-panel-title"), "Payment needed", "panel title");
  t.eq(await text(page, "#payment-panel-btn"), "Pay now", "button label");
  t.eq(await page.locator("#payment-panel-btn").getAttribute("href"), `payment-status.html?orders=${o.id}`, "no group yet -> link by order id");
  t.has(await text(page, "#payment-state"), "Awaiting payment", "payment badge");
  t.eq(await text(page, "#payment-method"), "DPO Pay", "method label");
  t.has(await text(page, "#order-timeline"), "Waiting for your payment", "timeline first step says waiting for payment");
  t.eq(await page.locator("#thb-box").isVisible(), false, "THB reward box hidden until paid");
  t.has(await text(page, "#cablink-driver-status"), "A driver is requested once your payment is confirmed", "driver text");
  t.eq(await page.locator("#cablink-send-btn").isVisible(), false, "no manual send button before payment");
  t.eq((await dbOf(page)).delivery_requests[0].cablink_ride_id, null, "no ride created for an unpaid order");
});

test("order-tracking: payment in progress -> 'View payment' goes to the group page", async (t) => {
  const { page, o, db } = await track(t, (db) => { const o = onlineOrder(db, { provider: "mascom_myzaka", pay: "pending" }); groupFor(db, { provider: "mascom_myzaka", status: "awaiting_confirmation", orders: [o], reference: "R-1234" }); return o; });
  t.eq(await banner(page), "Payment in progress", "banner");
  t.eq(await text(page, "#payment-panel-title"), "Payment in progress", "panel");
  t.eq(await text(page, "#payment-panel-btn"), "View payment", "button");
  t.ok((await page.locator("#payment-panel-btn").getAttribute("href")).startsWith("payment-status.html?group="), "link carries the group id");
  t.has(await text(page, "#payment-state"), "Payment in progress", "badge");
});

test("order-tracking: failed payment -> 'Try again', order still reserved", async (t) => {
  const { page } = await track(t, (db) => onlineOrder(db, { provider: "dpo", pay: "failed" }));
  t.eq(await text(page, "#payment-panel-title"), "Payment didn't go through", "panel");
  t.eq(await text(page, "#payment-panel-btn"), "Try again", "button");
  t.has(await text(page, "#payment-panel-text"), "still reserved", "says order is still reserved");
  t.has(await text(page, "#payment-state"), "Payment failed", "badge");
});

test("order-tracking: payment under review -> do not pay again, no action button", async (t) => {
  const { page } = await track(t, (db) => { const o = onlineOrder(db, { provider: "dpo", pay: "review" }); groupFor(db, { provider: "dpo", status: "review", orders: [o], reason: "amount_mismatch" }); return o; });
  t.eq(await banner(page), "Payment under review", "banner");
  t.has(await text(page, "#order-banner-sub"), "don't pay again", "banner warns not to pay again");
  t.eq(await text(page, "#payment-panel-title"), "Payment under review", "panel");
  t.has(await text(page, "#payment-state"), "Payment under review", "badge");
});

test("order-tracking: paid online order -> confirmed, CabLink request is sent automatically, once", async (t) => {
  const { page, o } = await track(t, (db) => onlineOrder(db, { provider: "dpo", pay: "paid", status: "confirmed" }));
  await page.waitForSelector("text=Sent to a CabLink driver");
  t.eq(await banner(page), "Payment received — order confirmed", "banner");
  t.eq(await panelVisible(page), false, "no payment panel once paid");
  t.has(await text(page, "#payment-state"), "Paid", "badge");
  t.eq(await page.locator("#thb-box").isVisible(), true, "reward box shown");
  const d = await dbOf(page);
  t.ok(!!d.delivery_requests[0].cablink_ride_id, "delivery request now has a CabLink ride");
  t.eq(d.delivery_requests.length, 1, "page did not create extra delivery requests");
});

test("order-tracking: paid order, CabLink down -> buyer sees it is saved and can send it later", async (t) => {
  t.allowErrors(/CabLink dispatch/);
  const { page } = await track(t, (db) => onlineOrder(db, { provider: "dpo", pay: "paid", status: "confirmed" }), { scen: { cablinkDown: true } });
  await page.waitForSelector("#cablink-send-btn:visible");
  t.has(await text(page, "#cablink-driver-status"), "couldn't take the delivery request just now", "message");
  await scen(page, { cablinkDown: false });
  await page.click("#cablink-send-btn");
  await page.waitForSelector("text=Sent to a CabLink driver");
  t.eq(await page.locator("#cablink-send-btn").isVisible(), false, "button hidden after success");
  t.ok(!!(await dbOf(page)).delivery_requests[0].cablink_ride_id, "ride created by the manual send");
});

test("order-tracking: cancelled unpaid online order -> items released, no payment panel, no badge, no driver", async (t) => {
  const { page } = await track(t, (db) => onlineOrder(db, { provider: "dpo", pay: "failed", status: "cancelled" }));
  t.eq(await banner(page), "Order Cancelled", "banner");
  t.has(await text(page, "#order-timeline"), "released back to the shop", "timeline explains the release");
  t.eq(await panelVisible(page), false, "no payment panel");
  t.eq(await text(page, "#payment-state"), "", "no payment badge");
  t.has(await text(page, "#cablink-driver-status"), "no driver will be sent", "driver text");
});

test("order-tracking: cancelled + refunded / cancelled + review keep a payment note", async (t) => {
  const a = await track(t, (db) => onlineOrder(db, { provider: "dpo", pay: "refunded", status: "cancelled" }));
  t.eq(await text(a.page, "#payment-panel-title"), "Payment refunded", "refunded panel");
  t.has(await text(a.page, "#payment-state"), "Refunded", "refunded badge");
  const b = await track(t, (db) => onlineOrder(db, { provider: "dpo", pay: "review", status: "cancelled" }));
  t.eq(await text(b.page, "#payment-panel-title"), "Payment under review", "review panel");
  t.has(await text(b.page, "#payment-panel-text"), "don't pay again", "review text");
});

test("order-tracking: Cash on Delivery order is untouched by the payment changes", async (t) => {
  const { page } = await track(t, (db) => onlineOrder(db, { provider: "cod", pay: "unpaid", status: "pending" }));
  t.eq(await banner(page), "Order Placed Successfully!", "banner");
  t.eq(await panelVisible(page), false, "no payment panel");
  t.eq(await text(page, "#payment-state"), "", "no badge");
  t.eq(await text(page, "#payment-method"), "Cash on Delivery", "label");
  t.eq(await page.locator("#thb-box").isVisible(), true, "reward box shown");
  t.has(await text(page, "#order-timeline"), "Your order has been received.", "normal timeline text");
});

test("order-tracking: self-pickup order shows no driver section", async (t) => {
  const { page } = await track(t, (db) => onlineOrder(db, { provider: "dpo", pay: "paid", status: "confirmed", delivery: "pickup", withRequest: false }));
  t.eq(await page.locator("#cablink-driver-section").isVisible(), false, "driver section hidden");
});

test("order-tracking: list shows payment badges only where they matter", async (t) => {
  const db = world();
  const a = onlineOrder(db, { provider: "dpo", pay: "unpaid" });
  const b = onlineOrder(db, { provider: "dpo", pay: "paid", status: "confirmed" });
  const c = onlineOrder(db, { provider: "cod", pay: "unpaid" });
  const d = onlineOrder(db, { provider: "dpo", pay: "failed", status: "cancelled" });
  const page = await open(t, "/order-tracking.html", { user: U.buyer, db });
  await page.waitForSelector("#orders-list a");
  const card = (o) => page.locator(`#orders-list a[href="order-tracking.html?order=${o.id}"]`).innerText().then((s) => s.replace(/\s+/g, " "));
  t.has(await card(a), "Awaiting payment", "unpaid online order has the badge");
  t.has(await card(b), "Paid", "paid order has the badge");
  t.eq((await card(c)).includes("Awaiting payment"), false, "COD has no badge");
  t.eq((await card(d)).includes("Payment failed"), false, "cancelled never-paid order has no badge");
  t.eq(await page.locator("#orders-list a").count(), 4, "all four orders listed");
});

test("order-tracking: someone else's order is not shown; logged out goes to login", async (t) => {
  const db = world();
  const o = onlineOrder(db, { provider: "dpo", pay: "unpaid" });
  const page = await open(t, `/order-tracking.html?order=${o.id}`, { user: U.buyer2, db });
  await page.waitForSelector("#order-not-found:not(.hidden)");
  t.eq(await page.locator("#order-content").isVisible(), false, "no order content for another buyer");
  const out = await open(t, `/order-tracking.html?order=${o.id}`, { user: null, db });
  await out.waitForURL(/login\.html/);
  t.ok(true, "redirected to login");
});

test("order-tracking: hostile text in order fields is escaped", async (t) => {
  const { page } = await track(t, (db) => { const o = onlineOrder(db, { provider: "dpo", pay: "unpaid" }); o.delivery_name = '<img id=pwn src=x onerror="window.__xss=1">'; o.delivery_method = '<b id=pwn2>x</b>'; db.order_items[0].product_name = '<i id=pwn3>y</i>'; return o; });
  t.eq(await page.evaluate(() => window.__xss), undefined, "no script ran");
  t.eq(await page.locator("#pwn, #pwn2, #pwn3").count(), 0, "no injected elements");
});

test("order-tracking: an unpaid order refreshes itself when the payment is confirmed", async (t) => {
  const { page, o } = await track(t, (db) => onlineOrder(db, { provider: "dpo", pay: "unpaid" }));
  t.eq(await banner(page), "Waiting for payment", "starts waiting");
  // the page re-reads every 30s while unpaid; simulate the passage of time by firing its timer now
  await page.evaluate(() => { window.__DB.orders.forEach((o) => { o.payment_status = "paid"; o.status = "confirmed"; }); sessionStorage.setItem("__DB", JSON.stringify(window.__DB)); });
  await page.clock?.runFor?.(31000).catch(() => {});
  await page.waitForFunction(() => document.getElementById("order-banner-title").textContent.startsWith("Payment received"), null, { timeout: 40000 });
  t.eq(await banner(page), "Payment received — order confirmed", "banner updated without a reload");
});
