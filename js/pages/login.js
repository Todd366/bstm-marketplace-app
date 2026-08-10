import { supabase } from "../core/supabase-client.js";

// Dynamic instead of hardcoded — works correctly whether deployed on
// GitHub Pages (subdirectory), Vercel, or a custom domain, unlike a
// hardcoded absolute URL which would silently break on any other host.
var VERIFY_BASE_URL = window.location.origin + window.location.pathname.replace(/login\.html$/, "verify.html");

// Preserve where the user was trying to go before being sent to log in
// (e.g. login.html?redirect=checkout.html) through the magic-link email
// round-trip, so verify.html can send them back there instead of always
// landing on buyer-dashboard.html.
var redirectTarget = new URLSearchParams(window.location.search).get("redirect");
var VERIFY_URL = redirectTarget
  ? VERIFY_BASE_URL + "?redirect=" + encodeURIComponent(redirectTarget)
  : VERIFY_BASE_URL;

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

// Wait for BSTM to be ready before checking session
// Uses event instead of direct call to avoid race condition
window.addEventListener('bstm:ready', function(e) {
  if (e.detail) window.location.href = "buyer-dashboard.html";
});

// Module is already deferred — DOM is ready, no DOMContentLoaded needed
var form = document.getElementById("login-form");
if (form) {
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
}
