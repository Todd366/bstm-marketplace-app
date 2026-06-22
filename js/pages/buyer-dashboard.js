import { getProfile, getOrders } from "../bstm-core.js";

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
    var roleEl = document.getElementById("stat-role");
    if (thbEl) thbEl.textContent = (profile.thb_balance || 0).toFixed(2) + " THB";
    if (roleEl) roleEl.textContent = profile.role || "buyer";

    // These columns don't exist in live DB — show safe fallbacks
    var ordersEl = document.getElementById("stat-orders");
    var refEl = document.getElementById("stat-referral");
    var refCodeEl = document.getElementById("ref-code-display");
    if (ordersEl) ordersEl.textContent = "—";
    if (refEl) refEl.textContent = "Coming soon";
    if (refCodeEl) refCodeEl.textContent = "Coming soon";
  }

  // Load real order count from orders table
  var { data: orders } = await getOrders(user.id);
  if (orders) {
    var ordersEl = document.getElementById("stat-orders");
    if (ordersEl) ordersEl.textContent = orders.length;
  }
}

window.BSTM.ready().then(render);
window.addEventListener("bstm:logout", function() { render(null); });

window.logout = function() {
  if (confirm("Are you sure you want to logout?")) {
    window.BSTM.logout();
  }
};

window.copyReferral = function() {
  // referral_code not in live DB yet — show info message
  alert("Referral system coming soon. Stay tuned!");
};
