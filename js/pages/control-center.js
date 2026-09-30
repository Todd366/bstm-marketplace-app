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
