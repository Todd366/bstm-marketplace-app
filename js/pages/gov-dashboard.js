import { getProfile } from "../bstm-core.js";

window.BSTM.ready().then(async function(session) {
  if (!session) {
    window.location.href = "login.html";
    return;
  }

  var { data: profile } = await getProfile(session.user.id);

  // Show content regardless of role for now — 
  // uncomment below to restrict to government/admin only
  // if (!profile || !["admin","government"].includes(profile.role)) {
  //   window.location.href = "buyer-dashboard.html";
  //   return;
  // }

  document.querySelectorAll(".gov-user, #gov-user").forEach(function(el) {
    el.textContent = session.user.email.split("@")[0];
  });
  document.querySelectorAll(".gov-role, #gov-role").forEach(function(el) {
    el.textContent = profile ? profile.role : "viewer";
  });

  var content = document.getElementById("gov-content") || document.getElementById("dashboard-content");
  var wall = document.getElementById("auth-wall");
  if (wall) wall.style.display = "none";
  if (content) content.style.display = "block";
});

window.handleLogout = function() {
  if (confirm("Logout?")) window.BSTM.logout();
};
