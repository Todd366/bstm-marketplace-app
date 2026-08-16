// js/pages/admin-dashboard.js
import { getProfile } from "../bstm-core.js";
import { supabase } from "../core/supabase-client.js";
import { escapeHtml } from "../core/sanitize.js";

window.BSTM.ready().then(async function (session) {
  if (!session) {
    window.location.href = "login.html?redirect=admin-dashboard.html";
    return;
  }

  const { data: profile } = await getProfile(session.user.id);

  if (!profile || profile.role !== "admin") {
    alert("This dashboard is restricted to administrators.");
    window.location.href = "buyer-dashboard.html";
    return;
  }

  document.getElementById("admin-user").textContent = session.user.email.split("@")[0];

  const { count: userCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true });
  document.getElementById("stat-users").textContent = userCount ?? "—";

  const { data: sellerRows } = await supabase.from("products").select("seller_id");
  const sellerCount = new Set((sellerRows || []).map((r) => r.seller_id).filter(Boolean)).size;
  document.getElementById("stat-sellers").textContent = sellerCount;

  const { count: orderCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true });
  document.getElementById("stat-orders").textContent = orderCount ?? "—";

  const { data: items } = await supabase.from("order_items").select("quantity, unit_price");
  const revenue = (items || []).reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  document.getElementById("stat-revenue").textContent = `P${revenue.toFixed(2)}`;

  const { data: kycRows } = await supabase
    .from("kyc_submissions")
    .select("id, full_name, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(5);

  const kycEl = document.getElementById("pending-kyc-list");
  if (!kycRows || kycRows.length === 0) {
    kycEl.innerHTML = '<p class="text-sm text-gray-400">No pending reviews.</p>';
  } else {
    kycEl.innerHTML = kycRows
      .map(
        (k) => `
      <div class="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
        <span class="text-sm font-semibold text-gray-800">${escapeHtml(k.full_name || "Unnamed applicant")}</span>
        <span class="text-xs text-gray-500">${new Date(k.created_at).toLocaleDateString()}</span>
      </div>`
      )
      .join("");
  }

  const { data: recentOrders } = await supabase
    .from("orders")
    .select("id, total_amount, status, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  const ordersEl = document.getElementById("recent-orders-list");
  if (!recentOrders || recentOrders.length === 0) {
    ordersEl.innerHTML = '<p class="text-sm text-gray-400">No orders yet.</p>';
  } else {
    ordersEl.innerHTML = recentOrders
      .map(
        (o) => `
      <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
        <span class="text-sm font-semibold text-gray-800">#${o.id.split("-")[0].toUpperCase()}</span>
        <span class="text-xs text-gray-500 capitalize">${o.status}</span>
        <span class="text-sm font-bold text-purple-600">P${Number(o.total_amount || 0).toFixed(2)}</span>
      </div>`
      )
      .join("");
  }
});

window.handleLogout = function () {
  if (confirm("Logout?")) window.BSTM.logout();
};
