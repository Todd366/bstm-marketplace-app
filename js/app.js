import { supabase } from "./core/supabase-client.js";

// ============================================
// BSTM APP CORE (SINGLE SESSION SOURCE)
// ============================================

let currentSession = null;
let readyResolve;

const readyPromise = new Promise((resolve) => {
  readyResolve = resolve;
});

// ---------- NAV UI SYNC ----------
function updateNav(session) {
  const navLogin = document.getElementById("nav-login-btn");
  const navUser = document.getElementById("nav-user-name");

  if (session?.user) {
    if (navLogin) navLogin.style.display = "none";

    if (navUser) {
      navUser.textContent = session.user.email.split("@")[0];
      navUser.style.display = "block";
    }
  } else {
    if (navLogin) navLogin.style.display = "block";
    if (navUser) navUser.style.display = "none";
  }
}

// ---------- BOOTSTRAP ----------
async function bootstrap() {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  currentSession = session;

  updateNav(session);

  readyResolve(session);

  window.dispatchEvent(
    new CustomEvent("bstm:ready", {
      detail: session
    })
  );

  // SINGLE GLOBAL LISTENER
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
}

// ---------- INIT ----------
document.addEventListener("DOMContentLoaded", bootstrap);

// ============================================
// GLOBAL API (USED BY ALL PAGES)
// ============================================
window.BSTM = {
  ready: () => readyPromise,

  getSession: () => currentSession,

  getUser: () => currentSession?.user || null,

  isLoggedIn: () => !!currentSession,

  logout: async () => {
    await supabase.auth.signOut();
    currentSession = null;
    window.location.href = "login.html";
  }
};
