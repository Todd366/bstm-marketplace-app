import { supabase } from "../core/supabase-client.js";

var VERIFY_URL = "https://todd366.github.io/bstm-marketplace-app/verify.html";

function showStatus(msg, type) {
  var el = document.getElementById("status");
  if (!el) return;
  el.textContent = msg;
  el.style.display = "block";
  el.style.background = type === "success" ? "#DCFCE7" : "#FEE2E2";
  el.style.color = type === "success" ? "#166534" : "#991B1B";
  el.style.border = "1px solid " + (type === "success" ? "#BBF7D0" : "#FECACA");
}

function friendlyError(message) {
  if (!message) return "Something went wrong. Please try again.";
  var m = message.toLowerCase();
  if (m.includes("rate limit") || m.includes("too many")) {
    return "⏳ Too many requests. Please wait a few minutes before trying again.";
  }
  if (m.includes("invalid email") || m.includes("unable to validate")) {
    return "Please enter a valid email address.";
  }
  if (m.includes("network") || m.includes("fetch")) {
    return "Network error. Check your connection and try again.";
  }
  return "Failed to send link: " + message;
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
      options: { emailRedirectTo: VERIFY_URL }
    });

    if (error) {
      showStatus(friendlyError(error.message), "error");
      btn.disabled = false;
      btn.textContent = "✨ Send Magic Link";
    } else {
      showStatus("✅ Magic link sent to " + email + " — check your inbox (and spam folder)!", "success");
      btn.textContent = "✅ Link Sent!";
      btn.disabled = true;
    }
  });
});
