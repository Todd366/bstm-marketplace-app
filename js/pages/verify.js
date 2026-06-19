import { supabase } from "../core/supabase-client.js";

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

document.addEventListener("DOMContentLoaded", async function() {
  show("loading");

  const { data: { session }, error } = await supabase.auth.getSession();

  if (session && session.user) {
    var name = session.user.email.split("@")[0];
    var msg = document.getElementById("welcome-msg");
    if (msg) msg.textContent = "Welcome back, " + name + "!";
    show("success");
    startCountdown();
  } else {
    supabase.auth.onAuthStateChange(function(event, session) {
      if (event === "SIGNED_IN" && session) {
        var name = session.user.email.split("@")[0];
        var msg = document.getElementById("welcome-msg");
        if (msg) msg.textContent = "Welcome, " + name + "!";
        show("success");
        startCountdown();
      }
    });
    setTimeout(function() {
      var card = document.getElementById("state-loading");
      if (card && card.style.display !== "none") show("error");
    }, 5000);
  }
});
