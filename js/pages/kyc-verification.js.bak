// kyc-verification.js
window.BSTM.ready().then(function(session) {
  var wall    = document.getElementById("auth-wall");
  var content = document.getElementById("kyc-content");

  if (!session) {
    if (wall)    { wall.style.display = "flex"; }
    if (content) { content.style.display = "none"; }
    return;
  }

  if (wall)    { wall.style.display = "none"; }
  if (content) { content.style.display = "block"; }

  var emailEl = document.getElementById("kyc-email");
  if (emailEl) emailEl.textContent = session.user.email;
});
