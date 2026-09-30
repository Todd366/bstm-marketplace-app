#!/data/data/com.termux/files/usr/bin/bash
set -e
echo "Patching 6 files + 1 new SQL migration: super_admin/agent role tier, Control Center role management, admin-dashboard permission gating, plus a corrupted-emoji fix in nav.html..."

mkdir -p "$(dirname "admin-dashboard.html")"
cat > admin-dashboard.html << 'BSTM_PATCH_EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Dashboard - BSTM Marketplace</title>
  <link rel="manifest" href="manifest.json">
  <meta name="theme-color" content="#7C3AED">
    <link href="css/tailwind.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" rel="stylesheet">
    <style>
        .gradient-bg { background: linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%); }
    </style>
</head>
<body class="bg-gray-50">
    <div id="bstm-nav"></div>

    <div class="gradient-bg text-white py-4 px-6">
        <div class="max-w-7xl mx-auto flex justify-between items-center">
            <div>
                <h1 class="text-2xl font-bold">⚙️ Admin Dashboard</h1>
                <p class="text-purple-100 text-sm">Signed in as: <span id="admin-user">Loading…</span></p>
            </div>
            <button onclick="handleLogout()" class="bg-white text-purple-700 px-4 py-2 rounded-lg font-semibold hover:bg-purple-50">
                <i class="fas fa-sign-out-alt mr-2"></i>Logout
            </button>
        </div>
    </div>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div class="bg-white rounded-xl shadow-lg p-6">
                <p class="text-3xl font-bold text-gray-800" id="stat-users">—</p>
                <p class="text-sm text-gray-600">Total Users</p>
            </div>
            <div class="bg-white rounded-xl shadow-lg p-6">
                <p class="text-3xl font-bold text-gray-800" id="stat-sellers">—</p>
                <p class="text-sm text-gray-600">Active Sellers</p>
            </div>
            <div class="bg-white rounded-xl shadow-lg p-6">
                <p class="text-3xl font-bold text-gray-800" id="stat-orders">—</p>
                <p class="text-sm text-gray-600">Total Orders</p>
            </div>
            <div class="bg-white rounded-xl shadow-lg p-6">
                <p class="text-3xl font-bold text-gray-800" id="stat-revenue">—</p>
                <p class="text-sm text-gray-600">Order Value (all statuses)</p>
                <p class="text-xs text-gray-400 mt-1" id="stat-revenue-confirmed">Confirmed (delivered): —</p>
            </div>
        </div>
        <div id="cod-notice" class="hidden mb-8 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <i class="fas fa-info-circle mr-1"></i>
            <span id="cod-notice-text"></span>
        </div>

        <!-- 1. Needs Attention -->
        <div data-permission="attention" class="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h2 class="text-lg font-bold text-gray-800 mb-4">🔔 Needs Attention</h2>
            <div id="needs-attention-list" class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <p class="text-sm text-gray-500">Loading…</p>
            </div>
        </div>

        <!-- 2. Revenue Breakdown -->
        <div data-permission="revenue" class="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h2 class="text-lg font-bold text-gray-800 mb-4">💰 Revenue Breakdown</h2>
            <div id="revenue-breakdown" class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <p class="text-sm text-gray-500">Loading…</p>
            </div>
        </div>

        <!-- 3. Customers -->
        <div data-permission="customers" class="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-lg font-bold text-gray-800">👥 Customers</h2>
                <input id="customer-search" type="text" placeholder="Search by email…" class="text-sm border-2 border-gray-200 rounded-lg px-3 py-1.5">
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead><tr class="text-left text-gray-500 border-b">
                        <th class="pb-2 pr-4">Email</th><th class="pb-2 pr-4">Role</th><th class="pb-2 pr-4">THB</th><th class="pb-2 pr-4">Orders</th><th class="pb-2">Joined</th>
                    </tr></thead>
                    <tbody id="customers-table"><tr><td colspan="5" class="py-3 text-gray-400">Loading…</td></tr></tbody>
                </table>
            </div>
        </div>

        <!-- 4. Sellers / Rooms -->
        <div data-permission="sellers" class="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h2 class="text-lg font-bold text-gray-800 mb-4">🏪 Sellers &amp; Rooms</h2>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead><tr class="text-left text-gray-500 border-b">
                        <th class="pb-2 pr-4">Room</th><th class="pb-2 pr-4">Owner Email</th><th class="pb-2 pr-4">Status</th><th class="pb-2 pr-4">Products</th><th class="pb-2">Revenue</th>
                    </tr></thead>
                    <tbody id="sellers-table"><tr><td colspan="5" class="py-3 text-gray-400">Loading…</td></tr></tbody>
                </table>
            </div>
        </div>

        <!-- 5. Audit Log -->
        <div data-permission="audit" class="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h2 class="text-lg font-bold text-gray-800 mb-4">📋 Recent Admin Actions (Audit Log)</h2>
            <div id="audit-log-list" class="space-y-2 text-sm">
                <p class="text-gray-500">Loading…</p>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div data-permission="kyc" class="bg-white rounded-2xl shadow-lg p-6">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-lg font-bold text-gray-800">Pending KYC Reviews</h2>
                </div>
                <div id="pending-kyc-list" class="space-y-3">
                    <p class="text-sm text-gray-500">Loading…</p>
                </div>
            </div>

            <div data-permission="orders" class="bg-white rounded-2xl shadow-lg p-6">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-lg font-bold text-gray-800">Recent Orders</h2>
                </div>
                <div id="recent-orders-list" class="space-y-3">
                    <p class="text-sm text-gray-500">Loading…</p>
                </div>
            </div>
        </div>
    </div>

    <div id="bstm-footer"></div>
    <script src="components/smart-loader.js"></script>
    <script type="module" src="js/app.js?v=1788846845"></script>
    <script type="module" src="js/pages/admin-dashboard.js?v=1788955825"></script>
</body>
</html>
BSTM_PATCH_EOF

mkdir -p "$(dirname "js/pages/admin-dashboard.js")"
cat > js/pages/admin-dashboard.js << 'BSTM_PATCH_EOF'
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

  // Three staff tiers: super_admin (full access + can manage the team),
  // admin (full dashboard access, can't manage other admins), agent
  // (only the sections listed in profiles.agent_permissions).
  const STAFF_ROLES = ["admin", "agent", "super_admin"];
  if (!profile || !STAFF_ROLES.includes(profile.role)) {
    alert("This dashboard is restricted to administrators.");
    window.location.href = "buyer-dashboard.html";
    return;
  }

  const agentPermissions = profile.role === "agent" ? (profile.agent_permissions || []) : null;
  // null means "not an agent, no restriction" — admin/super_admin see everything.
  function canAccess(perm) {
    return agentPermissions === null || agentPermissions.includes(perm);
  }

  // Hide any section this identity isn't scoped to see. IMPORTANT: this is
  // a UX convenience only, not the real security boundary. Supabase RLS on
  // each table below (profiles, orders, kyc_submissions, admin_audit_log,
  // rooms, order_items) is what actually has to stop an agent's own network
  // requests from reading data outside their granted sections — hiding a
  // <div> does nothing to stop someone opening devtools and calling
  // supabase.from(...) directly. See the RLS policy notes shipped alongside
  // this change; they need to be applied in Supabase for this to be real
  // access control rather than a convenience UI.
  document.querySelectorAll("[data-permission]").forEach((el) => {
    if (!canAccess(el.dataset.permission)) el.classList.add("hidden");
  });

  document.getElementById("admin-user").textContent = session.user.email.split("@")[0];

  // Best-effort audit log write. admin_audit_log's exact column names
  // aren't confirmed from this repo (the table isn't in database/schema.sql
  // at all), so this can silently fail on a naming mismatch without
  // blocking the actual action — same pattern already used for the
  // notify_kyc_decision call below. Check the browser console once after
  // deploying; a warning there means the column name needs correcting.
  async function logAudit(action, resourceType, resourceId, reason) {
    const { error } = await supabase.from("admin_audit_log").insert({
      actor: session.user.id,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      reason: reason || null,
    });
    if (error) console.warn("[BSTM Admin] Audit log insert failed (action still applied):", error);
  }

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

    await logAudit(decision === "approved" ? "KYC_APPROVED" : "KYC_REJECTED", "kyc_submission", kycId, null);

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

  // ===== Top-line stats (visible to every staff tier, not permission-gated —
  // aggregate counts only, no operational detail) =====
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

  const { data: items } = await supabase.from("order_items").select("quantity, unit_price, order_id");
  const revenue = (items || []).reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  document.getElementById("stat-revenue").textContent = `P${revenue.toFixed(2)}`;

  const { data: allOrdersForRevenue } = await supabase.from("orders").select("id, status, payment_method");
  const deliveredIds = new Set((allOrdersForRevenue || []).filter((o) => o.status === "delivered").map((o) => o.id));
  const confirmedRevenue = (items || [])
    .filter((i) => deliveredIds.has(i.order_id))
    .reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  document.getElementById("stat-revenue-confirmed").textContent = `Confirmed (delivered): P${confirmedRevenue.toFixed(2)}`;

  const codPendingCount = (allOrdersForRevenue || []).filter((o) => o.payment_method === "cod" && o.status === "pending").length;
  if (codPendingCount > 0) {
    document.getElementById("cod-notice").classList.remove("hidden");
    document.getElementById("cod-notice-text").textContent =
      `${codPendingCount} order${codPendingCount === 1 ? " is" : "s are"} Cash on Delivery and still pending — that money hasn't been collected yet, so it isn't real revenue until the seller marks the order delivered.`;
  }

  // Rooms list is needed by both the Sellers table and Needs Attention —
  // fetched once here, unconditionally, so Needs Attention still works even
  // for an agent who isn't granted the "sellers" section.
  const { data: allRooms } = await supabase
    .from("rooms")
    .select("id, name, status, seller_id, profiles(email)");

  // ===== KYC Reviews =====
  if (canAccess("kyc")) {
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
  }

  // ===== Recent Orders =====
  if (canAccess("orders")) {
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
  }

  // ===== Customers (with real emails) =====
  if (canAccess("customers")) {
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
  }

  // ===== Sellers & Rooms (with real owner emails) =====
  if (canAccess("sellers")) {
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
  }

  // ===== Revenue Breakdown (real GMV + platform commission) =====
  if (canAccess("revenue")) {
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
  }

  // ===== Needs Attention =====
  if (canAccess("attention")) {
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
  }

  // ===== Audit Log =====
  if (canAccess("audit")) {
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
  }

});

window.handleLogout = function () {
  if (confirm("Logout?")) window.BSTM.logout();
};
BSTM_PATCH_EOF

mkdir -p "$(dirname "js/bstm-core.js")"
cat > js/bstm-core.js << 'BSTM_PATCH_EOF'
import { supabase } from "./core/supabase-client.js";

export { supabase };

// ============================================
// AUTH
// ============================================
export async function signInWithMagicLink(email) {
  const result = await supabase.auth.signInWithOtp({ email });
  if (result.error) console.error("signInWithMagicLink error:", result.error);
  return result;
}

export async function getUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) console.error("getUser error:", error);
  return data?.user || null;
}

export async function logout() {
  return await supabase.auth.signOut();
}

// ============================================
// PROFILE
// Live columns: id, email, role, thb_balance
// ============================================
export async function getProfile(userId) {
  const result = await supabase
    .from("profiles")
    .select("id, email, role, thb_balance, phone, location, notification_prefs, wallet_address, agent_permissions, created_at")
    .eq("id", userId)
    .single();
  if (result.error) console.error("getProfile error:", result.error);
  return result;
}

export async function updateProfile(userId, updates) {
  // Only pass columns that exist: role, thb_balance
  const safeUpdates = {};
  if (updates.role !== undefined) safeUpdates.role = updates.role;
  if (updates.thb_balance !== undefined) safeUpdates.thb_balance = updates.thb_balance;
  const result = await supabase
    .from("profiles")
    .update(safeUpdates)
    .eq("id", userId);
  if (result.error) console.error("updateProfile error:", result.error);
  return result;
}

// ============================================
// ACCESS CONTROL
// Real page-level guard — nav.html only hides links visually; this
// actually redirects anyone who lands on a role-restricted page by
// URL (bookmark, typed link, etc.) instead of leaving the page shell
// visible to a role it isn't meant for.
// ============================================
export async function requireRole(allowedRoles, redirectTo = "buyer-dashboard.html") {
  const session = await window.BSTM.ready();
  if (!session) {
    window.location.href = "login.html?redirect=" + encodeURIComponent(window.location.pathname);
    return null;
  }
  const { data: profile } = await getProfile(session.user.id);
  const role = profile?.role || "buyer";
  if (!allowedRoles.includes(role)) {
    window.location.href = redirectTo;
    return null;
  }
  return { session, profile };
}

// Seller-tool pages (seller-dashboard, analytics, earnings, upload-product)
// need to admit room staff too — an employee added via add_room_employee
// keeps profiles.role = "buyer" but should still reach these pages.
// Returns { session, profile } on success, or null after redirecting away.
export async function requireSellerAccess(redirectTo = "buyer-dashboard.html") {
  const session = await window.BSTM.ready();
  if (!session) {
    window.location.href = "login.html?redirect=" + encodeURIComponent(window.location.pathname);
    return null;
  }
  const { data: profile } = await getProfile(session.user.id);
  const role = profile?.role || "buyer";
  if (["seller", "admin", "super_admin"].includes(role)) return { session, profile };

  const { count } = await supabase
    .from("room_roles")
    .select("room_id", { count: "exact", head: true })
    .eq("user_id", session.user.id);
  if ((count || 0) > 0) return { session, profile };

  window.location.href = redirectTo;
  return null;
}
// Live columns: id, name, price, image, seller_id, created_at
// ============================================
export async function getProducts(filters = {}) {
  let query = supabase
    .from("products")
    .select("id, name, price, image, seller_id, created_at");

  // Only filter by columns that actually exist
  if (filters.seller_id) query = query.eq("seller_id", filters.seller_id);

  const result = await query.order("created_at", { ascending: false });
  if (result.error) console.error("getProducts error:", result.error);
  return result;
}

export async function getProductById(productId) {
  const result = await supabase
    .from("products")
    .select("id, name, price, image, seller_id, created_at")
    .eq("id", productId)
    .single();
  if (result.error) console.error("getProductById error:", result.error);
  return result;
}

// Normalize a product row for consistent use across all pages
// The live DB uses 'name' — we expose 'title' in the UI for readability
export function normalizeProduct(p) {
  if (!p) return null;
  return {
    id: p.id,
    title: p.name,        // DB: name → UI: title
    name: p.name,
    price: p.price,
    image: p.image || null,
    seller_id: p.seller_id,
    created_at: p.created_at
  };
}

// ============================================
// ORDERS
// Live columns: id, buyer_id, status, created_at
// ============================================
export async function createOrder(order) {
  // Only insert columns that exist
  const safeOrder = {
    buyer_id: order.buyer_id,
    status: order.status || "pending"
  };
  const result = await supabase.from("orders").insert([safeOrder]);
  if (result.error) console.error("createOrder error:", result.error);
  return result;
}

export async function getOrders(userId) {
  const result = await supabase
    .from("orders")
    .select("id, buyer_id, status, total_amount, created_at")
    .eq("buyer_id", userId)
    .order("created_at", { ascending: false });
  if (result.error) console.error("getOrders error:", result.error);
  return result;
}

// ============================================
// WISHLIST
// Live columns: user_id, product_id, created_at (NO id column)
// ============================================
export async function getWishlist(userId) {
  const result = await supabase
    .from("wishlist")
    .select("user_id, product_id, created_at, products(id, name, price, image)")
    .eq("user_id", userId);
  if (result.error) console.error("getWishlist error:", result.error);
  return result;
}

export async function addToWishlist(userId, productId) {
  const result = await supabase
    .from("wishlist")
    .insert([{ user_id: userId, product_id: productId }]);
  if (result.error) console.error("addToWishlist error:", result.error);
  return result;
}

export async function removeFromWishlist(userId, productId) {
  const result = await supabase
    .from("wishlist")
    .delete()
    .eq("user_id", userId)
    .eq("product_id", productId);
  if (result.error) console.error("removeFromWishlist error:", result.error);
  return result;
}
BSTM_PATCH_EOF

mkdir -p "$(dirname "js/pages/control-center.js")"
cat > js/pages/control-center.js << 'BSTM_PATCH_EOF'
// js/pages/control-center.js
import { getProfile } from "../bstm-core.js";
import { supabase } from "../core/supabase-client.js";
import { escapeHtml } from "../core/sanitize.js";

window.BSTM.ready().then(async function (session) {
  if (!session) {
    window.location.href = "login.html?redirect=gov-dashboard.html";
    return;
  }

  const { data: profile } = await getProfile(session.user.id);

  // Control Center is the super-admin-only room: THB distribution, room
  // moderation, and granting/revoking staff access all live here. Regular
  // admins and agents work in admin-dashboard.html instead — they don't get
  // this page at all, so there's one single place staff access is decided,
  // not two overlapping ones.
  if (!profile || profile.role !== "super_admin") {
    document.getElementById("access-denied").classList.remove("hidden");
    return;
  }

  document.getElementById("control-center-content").classList.remove("hidden");
  document.getElementById("userName").textContent = session.user.email.split("@")[0];

  const ADMIN_PERMISSIONS = ["kyc", "orders", "customers", "sellers", "revenue", "audit", "attention"];
  const PERMISSION_LABELS = {
    kyc: "KYC Reviews",
    orders: "Orders",
    customers: "Customers",
    sellers: "Sellers & Rooms",
    revenue: "Revenue",
    audit: "Audit Log",
    attention: "Needs Attention",
  };

  // Best-effort audit write — admin_audit_log's exact columns aren't
  // confirmed from this repo (the table isn't in database/schema.sql), so
  // this can silently fail on a naming mismatch without blocking the
  // actual role change. A console warning here means the column name
  // needs correcting once the real table is confirmed in Supabase.
  async function logAudit(action, resourceId, reason) {
    const { error } = await supabase.from("admin_audit_log").insert({
      actor: session.user.id,
      action,
      resource_type: "user",
      resource_id: resourceId,
      reason: reason || null,
    });
    if (error) console.warn("[BSTM Control Center] Audit log insert failed (action still applied):", error);
  }

  // ---------- THB Distribution ----------
  document.getElementById("thb-distribute-btn").addEventListener("click", async () => {
    const statusEl = document.getElementById("thb-status");
    const email = document.getElementById("thb-target-email").value.trim();
    const amount = parseInt(document.getElementById("thb-amount").value, 10);
    const reason = document.getElementById("thb-reason").value.trim();

    statusEl.classList.remove("hidden", "text-green-600", "text-red-600");

    if (!email || !amount) {
      statusEl.textContent = "Enter an email and a non-zero amount.";
      statusEl.classList.add("text-red-600");
      return;
    }

    // profiles.email may not be queryable directly depending on schema —
    // resolve via auth by looking up the profile row that matches.
    const { data: targetProfile, error: lookupErr } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();

    if (lookupErr || !targetProfile) {
      statusEl.textContent = "No user found with that email.";
      statusEl.classList.add("text-red-600");
      return;
    }

    const { error } = await supabase.rpc("admin_distribute_thb", {
      target_user_id: targetProfile.id,
      amount,
      reason: reason || null,
    });

    if (error) {
      console.error("[BSTM Control Center] THB distribution failed:", error);
      statusEl.textContent = "Failed: " + error.message;
      statusEl.classList.add("text-red-600");
      return;
    }

    statusEl.textContent = `✅ ${amount > 0 ? "Credited" : "Debited"} ${Math.abs(amount)} THB to ${email}`;
    statusEl.classList.add("text-green-600");
    document.getElementById("thb-target-email").value = "";
    document.getElementById("thb-amount").value = "";
    document.getElementById("thb-reason").value = "";
  });

  // ---------- Platform stats ----------
  const { count: userCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true });
  document.getElementById("stat-total-users").textContent = userCount ?? "—";

  const { count: roomCount } = await supabase
    .from("rooms")
    .select("id", { count: "exact", head: true });
  document.getElementById("stat-total-rooms").textContent = roomCount ?? "—";

  const { count: productCount } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true });
  document.getElementById("stat-all-products").textContent = productCount ?? "—";

  const { data: items } = await supabase.from("order_items").select("quantity, unit_price");
  const revenue = (items || []).reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  document.getElementById("stat-platform-revenue").textContent = `P${revenue.toFixed(2)}`;

  // ---------- Room oversight + moderation ----------
  async function loadRooms() {
    const { data: rooms } = await supabase
      .from("rooms")
      .select("id, name, room_number, status, category")
      .order("room_number");

    const listEl = document.getElementById("rooms-oversight-list");
    if (!rooms || rooms.length === 0) {
      listEl.innerHTML = '<p class="text-gray-400 text-sm">No rooms yet.</p>';
      return;
    }

    listEl.innerHTML = rooms
      .map(
        (r) => `
      <div class="flex items-center justify-between p-3 border border-gray-100 rounded-lg" data-room-row="${r.id}">
        <div>
          <span class="font-semibold text-gray-800">Room ${r.room_number} — ${escapeHtml(r.name)}</span>
          <span class="text-xs text-gray-400 block">${escapeHtml(r.category || "Uncategorized")}</span>
        </div>
        <button class="room-toggle-btn text-xs font-bold px-3 py-1.5 rounded-lg ${
          r.status === "active"
            ? "bg-red-100 text-red-700 hover:bg-red-200"
            : "bg-green-100 text-green-700 hover:bg-green-200"
        }" data-id="${r.id}" data-current="${r.status}">
          ${r.status === "active" ? "Deactivate" : "Reactivate"}
        </button>
      </div>`
      )
      .join("");

    listEl.querySelectorAll(".room-toggle-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const newStatus = btn.dataset.current === "active" ? "inactive" : "active";
        const reason = prompt(
          newStatus === "inactive" ? "Reason for deactivating this room:" : "Reason for reactivating this room:"
        );
        if (!reason || !reason.trim()) return;

        btn.disabled = true;
        const { error } = await supabase.rpc("set_room_status", {
          p_room_id: btn.dataset.id,
          p_new_status: newStatus,
          p_reason: reason.trim(),
        });
        btn.disabled = false;
        if (error) {
          alert("Couldn't update room status: " + error.message);
          return;
        }
        loadRooms();
      });
    });
  }
  loadRooms();

  // ---------- User search ----------
  const searchInput = document.getElementById("user-search-input");
  const resultsEl = document.getElementById("user-search-results");
  let searchTimer;

  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const q = searchInput.value.trim();
    if (q.length < 2) {
      resultsEl.innerHTML = "";
      return;
    }
    searchTimer = setTimeout(async () => {
      const { data: users } = await supabase
        .from("profiles")
        .select("id, email, role, agent_permissions, created_at")
        .ilike("email", `%${q}%`)
        .limit(10);

      if (!users || users.length === 0) {
        resultsEl.innerHTML = '<p class="text-gray-400 text-sm">No matching users.</p>';
        return;
      }

      resultsEl.innerHTML = users.map((u) => renderUserRow(u)).join("");
      wireUserRowActions();
    }, 300);
  });

  function renderUserRow(u) {
    const roleColors = {
      super_admin: "bg-purple-600 text-white",
      admin: "bg-purple-100 text-purple-700",
      agent: "bg-blue-100 text-blue-700",
      seller: "bg-green-100 text-green-700",
      buyer: "bg-gray-100 text-gray-600",
    };
    const badge = `<span class="text-xs font-bold px-2 py-1 rounded-full ${roleColors[u.role] || roleColors.buyer}">${escapeHtml(u.role)}</span>`;

    let actions = "";
    if (u.role === "super_admin") {
      actions = `<span class="text-xs text-gray-400">Only you</span>`;
    } else if (u.role === "admin" || u.role === "agent") {
      actions = `<button class="revoke-btn text-xs font-bold px-2 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200" data-id="${u.id}">Revoke</button>`;
    } else {
      actions = `
        <button class="make-admin-btn text-xs font-bold px-2 py-1 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200" data-id="${u.id}">Make Admin</button>
        <button class="make-agent-btn text-xs font-bold px-2 py-1 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200" data-id="${u.id}">Make Agent</button>`;
    }

    const permBox =
      u.role === "agent" && u.agent_permissions?.length
        ? `<p class="text-xs text-gray-400 mt-1">Access: ${u.agent_permissions.map((p) => escapeHtml(PERMISSION_LABELS[p] || p)).join(", ")}</p>`
        : "";

    return `
      <div class="border border-gray-100 rounded-lg p-3" data-user-row="${u.id}">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <span class="text-sm text-gray-800">${escapeHtml(u.email)}</span>
          <div class="flex items-center gap-2">${badge}${actions}</div>
        </div>
        ${permBox}
        <div class="agent-permission-picker hidden mt-3 pt-3 border-t border-gray-100" data-for="${u.id}">
          <p class="text-xs text-gray-500 mb-2">Which sections of the admin dashboard can they see?</p>
          <div class="grid grid-cols-2 gap-1.5 mb-3 text-xs">
            ${ADMIN_PERMISSIONS.map((p) => `<label class="flex items-center gap-1.5"><input type="checkbox" class="agent-perm-cb" value="${p}"> ${escapeHtml(PERMISSION_LABELS[p])}</label>`).join("")}
          </div>
          <button class="confirm-agent-btn text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white" data-id="${u.id}">Confirm</button>
        </div>
      </div>`;
  }

  function wireUserRowActions() {
    resultsEl.querySelectorAll(".make-admin-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Give this account full admin access to the dashboard (KYC, orders, customers, sellers, revenue, audit log)?")) return;
        btn.disabled = true;
        const { error } = await supabase
          .from("profiles")
          .update({ role: "admin", agent_permissions: null })
          .eq("id", btn.dataset.id);
        if (error) {
          alert("Couldn't grant admin access: " + error.message);
          btn.disabled = false;
          return;
        }
        await logAudit("ADMIN_GRANTED", btn.dataset.id, null);
        searchInput.dispatchEvent(new Event("input"));
      });
    });

    resultsEl.querySelectorAll(".make-agent-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const row = resultsEl.querySelector(`.agent-permission-picker[data-for="${btn.dataset.id}"]`);
        if (row) row.classList.toggle("hidden");
      });
    });

    resultsEl.querySelectorAll(".confirm-agent-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const row = resultsEl.querySelector(`[data-user-row="${btn.dataset.id}"]`);
        const permissions = Array.from(row.querySelectorAll(".agent-perm-cb:checked")).map((cb) => cb.value);
        if (permissions.length === 0) {
          alert("Pick at least one section for this agent to access.");
          return;
        }
        btn.disabled = true;
        const { error } = await supabase
          .from("profiles")
          .update({ role: "agent", agent_permissions: permissions })
          .eq("id", btn.dataset.id);
        if (error) {
          alert("Couldn't grant agent access: " + error.message);
          btn.disabled = false;
          return;
        }
        await logAudit("AGENT_GRANTED", btn.dataset.id, `Sections: ${permissions.join(", ")}`);
        searchInput.dispatchEvent(new Event("input"));
      });
    });

    resultsEl.querySelectorAll(".revoke-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Revoke this person's admin/agent access? They'll become a regular buyer account.")) return;
        btn.disabled = true;
        const { error } = await supabase
          .from("profiles")
          .update({ role: "buyer", agent_permissions: null })
          .eq("id", btn.dataset.id);
        if (error) {
          alert("Couldn't revoke access: " + error.message);
          btn.disabled = false;
          return;
        }
        await logAudit("ACCESS_REVOKED", btn.dataset.id, null);
        searchInput.dispatchEvent(new Event("input"));
      });
    });
  }
});

window.handleLogout = function () {
  window.BSTM.logout();
};
BSTM_PATCH_EOF

mkdir -p "$(dirname "js/pages/monitoring-dashboard.js")"
cat > js/pages/monitoring-dashboard.js << 'BSTM_PATCH_EOF'
// js/pages/monitoring-dashboard.js
import { supabase } from "../core/supabase-client.js";
import { getProfile } from "../bstm-core.js";

function setDot(id, healthy) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("bg-green-500", "bg-red-500");
  el.classList.add(healthy ? "bg-green-500" : "bg-red-500");
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

async function checkHealth() {
  const start = performance.now();
  const { error } = await supabase.from("products").select("id").limit(1);
  const latency = Math.round(performance.now() - start);

  const dbHealthy = !error;
  document.getElementById("responseTime").textContent = dbHealthy ? `${latency}ms` : "—";
  setDot("dbStatus", dbHealthy);
  setText("dbStatusText", dbHealthy ? "Healthy" : "Degraded");

  setDot("websiteStatus", true); // tautological — if this script ran, the site loaded
  setText("websiteStatusText", "Online");

  const apiHealthy = dbHealthy; // Supabase is the only real backend API in use
  setDot("apiStatus", apiHealthy);
  setText("apiStatusText", apiHealthy ? "Running" : "Degraded");

  // Paystack still on placeholder key — honestly red until a real key is set
  const paystackConfigured = false;
  setDot("paymentsStatus", paystackConfigured);
  setText("paymentsStatusText", paystackConfigured ? "Active" : "Inactive");
  setText("paymentsStatusSub", paystackConfigured ? "Paystack OK" : "Paystack not configured");

  const log = document.getElementById("errorLog");
  const entries = [];
  if (!dbHealthy) entries.push(`<p class="text-red-400 text-sm">⚠ Database query failed: ${error.message}</p>`);
  entries.push('<p class="text-yellow-400 text-sm">⚠ Paystack not configured — payments are disabled</p>');
  log.innerHTML = entries.join("");

  const lastUpdate = document.getElementById("lastUpdate");
  if (lastUpdate) lastUpdate.textContent = "Last updated: " + new Date().toLocaleTimeString();
}

window.BSTM.ready().then(async function (session) {
  const wall = document.getElementById("auth-wall");
  const content = document.getElementById("monitoring-content");

  if (!session) {
    if (wall) wall.style.display = "flex";
    if (content) content.style.display = "none";
    return;
  }

  const { data: profile } = await getProfile(session.user.id);
  if (!profile || !["admin", "super_admin", "government"].includes(profile.role)) {
    alert("This dashboard is restricted to BSTM staff.");
    window.location.href = "buyer-dashboard.html";
    return;
  }

  if (wall) wall.style.display = "none";
  if (content) content.style.display = "block";

  const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });
  document.getElementById("activeUsers").textContent = count ?? "—";

  await checkHealth();
  setInterval(checkHealth, 30000);
});

window.logout = function () {
  if (confirm("Logout?")) window.BSTM.logout();
};
BSTM_PATCH_EOF

mkdir -p "$(dirname "components/nav.html")"
cat > components/nav.html << 'BSTM_PATCH_EOF'
<!-- BSTM Universal Navigation (RESTORED ORIGINAL FULL VERSION) -->

<style>
  #bstm-nav-bar {
    background:#fff;
    border-bottom:1px solid #EDE9FE;
    position:sticky;
    top:0;
    z-index:100;
    box-shadow:0 1px 12px rgba(124,58,237,0.08);
    font-family: Inter, sans-serif;
  }

  .nav-link {
    color:#374151;
    font-weight:600;
    font-size:13px;
    padding:6px 10px;
    border-radius:10px;
    text-decoration:none;
    display:inline-block;
  }

  .nav-link:hover {
    background:#F5F3FF;
    color:#7C3AED;
  }

  #desktop-nav {
    display:flex;
    flex-wrap:wrap;
    gap:6px;
  }

  #mobile-menu {
    display:none;
    background:#fff;
    border-top:1px solid #EDE9FE;
    padding:12px 16px 20px;
  }

  #mobile-menu.open {
    display:block;
  }

  #mobile-menu a {
    display:flex;
    align-items:center;
    gap:10px;
    padding:12px 14px;
    border-radius:12px;
    font-weight:600;
    color:#374151;
    text-decoration:none;
  }

  #mobile-menu a:hover {
    background:#F5F3FF;
    color:#7C3AED;
  }

  #notif-panel {
    position:fixed;
    top:68px;
    right:16px;
    width:340px;
    max-width:calc(100vw - 32px);
    background:#fff;
    border-radius:20px;
    box-shadow:0 20px 60px rgba(124,58,237,0.18);
    border:1px solid #EDE9FE;
    z-index:9999;
    display:none;
  }

  #notif-panel.open {
    display:block;
  }

  #menu-btn {
    background:none;
    border:none;
    cursor:pointer;
    display:flex;
    flex-direction:column;
    gap:5px;
  }

  #menu-btn span {
    width:22px;
    height:2px;
    background:#374151;
    display:block;
    border-radius:2px;
  }

  @media(max-width:900px){
    #desktop-nav { display:none; }
  }
</style>

<div id="bstm-nav-bar">

  <div style="max-width:1280px;margin:0 auto;padding:0 20px;">
    <div style="display:flex;align-items:center;justify-content:space-between;height:64px;">

      <!-- LEFT -->
      <div style="display:flex;align-items:center;gap:18px;">

        <a href="index.html" style="display:flex;align-items:center;gap:10px;text-decoration:none;">

          <div style="width:38px;height:38px;background:linear-gradient(135deg,#7C3AED,#4F46E5);border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:900;color:#fff;font-size:20px;">
            B
          </div>

          <div>
            <div style="font-weight:900;font-size:18px;color:#1E1B4B;">BSTM</div>
            <div style="font-size:9px;color:#A78BFA;font-weight:700;">DIGITAL MALL</div>
          </div>

        </a>

        <!-- DESKTOP NAV (role-filtered by app.js) -->
        <nav id="desktop-nav">

          <a class="nav-link" href="index.html" data-i18n="nav.home" data-roles="public">Home</a>
          <a class="nav-link" href="marketplace.html" data-i18n="nav.marketplace" data-roles="public">Mall</a>
          <a class="nav-link" href="agriculture.html" data-i18n="nav.farm" data-roles="public">Farm</a>

          <a class="nav-link" href="cablink.html" data-i18n="nav.cablink" data-roles="auth">CabLink</a>
          <a class="nav-link" href="thb-wallet.html" data-i18n="nav.wallet" data-roles="auth">Wallet</a>
          <a class="nav-link" href="transactions.html" data-roles="auth">Transactions</a>
          <a class="nav-link" href="earnings.html" data-roles="seller,admin,super_admin">Earnings</a>

          <a class="nav-link" href="buyer-dashboard.html" data-roles="auth">Buyer</a>
          <a class="nav-link" href="seller-dashboard.html" data-roles="seller,admin,super_admin">Seller</a>

          <a class="nav-link" href="open-room.html" data-roles="auth">Open Room</a>
          <a class="nav-link" href="upload-product.html" data-roles="seller,admin,super_admin">Upload</a>
          <a class="nav-link" href="checkout.html" data-roles="auth">Checkout</a>
          <a class="nav-link" href="order-tracking.html" data-roles="auth">Tracking</a>

          <a class="nav-link" href="messages.html" data-roles="auth">Messages</a>
          <a class="nav-link" href="notifications-all.html" data-roles="auth">Notifications</a>
          <a class="nav-link" href="wishlist.html" data-roles="auth">Wishlist</a>

          <a class="nav-link" href="analytics.html" data-roles="seller,admin,super_admin">Analytics</a>
          <a class="nav-link" href="monitoring-dashboard.html" data-roles="admin,super_admin,government">Monitoring</a>

          <a class="nav-link" href="admin-dashboard.html" data-roles="admin,agent,super_admin">Admin</a>
          <a class="nav-link" href="gov-dashboard.html" data-roles="super_admin">Control Center</a>

          <a class="nav-link" href="kyc-verification.html" data-roles="auth">KYC</a>

          <a class="nav-link" href="help.html" data-roles="public">Help</a>
          <a class="nav-link" href="terms.html" data-roles="public">Terms</a>

          <a class="nav-link" href="settings.html" data-roles="auth">Settings</a>
          <a class="nav-link" href="profile.html" data-roles="auth">Profile</a>

        </nav>

      </div>

      <!-- RIGHT -->
      <div style="display:flex;align-items:center;gap:12px;">

        <button id="lang-en-btn" onclick="MultiLanguage.setLanguage('en')" style="padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700;">EN</button>
        <button id="lang-tn-btn" onclick="MultiLanguage.setLanguage('tn')" style="padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700;">TN</button>

        <button id="notif-btn" style="position:relative;background:none;border:none;font-size:18px;cursor:pointer;">
          🔔
          <span id="nav-notif-badge" style="display:none;position:absolute;top:-4px;right:-6px;background:#DC2626;color:#fff;font-size:10px;font-weight:700;line-height:1;padding:3px 5px;border-radius:999px;min-width:16px;text-align:center;">0</span>
        </button>

        <a id="nav-login-btn" href="login.html" data-i18n="common.login"
           style="background:#7C3AED;color:#fff;padding:8px 14px;border-radius:10px;text-decoration:none;">
          Login
        </a>

        <div id="nav-user-menu" style="display:none;align-items:center;gap:8px;position:relative;">
          <button id="nav-user-name" onclick="document.getElementById('nav-user-dropdown').classList.toggle('open')"
                  style="background:#F5F3FF;color:#4F46E5;padding:8px 14px;border-radius:10px;border:none;font-weight:700;font-size:13px;cursor:pointer;">
          </button>
          <div id="nav-user-dropdown"
               style="display:none;position:absolute;top:calc(100% + 6px);right:0;background:#fff;border:1px solid #EDE9FE;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:160px;overflow:hidden;z-index:200;">
            <a href="profile.html" style="display:block;padding:12px 16px;color:#374151;text-decoration:none;font-size:13px;font-weight:600;">👤 Profile</a>
            <a href="buyer-dashboard.html" style="display:block;padding:12px 16px;color:#374151;text-decoration:none;font-size:13px;font-weight:600;">📦 My Orders</a>
            <button id="nav-logout-btn" onclick="window.BSTM.logout()"
                    style="display:block;width:100%;text-align:left;padding:12px 16px;color:#DC2626;background:none;border:none;border-top:1px solid #F3F4F6;font-size:13px;font-weight:600;cursor:pointer;">🚪 Logout</button>
          </div>
        </div>

        <style>
          #nav-user-dropdown.open { display: block !important; }
        </style>

        <button id="menu-btn">
          <span></span>
          <span></span>
          <span></span>
        </button>

      </div>

    </div>
  </div>

  <!-- MOBILE MENU (FULL RESTORED LIST 30+) -->
  <div id="mobile-menu">

    <a href="index.html" data-roles="public">🏠 Home</a>
    <a href="marketplace.html" data-roles="public">🏬 Mall</a>
    <a href="agriculture.html" data-roles="public">🌾 Farm</a>

    <a href="cablink.html" data-roles="auth">🚕 CabLink</a>
    <a href="thb-wallet.html" data-roles="auth">💰 Wallet</a>
    <a href="transactions.html" data-roles="auth">📊 Transactions</a>
    <a href="earnings.html" data-roles="seller,admin,super_admin">💸 Earnings</a>

    <a href="buyer-dashboard.html" data-roles="auth">👤 Buyer</a>
    <a href="seller-dashboard.html" data-roles="seller,admin,super_admin">🛒 Seller</a>

    <a href="open-room.html" data-roles="auth">🏪 Open Room</a>
    <a href="upload-product.html" data-roles="seller,admin,super_admin">📤 Upload</a>
    <a href="checkout.html" data-roles="auth">🧾 Checkout</a>
    <a href="order-tracking.html" data-roles="auth">📍 Tracking</a>

    <a href="messages.html" data-roles="auth">💬 Messages</a>
    <a href="notifications-all.html" data-roles="auth">🔔 Notifications</a>
    <a href="wishlist.html" data-roles="auth">❤️ Wishlist</a>

    <a href="analytics.html" data-roles="seller,admin,super_admin">📊 Analytics</a>
    <a href="monitoring-dashboard.html" data-roles="admin,super_admin,government">📡 Monitoring</a>

    <a href="admin-dashboard.html" data-roles="admin,agent,super_admin">🧠 Admin</a>
    <a href="gov-dashboard.html" data-roles="super_admin">🎛 Control Center</a>

    <a href="kyc-verification.html" data-roles="auth">🪪 KYC</a>

    <a href="help.html" data-roles="public">❓ Help</a>
    <a href="terms.html" data-roles="public">📘 Terms</a>

    <a href="settings.html" data-roles="auth">⚙️ Settings</a>
    <a href="profile.html" data-roles="auth">👤 Profile</a>

  </div>

</div>

<!-- NOTIFICATION PANEL (real data, wired by js/core/nav-notifications.js) -->
<div id="notif-panel">
  <div style="background:#7C3AED;color:#fff;padding:12px;font-weight:800;display:flex;justify-content:space-between;align-items:center;">
    <span>Notifications</span>
    <button onclick="window.BSTM_markAllNavNotifsRead && window.BSTM_markAllNavNotifsRead()" style="background:none;border:none;color:#fff;font-size:11px;font-weight:600;cursor:pointer;opacity:0.9;">Mark all read</button>
  </div>
  <div id="nav-notif-list" style="max-height:320px;overflow-y:auto;padding:6px;">
    <div style="padding:16px;color:#9CA3AF;font-size:13px;text-align:center;">Loading…</div>
  </div>
  <a href="notifications-all.html" style="display:block;text-align:center;padding:10px;font-size:12px;font-weight:700;color:#7C3AED;text-decoration:none;border-top:1px solid #EDE9FE;">See all</a>
</div>
BSTM_PATCH_EOF

mkdir -p "$(dirname "database/schema/add_agent_roles.sql")"
cat > database/schema/add_agent_roles.sql << 'BSTM_PATCH_EOF'
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New Query).
-- I can't run this myself — no network/DB access from where I work — so
-- this has to be pasted and run by hand, once, before the code changes
-- in this patch will actually work.

-- 1. Column agents' granted dashboard sections live in. Safe no-op if it
--    already exists.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_permissions jsonb;

-- 2. Widen whatever CHECK constraint governs profiles.role so 'agent' and
--    'super_admin' are valid values, not just 'buyer'/'seller'/'admin'.
--    This assumes the constraint has Postgres's default auto-generated name
--    (profiles_role_check) — the usual case when it wasn't explicitly named.
--    If the next ALTER TABLE ADD CONSTRAINT errors with "already exists" or
--    a name conflict, your constraint has a different name: run
--      SELECT conname FROM pg_constraint WHERE conrelid = 'profiles'::regclass AND contype = 'c';
--    to find its real name, swap it into the DROP line below, and re-run.
--    If profiles.role has NO check constraint at all (a plain text column),
--    both statements below are harmless no-ops.
DO $$
BEGIN
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('buyer', 'seller', 'admin', 'agent', 'super_admin'));

-- 3. Make yourself the one and only super_admin. Replace the email below
--    with the actual email on your account before running.
UPDATE profiles SET role = 'super_admin' WHERE email = 'YOUR_EMAIL_HERE';

-- 4. Make your business partner an admin. Replace the email below with
--    theirs. (You can also do this later from Control Center's user
--    search instead of SQL — that's what it's now built for.)
UPDATE profiles SET role = 'admin' WHERE email = 'PARTNER_EMAIL_HERE';

-- 5. Confirm it worked.
SELECT email, role, agent_permissions FROM profiles WHERE role IN ('admin', 'agent', 'super_admin');


-- ============================================================================
-- IMPORTANT — READ THIS PART
-- ============================================================================
-- Everything above makes the role model exist in the database. It does NOT
-- by itself stop an agent's browser from directly querying tables outside
-- their granted sections — hiding a <div> in the dashboard is a UX
-- convenience, not access control. The actual enforcement has to happen
-- here, in Postgres, via Row Level Security (RLS) policies on each table
-- admin-dashboard.js and control-center.js touch: profiles, orders,
-- order_items, kyc_submissions, rooms, products, admin_audit_log.
--
-- I can't write correct RLS policies for you sight-unseen — they depend on
-- policies you already have (which I can't see from this repo; several of
-- these tables, like admin_audit_log itself, aren't even in your schema
-- files), and a wrong policy can either lock legitimate users out or leave
-- a hole wide open. Two honest options:
--   a) Paste me the output of this, for each table above, and I'll write
--      exact policies against what's actually there:
--        SELECT * FROM pg_policies WHERE tablename = 'orders';
--   b) Treat this patch as staff UI only for now (safe for a small,
--      trusted team, which is what you have today) and come back to RLS
--      before the team grows past people you'd trust with database access
--      directly.
BSTM_PATCH_EOF

echo "All files written. Checking JS syntax..."
node --check js/pages/admin-dashboard.js && node --check js/bstm-core.js && node --check js/pages/control-center.js && node --check js/pages/monitoring-dashboard.js && echo 'Syntax OK'

git add -A
git commit -m "Add super_admin/agent role tier: Control Center role management, admin-dashboard permission gating, fix corrupted nav emoji"
git push
echo ""
echo "Pushed. BEFORE this works end-to-end, open database/schema/add_agent_roles.sql,"
echo "fill in the two email placeholders, and run it in the Supabase SQL Editor."
