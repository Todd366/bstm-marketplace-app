import { test, open, url, text, bodyText, dbOf, edgeCalls, scen, sim, settle } from "../run.mjs";
import { U, world, onlineOrder, groupFor, id } from "../fixtures.mjs";

const view = (page) => page.waitForSelector("#ps-root .ps-card");
const title = (page) => text(page, "#ps-root .ps-title");
const refresh = (page) => page.evaluate(() => { document.dispatchEvent(new Event("visibilitychange")); });

function gatewayPending({ cancel = false, checkoutUrl = undefined } = {}) {
  const db = world();
  const o = onlineOrder(db, { provider: "dpo", pay: "pending" });
  const g = groupFor(db, { provider: "dpo", status: "pending", orders: [o] });
  if (checkoutUrl !== undefined) g.checkout_url = checkoutUrl;
  return { db, o, g };
}
function manualGroup(status = "pending", extra = {}) {
  const db = world();
  const o = onlineOrder(db, { provider: "mascom_myzaka", pay: "pending", amount: 150 });
  const g = groupFor(db, { provider: "mascom_myzaka", status, orders: [o], ...extra });
  return { db, o, g };
}

test("payment-status: gateway pending shows amount, safe 'Continue to payment' link, countdown, order list", async (t) => {
  const { db, o, g } = gatewayPending();
  const page = await open(t, `/payment-status.html?group=${g.id}`, { user: U.buyer, db });
  await view(page);
  t.eq(await title(page), "Complete your payment", "title");
  t.has(await text(page, ".ps-amount"), "P100.00", "amount");
  t.eq(await page.locator("a.ps-btn", { hasText: "Continue to payment" }).getAttribute("href"), g.checkout_url, "continue link goes to the provider https URL");
  t.eq(await page.locator("#ps-check").count(), 1, "'I've paid — check now' button present");
  t.ok(/\d+ (h \d+ )?min/.test(await text(page, "#ps-countdown")), "countdown shows time left");
  t.has(await text(page, ".ps-orders"), "BSTM-" + o.id.split("-")[0].toUpperCase(), "order reference listed");
  t.eq(await page.locator(`a.ps-order[href="order-tracking.html?order=${o.id}"]`).count(), 1, "order links to tracking");
});

test("payment-status: unsafe checkout URL is never linked", async (t) => {
  const { db, g } = gatewayPending({ checkoutUrl: "javascript:alert(1)" });
  const page = await open(t, `/payment-status.html?group=${g.id}`, { user: U.buyer, db });
  await view(page);
  t.eq(await page.locator('a[href^="javascript"]').count(), 0, "no javascript: link");
  t.eq(await page.locator("a.ps-btn", { hasText: "Continue to payment" }).count(), 0, "no continue link");
  t.has(await bodyText(page), "didn't finish opening", "explains the page did not finish opening");
  const http = gatewayPending({ checkoutUrl: "http://evil.example/x" });
  const p2 = await open(t, `/payment-status.html?group=${http.g.id}`, { user: U.buyer, db: http.db });
  await view(p2);
  t.eq(await p2.locator('a[href^="http://"]').count(), 0, "plain http: URL is never linked either");
});

test("payment-status: half-finished gateway payment can be resumed with the remembered idempotency key", async (t) => {
  const { db, o, g } = gatewayPending({ checkoutUrl: null });
  const page = await open(t, `/payment-status.html?group=${g.id}`, { user: U.buyer, db });
  await view(page);
  t.eq(await page.locator("#ps-resume").count(), 0, "no resume button without a remembered key");
  await page.evaluate(({ k, key }) => sessionStorage.setItem(k, key), { k: "bstm_pay_key:dpo:" + o.id, key: g.idempotency_key });
  await page.reload(); await view(page);
  t.eq(await page.locator("#ps-resume").count(), 1, "resume button appears when a key is remembered");
  await page.click("#ps-resume"); await settle(page);
  const calls = await edgeCalls(page);
  t.ok(calls.some((c) => c.route === "create"), "create called again (idempotent) to finish the session");
  t.eq((await dbOf(page)).payment_groups.length, 1, "no second payment group was made");
});

test("payment-status: 'I've paid — check now' picks up a confirmed payment and hands the order to CabLink", async (t) => {
  const { db, o, g } = gatewayPending();
  const page = await open(t, `/payment-status.html?group=${g.id}`, { user: U.buyer, db });
  await view(page);
  await scen(page, { payOnStatus: true });      // the provider confirms while the buyer is on the page
  await page.click("#ps-check");
  await page.waitForSelector("text=Payment received");
  t.has(await bodyText(page), "Thank you — your order is confirmed.", "success text");
  await page.waitForSelector("text=delivery request sent to a CabLink driver");
  const d = await dbOf(page);
  t.eq([d.orders[0].status, d.orders[0].payment_status], ["confirmed", "paid"], "order confirmed + paid");
  t.ok(!!d.delivery_requests[0].cablink_ride_id, "delivery request handed to CabLink after payment");
  t.eq(await page.locator("a.ps-btn", { hasText: "View my orders" }).count(), 1, "link to orders");
});

test("payment-status: CabLink down after payment -> buyer is told the request is saved", async (t) => {
  const { db, g } = gatewayPending();
  const page = await open(t, `/payment-status.html?group=${g.id}`, { user: U.buyer, db });
  t.allowErrors(/CabLink dispatch/);
  await view(page);
  await scen(page, { payOnStatus: true, cablinkDown: true });
  await page.click("#ps-check");
  await page.waitForSelector("text=couldn't take the delivery request just now");
  const d = await dbOf(page);
  t.eq(d.delivery_requests[0].cablink_ride_id, null, "no ride was created");
});

test("payment-status: manual payment shows instructions and validates the reference", async (t) => {
  const { db, g } = manualGroup("pending");
  const page = await open(t, `/payment-status.html?group=${g.id}`, { user: U.buyer, db });
  await view(page);
  t.eq(await title(page), "Pay with MyZaka (Mascom)", "title");
  const body = await bodyText(page);
  t.has(body, "71234567", "account number"); t.has(body, "*444#", "USSD code"); t.has(body, "P150.00", "amount");
  t.has(body, "PAY-" + g.id.split("-")[0].toUpperCase(), "PAY- reference to quote");
  await page.fill("#ps-ref-input", "ab");
  await page.click("#ps-ref-form button[type=submit]");
  await page.waitForSelector(".ps-err");
  t.has(await text(page, ".ps-err"), "at least 4 characters", "short reference is refused");
  t.eq((await dbOf(page)).payment_groups[0].status, "pending", "nothing sent to the database for a short reference");
  await page.fill("#ps-ref-input", "MZ-48151623");
  await page.click("#ps-ref-form button[type=submit]");
  await page.waitForSelector("text=Waiting for confirmation");
  t.has(await bodyText(page), "MZ-48151623", "the buyer's reference is shown back");
  const d = await dbOf(page);
  t.eq([d.payment_groups[0].status, d.payment_groups[0].payer_reference], ["awaiting_confirmation", "MZ-48151623"], "group awaiting confirmation with the reference stored");
  t.eq(d.orders[0].payment_status, "pending", "order is NOT marked paid by the buyer's page");
});

test("payment-status: a reference already used for another payment is refused", async (t) => {
  const { db, g } = manualGroup("pending");
  const o2 = onlineOrder(db, { buyer: U.buyer2, provider: "mascom_myzaka", pay: "pending" });
  groupFor(db, { buyer: U.buyer2, provider: "mascom_myzaka", status: "awaiting_confirmation", orders: [o2], reference: "USED-1234" });
  const page = await open(t, `/payment-status.html?group=${g.id}`, { user: U.buyer, db });
  await view(page);
  await page.fill("#ps-ref-input", "USED-1234");
  await page.click("#ps-ref-form button[type=submit]");
  await page.waitForSelector(".ps-err");
  t.has(await text(page, ".ps-err"), "already been used", "duplicate reference message");
});

test("payment-status: awaiting confirmation allows correcting the reference, and updates when staff confirm", async (t) => {
  const { db, g } = manualGroup("awaiting_confirmation", { reference: "OLD-REF-1" });
  const page = await open(t, `/payment-status.html?group=${g.id}`, { user: U.buyer, db });
  await view(page);
  t.eq(await title(page), "Waiting for confirmation", "title");
  t.eq(await page.inputValue("#ps-ref-input"), "OLD-REF-1", "input prefilled with the current reference");
  await page.fill("#ps-ref-input", "NEW-REF-2");
  await page.click("#ps-ref-form button[type=submit]");
  await page.waitForFunction(() => document.body.innerText.includes("NEW-REF-2"));
  t.eq((await dbOf(page)).payment_groups[0].payer_reference, "NEW-REF-2", "reference updated");
  await sim(page, "markPaid", g.id);       // staff confirm
  await refresh(page);
  await page.waitForSelector("text=Payment received");
  t.has(await bodyText(page), "Thank you — your order is confirmed.", "page moved to the success view by itself");
});

test("payment-status: failed attempt offers retry with another method, which creates a NEW payment", async (t) => {
  const db = world();
  const o = onlineOrder(db, { provider: "dpo", pay: "failed" });
  const g = groupFor(db, { provider: "dpo", status: "failed", orders: [o], reason: "declined" });
  const page = await open(t, `/payment-status.html?group=${g.id}`, { user: U.buyer, db });
  await view(page);
  t.eq(await title(page), "Payment not completed", "title");
  await page.waitForSelector("input[name=ps-retry]");
  t.eq(await page.locator("input[name=ps-retry]").evaluateAll((e) => e.map((x) => x.value)), ["dpo", "mascom_myzaka"], "retry offers the methods that are on");
  await page.check("input[name=ps-retry][value=mascom_myzaka]");
  await page.click("#ps-retry");
  await page.waitForURL((u) => /payment-status\.html\?group=/.test(u.href) && !u.href.includes(g.id));
  await view(page);
  const d = await dbOf(page);
  t.eq(d.payment_groups.length, 2, "a second payment group exists");
  t.eq(d.payment_groups[1].provider, "mascom_myzaka", "new group uses the chosen method");
  t.eq(d.orders[0].payment_group_id, d.payment_groups[1].id, "order re-linked to the new group");
  t.eq((await edgeCalls(page)).map((c) => c.route).filter((r) => r !== "status"), ["status", "ready", "create"].filter((r) => r !== "status"), "ready check then create (status polls ignored)");
});

test("payment-status: retry with a method that is not ready is refused and the list refreshed", async (t) => {
  const db = world();
  const o = onlineOrder(db, { provider: "dpo", pay: "failed" });
  const g = groupFor(db, { provider: "dpo", status: "failed", orders: [o] });
  const page = await open(t, `/payment-status.html?group=${g.id}`, { user: U.buyer, db, scen: { notReady: ["dpo"] } });
  await view(page); await page.waitForSelector("input[name=ps-retry]");
  await page.click("#ps-retry");
  await page.waitForSelector(".ps-err");
  t.has(await text(page, ".ps-err"), "isn't available right now", "error shown");
  t.eq((await dbOf(page)).payment_groups.length, 1, "no new group created");
});

test("payment-status: expired payment -> orders released, no retry panel", async (t) => {
  const db = world();
  const o = onlineOrder(db, { provider: "dpo", pay: "failed", status: "cancelled" });
  const g = groupFor(db, { provider: "dpo", status: "expired", orders: [o] });
  const page = await open(t, `/payment-status.html?group=${g.id}`, { user: U.buyer, db });
  await view(page);
  t.eq(await title(page), "Payment window expired", "title");
  t.has(await bodyText(page), "released back to the shop", "explains items were released");
  t.eq(await page.locator("#ps-retry").count(), 0, "no retry button for cancelled orders");
});

test("payment-status: review and refunded states", async (t) => {
  const db = world();
  const o = onlineOrder(db, { provider: "dpo", pay: "review" });
  const g = groupFor(db, { provider: "dpo", status: "review", orders: [o], reason: "amount_mismatch" });
  const page = await open(t, `/payment-status.html?group=${g.id}`, { user: U.buyer, db });
  await view(page);
  t.eq(await title(page), "Payment under review", "review title");
  t.has(await bodyText(page), "Please don't pay again", "tells the buyer not to pay again");
  t.eq(await page.locator("a.ps-btn-alt", { hasText: "Contact support" }).getAttribute("href"), "help.html", "support link");
  t.eq(await page.locator("#ps-retry,#ps-check,#ps-ref-form").count(), 0, "no pay/retry controls while under review");
  const db2 = world();
  const o2 = onlineOrder(db2, { provider: "dpo", pay: "failed", status: "cancelled" });
  const g2 = groupFor(db2, { provider: "dpo", status: "refunded", orders: [o2], reason: "Refunded by staff" });
  const p2 = await open(t, `/payment-status.html?group=${g2.id}`, { user: U.buyer, db: db2 });
  await view(p2);
  t.eq(await title(p2), "Payment refunded", "refunded title");
  t.has(await bodyText(p2), "Refunded by staff", "refund note shown");
});

test("payment-status: orders with no payment group (couldn't start) show the error and a retry", async (t) => {
  const db = world();
  const o = onlineOrder(db, { provider: "dpo", pay: "unpaid" });
  const page = await open(t, `/payment-status.html?orders=${o.id}&provider=dpo&error=provider_error`, { user: U.buyer, db });
  await view(page);
  t.eq(await title(page), "Your order is waiting for payment", "title");
  t.has(await bodyText(page), "nothing was charged", "error text for provider_error");
  t.has(await text(page, ".ps-amount"), "P100.00", "total of the orders");
  await page.waitForSelector("input[name=ps-retry]");
  t.eq(await page.locator("input[name=ps-retry]:checked").getAttribute("value"), "dpo", "provider from the URL is preselected");
  await page.click("#ps-retry");
  await page.waitForURL(/pay\.test\/checkout\//);
});

test("payment-status: bad links and other people's payments never show data", async (t) => {
  const page = await open(t, "/payment-status.html", { user: U.buyer });
  await page.waitForSelector("#ps-fatal:not(.ps-hidden)");
  t.has(await text(page, "#ps-fatal-text"), "needs a payment or order reference", "no params");
  const p2 = await open(t, "/payment-status.html?group=not-a-uuid", { user: U.buyer });
  await p2.waitForSelector("#ps-fatal:not(.ps-hidden)");
  t.has(await text(p2, "#ps-fatal-text"), "needs a payment or order reference", "non-uuid group");
  const p3 = await open(t, "/payment-status.html?group=" + id(424242), { user: U.buyer });
  await p3.waitForSelector("#ps-fatal:not(.ps-hidden)");
  t.has(await text(p3, "#ps-fatal-text"), "couldn't find that payment", "unknown group");
  const { db, g } = manualGroup("pending");
  const p4 = await open(t, `/payment-status.html?group=${g.id}`, { user: U.buyer2, db });
  await p4.waitForSelector("#ps-fatal:not(.ps-hidden)");
  t.eq((await bodyText(p4)).includes("71234567"), false, "another buyer's group does not leak its details");
  const p5 = await open(t, "/payment-status.html?orders=" + Array.from({ length: 21 }, (_, i) => id(900 + i)).join(","), { user: U.buyer });
  await p5.waitForSelector("#ps-fatal:not(.ps-hidden)");
  t.has(await text(p5, "#ps-fatal-text"), "needs a payment or order reference", "more than 20 orders refused");
});

test("payment-status: logged-out visitor is sent to login and brought back", async (t) => {
  const { g } = gatewayPending();
  const page = await open(t, `/payment-status.html?group=${g.id}`, { user: null });
  await page.waitForURL(/login\.html/);
  t.has(decodeURIComponent(url(page).search), "payment-status.html?group=" + g.id, "redirect carries the full return URL");
});

test("payment-status: payment service down -> shows what the database knows with a soft warning", async (t) => {
  const { db, g } = manualGroup("pending");
  const page = await open(t, `/payment-status.html?group=${g.id}`, { user: U.buyer, db, scen: { edgeDown: true } });
  await view(page);
  t.has(await bodyText(page), "couldn't reach the payment service", "soft warning shown");
  t.eq(await title(page), "Pay with MyZaka (Mascom)", "state still shown from the database");
  const p2 = await open(t, `/payment-status.html?group=${g.id}`, { user: U.buyer, db, scen: { edgeDown: true, dbSummaryDown: true } });
  await p2.waitForSelector("#ps-fatal:not(.ps-hidden)");
  t.has(await text(p2, "#ps-fatal-text"), "couldn't load this payment right now", "both down -> clear message");
});

test("payment-status: buyer left the provider page (?cancelled=1)", async (t) => {
  const { db, g } = gatewayPending();
  const page = await open(t, `/payment-status.html?group=${g.id}&cancelled=1`, { user: U.buyer, db });
  await view(page);
  t.has(await bodyText(page), "left the payment page without paying", "banner shown");
});

test("payment-status: hostile text from the server is escaped (no HTML/JS injection)", async (t) => {
  const { db, g } = manualGroup("awaiting_confirmation", { reference: '"><img src=x onerror="window.__xss=1">' });
  db.payment_providers.find((p) => p.slug === "mascom_myzaka").config.instructions = '<script>window.__xss=2</script><b id="pwn">bold</b>';
  db.payment_providers.find((p) => p.slug === "mascom_myzaka").display_name = '<i id="pwn2">Pay</i>';
  const page = await open(t, `/payment-status.html?group=${g.id}`, { user: U.buyer, db });
  await view(page); await settle(page);
  t.eq(await page.evaluate(() => window.__xss), undefined, "no injected script ran");
  t.eq(await page.locator("#pwn, #pwn2").count(), 0, "no injected elements");
  t.has(await bodyText(page), "<i id=\"pwn2\">Pay</i>", "shown literally as text");
});
