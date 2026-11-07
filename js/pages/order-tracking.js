// js/pages/order-tracking.js
import { supabase } from "../core/supabase-client.js";
import { escapeHtml } from "../core/sanitize.js";
import {
  paymentLabel,
  paymentBadge,
  isOnlineOrder,
  awaitingPayment,
  dispatchOrderToCabLink,
  shortOrderRef,
} from "../core/payments.js";

const STATUS_STEPS = [
  { key: "pending", label: "Order Placed", icon: "fa-check", desc: "Your order has been received." },
  { key: "confirmed", label: "Order Confirmed", icon: "fa-box", desc: "The seller is preparing your order." },
  { key: "shipped", label: "Out for Delivery", icon: "fa-truck", desc: "Your order is on its way." },
  { key: "delivered", label: "Delivered", icon: "fa-home", desc: "Delivered to your doorstep." },
];

// One automatic CabLink hand-off attempt per order per page visit. The server call is idempotent
// and refuses unpaid / cancelled orders, so repeating it is safe; this only avoids hammering it.
const dispatchTried = new Set();
let refreshTimer = null;

function statusIndex(status) {
  const i = STATUS_STEPS.findIndex((s) => s.key === status);
  return i === -1 ? 0 : i;
}

function renderTimeline(order) {
  const status = order.status;
  const activeIndex = statusIndex(status);
  const container = document.getElementById("order-timeline");
  if (!container) return;
  const waitingOnPayment = awaitingPayment(order);

  if (status === "cancelled") {
    container.innerHTML = `
      <div class="flex items-start">
        <div class="status-dot bg-red-500 rounded-full flex items-center justify-center mr-6 flex-shrink-0">
          <i class="fas fa-times text-white text-xl"></i>
        </div>
        <div>
          <h3 class="text-lg font-bold text-gray-800">Order Cancelled</h3>
          <p class="text-sm text-gray-600 mt-2">${
            isOnlineOrder(order) && order.payment_status !== "paid" && order.payment_status !== "refunded"
              ? "This order was cancelled and the items were released back to the shop."
              : "This order was cancelled."
          }</p>
        </div>
      </div>`;
    return;
  }

  container.innerHTML = STATUS_STEPS.map((step, i) => {
    const isActive = i <= activeIndex;
    const desc = i === 0 && waitingOnPayment ? "Waiting for your payment — the seller starts once it is confirmed." : step.desc;
    return `
      <div class="timeline-step ${isActive ? "active" : ""} flex items-start">
        <div class="status-dot ${isActive ? "active" : "bg-gray-300"} rounded-full flex items-center justify-center mr-6 flex-shrink-0">
          <i class="fas ${step.icon} ${isActive ? "text-white" : "text-gray-600"} text-xl"></i>
        </div>
        <div>
          <h3 class="text-lg font-bold ${isActive ? "text-gray-800" : "text-gray-400"}">${step.label}</h3>
          <p class="text-sm ${isActive ? "text-gray-500" : "text-gray-500"}">${isActive ? "" : "Pending"}</p>
          <p class="text-sm text-gray-700 mt-2">${escapeHtml(desc)}</p>
        </div>
      </div>`;
  }).join("");
}

function renderItems(items) {
  const container = document.getElementById("order-items-list");
  if (!container) return;

  container.innerHTML = items
    .map(
      (item) => `
      <div class="flex items-center space-x-4 p-4 border-2 border-gray-200 rounded-xl">
        <div class="flex-1">
          <h3 class="font-bold text-gray-800">${escapeHtml(item.product_name)}</h3>
          <span class="text-sm text-gray-600">Qty: ${item.quantity}</span>
        </div>
        <div class="text-right">
          <p class="text-xl font-bold text-gray-800">P${(item.unit_price * item.quantity).toFixed(2)}</p>
        </div>
      </div>`
    )
    .join("");
}

function renderOrdersList(orders) {
  const listEl = document.getElementById("orders-list");
  const emptyEl = document.getElementById("orders-list-empty");
  document.getElementById("orders-list-section").classList.remove("hidden");

  if (!orders || orders.length === 0) {
    emptyEl.classList.remove("hidden");
    return;
  }

  listEl.innerHTML = orders
    .map((o) => {
      const statusColors = {
        pending: "bg-yellow-100 text-yellow-800",
        confirmed: "bg-blue-100 text-blue-800",
        shipped: "bg-purple-100 text-purple-800",
        delivered: "bg-green-100 text-green-800",
        cancelled: "bg-red-100 text-red-800",
      };
      const colorClass = statusColors[o.status] || "bg-gray-100 text-gray-700";
      const badge = paymentBadge(o);
      return `
      <a href="order-tracking.html?order=${encodeURIComponent(o.id)}" class="block bg-white rounded-xl shadow p-5 hover:shadow-md transition-shadow">
        <div class="flex justify-between items-center">
          <div>
            <p class="font-bold text-gray-800">${escapeHtml(shortOrderRef(o.id))}</p>
            <p class="text-sm text-gray-500">${new Date(o.created_at).toLocaleDateString("en-BW", { dateStyle: "medium" })}</p>
          </div>
          <div class="text-right">
            <p class="text-lg font-bold text-gray-800">P${Number(o.total_amount || 0).toFixed(2)}</p>
            <span class="inline-block text-xs font-semibold px-2 py-1 rounded-full capitalize ${colorClass}">${escapeHtml(o.status)}</span>
            ${badge ? `<div style="margin-top:4px;">${badge}</div>` : ""}
          </div>
        </div>
      </a>`;
    })
    .join("");
}

// ---------------------------------------------------------------- banner + payment panel
function resetBanner() {
  const banner = document.getElementById("order-banner");
  const icon = document.getElementById("order-banner-icon");
  if (banner) {
    banner.style.background = "";
    banner.style.borderColor = "";
  }
  if (icon) icon.style.background = "";
}

function setBanner(order) {
  const banner = document.getElementById("order-banner");
  const icon = document.getElementById("order-banner-icon");
  const glyph = document.getElementById("order-banner-glyph");
  const title = document.getElementById("order-banner-title");
  const sub = document.getElementById("order-banner-sub");
  const thb = document.getElementById("thb-box");
  if (!banner || !icon || !glyph || !title || !sub) return;

  const paint = (bg, border, iconBg, glyphClass, t, s, showThb) => {
    banner.style.background = bg;
    banner.style.borderColor = border;
    icon.style.background = iconBg;
    glyph.className = "fas " + glyphClass + " text-white text-4xl";
    title.textContent = t;
    sub.textContent = s;
    if (thb) thb.style.display = showThb ? "" : "none";
  };

  resetBanner();
  if (order.status === "cancelled") {
    paint("#fef2f2", "#fca5a5", "#dc2626", "fa-times", "Order Cancelled", "This order was cancelled.", false);
  } else if (order.payment_status === "review") {
    paint("#fff7ed", "#fdba74", "#ea580c", "fa-search", "Payment under review", "Please don't pay again — our team is checking your payment.", false);
  } else if (awaitingPayment(order)) {
    const inProgress = order.payment_status === "pending";
    paint(
      "#fffbeb",
      "#fcd34d",
      "#d97706",
      inProgress ? "fa-hourglass-half" : "fa-clock",
      inProgress ? "Payment in progress" : "Waiting for payment",
      "Your order is reserved. The seller starts once your payment is confirmed.",
      false
    );
  } else {
    glyph.className = "fas fa-check text-white text-4xl";
    title.textContent = order.payment_status === "paid" && isOnlineOrder(order) ? "Payment received — order confirmed" : "Order Placed Successfully!";
    sub.textContent = "Thank you for shopping with BSTM Marketplace";
    if (thb) thb.style.display = "";
  }
}

function payHref(order) {
  return order.payment_group_id
    ? "payment-status.html?group=" + encodeURIComponent(order.payment_group_id)
    : "payment-status.html?orders=" + encodeURIComponent(order.id);
}

function renderPaymentPanel(order) {
  const panel = document.getElementById("payment-panel");
  const title = document.getElementById("payment-panel-title");
  const text = document.getElementById("payment-panel-text");
  const btn = document.getElementById("payment-panel-btn");
  if (!panel || !title || !text || !btn) return;

  const show = (t, s, btnLabel, colors) => {
    title.textContent = t;
    text.textContent = s;
    panel.style.borderColor = colors[0];
    panel.style.background = colors[1];
    if (btnLabel) {
      btn.textContent = btnLabel;
      btn.setAttribute("href", payHref(order));
      btn.classList.remove("hidden");
    } else {
      btn.classList.add("hidden");
    }
    panel.classList.remove("hidden");
  };

  panel.classList.add("hidden");
  if (!isOnlineOrder(order)) return;

  const due = order.payment_due_at
    ? new Date(order.payment_due_at).toLocaleString("en-BW", { dateStyle: "medium", timeStyle: "short" })
    : null;
  const amber = ["#fcd34d", "#fffbeb"];

  if (order.status === "cancelled") {
    if (order.payment_status === "refunded") show("Payment refunded", "This order was cancelled and your payment was refunded.", null, ["#d1d5db", "#f9fafb"]);
    else if (order.payment_status === "review") show("Payment under review", "This order was cancelled but a payment needs checking. Please don't pay again — our team will contact you.", null, ["#fdba74", "#fff7ed"]);
    return;
  }

  switch (order.payment_status) {
    case "unpaid":
      show("Payment needed", due ? `Pay before ${due}, or this order is cancelled and the items are released.` : "Pay to confirm this order.", "Pay now", amber);
      break;
    case "failed":
      show("Payment didn't go through", due ? `Your order is still reserved until ${due}. Try again with the same or another method.` : "Try again with the same or another method.", "Try again", ["#fca5a5", "#fef2f2"]);
      break;
    case "pending":
      show("Payment in progress", "We're waiting for the payment provider or our team to confirm your payment.", "View payment", ["#93c5fd", "#eff6ff"]);
      break;
    case "review":
      show("Payment under review", "Please don't pay again. Our team is checking your payment and will contact you.", "View payment", ["#fdba74", "#fff7ed"]);
      break;
    case "refunded":
      show("Payment refunded", "This payment was refunded.", null, ["#d1d5db", "#f9fafb"]);
      break;
    default:
      break; // paid: nothing to act on
  }
}

// ---------------------------------------------------------------- CabLink
function setDriverStatus(html) {
  const statusEl = document.getElementById("cablink-driver-status");
  if (statusEl) statusEl.innerHTML = html;
}

function showSendButton(order, visible) {
  const wrap = document.getElementById("cablink-send-wrap");
  const btn = document.getElementById("cablink-send-btn");
  if (!wrap || !btn) return;
  wrap.classList.toggle("hidden", !visible);
  btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = "Sending…";
    const res = await dispatchOrderToCabLink(order.id);
    btn.disabled = false;
    btn.textContent = "Send delivery request now";
    applyDispatchResult(order, res);
  };
}

function applyDispatchResult(order, res) {
  if (res === "sent" || res === "already") {
    setDriverStatus('<i class="fas fa-check-circle text-green-500 text-4xl mb-4 block"></i>Sent to a CabLink driver');
    showSendButton(order, false);
  } else if (res === "blocked") {
    setDriverStatus('<i class="fas fa-lock text-4xl mb-4 block"></i>Delivery can be requested once the order is paid and active.');
    showSendButton(order, false);
  } else if (res === "none") {
    setDriverStatus('<i class="fas fa-question-circle text-4xl mb-4 block"></i>No delivery request was found for this order.');
    showSendButton(order, false);
  } else {
    setDriverStatus(
      '<i class="fas fa-clock text-4xl mb-4 block"></i>CabLink couldn\'t take the delivery request just now. It is saved — try again in a moment.'
    );
    showSendButton(order, true);
  }
}

async function renderCabLink(order) {
  const section = document.getElementById("cablink-driver-section");
  if (!section) return;
  // Only CabLink orders have a driver at all — self-pickup and service orders have none.
  if (order.delivery_method !== "cablink") {
    section.classList.add("hidden");
    return;
  }
  section.classList.remove("hidden");

  if (order.status === "cancelled") {
    setDriverStatus('<i class="fas fa-ban text-4xl mb-4 block"></i>This order was cancelled, so no driver will be sent.');
    showSendButton(order, false);
    return;
  }
  if (awaitingPayment(order)) {
    setDriverStatus('<i class="fas fa-clock text-4xl mb-4 block"></i>A driver is requested once your payment is confirmed.');
    showSendButton(order, false);
    return;
  }

  const { data: deliveryRequest } = await supabase
    .from("delivery_requests")
    .select("status, cablink_ride_id")
    .eq("order_id", order.id)
    .maybeSingle();

  if (deliveryRequest && deliveryRequest.cablink_ride_id) {
    applyDispatchResult(order, "already");
    return;
  }
  if (deliveryRequest && deliveryRequest.status === "cancelled") {
    setDriverStatus('<i class="fas fa-ban text-4xl mb-4 block"></i>The delivery request for this order was cancelled.');
    showSendButton(order, false);
    return;
  }
  if (!deliveryRequest) {
    applyDispatchResult(order, "none");
    return;
  }

  // Paid online order whose hand-off hasn't happened yet (the buyer didn't come back to the
  // payment page): try once now, and leave a manual button if CabLink can't take it.
  if (isOnlineOrder(order) && order.payment_status === "paid" && !dispatchTried.has(order.id)) {
    dispatchTried.add(order.id);
    setDriverStatus('<i class="fas fa-spinner fa-spin text-4xl mb-4 block"></i>Sending your delivery request to CabLink…');
    showSendButton(order, false);
    applyDispatchResult(order, await dispatchOrderToCabLink(order.id));
    return;
  }

  setDriverStatus('<i class="fas fa-clock text-4xl mb-4 block"></i>Waiting to be sent to CabLink');
  showSendButton(order, true);
}

// ---------------------------------------------------------------- page
async function loadOrder(orderId, session) {
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("buyer_id", session.user.id)
    .single();

  if (error || !order) {
    document.getElementById("order-not-found").classList.remove("hidden");
    return;
  }

  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", order.id);

  document.getElementById("order-content").classList.remove("hidden");

  document.getElementById("order-number").textContent = shortOrderRef(order.id);

  document.getElementById("order-date").textContent = new Date(
    order.created_at
  ).toLocaleString("en-BW", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  document.getElementById("delivery-method").innerHTML =
    `<i class="fas fa-car text-purple-600 mr-2"></i>${
      order.delivery_method === "cablink" ? "CabLink Express" : escapeHtml(order.delivery_method || "—")
    }`;

  document.getElementById("payment-method").textContent = paymentLabel(order.payment_method);
  const stateEl = document.getElementById("payment-state");
  if (stateEl) stateEl.innerHTML = paymentBadge(order);

  document.getElementById("total-amount").textContent = order.total_amount
    ? `P${Number(order.total_amount).toFixed(2)}`
    : "—";

  const addrEl = document.getElementById("delivery-address");
  if (order.delivery_name || order.delivery_address) {
    addrEl.innerHTML = `
      <p class="text-gray-700">${escapeHtml(order.delivery_name || "")}</p>
      <p class="text-gray-700">${escapeHtml(order.delivery_address || "")}</p>
      <p class="text-gray-700">${escapeHtml(order.delivery_city || "")}, Botswana</p>
      <p class="text-gray-700">${escapeHtml(order.delivery_phone || "")}</p>`;
  }

  // THB reward is logged in wallet_ledger against this order
  const { data: reward } = await supabase
    .from("wallet_ledger")
    .select("amount_thb")
    .eq("reference_id", order.id)
    .eq("reference_type", "order")
    .maybeSingle();
  document.getElementById("thb-earned").textContent = reward
    ? reward.amount_thb.toFixed(1)
    : "0.0";

  setBanner(order);
  renderPaymentPanel(order);
  renderTimeline(order);
  if (items) renderItems(items);
  await renderCabLink(order);

  // An unpaid online order changes by itself (payment confirmed, window expired): keep it fresh.
  clearTimeout(refreshTimer);
  if (awaitingPayment(order) || order.payment_status === "pending") {
    refreshTimer = setTimeout(() => {
      if (document.visibilityState === "visible") loadOrder(orderId, session);
      else refreshTimer = setTimeout(() => loadOrder(orderId, session), 30000);
    }, 30000);
  }
}

window.BSTM.ready().then(async function (session) {
  if (!session) {
    window.location.href = "login.html?redirect=order-tracking.html";
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("order");

  if (!orderId) {
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, total_amount, status, created_at, payment_method, payment_status")
      .eq("buyer_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      document.getElementById("order-not-found").classList.remove("hidden");
      return;
    }
    renderOrdersList(orders);
    return;
  }

  await loadOrder(orderId, session);
});

window.logout = function () {
  if (confirm("Logout?")) window.BSTM.logout();
};
