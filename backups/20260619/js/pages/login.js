import { supabase } from "../core/supabase-client.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  const btn = document.getElementById("submit-btn");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email-input").value.trim();
    if (!email) return;

    btn.disabled = true;
    btn.textContent = "Sending...";

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + "/bstm-marketplace-app/"
      }
    });

    if (error) {
      console.error(error);
      alert("Login failed");
      btn.disabled = false;
      btn.textContent = "Try again";
      return;
    }

    alert("Check your email for login link");
    btn.textContent = "Sent";
  });
});import { signInWithMagicLink } from "../bstm-core.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  const btn = document.getElementById("submit-btn");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email-input").value.trim();

    if (!email) return;

    btn.disabled = true;
    btn.textContent = "Sending...";

    const { error } = await signInWithMagicLink(email);

    if (error) {
      alert("Login failed");
      btn.disabled = false;
      btn.textContent = "Try again";
      return;
    }

    alert("Check your email for login link");
    btn.textContent = "Sent";
  });
});
