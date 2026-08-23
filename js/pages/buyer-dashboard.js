import { getProfile, getOrders } from "../bstm-core.js";
import { supabase } from "../core/supabase-client.js";
import { escapeHtml } from "../core/sanitize.js";

async function render(session) {
  if (!session) {
    var wall = document.getElementById("auth-wall");
    var content = document.getElementById("dashboard-content");
    if (wall) wall.style.display = "flex";
    if (content) content.style.display = "none";
    return;
  }

  var user = session.user;
  var wall = document.getElementById("auth-wall");
  var content = document.getElementById("dashboard-content");
  if (wall) wall.style.display = "none";
  if (content) content.style.display = "block";

  // Live profile columns: id, email, role, thb_balance
  var nameEl = document.getElementById("user-name");
  var emailEl = document.getElementById("user-email");
  if (nameEl) nameEl.textContent = user.email.split("@")[0];
  if (emailEl) emailEl.textContent = user.email;

  var { data: profile, error: profileError } = await getProfile(user.id);

  if (profile) {
    var thbEl = document.getElementById("stat-thb");
    if (thbEl) thbEl.textContent = (profile.thb_balance || 0).toFixed(2);

    // referral_code doesn't exist in the live DB yet — show a safe, honest fallback
    var refEl = document.getElementById("stat-referral");
    var refCodeEl = document.getElementById("ref-code-display");
    if (refEl) refEl.textContent = "Coming soon";
    if (refCodeEl) refCodeEl.textContent = "Coming soon";
  }

  // Load real order count from orders table
  var { data: orders } = await getOrders(user.id);
  if (orders) {
    var ordersEl = document.getElementById("stat-orders");
    if (ordersEl) ordersEl.textContent = orders.length;
  }

  // Load real wishlist count — this stat was never wired to anything real
  const { count: wishlistCount } = await supabase
    .from("wishlist")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  const wishlistEl = document.getElementById("stat-wishlist");
  if (wishlistEl && typeof wishlistCount === "number") wishlistEl.textContent = wishlistCount;

  // Real open rooms — no filler shown if none exist yet
  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, name, banner_emoji, category")
    .eq("status", "active")
    .order("room_number")
    .limit(6);

  const roomsGrid = document.getElementById("dashboard-rooms-grid");
  if (roomsGrid) {
    if (!rooms || rooms.length === 0) {
      roomsGrid.innerHTML =
        '<p style="color:#9CA3AF;font-size:13px;">No rooms open yet — ' +
        '<a href="open-room.html" style="color:#7C3AED;font-weight:700;">open the first one →</a></p>';
    } else {
      roomsGrid.innerHTML = rooms
        .map(
          (r) => `
        <a href="room.html?id=${r.id}" style="display:flex;align-items:center;gap:12px;background:#fff;border:1.5px solid #D1FAE5;border-radius:16px;padding:16px;text-decoration:none;">
          <div style="font-size:28px;">${escapeHtml(r.banner_emoji || "🏬")}</div>
          <div><div style="font-size:13px;font-weight:800;color:#1E1B4B;">${escapeHtml(r.name)}</div>
          <div style="font-size:11px;color:#059669;font-weight:600;">● Open</div></div>
        </a>`
        )
        .join("");
    }
  }
}

window.BSTM.ready().then(render);
window.addEventListener("bstm:logout", function() { render(null); });

window.logout = function() {
  if (confirm("Are you sure you want to logout?")) {
    window.BSTM.logout();
  }
};
