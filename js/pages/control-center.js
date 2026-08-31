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

  if (!profile || profile.role !== "admin") {
    document.getElementById("access-denied").classList.remove("hidden");
    return;
  }

  document.getElementById("control-center-content").classList.remove("hidden");
  document.getElementById("userName").textContent = session.user.email.split("@")[0];

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
        .select("id, email, role, created_at")
        .ilike("email", `%${q}%`)
        .limit(10);

      if (!users || users.length === 0) {
        resultsEl.innerHTML = '<p class="text-gray-400 text-sm">No matching users.</p>';
        return;
      }

      resultsEl.innerHTML = users
        .map(
          (u) => `
        <div class="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
          <span class="text-sm text-gray-800">${escapeHtml(u.email)}</span>
          <span class="text-xs font-bold px-2 py-1 rounded-full bg-purple-100 text-purple-700">${escapeHtml(u.role)}</span>
        </div>`
        )
        .join("");
    }, 300);
  });
});

window.handleLogout = function () {
  window.BSTM.logout();
};
