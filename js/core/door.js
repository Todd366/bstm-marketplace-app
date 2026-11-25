// js/core/door.js
// How a person gets INTO a workspace. No DOM here: login.js, verify.js, welcome.js and app.js share it.
//
// Model (standard for institutions): ONE verified identity (the email sign-in) and a SEPARATE ACCOUNT PER WORKSPACE
// (public.workspace_accounts). Having signed in proves who you are; it does not give you a workspace. Each workspace has
// its own door. Buyer and Seller accounts are created by the person at that door, with the Terms accepted and recorded.
// Agent, Admin and Government accounts are created by BSTM only. You can switch only between accounts you hold.
import { ORDER, PAGE_WORKSPACE, SELF_REGISTER, TERMS_VERSION, activeIds, defaultWorkspace, homeFor } from "./workspaces.js";

export const WS_KEY = "bstm_workspace"; // remembered across visits: { uid, ws (last choice), accounts (ids, for the first paint) }
export const WS_NOW_KEY = "bstm_workspace_now"; // this tab only: the workspace you are working in right now
export const DOOR_KEY = "bstm_door"; // what the person asked for at the door, kept until the emailed link is opened
const INTENT_TTL_MS = 60 * 60 * 1000;

export function readStore(storage, key) {
  try {
    return JSON.parse(storage.getItem(key) || "null") || {};
  } catch (e) {
    return {};
  }
}

export function writeStore(storage, key, patch) {
  try {
    storage.setItem(key, JSON.stringify({ ...readStore(storage, key), ...patch }));
  } catch (e) {
    /* storage blocked: it still works for this page load */
  }
}

// Only this app's own pages may be a post-login destination (blocks login.html?redirect=https://other-site).
export function safeRedirect(v) {
  v = String(v || "").trim().replace(/^\.?\//, ""); // "/checkout.html" (a pathname) is the same page as "checkout.html"
  return /^[A-Za-z0-9][A-Za-z0-9._-]*\.html(\?[A-Za-z0-9=&._%~,-]*)?(#[A-Za-z0-9_-]*)?$/.test(v) ? v : "";
}

export const isWorkspace = (id) => ORDER.includes(id);

// ---- intent: remembered in this browser while the person opens the emailed link ----
export function storeIntent({ ws, mode, redirect, accepted }) {
  try {
    localStorage.setItem(DOOR_KEY, JSON.stringify({ ws: isWorkspace(ws) ? ws : null, mode: mode === "register" ? "register" : "login", redirect: safeRedirect(redirect), accepted: !!accepted, at: Date.now() }));
  } catch (e) {
    /* nothing to remember: the person simply lands in a workspace they already hold */
  }
}

export function readIntent() {
  const v = readStore(localStorage, DOOR_KEY);
  if (!v || !v.at || Date.now() - v.at > INTENT_TTL_MS) return null;
  return { ws: isWorkspace(v.ws) ? v.ws : null, mode: v.mode === "register" ? "register" : "login", redirect: safeRedirect(v.redirect), accepted: !!v.accepted };
}

export function clearIntent() {
  try {
    localStorage.removeItem(DOOR_KEY);
  } catch (e) {
    /* ignore */
  }
}

// ---- accounts ----
// Reads this person's workspace accounts. ok=false when the table cannot be read (callers then fall back to the
// pre-accounts rule so nobody is locked out by a database hiccup).
export async function fetchAccounts(sb, uid) {
  try {
    const { data, error } = await sb.from("workspace_accounts").select("workspace, status, registered_via, registered_at, terms_version, terms_accepted_at").eq("user_id", uid);
    if (error || !Array.isArray(data)) return { ok: false, rows: null, error: error ? error.message : "unreadable" };
    return { ok: true, rows: data };
  } catch (e) {
    return { ok: false, rows: null, error: String(e && e.message ? e.message : e) };
  }
}

async function rpc(sb, fn, ws) {
  try {
    const { data, error } = await sb.rpc(fn, { p_workspace: ws, p_terms_version: TERMS_VERSION });
    if (error) return { ok: false, error: error.message || "failed" };
    return { ok: true, row: data };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}
export const registerWorkspace = (sb, ws) => rpc(sb, "register_workspace", ws); // Buyer / Seller only (server enforces)
export const acceptTerms = (sb, ws) => rpc(sb, "accept_terms", ws);

// Make `ws` the workspace this person is working in (this tab) and the one they land in next time.
export function activate(uid, ws, accountIds) {
  const patch = { uid, ws };
  if (accountIds) patch.accounts = accountIds;
  writeStore(localStorage, WS_KEY, patch);
  writeStore(sessionStorage, WS_NOW_KEY, { uid, ws });
}

// Where a person goes after getting in at the `ws` door: the page they were heading to when it belongs to this
// workspace (or is shared), otherwise this workspace's home. A page of ANOTHER workspace is never a destination.
export function destination({ ws, redirect }) {
  const r = safeRedirect(redirect);
  if (r) {
    const page = r.split(/[?#]/)[0].toLowerCase();
    const own = [].concat(PAGE_WORKSPACE[page] || []);
    if (!own.length || own.includes(ws)) return r;
  }
  return homeFor(ws);
}

// Decide what the door has to do next. Pure: no network, no DOM.
//   rows      this person's workspace_accounts rows (null = unreadable)
//   ws        the workspace door they came through (null = none chosen)
//   mode      "login" | "register"
//   accepted  they ticked the Terms box at the door before the link was sent
//   stored    the workspace they last chose (for a door-less sign-in)
// Returns { kind, ... } where kind is one of:
//   legacy | choose | go | register-now | accept-now | create | terms | staff-missing | suspended
export function resolveDoor({ rows, ws, mode, accepted, redirect, stored }) {
  if (!Array.isArray(rows)) return { kind: "legacy" };
  const have = activeIds(rows);
  if (!isWorkspace(ws)) {
    if (!have.length) return { kind: "choose" };
    const pick = stored && have.includes(stored) ? stored : defaultWorkspace(have);
    return { kind: "go", ws: pick, url: destination({ ws: pick, redirect }) };
  }
  const row = rows.find((r) => r.workspace === ws);
  if (!row) {
    if (!SELF_REGISTER.includes(ws)) return { kind: "staff-missing", ws };
    return accepted && mode === "register" ? { kind: "register-now", ws } : { kind: "create", ws };
  }
  if (row.status !== "active") return { kind: "suspended", ws };
  if (row.terms_version !== TERMS_VERSION) return accepted ? { kind: "accept-now", ws } : { kind: "terms", ws, first: !row.terms_version };
  return { kind: "go", ws, url: destination({ ws, redirect }) };
}
