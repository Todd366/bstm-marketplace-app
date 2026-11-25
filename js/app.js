import { supabase } from "./core/supabase-client.js";
import { getProfile } from "./bstm-core.js?v=1792108428";
import "./core/cart.js"; // registers window.addToCart globally
import "./multi-language.js"; // registers window.MultiLanguage globally
import "./form-validation.js"; // registers window.FormValidator globally
import "./toast-notifications.js"; // registers window.Toast globally
import "./core/nav-notifications.js"; // wires the real notification bell in nav.html
import { availableWorkspaces, legacyAccounts, activeIds, gateFor, doorUrl, resolveWorkspace, homeFor, renderWorkspaceNav, renderWorkspaceFooter, pageFile, WORKSPACES } from "./core/workspaces.js";
import { WS_KEY, WS_NOW_KEY, DOOR_KEY, readStore, writeStore, fetchAccounts, activate } from "./core/door.js";

// ============================================
// BSTM APP CORE (SINGLE SOURCE OF TRUTH)
// ============================================

let currentSession = null;
let currentRole = null; // profiles.role: used for staff pages and the Control Center only (workspaces come from accounts)
let currentIsRoomStaff = false; // only read when the accounts table cannot be (legacy fallback)
let isBootstrapped = false;
let readyResolve;

const readyPromise = new Promise((resolve) => {
  readyResolve = resolve;
});

// ===============================
// WORKSPACES (Buyer / Seller / Agent / Admin / Government)
// ===============================
// Each person works inside ONE workspace at a time: its own menu, home page and pages (js/core/workspaces.js).
// A workspace exists for you only if you hold an ACTIVE ACCOUNT in it (public.workspace_accounts): each account is
// created at that workspace's own door (js/core/door.js, login.html, welcome.html). A page that belongs to a workspace
// puts you in it; shared account pages keep the workspace you were in; a page of a workspace you hold no account in
// sends you to that workspace's door. The choice is remembered in this browser.
let currentWorkspace = "buyer";
let sessionChecked = false; // paint the menu only once we know who is signed in (no flash of the wrong menu)
let accountRows = null; // this person's workspace_accounts rows (null = not read / unreadable)
let accountsOk = false; // the server read succeeded (otherwise the pre-accounts rule applies and nothing is gated)
let accountsKnown = false; // read finished this page load (ok or not)
let accountsPromise = Promise.resolve([]);
let gateDone = false;

function workspaceState() {
  const store = readStore(localStorage, WS_KEY);
  const now = readStore(sessionStorage, WS_NOW_KEY);
  const uid = currentSession ? currentSession.user.id : null;
  const mine = !!uid && store.uid === uid;
  let ids = [];
  if (currentSession) {
    if (accountsKnown) ids = accountsOk ? activeIds(accountRows) : legacyAccounts({ role: currentRole, isRoomStaff: currentIsRoomStaff });
    else ids = mine && Array.isArray(store.accounts) ? store.accounts : [];
  }
  const available = availableWorkspaces({ accounts: ids });
  // a page that belongs to a workspace wins; shared account pages keep the workspace you are working in
  // (this tab), then the one you chose with the switch, then the default for your accounts.
  const stored = now.uid === uid && now.ws ? now.ws : mine ? store.ws : null;
  const current = currentSession ? resolveWorkspace({ page: pageFile(location.pathname), available, stored }) : "buyer";
  return { session: currentSession, role: currentRole, available, current, mine, choice: mine ? store.ws : null, known: accountsKnown || (mine && Array.isArray(store.accounts)) };
}

function renderNav() {
  if (!sessionChecked) return;
  const st = workspaceState();
  if (st.session && !st.known) return; // accounts not known yet: paint once, correctly
  currentWorkspace = st.current;
  if (st.session) {
    writeStore(sessionStorage, WS_NOW_KEY, { uid: st.session.user.id, ws: st.current });
    if (accountsKnown) writeStore(localStorage, WS_KEY, { uid: st.session.user.id, accounts: st.available, ...(st.mine ? {} : { ws: null }) });
  }
  renderWorkspaceFooter(st);
  if (renderWorkspaceNav(st)) {
    if (window.MultiLanguage && window.MultiLanguage.applyTranslations) window.MultiLanguage.applyTranslations();
    window.dispatchEvent(new CustomEvent("bstm:navRendered", { detail: { workspace: st.current, available: st.available } }));
  }
}

// A person who signs in is held to the page gate once per page load (js/core/workspaces.js gateFor).
function runGate() {
  if (gateDone || !currentSession || !accountsKnown || !accountsOk) return;
  const st = workspaceState();
  const page = pageFile(location.pathname);
  const g = gateFor({ page, rows: accountRows, current: st.current, redirect: page + location.search });
  if (g) {
    gateDone = true;
    window.location.replace(g.to);
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
      // seller tools are shown to people who hold a Seller account
      if (allowed.includes("seller") && workspaceState().available.includes("seller")) visible = true;
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

// Legacy fallback only (accounts table unreadable): does this person own a room or hold any room_roles row?
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

// Reads this person's workspace accounts (never blocks BSTM.ready()); re-applies the nav and runs the page gate when done.
function loadAccounts(session) {
  if (!session) {
    accountRows = null;
    accountsOk = false;
    accountsKnown = true;
    currentIsRoomStaff = false;
    accountsPromise = Promise.resolve([]);
    return accountsPromise;
  }
  accountsKnown = false;
  accountsPromise = fetchAccounts(supabase, session.user.id)
    .then(async (res) => {
      accountsOk = res.ok;
      accountRows = res.ok ? res.rows : null;
      if (!res.ok) {
        console.warn("[BSTM] Workspace accounts unreadable, using the role rule:", res.error);
        currentIsRoomStaff = await resolveRoomStaff(session.user.id);
      }
      accountsKnown = true;
      if (!checkIdle()) {
        touchActivity();
        filterNavByRole();
        runGate();
      }
      return workspaceState().available;
    })
    .catch((err) => {
      console.warn("[BSTM] Accounts check failed:", err);
      accountsKnown = true;
      return workspaceState().available;
    });
  return accountsPromise;
}

// Nav is injected asynchronously by smart-loader.js and may finish
// before or after session bootstrap — re-apply filtering whichever
// happens second, so a role is never left unapplied by a race.
window.addEventListener("bstm:componentLoaded", filterNavByRole);

// ===============================
// IDLE SIGN-OUT (staff workspaces)
// ===============================
// Agent, Admin and Government sessions end after 30 minutes without activity (privileged access should not stay
// open on an unattended device). Buyer and Seller sessions are not timed out. Activity is shared across tabs
// through localStorage, and checked when a page opens and once a minute.
const IDLE_KEY = "bstm_last_active";
const STAFF_WORKSPACES = ["agent", "admin", "government"];
const STAFF_IDLE_MS = 30 * 60 * 1000;
let lastWrite = 0;

function touchActivity() {
  const now = Date.now();
  if (now - lastWrite < 15000) return;
  lastWrite = now;
  try {
    localStorage.setItem(IDLE_KEY, String(now));
  } catch (e) {
    /* storage blocked: no shared clock, nothing to time out */
  }
}

function checkIdle() {
  if (!currentSession || !accountsKnown) return false;
  if (!STAFF_WORKSPACES.includes(workspaceState().current)) return false;
  let last = 0;
  try {
    last = Number(localStorage.getItem(IDLE_KEY)) || 0;
  } catch (e) {
    return false;
  }
  if (last && Date.now() - last > STAFF_IDLE_MS) {
    window.BSTM.logout({ reason: "idle" });
    return true;
  }
  return false;
}

["pointerdown", "keydown", "scroll", "touchstart"].forEach((ev) => window.addEventListener(ev, touchActivity, { passive: true }));
setInterval(checkIdle, 60 * 1000);

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
    loadAccounts(currentSession);

    window.dispatchEvent(
      new CustomEvent("bstm:ready", {
        detail: currentSession,
      })
    );

    // AUTH LISTENER (single source)
    supabase.auth.onAuthStateChange(async (event, session) => {
      const changed = (session ? session.user.id : null) !== (currentSession ? currentSession.user.id : null);
      currentSession = session;
      currentRole = session ? await resolveRole(session.user.id) : null;
      if (changed || event === "SIGNED_IN") loadAccounts(session);

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

  // ---- workspaces (one account per workspace) ----
  workspace: () => currentWorkspace,
  workspaces: () => workspaceState().available,
  hasWorkspace: (id) => workspaceState().available.includes(id),
  accountsReady: () => accountsPromise,
  refreshAccounts: () => loadAccounts(currentSession),
  doorUrl,
  // Where this person's own workspace starts (used right after login). No account anywhere = the chooser.
  workspaceHome: async () => {
    await readyPromise;
    if (!currentSession) return "welcome.html";
    await accountsPromise;
    // the page gate is already taking this person to a door: do not let a page's own fallback redirect override it
    if (gateDone) return new Promise(() => {});
    const st = workspaceState();
    if (!st.available.length) return "welcome.html";
    // login lands in the workspace you last chose with the switch, otherwise your main one (staff > seller > buyer)
    return homeFor(resolveWorkspace({ page: "", available: st.available, stored: st.choice }));
  },
  // Switch between workspaces you hold accounts in (never to one you do not).
  setWorkspace: (id) => {
    const st = workspaceState();
    if (!WORKSPACES[id] || !st.available.includes(id)) return false;
    activate(currentSession.user.id, id, st.available);
    window.location.href = homeFor(id);
    return true;
  },

  logout: async (opts) => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("[BSTM] Logout error:", e);
    }
    // leave nothing of this person's workspaces behind in this browser
    try {
      sessionStorage.removeItem(WS_NOW_KEY);
      localStorage.removeItem(WS_KEY);
      localStorage.removeItem(DOOR_KEY);
      localStorage.removeItem("bstm_post_login_redirect");
      localStorage.removeItem(IDLE_KEY);
    } catch (e) {
      /* storage blocked */
    }
    currentSession = null;
    window.location.href = opts && opts.reason === "idle" ? "welcome.html?reason=idle" : "welcome.html";
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
