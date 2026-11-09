import { test, open, url, text, bodyText, dbOf, edgeCalls, scen, settle } from "../run.mjs";
import { U, world, CART, P, R } from "../fixtures.mjs";

async function fillForm(page) {
  await page.fill("#phone", "+26771234567");
  await page.fill("#address", "Plot 123, Main Mall");
  await page.selectOption("#city", "Gaborone");
}
const placeOrder = (page) => page.click("#place-order-btn");

test("checkout: every provider off -> only Cash on Delivery works, order is created pending/cod", async (t) => {
  const page = await open(t, "/checkout.html", { user: U.buyer, db: world({ providersOff: true }), cart: CART.one });
  await page.waitForSelector("#payment-methods-online");
  await settle(page);
  const methods = await text(page, "#payment-methods-online");
  t.has(methods, "not switched on yet", "shows that online payment is not switched on");
  t.eq(await page.locator('input[name="payment"]:not([disabled])').count(), 1, "exactly one selectable payment option (COD)");
  t.eq(await page.locator('input[name="payment"]:checked').getAttribute("value"), "cod", "COD is selected");
  t.eq(await text(page, "#place-order-btn"), "Place Order", "button label is Place Order");
  await fillForm(page);
  await placeOrder(page);
  await page.waitForURL(/order-tracking\.html/);
  const db = await dbOf(page);
  t.eq(db.orders.length, 1, "one order created");
  t.eq([db.orders[0].status, db.orders[0].payment_method, db.orders[0].payment_status], ["pending", "cod", "unpaid"], "order is pending / cod / unpaid");
  t.eq(db.orders[0].total_amount, 100, "order total is 100");
  t.eq(db.products.find((p) => p.id === P.p1).quantity, 9, "stock decremented by 1");
  t.eq(db.delivery_requests.length, 1, "exactly one delivery request (trigger), none added by the page");
  t.ok(!!db.delivery_requests[0].cablink_ride_id, "COD + CabLink order is handed to CabLink at creation (existing behaviour kept)");
  t.eq(await page.evaluate(() => localStorage.getItem("bstm_cart")), "[]", "cart cleared");
  t.eq((await edgeCalls(page)).length, 0, "no payments edge calls for COD");
});

test("checkout: enabled methods appear, hints and button label follow the selection", async (t) => {
  const page = await open(t, "/checkout.html", { user: U.buyer, cart: CART.one });
  await settle(page);
  const radios = await page.locator('input[name="payment"]:not([disabled])').evaluateAll((els) => els.map((e) => e.value));
  t.eq(radios, ["dpo", "mascom_myzaka", "cod"], "selectable methods: dpo, mascom_myzaka, cod (disabled ones hidden)");
  t.eq(await text(page, "#place-order-btn"), "Place Order", "COD label");
  await page.check('input[name="payment"][value="dpo"]');
  t.eq(await text(page, "#place-order-btn"), "Place Order & Pay", "gateway label");
  t.eq(await page.locator('[data-pay-hint="dpo"]').isVisible(), true, "gateway hint visible");
  t.eq(await page.locator('[data-pay-hint="mascom_myzaka"]').isVisible(), false, "manual hint hidden");
  await page.check('input[name="payment"][value="mascom_myzaka"]');
  t.eq(await text(page, "#place-order-btn"), "Place Order & Get Payment Details", "manual label");
  t.has(await text(page, '[data-pay-hint="mascom_myzaka"]'), "exactly how to pay", "manual hint text");
  await page.check('input[name="payment"][value="cod"]');
  t.eq(await text(page, "#place-order-btn"), "Place Order", "back to COD label");
  t.eq(await page.locator('label[data-pay-option="cod"]').evaluate((e) => e.classList.contains("pay-opt-selected")), true, "COD option highlighted");
});

test("checkout: gateway order -> ready check, order, payment group, redirect to provider page", async (t) => {
  const page = await open(t, "/checkout.html", { user: U.buyer, cart: CART.one });
  await settle(page);
  await page.check('input[name="payment"][value="dpo"]');
  await fillForm(page);
  await placeOrder(page);
  await page.waitForURL(/pay\.test\/checkout\//);
  const landed = page.url();
  const db = await dbOf(page);
  t.eq(db.orders.length, 1, "one order");
  const o = db.orders[0];
  t.eq([o.status, o.payment_method, o.payment_status], ["pending", "dpo", "pending"], "order pending / dpo / payment_status pending after group creation");
  t.eq(db.payment_groups.length, 1, "one payment group");
  t.eq(db.payment_groups[0].amount, 100, "group amount 100");
  t.eq(o.payment_group_id, db.payment_groups[0].id, "order linked to group");
  t.eq(landed, db.payment_groups[0].checkout_url, "browser sent to the provider checkout_url");
  t.eq(db.delivery_requests[0].cablink_ride_id, null, "CabLink NOT dispatched before payment");
  const calls = (await edgeCalls(page)).map((c) => c.route + ":" + c.method);
  t.eq(calls, ["ready:POST", "create:POST"], "edge calls: ready (POST) then create (POST), in that order");
  t.eq(db.products.find((p) => p.id === P.p1).quantity, 9, "stock reserved");
});

test("checkout: manual order -> lands on payment-status with instructions", async (t) => {
  const page = await open(t, "/checkout.html", { user: U.buyer, cart: CART.one });
  await settle(page);
  await page.check('input[name="payment"][value="mascom_myzaka"]');
  await fillForm(page);
  await placeOrder(page);
  await page.waitForURL(/payment-status\.html\?group=/);
  await page.waitForSelector("#ps-root .ps-card");
  const body = await bodyText(page);
  t.has(body, "Pay with MyZaka (Mascom)", "title names the method");
  t.has(body, "71234567", "shows the account number from the provider config");
  t.has(body, "P100.00", "shows the amount");
  t.eq(await page.locator("#ps-ref-form").count(), 1, "reference form present");
  t.has(await text(page, ".ps-ref"), "PAY-", "shows a PAY- reference to quote when paying");
});

test("checkout: provider not ready -> nothing reserved, no order, buyer told", async (t) => {
  const page = await open(t, "/checkout.html", { user: U.buyer, cart: CART.one, scen: { notReady: ["dpo"] } });
  await settle(page);
  await page.check('input[name="payment"][value="dpo"]');
  await fillForm(page);
  await placeOrder(page);
  await page.waitForSelector("#checkout-error:not(.hidden)");
  t.has(await text(page, "#checkout-error"), "isn't available right now", "error shown");
  const db = await dbOf(page);
  t.eq(db.orders.length, 0, "no order created");
  t.eq(db.products.find((p) => p.id === P.p1).quantity, 10, "stock untouched");
  t.eq(url(page).pathname, "/checkout.html", "still on checkout");
  t.eq(await page.locator("#place-order-btn").isDisabled(), false, "button usable again");
});

test("checkout: ready-check outage fails closed", async (t) => {
  const page = await open(t, "/checkout.html", { user: U.buyer, cart: CART.one, scen: { readyError: true } });
  await settle(page);
  await page.check('input[name="payment"][value="dpo"]');
  await fillForm(page);
  await placeOrder(page);
  await page.waitForSelector("#checkout-error:not(.hidden)");
  const db = await dbOf(page);
  t.eq(db.orders.length, 0, "no order when the ready check errors");
});

test("checkout: method switched off after page load -> database refuses, stock restored, method list refreshed", async (t) => {
  t.allowErrors(/Order creation failed: Error: payments:method_unavailable/);
  const page = await open(t, "/checkout.html", { user: U.buyer, cart: CART.one, scen: { readyForce: true } });
  await settle(page);
  await page.check('input[name="payment"][value="dpo"]');
  await fillForm(page);
  // the admin switches DPO off while the buyer is on the page
  await page.evaluate(() => { window.__DB.payment_providers.find((p) => p.slug === "dpo").enabled = false; sessionStorage.setItem("__DB", JSON.stringify(window.__DB)); });
  await placeOrder(page);
  await page.waitForSelector("#checkout-error:not(.hidden)");
  t.has(await text(page, "#checkout-error"), "just switched off", "message says the method was switched off");
  const db = await dbOf(page);
  t.eq(db.orders.length, 0, "no order");
  t.eq(db.products.find((p) => p.id === P.p1).quantity, 10, "stock restored after the failed insert");
  t.eq(await page.locator('input[name="payment"][value="dpo"]').count(), 0, "DPO removed from the list");
  t.eq(await page.locator('input[name="payment"]:checked').getAttribute("value"), "cod", "falls back to COD");
});

test("checkout: 3 rooms + standard delivery -> fee split in whole cents, group total equals what the buyer saw", async (t) => {
  const page = await open(t, "/checkout.html", { user: U.buyer, cart: CART.three });
  await settle(page);
  await page.check('input[name="delivery"][value="standard"]');
  const shown = await text(page, "#checkout-total");
  t.eq(shown, "P203.83", "total shown to buyer: 100 + 50.50 + 33.33 + 20 fee");
  await page.check('input[name="payment"][value="dpo"]');
  await fillForm(page);
  await placeOrder(page);
  await page.waitForURL(/pay\.test\/checkout\//);
  const db = await dbOf(page);
  t.eq(db.orders.length, 3, "three orders (one per room)");
  const totals = db.orders.map((o) => o.total_amount).sort((a, b) => a - b);
  const sum = Math.round(totals.reduce((s, x) => s + x, 0) * 100) / 100;
  t.eq(sum, 203.83, "sum of order totals equals the total shown");
  t.ok(db.orders.every((o) => Math.round(o.total_amount * 100) === o.total_amount * 100 || Math.abs(o.total_amount * 100 - Math.round(o.total_amount * 100)) < 1e-6), "every order total is a whole number of cents");
  t.eq(db.payment_groups[0].amount, 203.83, "payment group amount equals the total shown");
});

test("checkout: more than 20 rooms is refused for online payment before anything is reserved", async (t) => {
  const cart = Array.from({ length: 21 }, (_, i) => ({ id: "00000000-0000-4000-8000-9000000000" + String(i).padStart(2, "0"), name: "Item " + i, price: 1, qty: 1, room_id: "00000000-0000-4000-8000-8000000000" + String(i).padStart(2, "0"), room_name: "R" + i, seller_id: U.seller.id, product_type: "physical" }));
  const page = await open(t, "/checkout.html", { user: U.buyer, cart });
  await settle(page);
  await page.check('input[name="payment"][value="dpo"]');
  await fillForm(page);
  await placeOrder(page);
  await page.waitForSelector("#checkout-error:not(.hidden)");
  t.has(await text(page, "#checkout-error"), "up to 20 rooms", "cap message");
  t.eq((await dbOf(page)).orders.length, 0, "no orders");
});

test("checkout: payment service refuses to create the payment -> orders kept, buyer sent to a retry page", async (t) => {
  const page = await open(t, "/checkout.html", { user: U.buyer, cart: CART.one, scen: { createError: "provider_error", createStatus: 502 } });
  await settle(page);
  await page.check('input[name="payment"][value="dpo"]');
  await fillForm(page);
  await placeOrder(page);
  await page.waitForURL(/payment-status\.html\?orders=/);
  const u = url(page);
  t.eq(u.searchParams.get("error"), "provider_error", "error code carried in the URL");
  t.eq(u.searchParams.get("provider"), "dpo", "provider carried in the URL");
  await page.waitForSelector("#ps-root .ps-card");
  const body = await bodyText(page);
  t.has(body, "nothing was charged", "tells the buyer nothing was charged");
  t.has(body, "Pay with this method", "offers a retry");
  const db = await dbOf(page);
  t.eq(db.orders.length, 1, "the order exists");
  t.eq(db.orders[0].payment_status, "unpaid", "order still unpaid");
});

test("checkout: logged out buyer is sent to login", async (t) => {
  const page = await open(t, "/checkout.html", { user: null, cart: CART.one });
  await page.waitForURL(/login\.html/);
  t.has(url(page).search, "redirect=checkout.html", "redirect back to checkout after login");
});
