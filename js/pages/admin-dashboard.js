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

  async function reviewKyc(kycId, userId, decision) {
    const row = document.querySelector(`[data-kyc-row="${kycId}"]`);
    const buttons = row ? row.querySelectorAll("button") : [];
    buttons.forEach((b) => (b.disabled = true));

    const { error } = await supabase
      .from("kyc_submissions")
      .update({
        status: decision,
        reviewed_by: session.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", kycId);

    if (error) {
      console.error("[BSTM Admin] KYC review failed:", error);
      alert("Couldn't save that decision. Please try again.");
      buttons.forEach((b) => (b.disabled = false));
      return;
    }

    // Best-effort — the review itself already succeeded even if this fails.
    const { error: notifyErr } = await supabase.rpc("notify_kyc_decision", {
      target_user_id: userId,
      decision,
    });
    if (notifyErr) console.warn("[BSTM Admin] KYC notification failed:", notifyErr);

    if (row) {
      row.style.opacity = "0.5";
      row.innerHTML = `<span class="text-sm text-gray-500">${decision === "approved" ? "✅ Approved" : "❌ Rejected"}</span>`;
    }
  }


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
    .select("id, user_id, full_name, created_at")
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
      <div class="flex justify-between items-center p-3 bg-yellow-50 rounded-lg" data-kyc-row="${k.id}">
        <div>
          <span class="text-sm font-semibold text-gray-800">${escapeHtml(k.full_name || "Unnamed applicant")}</span>
          <span class="text-xs text-gray-500 block">${new Date(k.created_at).toLocaleDateString()}</span>
        </div>
        <div class="flex gap-2">
          <button class="kyc-approve-btn text-xs font-bold bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg" data-id="${k.id}" data-user="${k.user_id}">Approve</button>
          <button class="kyc-reject-btn text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg" data-id="${k.id}" data-user="${k.user_id}">Reject</button>
        </div>
      </div>`
      )
      .join("");

    kycEl.querySelectorAll(".kyc-approve-btn").forEach((btn) =>
      btn.addEventListener("click", () => reviewKyc(btn.dataset.id, btn.dataset.user, "approved"))
    );
    kycEl.querySelectorAll(".kyc-reject-btn").forEach((btn) =>
      btn.addEventListener("click", () => reviewKyc(btn.dataset.id, btn.dataset.user, "rejected"))
    );
  }

  const { data: recentOrders } = await supabase
    .from("orders")
    .select("id, total_amount, status, created_at")
    .order("created_at", { ascending: false })
    .limit(15);

  const ordersEl = document.getElementById("recent-orders-list");
  if (!recentOrders || recentOrders.length === 0) {
    ordersEl.innerHTML = '<p class="text-sm text-gray-400">No orders yet.</p>';
  } else {
    const ADMIN_ACTIONS = {
      pending: [{ label: "Confirm", next: "confirmed" }, { label: "Cancel", next: "cancelled" }],
      confirmed: [{ label: "Mark Shipped", next: "shipped" }, { label: "Cancel", next: "cancelled" }],
      shipped: [{ label: "Mark Delivered", next: "delivered" }],
    };
    ordersEl.innerHTML = recentOrders
      .map((o) => {
        const actions = ADMIN_ACTIONS[o.status] || [];
        const btns = actions
          .map(
            (a) =>
              `<button data-order-id="${o.id}" data-next-status="${a.next}" class="admin-order-btn text-xs font-semibold px-2 py-1 rounded ${a.next === "cancelled" ? "bg-red-100 text-red-700" : "bg-purple-100 text-purple-700"}">${a.label}</button>`
          )
          .join(" ");
        return `
      <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg gap-2">
        <span class="text-sm font-semibold text-gray-800">#${o.id.split("-")[0].toUpperCase()}</span>
        <span class="text-xs text-gray-500 capitalize">${o.status}</span>
        <span class="text-sm font-bold text-purple-600">P${Number(o.total_amount || 0).toFixed(2)}</span>
        <span class="flex gap-1">${btns}</span>
      </div>`;
      })
      .join("");

    ordersEl.querySelectorAll(".admin-order-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        const { error } = await supabase.rpc("advance_order_status", {
          p_order_id: btn.dataset.orderId,
          p_new_status: btn.dataset.nextStatus,
        });
        if (error) {
          console.error("[BSTM Admin] Couldn't update order:", error);
          alert("Couldn't update this order: " + error.message);
          btn.disabled = false;
          return;
        }
        location.reload();
      });
    });
  }

  // ===== Customers (with real emails) =====
  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("id, email, role, thb_balance, created_at")
    .order("created_at", { ascending: false });

  const { data: allOrdersForCount } = await supabase.from("orders").select("buyer_id");
  const orderCountByBuyer = {};
  (allOrdersForCount || []).forEach((o) => {
    orderCountByBuyer[o.buyer_id] = (orderCountByBuyer[o.buyer_id] || 0) + 1;
  });

  function renderCustomers(filterText) {
    const tbody = document.getElementById("customers-table");
    const rows = (allProfiles || []).filter(
      (p) => !filterText || (p.email || "").toLowerCase().includes(filterText.toLowerCase())
    );
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="py-3 text-gray-400">No matching customers.</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(
        (p) => `
      <tr class="border-b last:border-0">
        <td class="py-2 pr-4">${escapeHtml(p.email || "—")}</td>
        <td class="py-2 pr-4 capitalize">${escapeHtml(p.role || "buyer")}</td>
        <td class="py-2 pr-4">${Number(p.thb_balance || 0).toFixed(1)}</td>
        <td class="py-2 pr-4">${orderCountByBuyer[p.id] || 0}</td>
        <td class="py-2">${new Date(p.created_at).toLocaleDateString()}</td>
      </tr>`
      )
      .join("");
  }
  renderCustomers("");
  document.getElementById("customer-search").addEventListener("input", (e) => renderCustomers(e.target.value));

  // ===== Sellers & Rooms (with real owner emails) =====
  const { data: allRooms } = await supabase
    .from("rooms")
    .select("id, name, status, seller_id, profiles(email)");
  const { data: allProductsForRooms } = await supabase.from("products").select("id, room_id");
  const { data: allOrderItemsForRooms } = await supabase
    .from("order_items")
    .select("quantity, unit_price, product_id, products(room_id)");

  const productCountByRoom = {};
  (allProductsForRooms || []).forEach((p) => {
    if (p.room_id) productCountByRoom[p.room_id] = (productCountByRoom[p.room_id] || 0) + 1;
  });
  const revenueByRoom = {};
  (allOrderItemsForRooms || []).forEach((i) => {
    const rid = i.products?.room_id;
    if (rid) revenueByRoom[rid] = (revenueByRoom[rid] || 0) + i.quantity * i.unit_price;
  });

  const sellersTbody = document.getElementById("sellers-table");
  if (!allRooms || allRooms.length === 0) {
    sellersTbody.innerHTML = '<tr><td colspan="5" class="py-3 text-gray-400">No rooms yet.</td></tr>';
  } else {
    sellersTbody.innerHTML = allRooms
      .map(
        (r) => `
      <tr class="border-b last:border-0">
        <td class="py-2 pr-4 font-semibold">${escapeHtml(r.name)}</td>
        <td class="py-2 pr-4">${escapeHtml(r.profiles?.email || "—")}</td>
        <td class="py-2 pr-4 capitalize">${escapeHtml(r.status)}</td>
        <td class="py-2 pr-4">${productCountByRoom[r.id] || 0}</td>
        <td class="py-2">P${(revenueByRoom[r.id] || 0).toFixed(2)}</td>
      </tr>`
      )
      .join("");
  }

  // ===== Revenue Breakdown (real GMV + platform commission) =====
  const gmv = (items || []).reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const COMMISSION_RATE = 0.05; // matches the 5% baseline commission
  const commission = gmv * COMMISSION_RATE;
  document.getElementById("revenue-breakdown").innerHTML = `
    <div class="bg-purple-50 rounded-xl p-4">
      <p class="text-2xl font-bold text-purple-700">P${gmv.toFixed(2)}</p>
      <p class="text-xs text-gray-600">Gross Order Value</p>
    </div>
    <div class="bg-green-50 rounded-xl p-4">
      <p class="text-2xl font-bold text-green-700">P${commission.toFixed(2)}</p>
      <p class="text-xs text-gray-600">Platform Commission (5%)</p>
    </div>
    <div class="bg-blue-50 rounded-xl p-4">
      <p class="text-2xl font-bold text-blue-700">P${(gmv - commission).toFixed(2)}</p>
      <p class="text-xs text-gray-600">Seller Payout (est.)</p>
    </div>`;

  // ===== Needs Attention =====
  const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: stalePendingCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .lt("created_at", staleThreshold);
  const { count: pendingKycCount } = await supabase
    .from("kyc_submissions")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  const inactiveRoomCount = (allRooms || []).filter((r) => r.status !== "active").length;

  document.getElementById("needs-attention-list").innerHTML = `
    <a href="#" class="block bg-yellow-50 rounded-xl p-4 hover:bg-yellow-100">
      <p class="text-2xl font-bold text-yellow-700">${pendingKycCount ?? 0}</p>
      <p class="text-xs text-gray-600">Pending KYC reviews</p>
    </a>
    <div class="block bg-red-50 rounded-xl p-4">
      <p class="text-2xl font-bold text-red-700">${stalePendingCount ?? 0}</p>
      <p class="text-xs text-gray-600">Orders pending &gt;24h, unconfirmed</p>
    </div>
    <div class="block bg-gray-50 rounded-xl p-4">
      <p class="text-2xl font-bold text-gray-700">${inactiveRoomCount}</p>
      <p class="text-xs text-gray-600">Inactive / suspended rooms</p>
    </div>`;

  // ===== Audit Log =====
  const { data: auditRows } = await supabase
    .from("admin_audit_log")
    .select("id, action, resource_type, resource_id, reason, created_at, profiles!admin_audit_log_actor_profiles_fkey(email)")
    .order("created_at", { ascending: false })
    .limit(20);

  const auditEl = document.getElementById("audit-log-list");
  if (!auditRows || auditRows.length === 0) {
    auditEl.innerHTML = '<p class="text-gray-400">No admin actions recorded yet.</p>';
  } else {
    auditEl.innerHTML = auditRows
      .map(
        (a) => `
      <div class="flex justify-between items-center py-2 border-b last:border-0">
        <div>
          <span class="font-semibold text-gray-800">${escapeHtml(a.action)}</span>
          <span class="text-gray-500"> on ${escapeHtml(a.resource_type)} · by ${escapeHtml(a.profiles?.email || "system")}</span>
          ${a.reason ? `<span class="block text-xs text-gray-400">"${escapeHtml(a.reason)}"</span>` : ""}
        </div>
        <span class="text-xs text-gray-400">${new Date(a.created_at).toLocaleString()}</span>
      </div>`
      )
      .join("");
  }
});

window.handleLogout = function () {
  if (confirm("Logout?")) window.BSTM.logout();
};
