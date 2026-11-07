// js/pages/checkout.js
import { supabase } from "../core/supabase-client.js";
import { getCart, getCartGroupedByRoom, getCartTotal, clearCart, removeFromCart } from "../core/cart.js";
import { escapeHtml } from "../core/sanitize.js";
import { CONFIG } from "../core/config.js";
import { logEvent } from "../core/events.js";
import {
  getPaymentMethods,
  isMethodReady,
  startPayment,
  newIdempotencyKey,
  paymentErrorMessage,
  dbErrorCode,
  safeHttpsUrl,
} from "../core/payments.js";

const REWARD_PERCENT = CONFIG.MARKETPLACE.REWARD_PERCENT / 100; // e.g. 1%
const MAX_ORDERS_PER_PAYMENT = 20; // the payments service pays at most this many room-orders at once

// Online payment methods that are switched on right now, keyed by slug (filled from the database).
let onlineMethods = new Map();

function selectedPayment() {
  return document.querySelector('input[name="payment"]:checked')?.value || "cod";
}

function placeOrderLabel() {
  const m = onlineMethods.get(selectedPayment());
  if (!m) return "Place Order";
  return m.kind === "manual" ? "Place Order & Get Payment Details" : "Place Order & Pay";
}

function setPlaceOrderButton(text, disabled) {
  const btn = document.getElementById("place-order-btn");
  if (!btn) return;
  btn.disabled = disabled;
  btn.innerHTML = "";
  const icon = document.createElement("i");
  icon.className = "fas fa-lock mr-2";
  btn.appendChild(icon);
  btn.appendChild(document.createTextNode(text));
}

// Highlights the chosen payment option and shows what happens next for online methods.
function syncPaymentUi() {
  const chosen = selectedPayment();
  document.querySelectorAll("[data-pay-option]").forEach((el) => {
    el.classList.toggle("pay-opt-selected", el.dataset.payOption === chosen);
  });
  document.querySelectorAll("[data-pay-hint]").forEach((el) => {
    el.classList.toggle("hidden", el.dataset.payHint !== chosen);
  });
  const btn = document.getElementById("place-order-btn");
  if (btn && !btn.disabled) setPlaceOrderButton(placeOrderLabel(), false);
}

function renderPaymentMethods(methods) {
  const box = document.getElementById("payment-methods-online");
  if (!box) return;
  onlineMethods = new Map(methods.map((m) => [m.slug, m]));
  box.innerHTML = "";

  if (methods.length === 0) {
    const row = document.createElement("div");
    row.className = "pay-opt pay-opt-off";
    const text = document.createElement("div");
    const title = document.createElement("p");
    title.className = "pay-opt-title";
    title.textContent = "Card / Mobile Money / Bank";
    const sub = document.createElement("p");
    sub.className = "pay-opt-sub";
    sub.textContent = "Online payment is not switched on yet — choose Cash on Delivery.";
    text.appendChild(title);
    text.appendChild(sub);
    const icon = document.createElement("i");
    icon.className = "fas fa-shield-alt text-gray-400 text-2xl";
    row.appendChild(text);
    row.appendChild(icon);
    box.appendChild(row);
    return;
  }

  methods.forEach((m) => {
    const wrap = document.createElement("div");

    const label = document.createElement("label");
    label.className = "pay-opt";
    label.dataset.payOption = m.slug;

    const left = document.createElement("div");
    left.className = "flex items-center";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "payment";
    input.value = m.slug;
    input.className = "mr-4";
    const text = document.createElement("div");
    const title = document.createElement("p");
    title.className = "pay-opt-title";
    title.textContent = m.name;
    const sub = document.createElement("p");
    sub.className = "pay-opt-sub";
    sub.textContent = m.description || "";
    text.appendChild(title);
    text.appendChild(sub);
    left.appendChild(input);
    left.appendChild(text);

    const icon = document.createElement("i");
    icon.className = (m.kind === "manual" ? "fas fa-mobile-alt" : "fas fa-credit-card") + " text-purple-600 text-2xl";
    label.appendChild(left);
    label.appendChild(icon);
    wrap.appendChild(label);

    const hint = document.createElement("p");
    hint.className = "pay-opt-hint hidden";
    hint.dataset.payHint = m.slug;
    hint.textContent =
      m.kind === "manual"
        ? "After you place the order you'll see exactly how to pay, then confirm your payment reference."
        : "After you place the order you'll be taken to a secure page to complete the payment.";
    wrap.appendChild(hint);

    box.appendChild(wrap);
  });
}

async function loadPaymentMethods() {
  const methods = await getPaymentMethods();
  renderPaymentMethods(methods);
  // If the selected method vanished (switched off) fall back to Cash on Delivery.
  if (!document.querySelector('input[name="payment"]:checked')) {
    const cod = document.querySelector('input[name="payment"][value="cod"]');
    if (cod) cod.checked = true;
  }
  syncPaymentUi();
}

// Splits the delivery fee across the room-orders in whole cents, so the per-order totals add up to
// exactly the total the buyer was shown (a plain division leaves fractions of a cent that the
// payment service would round order by order).
function splitFee(fee, n) {
  if (n <= 0) return [];
  const cents = Math.round(fee * 100);
  const base = Math.floor(cents / n);
  const extra = cents - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < extra ? 1 : 0)) / 100);
}

const round2 = (x) => Math.round(x * 100) / 100;

function getDeliveryFee() {
  const checked = document.querySelector('input[name="delivery"]:checked');
  return checked ? Number(checked.dataset.fee || 0) : 0;
}

function renderCart() {
  const cart = getCart();
  const itemsEl = document.getElementById("checkout-items");
  const subtotalEl = document.getElementById("checkout-subtotal");
  const totalEl = document.getElementById("checkout-total");
  const thbEl = document.getElementById("checkout-thb-reward");
  const deliveryFeeEl = document.getElementById("checkout-delivery-fee");
  const placeOrderBtn = document.getElementById("place-order-btn");

  if (!itemsEl) return cart;

  if (cart.length === 0) {
    itemsEl.innerHTML =
      '<p class="text-gray-500 text-sm">Your cart is empty. ' +
      '<a href="marketplace.html" class="text-purple-600 font-semibold">Go shopping →</a></p>';
    if (placeOrderBtn) placeOrderBtn.disabled = true;
    if (subtotalEl) subtotalEl.textContent = "P0";
    if (totalEl) totalEl.textContent = "P0";
    if (thbEl) thbEl.textContent = "0.0";
    return cart;
  }

  const groups = getCartGroupedByRoom();
  const multiRoom = groups.length > 1;

  itemsEl.innerHTML = groups
    .map(
      (group) => `
      <div class="mb-4 pb-4 border-b border-gray-100 last:border-0 last:mb-0 last:pb-0">
        ${
          multiRoom
            ? `<div class="flex items-center justify-between mb-2">
                 <span class="text-xs font-bold text-purple-600 uppercase tracking-wide">🏬 ${escapeHtml(group.room_name)}</span>
                 <span class="text-xs text-gray-400">Separate order — this seller ships independently</span>
               </div>`
            : ""
        }
        ${group.items
          .map(
            (item) => `
          <div class="flex items-center space-x-4 mb-2">
            <img src="${escapeHtml(item.image || "")}" onerror="this.style.display='none'" alt="${escapeHtml(item.name)}" class="w-16 h-16 rounded-lg object-cover bg-purple-50">
            <div class="flex-1">
              <h4 class="font-semibold text-gray-800">${escapeHtml(item.name)}</h4>
              <p class="text-sm text-gray-600">Qty: ${item.qty}</p>
            </div>
            <span class="font-bold text-gray-800">P${(item.price * item.qty).toFixed(2)}</span>
          </div>`
          )
          .join("")}
        ${multiRoom ? `<p class="text-right text-sm text-gray-500 mt-1">Room subtotal: P${group.subtotal.toFixed(2)}</p>` : ""}
      </div>`
    )
    .join("");

  const subtotal = getCartTotal();
  const deliveryFee = getDeliveryFee();
  const total = subtotal + deliveryFee;
  const reward = Math.round(subtotal * REWARD_PERCENT); // reward is based on goods, not delivery fee — rounded to match what actually gets credited (see handlePlaceOrder)

  if (subtotalEl) subtotalEl.textContent = `P${subtotal.toFixed(2)}`;
  if (totalEl) totalEl.textContent = `P${total.toFixed(2)}`;
  if (thbEl) thbEl.textContent = reward.toFixed(1);
  if (deliveryFeeEl) {
    if (deliveryFee > 0) {
      deliveryFeeEl.textContent = `P${deliveryFee.toFixed(2)}`;
      deliveryFeeEl.classList.remove("text-green-600");
    } else {
      deliveryFeeEl.textContent = "FREE";
      deliveryFeeEl.classList.add("text-green-600");
    }
  }

  if (multiRoom) {
    let note = document.getElementById("checkout-multiroom-note");
    if (!note) {
      note = document.createElement("p");
      note.id = "checkout-multiroom-note";
      note.className = "text-xs text-gray-500 mt-2";
      itemsEl.parentElement?.insertBefore(note, itemsEl.nextSibling);
    }
    note.textContent = `Your items are from ${groups.length} different rooms — this will create ${groups.length} separate orders, one per seller, each with its own tracking.`;
  }

  const hasAnyService = groups.some((g) => g.hasService);
  const serviceNote = document.getElementById("service-delivery-note");
  if (serviceNote) serviceNote.classList.toggle("hidden", !hasAnyService);

  return cart;
}

function showError(msg) {
  const el = document.getElementById("checkout-error");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
}

function clearError() {
  const el = document.getElementById("checkout-error");
  if (!el) return;
  el.classList.add("hidden");
}

async function createOrder(session, cart, { deliveryFee, orderStatus, paymentMethod }) {
  const userId = session.user.id;

  const form = document.getElementById("checkoutForm");
  const delivery = {
    delivery_name: form.fullName.value,
    delivery_phone: form.phone.value,
    delivery_address: form.address.value,
    delivery_city: form.city.value,
    delivery_notes: form.notes.value || null,
  };
  const deliveryMethod =
    document.querySelector('input[name="delivery"]:checked')?.value || "cablink";
  const online = paymentMethod !== "cod";

  // Each room is a separate seller — split the cart into one order per room
  // rather than one order for the whole basket. A shopper buying from 3
  // rooms in one checkout ends up with 3 independent orders, each visible
  // only to its own seller, each trackable separately. Delivery fee is
  // split across room-orders (in whole cents) rather than charged per-room again.
  const groups = getCartGroupedByRoom();
  const createdOrders = [];
  const fees = splitFee(deliveryFee, groups.length);
  let currentIndex = -1;

  try {
    for (let gi = 0; gi < groups.length; gi++) {
      currentIndex = gi;
      const group = groups[gi];
      const orderTotal = round2(group.subtotal + fees[gi]);

      // A service-only room order (e.g. booking a haircut) has no physical
      // delivery — dispatching a CabLink pickup for it would be nonsense.
      const effectiveDeliveryMethod = group.hasService && !group.hasPhysical ? "service" : deliveryMethod;

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          buyer_id: userId,
          product_id: group.items[0].id, // kept for backward-compat joins
          room_id: group.room_id,
          seller_id: group.seller_id,
          status: orderStatus,
          total_amount: orderTotal,
          delivery_method: effectiveDeliveryMethod,
          payment_method: paymentMethod,
          ...delivery,
        })
        .select()
        .single();

      if (orderErr) throw orderErr;

      const items = group.items.map((item) => ({
        order_id: order.id,
        product_id: item.id,
        product_name: item.name,
        quantity: item.qty,
        unit_price: item.price,
      }));

      const { error: itemsErr } = await supabase.from("order_items").insert(items);
      if (itemsErr) {
        // The order row exists but has no items. Buyers cannot cancel orders
        // (admin-only policy), so this can only be logged for support until
        // the server-side place_order function replaces this client flow.
        console.error("[BSTM Checkout] order_items insert failed, empty order left behind:", order.id, itemsErr);
        throw itemsErr;
      }

      // Auto-create a CabLink pickup task for this room's order so it shows
      // up ready-to-claim in the real CabLink driver app — no manual step
      // needed from the buyer or seller. Skipped entirely for service-only
      // orders (the buyer enquires/books with the seller directly).
      // Skipped for online-payment orders too: the database trigger has already
      // made the (pending) delivery request, and it is only handed to CabLink
      // once the payment has been received (payment-status.html does that).
      if (!online && effectiveDeliveryMethod === "cablink" && group.room_id) {
        // A database trigger on order_items already creates exactly one
        // delivery_requests row per cablink order (unique on order_id), so
        // inserting a second one here always failed with a duplicate-key
        // error and dispatch never ran. Read the existing row first; insert
        // only if the trigger didn't make one.
        let { data: deliveryRequest, error: deliveryErr } = await supabase
          .from("delivery_requests")
          .select("id")
          .eq("order_id", order.id)
          .maybeSingle();
        if (!deliveryErr && !deliveryRequest) {
          ({ data: deliveryRequest, error: deliveryErr } = await supabase
            .from("delivery_requests")
            .insert({
              order_id: order.id,
              buyer_id: userId,
              pickup_room_id: group.room_id,
              dropoff_address: delivery.delivery_address,
              dropoff_city: delivery.delivery_city,
              dropoff_phone: delivery.delivery_phone,
              status: "pending",
            })
            .select("id")
            .single());
        }

        // Actually hand the task to CabLink's real driver network. This is
        // best-effort on purpose: if CabLink is briefly unreachable or the
        // shared key isn't configured yet, the order must still succeed —
        // the row above stays "pending" and can be retried later rather
        // than blocking checkout.
        if (!deliveryErr && deliveryRequest) {
          try {
            const { error: dispatchErr } = await supabase.functions.invoke(
              "dispatch-to-cablink",
              { body: { delivery_request_id: deliveryRequest.id } }
            );
            if (dispatchErr) {
              console.error("[BSTM Checkout] CabLink dispatch failed (order still placed):", dispatchErr);
            }
          } catch (dispatchException) {
            console.error("[BSTM Checkout] CabLink dispatch threw (order still placed):", dispatchException);
          }
        } else if (deliveryErr) {
          console.error("[BSTM Checkout] Couldn't create delivery_requests row:", deliveryErr);
        }
      }

      createdOrders.push(order);
      logEvent("order_placed", {
        userId,
        roomId: group.room_id,
        orderId: order.id,
        metadata: {
          item_count: group.items.length,
          total: orderTotal,
          payment_method: paymentMethod,
          delivery_method: effectiveDeliveryMethod,
        },
      });
    }
  } catch (err) {
    // Tell the caller which rooms already have a real order so it only
    // gives back stock for the rooms that did not.
    err.createdOrders = createdOrders;
    err.failedIndex = currentIndex;
    throw err;
  }

  // THB rewards are NOT credited from the browser. wallet_ledger and
  // profiles.thb_balance are server-controlled; the reward is issued by the
  // database when an order is delivered.
  return createdOrders;
}

function resetPlaceOrderButton() {
  setPlaceOrderButton(placeOrderLabel(), false);
}

// Sends the buyer on to pay for orders that already exist. Gateways go to the provider's secure
// page; manual rails (and every problem) go to the payment status page, which explains the state
// and lets the buyer retry or pick another method.
async function goToPayment(provider, orderIds) {
  setPlaceOrderButton("Starting payment…", true);
  const pay = await startPayment({ provider, orderIds, idempotencyKey: newIdempotencyKey() });
  if (pay.ok && pay.group) {
    const g = pay.group;
    const url = g.kind === "gateway" ? safeHttpsUrl(g.checkout_url) : null;
    window.location.href = url || `payment-status.html?group=${encodeURIComponent(g.id)}`;
    return;
  }
  if (pay.groupId) {
    window.location.href = `payment-status.html?group=${encodeURIComponent(pay.groupId)}`;
    return;
  }
  window.location.href =
    `payment-status.html?orders=${encodeURIComponent(orderIds.join(","))}` +
    `&provider=${encodeURIComponent(provider)}&error=${encodeURIComponent(pay.error || "internal_error")}`;
}

async function handlePlaceOrder() {
  clearError();

  const form = document.getElementById("checkoutForm");
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const cart = getCart();
  if (cart.length === 0) {
    showError("Your cart is empty.");
    return;
  }

  // Cash on Delivery, or one of the online methods that is switched on right now.
  // Anything else is refused before any stock is touched.
  const paymentMethod = selectedPayment();
  const online = paymentMethod !== "cod";
  if (online) {
    if (!onlineMethods.has(paymentMethod)) {
      showError("That payment method isn't available right now. Please choose another one.");
      await loadPaymentMethods();
      return;
    }
    if (getCartGroupedByRoom().length > MAX_ORDERS_PER_PAYMENT) {
      showError(
        `Online payment covers up to ${MAX_ORDERS_PER_PAYMENT} rooms at a time. Please remove some items or choose Cash on Delivery.`
      );
      return;
    }
  }

  const session = await window.BSTM.ready();
  if (!session) {
    window.location.href = "login.html?redirect=checkout.html";
    return;
  }

  setPlaceOrderButton("Processing…", true);

  // Ask the server whether this method can really take a payment BEFORE any stock is
  // reserved or any order is created, so a method that is switched on but not fully
  // set up never leaves the buyer with an unpayable order.
  if (online && !(await isMethodReady(paymentMethod))) {
    showError(paymentErrorMessage("provider_not_configured"));
    await loadPaymentMethods();
    resetPlaceOrderButton();
    return;
  }

  const deliveryFee = getDeliveryFee();

  // Reserve stock before creating orders. Each decrement is atomic at the
  // database level (see decrement_product_stock), so two buyers racing for
  // the last unit can never both succeed. If anything fails here, roll back
  // whatever already succeeded and stop.
  const reserved = [];
  for (const item of cart) {
    const { data: ok, error: stockErr } = await supabase.rpc(
      "decrement_product_stock",
      { p_product_id: item.id, p_qty: item.qty }
    );
    if (stockErr || !ok) {
      for (const r of reserved) {
        await supabase.rpc("restore_product_stock", {
          p_product_id: r.id,
          p_qty: r.qty,
        });
      }
      showError(`"${item.name}" doesn't have enough stock left. Please adjust your cart.`);
      resetPlaceOrderButton();
      return;
    }
    reserved.push({ id: item.id, qty: item.qty });
  }

  async function restoreStock(items) {
    for (const r of items) {
      await supabase.rpc("restore_product_stock", { p_product_id: r.id, p_qty: r.qty });
    }
  }

  // Orders are always created as "pending". Cash on Delivery is confirmed at the point of
  // physical delivery; an online order is confirmed by the database itself the moment the
  // payment is received (the buyer cannot mark anything paid from here).
  let orders;
  try {
    orders = await createOrder(session, cart, {
      deliveryFee,
      orderStatus: "pending",
      paymentMethod,
    });
  } catch (err) {
    console.error("[BSTM Checkout] Order creation failed:", err);
    const placed = Array.isArray(err.createdOrders) ? err.createdOrders : [];

    if (placed.length === 0) {
      await restoreStock(reserved);
      if (dbErrorCode(err) === "method_unavailable") {
        showError(paymentErrorMessage("method_unavailable"));
        await loadPaymentMethods();
      } else {
        showError("Couldn't place your order. Please try again.");
      }
      resetPlaceOrderButton();
      return;
    }

    // Some rooms already have a real order (their stock stays taken). Give
    // back stock only for the rooms that failed, drop the placed rooms from
    // the cart, and tell the buyer exactly what happened.
    const groups = getCartGroupedByRoom();
    const failedItems = groups.slice(err.failedIndex).flatMap((g) => g.items);
    const placedItems = groups.slice(0, err.failedIndex).flatMap((g) => g.items);
    await restoreStock(failedItems.map((i) => ({ id: i.id, qty: i.qty })));
    placedItems.forEach((i) => removeFromCart(i.id));
    showError(
      `${placed.length} of your orders were placed (see My Orders${online ? ", where you can pay for them" : ""}). The remaining items could not be ordered and are still in your cart — please try again.`
    );
    resetPlaceOrderButton();
    return;
  }

  clearCart();
  const orderIds = orders.map((o) => o.id);

  if (!online) {
    window.location.href = `order-tracking.html?order=${orders[0].id}&orders=${orderIds.join(",")}`;
    return;
  }
  await goToPayment(paymentMethod, orderIds);
}

window.BSTM.ready().then(async function (session) {
  if (!session) {
    window.location.href = "login.html?redirect=checkout.html";
    return;
  }

  const emailEl = document.getElementById("email");
  const nameEl = document.getElementById("fullName");
  if (emailEl && !emailEl.value) emailEl.value = session.user.email;
  if (nameEl && !nameEl.value)
    nameEl.value =
      session.user.user_metadata?.full_name || session.user.email.split("@")[0];

  const { data: profile } = await supabase
    .from("profiles")
    .select("thb_balance")
    .eq("id", session.user.id)
    .maybeSingle();
  const balanceEl = document.getElementById("thb-balance-display");
  if (balanceEl) balanceEl.textContent = Number(profile?.thb_balance || 0).toFixed(1);

  renderCart();

  document.querySelectorAll('input[name="delivery"]').forEach((el) => {
    el.addEventListener("change", renderCart);
  });

  // Payment methods come from the database (only the ones switched on are shown).
  document.addEventListener("change", (e) => {
    if (e.target && e.target.name === "payment") syncPaymentUi();
  });
  await loadPaymentMethods();

  const btn = document.getElementById("place-order-btn");
  if (btn) btn.addEventListener("click", handlePlaceOrder);
});

window.addEventListener("bstm:cartUpdated", renderCart);
window.logout = function () {
  if (confirm("Logout?")) window.BSTM.logout();
};
