import { supabase } from "../core/supabase-client.js";

function showStatus(msg, type) {
  var el = document.getElementById("status");
  if (!el) return;
  el.textContent = msg;
  el.style.display = "block";
  el.style.background = type === "success" ? "#DCFCE7" : "#FEE2E2";
  el.style.color = type === "success" ? "#166534" : "#991B1B";
  el.style.border = "1px solid " + (type === "success" ? "#BBF7D0" : "#FECACA");
}

window.BSTM.ready().then(function(session) {
  if (session) window.location.href = "buyer-dashboard.html";
});

document.addEventListener("DOMContentLoaded", function () {
  var form = document.getElementById("login-form");
  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var btn = document.getElementById("submit-btn");
    var email = document.getElementById("email-input").value.trim().toLowerCase();

    if (!email || !email.includes("@")) {
      showStatus("Please enter a valid email address.", "error");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Sending...";

    var { error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: "https://todd366.github.io/bstm-marketplace-app/verify.html"
      }
    });

    if (error) {
      showStatus("Failed: " + error.message, "error");
      btn.disabled = false;
      btn.textContent = "✨ Send Magic Link";
    } else {
      showStatus("✅ Magic link sent to " + email + ". Check your inbox!", "success");
      btn.textContent = "✅ Link Sent!";
    }
  });
});
