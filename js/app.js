import { supabase } from "./core/supabase-client.js";

// ============================================
// BSTM APP CORE (SINGLE SOURCE OF TRUTH)
// ============================================

let currentSession = null;
let isBootstrapped = false;
let readyResolve;

const readyPromise = new Promise((resolve) => {
  readyResolve = resolve;
});

// ===============================
// NAV UI SYNC
// ===============================
function updateNav(session) {
  const navLogin = document.getElementById("nav-login-btn");
  const navUser = document.getElementById("nav-user-name");

  const user = session?.user || null;

  if (user) {
    if (navLogin) navLogin.style.display = "none";

    if (navUser) {
      navUser.textContent = user.email ? user.email.split("@")[0] : "User";
      navUser.style.display = "block";
    }
  } else {
    if (navLogin) navLogin.style.display = "block";
    if (navUser) navUser.style.display = "none";
  }
}

// ===============================
// BOOTSTRAP SESSION
// ===============================
async function bootstrap() {
  if (isBootstrapped) return;
  isBootstrapped = true;

  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.warn("Supabase session error:", error.message);
    }

    currentSession = data?.session || null;

    updateNav(currentSession);

    readyResolve(currentSession);

    window.dispatchEvent(
      new CustomEvent("bstm:ready", {
        detail: currentSession
      })
    );

    // SINGLE GLOBAL AUTH LISTENER
    supabase.auth.onAuthStateChange((event, session) => {
      currentSession = session;

      updateNav(session);

      if (event === "SIGNED_IN") {
        window.dispatchEvent(
          new CustomEvent("bstm:login", { detail: session })
        );
      }

      if (event === "SIGNED_OUT") {
        window.dispatchEvent(new CustomEvent("bstm:logout"));
      }
    });

  } catch (err) {
    console.error("Bootstrap failed:", err);
    readyResolve(null);
  }
}

// ===============================
// INIT
// ===============================
document.addEventListener("DOMContentLoaded", bootstrap);

// ===============================
// GLOBAL API
// ===============================
window.BSTM = {
  ready: () => readyPromise,

  getSession: () => currentSession,

  getUser: () => currentSession?.user || null,

  isLoggedIn: () => !!currentSession,

  logout: async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("Logout error:", e);
    }

    currentSession = null;
    window.location.href = "login.html";
  }
};
