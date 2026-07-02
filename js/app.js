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
  const user = session?.user || null;

  // multiple possible nav layouts (desktop + mobile)
  const navLoginBtns = document.querySelectorAll("#nav-login-btn");
  const navUserNames = document.querySelectorAll("#nav-user-name");

  navLoginBtns.forEach((el) => {
    if (!el) return;
    el.style.display = user ? "none" : "block";
  });

  navUserNames.forEach((el) => {
    if (!el) return;
    if (user) {
      el.textContent = user.email ? user.email.split("@")[0] : "User";
      el.style.display = "block";
    } else {
      el.style.display = "none";
    }
  });
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
      console.warn("[BSTM] Session error:", error.message);
    }

    currentSession = data?.session || null;

    updateNav(currentSession);

    readyResolve(currentSession);

    window.dispatchEvent(
      new CustomEvent("bstm:ready", {
        detail: currentSession
      })
    );

    // AUTH STATE LISTENER (single instance)
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
    console.error("[BSTM] Bootstrap failed:", err);
    readyResolve(null);
  }
}

// ===============================
// INIT
// ===============================
document.addEventListener("DOMContentLoaded", bootstrap);

// ===============================
// HANDLE DYNAMIC NAV INJECTION
// ===============================
window.addEventListener("bstm:ready", () => {
  // re-run UI sync after nav.html is injected
  updateNav(currentSession);
});

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
      console.warn("[BSTM] Logout error:", e);
    }

    currentSession = null;
    window.location.href = "login.html";
  }
};
