function show(state) {
  ["loading","success","error"].forEach(function(s) {
    var el = document.getElementById("state-" + s);
    if (el) el.style.display = s === state ? "block" : "none";
  });
}

function startCountdown() {
  var n = 3;
  var el = document.getElementById("countdown");
  var iv = setInterval(function() {
    n--;
    if (el) el.textContent = n;
    if (n <= 0) {
      clearInterval(iv);
      window.location.href = "buyer-dashboard.html";
    }
  }, 1000);
}

function showWelcome(session) {
  var name = session.user.email.split("@")[0];
  var msg = document.getElementById("welcome-msg");
  if (msg) msg.textContent = "Welcome, " + name + "!";
  show("success");
  startCountdown();
}

show("loading");

window.BSTM.ready().then(function(session) {
  if (session && session.user) {
    showWelcome(session);
  } else {
    // Supabase magic link confirmation lands here as a SIGNED_IN event
    // routed through app.js's single listener.
    window.addEventListener("bstm:login", function(e) {
      showWelcome(e.detail);
    });
    setTimeout(function() {
      var card = document.getElementById("state-loading");
      if (card && card.style.display !== "none") show("error");
    }, 5000);
  }
});
