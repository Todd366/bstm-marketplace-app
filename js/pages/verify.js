// Supabase magic links deliver the session via URL hash fragment:
// #access_token=...&refresh_token=...&type=magiclink
// app.js's onAuthStateChange fires SIGNED_IN automatically when
// the Supabase client detects this hash on page load.
// This file just handles the UI states.

function show(state) {
  ["loading", "success", "error"].forEach(function(s) {
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

// Start in loading state
show("loading");

// Case 1: User already had a valid session (e.g. came back to verify.html)
window.BSTM.ready().then(function(session) {
  if (session && session.user) {
    showWelcome(session);
    return;
  }

  // Case 2: Magic link just clicked — Supabase puts tokens in hash.
  // app.js fires bstm:login when onAuthStateChange fires SIGNED_IN.
  window.addEventListener("bstm:login", function(e) {
    if (e.detail && e.detail.user) {
      showWelcome(e.detail);
    }
  });

  // Case 3: Timeout — if nothing happens in 8s, show error
  setTimeout(function() {
    var loading = document.getElementById("state-loading");
    if (loading && loading.style.display !== "none") {
      show("error");
    }
  }, 8000);
});
