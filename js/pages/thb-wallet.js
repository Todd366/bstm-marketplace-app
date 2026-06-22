import { getProfile, getOrders } from "../bstm-core.js";

window.BSTM.ready().then(async function(session) {
  if (!session) {
    window.location.href = "login.html";
    return;
  }

  var user = session.user;

  // Populate name/email wherever they appear
  document.querySelectorAll(".wallet-user-name").forEach(function(el) {
    el.textContent = user.email.split("@")[0];
  });
  document.querySelectorAll(".wallet-user-email").forEach(function(el) {
    el.textContent = user.email;
  });

  var { data: profile } = await getProfile(user.id);
  if (profile) {
    var bal = (profile.thb_balance || 0).toFixed(2);
    document.querySelectorAll(".thb-balance, #thb-balance, #wallet-balance").forEach(function(el) {
      el.textContent = bal + " THB";
    });
    document.querySelectorAll(".user-role, #user-role").forEach(function(el) {
      el.textContent = profile.role || "buyer";
    });
  }

  var { data: orders } = await getOrders(user.id);
  document.querySelectorAll(".order-count, #order-count").forEach(function(el) {
    if (el) el.textContent = orders ? orders.length : 0;
  });
});

window.logout = function() {
  if (confirm("Logout?")) window.BSTM.logout();
};
