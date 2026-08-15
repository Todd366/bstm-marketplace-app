// js/pages/checkout.js
import { supabase } from "../core/supabase-client.js";
import { getCart, getCartGroupedByRoom, getCartTotal, clearCart } from "../core/cart.js";
import { CONFIG } from "../core/config.js";

const REWARD_PERCENT = CONFIG.MARKETPLACE.REWARD_PERCENT / 100; // e.g. 1%

function renderCart() {
  const cart = getCart();
  const itemsEl = document.getElementById("checkout-items");
  const subtotalEl = document.getElementById("checkout-subtotal");
  const totalEl = document.getElementById("checkout-total");
  const thbEl = document.getElementById("checkout-thb-reward");
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
                 <span class="text-xs font-bold text-purple-600 uppercase tracking-wide">🏬 ${group.room_name}</span>
                 <span class="text-xs text-gray-400">Separate order — this seller ships independently</span>
               </div>`
            : ""
        }
        ${group.items
          .map(
            (item) => `
          <div class="flex items-center space-x-4 mb-2">
            <img src="${item.image || ""}" onerror="this.style.display='none'" alt="${item.name}" class="w-16 h-16 rounded-lg object-cover bg-purple-50">
            <div class="flex-1">
              <h4 class="font-semibold text-gray-800">${item.name}</h4>
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

  const total = getCartTotal();
  const reward = total * REWARD_PERCENT;

  if (subtotalEl) subtotalEl.textContent = `P${total.toFixed(2)}`;
  if (totalEl) totalEl.textContent = `P${total.toFixed(2)}`;
  if (thbEl) thbEl.textContent = reward.toFixed(3);

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

async function createOrder(session, cart) {
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
  const paymentMethod =
    document.querySelector('input[name="payment"]:checked')?.value || "paystack";

  // Each room is a separate seller — split the cart into one order per room
  // rather than one order for the whole basket. A shopper buying from 3
  // rooms in one checkout ends up with 3 independent orders, each visible
  // only to its own seller, each trackable separately.
  const groups = getCartGroupedByRoom();
  const createdOrders = [];

  for (const group of groups) {
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        buyer_id: userId,
        product_id: group.items[0].id, // kept for backward-compat joins
        room_id: group.room_id,
        seller_id: group.seller_id,
        status: "confirmed",
        total_amount: group.subtotal,
        delivery_method: deliveryMethod,
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
    if (itemsErr) throw itemsErr;

    // Auto-create a CabLink pickup task for this room's order so it shows
    // up ready-to-claim in the real CabLink driver app — no manual step
    // needed from the buyer or seller.
    if (deliveryMethod === "cablink" && group.room_id) {
      await supabase.from("delivery_requests").insert({
        order_id: order.id,
        buyer_id: userId,
        pickup_room_id: group.room_id,
        dropoff_address: delivery.delivery_address,
        dropoff_city: delivery.delivery_city,
        dropoff_phone: delivery.delivery_phone,
        status: "pending",
      });
    }

    createdOrders.push(order);
  }

  // Reward THB — credited immediately for MVP. In production this should be
  // confirmed server-side once the Paystack webhook verifies payment.
  const total = getCartTotal();
  const reward = Math.round(total * REWARD_PERCENT);
  if (reward > 0) {
    await supabase.from("wallet_ledger").insert({
      user_id: userId,
      amount_thb: reward,
      type: "credit",
      reference_type: "order",
      reference_id: createdOrders[0].id,
      meta: { reason: "purchase_reward", order_count: createdOrders.length },
    });
  }

  return createdOrders;
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

  const session = await window.BSTM.ready();
  if (!session) {
    window.location.href = "login.html?redirect=checkout.html";
    return;
  }

  const btn = document.getElementById("place-order-btn");
  btn.disabled = true;
  btn.textContent = "Processing…";

  const total = getCartTotal();
  const email = document.getElementById("email").value;

  // NOTE: This confirms payment on the client-side Paystack callback, which
  // is fine for early testing but is NOT secure for real money — a user
  // could fake success without paying. Before going live, verify payment
  // server-side via a Paystack webhook (see backend/) before creating the
  // order. Flagging this clearly rather than hiding it.
  if (!window.PaystackPop || CONFIG.API.PAYSTACK_PUBLIC === "pk_live_xxx") {
    showError(
      "Payment isn't configured yet — add a real Paystack public key in js/core/config.js before going live."
    );
    btn.disabled = false;
    btn.textContent = "Place Order";
    return;
  }

  const handler = PaystackPop.setup({
    key: CONFIG.API.PAYSTACK_PUBLIC,
    email: email,
    amount: Math.round(total * 100), // kobo/thebe
    currency: CONFIG.PAYSTACK.CURRENCY,
    ref: "BSTM-" + Date.now() + "-" + Math.floor(Math.random() * 10000),
    callback: function (response) {
      createOrder(session, cart)
        .then((orders) => {
          clearCart();
          const orderIds = orders.map((o) => o.id).join(",");
          window.location.href = `order-tracking.html?order=${orders[0].id}&orders=${orderIds}&ref=${response.reference}`;
        })
        .catch((err) => {
          console.error("[BSTM Checkout] Order creation failed:", err);
          showError(
            "Payment succeeded but saving your order failed. Contact support with reference " +
              response.reference
          );
          btn.disabled = false;
          btn.textContent = "Place Order";
        });
    },
    onClose: function () {
      btn.disabled = false;
      btn.textContent = "Place Order";
    },
  });

  handler.openIframe();
}

window.BSTM.ready().then(function (session) {
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

  renderCart();

  const btn = document.getElementById("place-order-btn");
  if (btn) btn.addEventListener("click", handlePlaceOrder);
});

window.addEventListener("bstm:cartUpdated", renderCart);
window.logout = function () {
  if (confirm("Logout?")) window.BSTM.logout();
};
