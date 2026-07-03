// settings.js
window.BSTM.ready().then(function(session) {
  var wall    = document.getElementById("auth-wall");
  var content = document.getElementById("settings-content");

  if (!session) {
    if (wall)    { wall.style.display = "flex"; }
    if (content) { content.style.display = "none"; }
    return;
  }

  if (wall)    { wall.style.display = "none"; }
  if (content) { content.style.display = "block"; }

  var email = session.user.email;
  var name  = session.user.user_metadata?.full_name || email.split("@")[0];

  document.querySelectorAll(".settings-name").forEach(function(el) { el.textContent = name; });
  document.querySelectorAll(".settings-email").forEach(function(el) {
    el.value !== undefined ? el.value = email : el.textContent = email;
  });

  var avatar = document.getElementById("settings-avatar");
  if (avatar) avatar.textContent = name.charAt(0).toUpperCase();
});

window.logout = function() {
  if (confirm("Logout?")) window.BSTM.logout();
};

window.saveProfile = function() {
  var btn = document.querySelector('button[onclick="saveProfile()"]');
  if (btn) {
    btn.textContent = "✅ Saved!";
    setTimeout(function() { btn.textContent = "Save Changes"; }, 2000);
  }
};
