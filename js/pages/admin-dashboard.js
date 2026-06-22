import { getProfile } from "../bstm-core.js";

window.BSTM.ready().then(async function(session) {
  if (!session) {
    window.location.href = "login.html";
    return;
  }

  var { data: profile } = await getProfile(session.user.id);

  // Role gate: only admin can see this page
  // Uncomment when you have admin users set up in Supabase:
  // if (!profile || profile.role !== "admin") {
  //   window.location.href = "buyer-dashboard.html";
  //   return;
  // }

  document.querySelectorAll(".admin-user, #admin-user").forEach(function(el) {
    el.textContent = session.user.email.split("@")[0];
  });

  var content = document.getElementById("adminContent") || document.getElementById("dashboard-content");
  var wall = document.getElementById("auth-wall");
  if (wall) wall.style.display = "none";
  if (content) content.style.display = "block";
});
