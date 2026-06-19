import { supabase } from "./core/supabase-client.js";

async function bootstrap() {
  const { data: { session } } = await supabase.auth.getSession();

  const navLogin = document.getElementById("nav-login-btn");
  const navUser = document.getElementById("nav-user-name");

  if (session && session.user) {
    if (navLogin) navLogin.style.display = "none";
    if (navUser) {
      navUser.textContent = session.user.email.split("@")[0];
      navUser.style.display = "block";
    }
  } else {
    if (navLogin) navLogin.style.display = "block";
    if (navUser) navUser.style.display = "none";
  }

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN") {
      window.dispatchEvent(new CustomEvent("bstm:login", { detail: session }));
    }
    if (event === "SIGNED_OUT") {
      window.dispatchEvent(new CustomEvent("bstm:logout"));
    }
  });
}

document.addEventListener("DOMContentLoaded", bootstrap);
