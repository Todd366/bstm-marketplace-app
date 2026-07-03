// seller-dashboard.js
window.BSTM.ready().then(function(session) {
  var wall    = document.getElementById("auth-wall");
  var content = document.getElementById("seller-content");

  if (!session) {
    if (wall)    { wall.style.display = "flex"; }
    if (content) { content.style.display = "none"; }
    return;
  }

  if (wall)    { wall.style.display = "none"; }
  if (content) { content.style.display = "block"; }

  var nameEl = document.getElementById("seller-name");
  if (nameEl) {
    nameEl.textContent = session.user.user_metadata?.full_name
      || session.user.email.split("@")[0];
  }
});

window.logout = function() {
  if (confirm("Logout?")) window.BSTM.logout();
};
