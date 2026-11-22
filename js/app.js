import { supabase } from "./core/supabase-client.js";
import { getProfile } from "./bstm-core.js?v=1792108428";
import "./core/cart.js"; // registers window.addToCart globally
import "./multi-language.js"; // registers window.MultiLanguage globally
import "./form-validation.js"; // registers window.FormValidator globally
import "./toast-notifications.js"; // registers window.Toast globally
import "./core/nav-notifications.js"; // wires the real notification bell in nav.html
import { availableWorkspaces, resolveWorkspace, homeFor, renderWorkspaceNav, renderWorkspaceFooter, pageFile, WORKSPACES } from "./core/workspaces.js";

// ============================================
// BSTM APP CORE (SINGLE SOURCE OF TRUTH)
// ============================================

let currentSession = null;
let currentRole = null; // resolved once per session, used for nav filtering
let currentIsRoomStaff = false; // owns or works in at least one room (profiles.role stays "buyer")
let isBootstrapped = false;
let readyResolve;

const readyPromise = new Promise((resolve) => {
  readyResolve = resolve;
});

// ===============================
// WORKSPACES (Buyer / Seller / Admin)
// ===============================
// Each person works inside ONE workspace at a time: its own menu, home page and
// pages (see js/core/workspaces.js). Everyone has Buyer; room people also have
// Seller; staff also have Admin. A page that belongs to a workspace puts you in
// it; shared account pages keep the workspace you were in; the choice is
// remembered in this browser (and used for the first paint on the next visit).
const WS_KEY = "bstm_workspace"; // remembered across visits: { uid, ws (a choice made with the switch), staff }
const WS_NOW_KEY = "bstm_workspace_now"; // this tab only: the workspace you are working in right now
let currentWorkspace = "buyer";
let sessionChecked = false; // paint the menu only once we know who is signed in (no flash of the wrong menu)
let staffKnown = false; // room membership checked yet this page load?
let staffPromise = Promise.resolve(false);

function readStore(storage, key) {
  try {
    return JSON.parse(storage.getItem(key) || "null") || {};
  } catch (e) {
    return {};
  }
}

function writeStore(storage, key, patch) {
  try {
    storage.setItem(key, JSON.stringify({ ...readStore(storage, key), ...patch }));
  } catch (e) {
    /* storage blocked: the workspace still works for this page load */
  }
}

function workspaceState() {
  const store = readStore(localStorage, WS_KEY);
  const now = readStore(sessionStorage, WS_NOW_KEY);
  const uid = currentSession ? currentSession.user.id : null;
  const mine = !!uid && store.uid === uid;
  const isRoomStaff = staffKnown ? currentIsRoomStaff : !!(mine && store.staff);
  const available = currentSession ? availableWorkspaces({ role: currentRole, isRoomStaff }) : [];
  // a page that belongs to a workspace wins; shared account pages keep the workspace you are working in
  // (this tab), then the one you chose with the switch, then the default for your roles.
  const stored = now.uid === uid && now.ws ? now.ws : mine ? store.ws : null;
  const current = currentSession ? resolveWorkspace({ page: pageFile(location.pathname), available, stored }) : "buyer";
  return { session: currentSession, role: currentRole, available, current, mine, choice: mine ? store.ws : null, isRoomStaff };
}

function renderNav() {
  if (!sessionChecked) return;
  const st = workspaceState();
  currentWorkspace = st.current;
  if (st.session) {
    writeStore(sessionStorage, WS_NOW_KEY, { uid: st.session.user.id, ws: st.current });
    if (staffKnown) writeStore(localStorage, WS_KEY, { uid: st.session.user.id, staff: st.isRoomStaff, ...(st.mine ? {} : { ws: null }) });
  }
  renderWorkspaceFooter(st);
  if (renderWorkspaceNav(st)) {
    if (window.MultiLanguage && window.MultiLanguage.applyTranslations) window.MultiLanguage.applyTranslations();
    window.dispatchEvent(new CustomEvent("bstm:navRendered", { detail: { workspace: st.current, available: st.available } }));
  }
}

// Other elements may still declare data-roles="public" / "auth" / "seller" / ...;
// they are shown by the same rules as before.
function filterNavByRole() {
  const links = document.querySelectorAll("[data-roles]");
  links.forEach((el) => {
    const allowed = el.dataset.roles.split(",").map((r) => r.trim());
    let visible = allowed.includes("public");
    if (currentSession) {
      if (allowed.includes("auth")) visible = true;
      if (currentRole && allowed.includes(currentRole)) visible = true;
      // Room owners and room staff keep profiles.role = "buyer" (role changes
      // are locked), so seller tools are shown by room membership instead.
      if (currentIsRoomStaff && allowed.includes("seller")) visible = true;
    }
    el.style.display = visible ? "" : "none";
  });
  renderNav();
}

// ===============================
// NAV UI SYNC (SAFE DOM VERSION)
// ===============================
function updateNav(session) {
  const user = session?.user || null;

  const navLoginBtns = document.querySelectorAll("#nav-login-btn");
  const navUserNames = document.querySelectorAll("#nav-user-name");
  const navUserMenus = document.querySelectorAll("#nav-user-menu");

  navLoginBtns.forEach((el) => {
    if (!el) return;
    el.style.display = user ? "none" : "inline-block";
  });

  navUserMenus.forEach((el) => {
    if (!el) return;
    el.style.display = user ? "flex" : "none";
  });

  navUserNames.forEach((el) => {
    if (!el) return;

    if (user) {
      el.textContent = user.email ? user.email.split("@")[0] : "User";
      el.style.display = "inline-block";
    } else {
      el.style.display = "none";
    }
  });

  filterNavByRole();
}

// ===============================
// ROLE RESOLUTION
// ===============================
async function resolveRole(userId) {
  const { data: profile, error } = await getProfile(userId);
  if (error || !profile) return null;
  return profile.role || null;
}

// True when this person owns a room or holds any room_roles row. Runs in the
// background (never blocks BSTM.ready()) and re-applies the nav when done.
async function resolveRoomStaff(userId) {
  try {
    const [roles, owned] = await Promise.all([
      supabase.from("room_roles").select("room_id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("rooms").select("id", { count: "exact", head: true }).eq("seller_id", userId),
    ]);
    return (roles.count || 0) > 0 || (owned.count || 0) > 0;
  } catch (err) {
    console.warn("[BSTM] Couldn't check room membership:", err);
    return false;
  }
}

function refreshRoomStaff(session) {
  if (!session) {
    currentIsRoomStaff = false;
    staffKnown = true;
    staffPromise = Promise.resolve(false);
    return;
  }
  staffPromise = resolveRoomStaff(session.user.id).then((isStaff) => {
    currentIsRoomStaff = isStaff;
    staffKnown = true;
    filterNavByRole();
    return isStaff;
  });
}

// Nav is injected asynchronously by smart-loader.js and may finish
// before or after session bootstrap — re-apply filtering whichever
// happens second, so a role is never left unapplied by a race.
window.addEventListener("bstm:componentLoaded", filterNavByRole);

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
    currentRole = currentSession ? await resolveRole(currentSession.user.id) : null;
    sessionChecked = true;

    // IMPORTANT: only update nav AFTER DOM is ready
    requestAnimationFrame(() => updateNav(currentSession));

    readyResolve(currentSession);
    refreshRoomStaff(currentSession);

    window.dispatchEvent(
      new CustomEvent("bstm:ready", {
        detail: currentSession,
      })
    );

    // AUTH LISTENER (single source)
    supabase.auth.onAuthStateChange(async (event, session) => {
      currentSession = session;
      currentRole = session ? await resolveRole(session.user.id) : null;
      refreshRoomStaff(session);

      requestAnimationFrame(() => updateNav(session));

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
    sessionChecked = true;
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
// nav.html is fetched and injected asynchronously by smart-loader.js, with
// no guaranteed ordering against the session check above. Event-based
// retries (bstm:ready / bstm:componentLoaded) were tried here before and
// still proved unreliable in practice — chasing exact timing across three
// independent async systems (fetch, DOMContentLoaded, requestAnimationFrame)
// is fragile by nature. A MutationObserver sidesteps the whole problem: it
// fires the instant nav.html's markup actually lands in the DOM, no matter
// what order anything else happens in, and needs no retry logic at all.
const navContainer = document.getElementById("bstm-nav");
if (navContainer) {
  const navObserver = new MutationObserver(() => {
    updateNav(currentSession);
  });
  navObserver.observe(navContainer, { childList: true });
}
// Also covers the case where nav.html was already injected before this
// script ran (e.g. cached/instant fetch on a fast connection).
requestAnimationFrame(() => updateNav(currentSession));

// ===============================
// GLOBAL API
// ===============================
window.BSTM = {
  ready: () => readyPromise,
  getSession: () => currentSession,
  getUser: () => currentSession?.user || null,
  isLoggedIn: () => !!currentSession,

  // ---- workspaces ----
  workspace: () => currentWorkspace,
  workspaces: () => workspaceState().available,
  // Where this person's own workspace starts (used right after login).
  workspaceHome: async () => {
    await readyPromise;
    if (!currentSession) return "login.html";
    await staffPromise;
    const st = workspaceState();
    // login lands in the workspace you last chose with the switch, otherwise your main one (staff > room > buyer)
    return homeFor(resolveWorkspace({ page: "", available: st.available, stored: st.choice }));
  },
  setWorkspace: (id) => {
    const st = workspaceState();
    if (!WORKSPACES[id] || !st.available.includes(id)) return false;
    writeStore(localStorage, WS_KEY, { uid: currentSession.user.id, ws: id, staff: st.isRoomStaff });
    writeStore(sessionStorage, WS_NOW_KEY, { uid: currentSession.user.id, ws: id });
    window.location.href = homeFor(id);
    return true;
  },

  logout: async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("[BSTM] Logout error:", e);
    }

    currentSession = null;
    window.location.href = "login.html";
  },
};

// Register service worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then(function(r) { console.log('SW registered'); })
      .catch(function(e) { console.warn('SW failed:', e); });
  });
}
