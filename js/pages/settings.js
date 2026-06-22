import { getProfile, updateProfile } from "../bstm-core.js";

window.BSTM.ready().then(async function(session) {
  if (!session) {
    window.location.href = "login.html";
    return;
  }

  var user = session.user;

  document.querySelectorAll(".settings-email, #settings-email").forEach(function(el) {
    el.textContent = user.email;
  });
  document.querySelectorAll(".settings-name, #settings-name").forEach(function(el) {
    el.textContent = user.email.split("@")[0];
  });

  var { data: profile } = await getProfile(user.id);
  if (profile) {
    document.querySelectorAll(".settings-role, #settings-role").forEach(function(el) {
      el.textContent = profile.role || "buyer";
    });
    document.querySelectorAll(".settings-thb, #settings-thb").forEach(function(el) {
      el.textContent = (profile.thb_balance || 0).toFixed(2) + " THB";
    });
  }
});

window.logout = function() {
  if (confirm("Logout?")) window.BSTM.logout();
};
