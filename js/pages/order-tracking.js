// js/pages/order-tracking.js
import { supabase } from "../core/supabase-client.js";
import { escapeHtml } from "../core/sanitize.js";

const STATUS_STEPS = [
  { key: "pending", label: "Order Placed", icon: "fa-check", desc: "Your order has been received." },
  { key: "confirmed", label: "Order Confirmed", icon: "fa-box", desc: "The seller is preparing your order." },
  { key: "shipped", label: "Out for Delivery", icon: "fa-truck", desc: "Your order is on its way." },
  { key: "delivered", label: "Delivered", icon: "fa-home", desc: "Delivered to your doorstep." },
];

function statusIndex(status) {
  const i = STATUS_STEPS.findIndex((s) => s.key === status);
  return i === -1 ? 0 : i;
}

function renderTimeline(status) {
  const activeIndex = statusIndex(status);
  const container = document.getElementById("order-timeline");
  if (!container) return;

  if (status === "cancelled") {
    container.innerHTML = `
      <div class="flex items-start">
        <div class="status-dot bg-red-500 rounded-full flex items-center justify-center mr-6 flex-shrink-0">
          <i class="fas fa-times text-white text-xl"></i>
        </div>
        <div>
          <h3 class="text-lg font-bold text-gray-800">Order Cancelled</h3>
          <p class="text-sm text-gray-600 mt-2">This order was cancelled.</p>
        </div>
      </div>`;
    return;
  }

  container.innerHTML = STATUS_STEPS.map((step, i) => {
    const isActive = i <= activeIndex;
    return `
      <div class="timeline-step ${isActive ? "active" : ""} flex items-start">
        <div class="status-dot ${isActive ? "active" : "bg-gray-300"} rounded-full flex items-center justify-center mr-6 flex-shrink-0">
          <i class="fas ${step.icon} ${isActive ? "text-white" : "text-gray-600"} text-xl"></i>
        </div>
        <div>
          <h3 class="text-lg font-bold ${isActive ? "text-gray-800" : "text-gray-400"}">${step.label}</h3>
          <p class="text-sm ${isActive ? "text-gray-500" : "text-gray-500"}">${isActive ? "" : "Pending"}</p>
          <p class="text-sm text-gray-700 mt-2">${step.desc}</p>
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

  document.getElementById("order-number").textContent =
    "BSTM-" + order.id.split("-")[0].toUpperCase();

  document.getElementById("order-date").textContent = new Date(
    order.created_at
  ).toLocaleString("en-BW", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  document.getElementById("delivery-method").innerHTML =
    `<i class="fas fa-car text-purple-600 mr-2"></i>${
      order.delivery_method === "cablink" ? "CabLink Express" : order.delivery_method || "—"
    }`;

  document.getElementById("payment-method").textContent =
    order.payment_method === "paystack" ? "Paystack" : order.payment_method || "—";

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

  renderTimeline(order.status);
  if (items) renderItems(items);
}

window.BSTM.ready().then(async function (session) {
  if (!session) {
    window.location.href = "login.html?redirect=order-tracking.html";
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("order");

  if (!orderId) {
    document.getElementById("order-not-found").classList.remove("hidden");
    return;
  }

  await loadOrder(orderId, session);
});

window.logout = function () {
  if (confirm("Logout?")) window.BSTM.logout();
};
