// js/core/payments.js
// Browser side of the payments layer. Every secret and every money decision lives on the
// server (database functions + the `payments` edge function); this module only asks.
import { supabase } from "./supabase-client.js";
import { loadConfig } from "./config.js";
import { escapeHtml } from "./sanitize.js";

const FN_URL = `${loadConfig().API.SUPABASE_URL}/functions/v1/payments`;
const FN_KEY = loadConfig().API.SUPABASE_KEY;

export const PROVIDER_LABELS = {
  cod: "Cash on Delivery",
  dpo: "DPO Pay",
  orange_money: "Orange Money",
  mascom_myzaka: "MyZaka (Mascom)",
  btc_smega: "Smega (BTC)",
  bank_eft: "Bank transfer (EFT)",
  paystack: "Paystack",
};

export function paymentLabel(slug) {
  if (!slug) return "—";
  return PROVIDER_LABELS[slug] || String(slug);
}

export function money(n) {
  return "P" + Number(n || 0).toFixed(2);
}

// Order-level payment state (orders.payment_status)
export const ORDER_PAYMENT = {
  unpaid: { label: "Awaiting payment", bg: "#FEF3C7", fg: "#92400E" },
  pending: { label: "Payment in progress", bg: "#DBEAFE", fg: "#1E40AF" },
  paid: { label: "Paid", bg: "#DCFCE7", fg: "#166534" },
  failed: { label: "Payment failed", bg: "#FEE2E2", fg: "#991B1B" },
  refunded: { label: "Refunded", bg: "#E5E7EB", fg: "#374151" },
  review: { label: "Payment under review", bg: "#FFEDD5", fg: "#9A3412" },
};

// True for an order that must be paid online before the seller can act on it.
export function isOnlineOrder(order) {
  return !!order && !!order.payment_method && order.payment_method !== "cod";
}

export function awaitingPayment(order) {
  return isOnlineOrder(order) && order.status !== "cancelled" && order.payment_status !== "paid";
}

// A small coloured pill for an online order's payment state. Returns "" for Cash on Delivery
// (nothing to show) and for cancelled orders that never reached payment.
export function paymentBadge(order) {
  if (!isOnlineOrder(order)) return "";
  const st = ORDER_PAYMENT[order.payment_status] || ORDER_PAYMENT.unpaid;
  if (order.status === "cancelled" && order.payment_status !== "refunded" && order.payment_status !== "review") return "";
  return (
    `<span style="display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:${st.bg};color:${st.fg};">` +
    escapeHtml(st.label) +
    "</span>"
  );
}

export function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

// A payment attempt that died half way (tab closed after the order was created but before the
// provider session was attached) can only be completed by repeating the same idempotency key.
// Remember the key for this tab so the payment page can resume instead of leaving the buyer stuck.
function keyName(provider, orderIds) {
  return "bstm_pay_key:" + provider + ":" + [...orderIds].sort().join(",");
}
export function rememberPaymentKey(provider, orderIds, key) {
  try {
    sessionStorage.setItem(keyName(provider, orderIds), key);
  } catch {
    /* storage unavailable: resume simply isn't possible */
  }
}
export function recallPaymentKey(provider, orderIds) {
  try {
    return sessionStorage.getItem(keyName(provider, orderIds));
  } catch {
    return null;
  }
}

const ERROR_TEXT = {
  unauthorized: "Please sign in again to continue.",
  network: "We couldn't reach the payment service. Check your connection and try again.",
  provider_disabled: "That payment method was just switched off. Please choose another one.",
  provider_not_configured: "That payment method isn't available right now. Please choose another one.",
  provider_not_implemented: "That payment method isn't available right now. Please choose another one.",
  provider_error: "We couldn't start that payment, and nothing was charged. Please try again or choose another method.",
  unknown_provider: "That payment method isn't available.",
  method_unavailable: "That payment method was just switched off. Please choose another one.",
  already_open: "A payment is already in progress for these orders.",
  order_not_payable: "One of these orders can no longer be paid.",
  order_not_online: "This order is Cash on Delivery — there is nothing to pay online.",
  order_amount_invalid: "This order has no amount to pay.",
  order_not_found: "We couldn't find one of these orders.",
  forbidden: "These orders belong to a different account.",
  group_not_found: "We couldn't find that payment.",
  reference_invalid: "Enter the payment reference you received (at least 4 characters).",
  reference_already_used: "That reference has already been used for another payment.",
  group_not_open: "This payment is no longer open.",
  not_manual: "This payment is handled by the payment provider, not by reference.",
  order_awaiting_payment: "This order is waiting for the buyer's payment, so it can't be moved forward yet.",
  instructions_required: "Add the payment instructions buyers should follow before switching this method on.",
  not_onboarded: "Set the status to Sandbox or Live before switching this method on.",
  config_invalid: "The settings for this method are not valid.",
  invalid_resolution: "That resolution isn't allowed.",
  group_not_in_review: "This payment is no longer in review.",
};

export function paymentErrorMessage(code) {
  return ERROR_TEXT[code] || "Something went wrong with the payment. Please try again.";
}

// Pulls the stable error code out of a database error such as "payments:reference_invalid".
export function dbErrorCode(error) {
  const m = /payments:([a-z_]+)/.exec((error && error.message) || "");
  return m ? m[1] : null;
}

// Only ever send the buyer to an https page (the URL comes from the server, but never trust a redirect).
export function safeHttpsUrl(u) {
  try {
    const url = new URL(String(u));
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function getPaymentMethods() {
  const { data, error } = await supabase.rpc("get_payment_methods");
  if (error || !Array.isArray(data)) {
    console.warn("[BSTM Payments] Couldn't load payment methods:", error);
    return [];
  }
  return data;
}

// Asks the server whether a method can really take a payment right now.
// Fails closed: any problem means "not ready". This is a POST on purpose: the service worker
// keeps a copy of every GET and would serve a stale "ready: true" when the network is down.
export async function isMethodReady(slug) {
  try {
    const res = await fetch(`${FN_URL}/ready?provider=${encodeURIComponent(slug)}`, { method: "POST" });
    if (!res.ok) return false;
    const body = await res.json();
    return !!body && body.ready === true;
  } catch (err) {
    console.warn("[BSTM Payments] ready check failed:", err);
    return false;
  }
}

async function callFunction(path, body, method = "POST") {
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess && sess.session ? sess.session.access_token : null;
    if (!token) return { ok: false, status: 401, data: { error: "unauthorized" } };
    const init = {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: FN_KEY },
    };
    if (method === "POST") init.body = JSON.stringify(body || {});
    const res = await fetch(`${FN_URL}/${path}`, init);
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data: data || { error: "internal_error" } };
  } catch (err) {
    console.warn("[BSTM Payments] request failed:", err);
    return { ok: false, status: 0, data: { error: "network" } };
  }
}

// Starts a payment for orders that already exist. Safe to repeat with the same key.
export async function startPayment({ provider, orderIds, idempotencyKey }) {
  const key = idempotencyKey || newIdempotencyKey();
  rememberPaymentKey(provider, orderIds, key);
  const r = await callFunction("create", { provider, order_ids: orderIds, idempotency_key: key });
  return {
    ok: r.ok,
    status: r.status,
    group: r.data.group || null,
    error: r.ok ? null : r.data.error || "internal_error",
    groupId: r.data.group_id || (r.data.group && r.data.group.id) || null,
  };
}

// Re-checks a payment (asks the provider when needed) and returns the current summary.
export async function getPaymentStatus(groupId) {
  const r = await callFunction("status", { group_id: groupId });
  return { ok: r.ok, status: r.status, group: r.data.group || null, error: r.ok ? null : r.data.error || "internal_error" };
}

// Reads the summary straight from the database (no provider call). Used when the edge function
// can't be reached, so the buyer still sees where the payment stands.
export async function getPaymentGroupFromDb(groupId) {
  const { data, error } = await supabase.rpc("get_payment_group", { p_group: groupId });
  if (error || !data) return { ok: false, group: null, error: dbErrorCode(error) || "internal_error" };
  return { ok: true, group: data, error: null };
}

// Admin only: which gateways have all their server-side secrets (names of missing ones, never values).
export async function getGatewayHealth() {
  const r = await callFunction("health", null, "GET");
  if (!r.ok || !Array.isArray(r.data.providers)) return { ok: false, providers: [] };
  return { ok: true, providers: r.data.providers };
}

export async function submitReference(groupId, reference) {
  const { data, error } = await supabase.rpc("payments_buyer_submit_reference", {
    p_group: groupId,
    p_payer_reference: reference,
  });
  if (error) return { ok: false, error: dbErrorCode(error) || "internal_error", group: null };
  return { ok: true, error: null, group: data };
}

export function shortOrderRef(orderId) {
  return "BSTM-" + String(orderId).split("-")[0].toUpperCase();
}

export function shortGroupRef(groupId) {
  return "PAY-" + String(groupId).split("-")[0].toUpperCase();
}

// Hands one paid / cash order to the CabLink driver network. Idempotent on the server.
// Returns one of: "sent" | "already" | "queued" | "blocked" | "none".
//   queued  = CabLink couldn't take it right now (the request stays pending and can be retried)
//   blocked = the order isn't payable-complete yet or was cancelled
//   none    = this order has no delivery request
export async function dispatchOrderToCabLink(orderId) {
  const { data: dr, error } = await supabase
    .from("delivery_requests")
    .select("id, cablink_ride_id")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error || !dr) return "none";
  if (dr.cablink_ride_id) return "already";
  try {
    const { data, error: fnErr } = await supabase.functions.invoke("dispatch-to-cablink", {
      body: { delivery_request_id: dr.id },
    });
    if (!fnErr && data && data.success) return data.already_dispatched ? "already" : "sent";
    let code = null;
    if (fnErr && fnErr.context && typeof fnErr.context.json === "function") {
      try {
        const body = await fnErr.context.json();
        code = body && body.error;
      } catch {
        code = null;
      }
    }
    if (code === "payment_required" || code === "order_cancelled") return "blocked";
    console.warn("[BSTM Payments] CabLink dispatch not completed:", code || fnErr);
    return "queued";
  } catch (err) {
    console.warn("[BSTM Payments] CabLink dispatch threw:", err);
    return "queued";
  }
}
