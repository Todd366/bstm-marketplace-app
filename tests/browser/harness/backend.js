// In-page emulation of the SERVER side of the payments contract, used by the browser tests.
// It mirrors the live shapes (verified against pg_get_functiondef on 2026-11-07): get_payment_methods,
// get_payment_group / payments_group_summary, admin_list_payment_queue, admin_list_payment_providers,
// plus the `payments` edge function (/ready /create /status /health) and the orders triggers.
// It is an emulation: it proves the FRONTEND behaves correctly against the contract, not that the server does.
(function () {
  const W = window;
  const DB = () => W.__DB;
  const T = (t) => (W.__DB[t] ||= []);
  const now = () => new Date().toISOString();
  const uid = () => crypto.randomUUID();
  const S = () => W.__SCEN || {};
  const serr = (msg, code = "P0001") => { const e = new Error(msg); e.code = code; e.server = true; e.message = msg; return e; };
  const me = () => (W.__SESSION && W.__SESSION.user) || null;
  const isAdmin = () => { const u = me(); const p = u && T("profiles").find((x) => x.id === u.id); return !!p && (p.role === "admin" || p.role === "super_admin"); };
  const byId = (a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0);

  function summary(gid) {
    const g = T("payment_groups").find((x) => x.id === gid);
    if (!g) return null;
    const p = T("payment_providers").find((x) => x.slug === g.provider);
    const orders = T("payment_transactions").filter((t) => t.group_id === gid).map((t) => {
      const o = T("orders").find((x) => x.id === t.order_id);
      return { id: o.id, amount: t.amount, status: o.status, payment_status: o.payment_status };
    }).sort(byId);
    return {
      id: g.id, provider: g.provider, provider_name: p.display_name, kind: p.kind, status: g.status, amount: g.amount,
      currency: g.currency_code || "BWP", checkout_url: g.checkout_url, payer_reference: g.payer_reference,
      failure_reason: g.failure_reason, expires_at: g.expires_at, created_at: g.created_at,
      instructions: p.kind === "manual" ? p.config : {}, orders,
    };
  }

  // ---- state transitions (what the server does when money moves) ----
  const sim = {
    summary,
    markPaid(gid, ref) {
      const g = T("payment_groups").find((x) => x.id === gid);
      g.status = "succeeded"; g.completed_at = now(); if (ref) g.payer_reference = ref;
      T("payment_transactions").filter((t) => t.group_id === gid).forEach((t) => {
        t.status = "succeeded";
        const o = T("orders").find((x) => x.id === t.order_id); o.payment_status = "paid"; if (o.status === "pending") o.status = "confirmed";
      });
      persist();
    },
    markFailed(gid, status = "failed", reason = "declined") {
      const g = T("payment_groups").find((x) => x.id === gid);
      g.status = status; g.failure_reason = reason;
      T("payment_transactions").filter((t) => t.group_id === gid).forEach((t) => { t.status = "failed"; const o = T("orders").find((x) => x.id === t.order_id); o.payment_status = "failed"; });
      persist();
    },
    expire(gid) {
      const g = T("payment_groups").find((x) => x.id === gid);
      g.status = "expired";
      T("payment_transactions").filter((t) => t.group_id === gid).forEach((t) => { const o = T("orders").find((x) => x.id === t.order_id); o.status = "cancelled"; o.payment_status = "failed"; });
      persist();
    },
    review(gid, reason = "amount_mismatch") {
      const g = T("payment_groups").find((x) => x.id === gid);
      g.status = "review"; g.failure_reason = reason;
      T("payment_transactions").filter((t) => t.group_id === gid).forEach((t) => { const o = T("orders").find((x) => x.id === t.order_id); o.payment_status = "review"; });
      persist();
    },
  };
  W.__sim = sim;
  function persist() { try { sessionStorage.setItem("__DB", JSON.stringify(W.__DB)); } catch {} }

  // ---- orders / order_items triggers ----
  W.__HOOKS = {
    orders: {
      before_insert(row) {
        const me_ = me();
        row.status = "pending";
        row.payment_status = "unpaid";
        row.payment_group_id = null;
        if (me_ && row.buyer_id !== me_.id) throw serr("new row violates row-level security policy for table \"orders\"", "42501");
        const pm = row.payment_method;
        if (pm && pm !== "cod") {
          const p = T("payment_providers").find((x) => x.slug === pm && x.enabled);
          if (!p) throw serr("payments:method_unavailable");
          row.payment_due_at = new Date(Date.now() + (p.hold_minutes || 120) * 60000).toISOString();
        } else {
          row.payment_due_at = null;
        }
        return row;
      },
      before_update(oldRow, nw) {
        if (oldRow.status !== nw.status && nw.status !== "cancelled" && oldRow.payment_method && oldRow.payment_method !== "cod" && oldRow.payment_status !== "paid") throw serr("payments:order_awaiting_payment");
        if (["payment_status", "payment_group_id", "payment_method", "payment_due_at"].some((k) => oldRow[k] !== nw[k])) throw serr("payments:payment_fields_locked");
      },
    },
    order_items: {
      after_insert(row) {
        const o = T("orders").find((x) => x.id === row.order_id);
        if (o && o.delivery_method === "cablink" && !T("delivery_requests").some((d) => d.order_id === o.id)) {
          T("delivery_requests").push({ id: uid(), order_id: o.id, buyer_id: o.buyer_id, pickup_room_id: o.room_id, dropoff_address: o.delivery_address, dropoff_city: o.delivery_city, dropoff_phone: o.delivery_phone, status: "pending", cablink_ride_id: null, requested_at: now(), updated_at: now() });
        }
      },
    },
  };

  // ---- database functions (RPC) ----
  const need = (c, m) => { if (!c) throw serr(m); };
  W.__RPC = {
    decrement_product_stock({ p_product_id, p_qty }) {
      const p = T("products").find((x) => x.id === p_product_id);
      if (!p) return true;
      if (Number(p.quantity) < Number(p_qty)) return false;
      p.quantity = Number(p.quantity) - Number(p_qty); return true;
    },
    restore_product_stock({ p_product_id, p_qty }) { const p = T("products").find((x) => x.id === p_product_id); if (p) p.quantity = Number(p.quantity) + Number(p_qty); return null; },
    advance_order_status({ p_order_id, p_new_status }) {
      const o = T("orders").find((x) => x.id === p_order_id); need(o, "order_not_found");
      if (o.payment_method && o.payment_method !== "cod" && o.payment_status !== "paid" && p_new_status !== "cancelled") throw serr("payments:order_awaiting_payment");
      o.status = p_new_status; return null;
    },
    get_payment_methods() {
      return T("payment_providers").filter((p) => p.enabled).sort((a, b) => a.sort_order - b.sort_order || (a.slug > b.slug ? 1 : -1))
        .map((p) => ({ slug: p.slug, name: p.display_name, kind: p.kind, description: p.description, hold_minutes: p.hold_minutes, config: p.kind === "manual" ? p.config : {} }));
    },
    get_payment_group({ p_group }) {
      need(me(), "payments:not_authenticated");
      const g = T("payment_groups").find((x) => x.id === p_group);
      if (!g || (g.buyer_id !== me().id && !isAdmin())) throw serr("payments:group_not_found");
      if (S().dbSummaryDown) throw serr("db down");
      return summary(p_group);
    },
    payments_buyer_submit_reference({ p_group, p_payer_reference }) {
      const g = T("payment_groups").find((x) => x.id === p_group && x.buyer_id === (me() || {}).id); need(g, "payments:group_not_found");
      const p = T("payment_providers").find((x) => x.slug === g.provider); need(p.kind === "manual", "payments:not_manual");
      need(["pending", "awaiting_confirmation"].includes(g.status), "payments:group_not_open");
      const r = String(p_payer_reference || "").trim(); need(r.length >= 4, "payments:reference_invalid");
      need(!T("payment_groups").some((x) => x.id !== g.id && x.provider === g.provider && x.payer_reference === r), "payments:reference_already_used");
      g.payer_reference = r; g.status = "awaiting_confirmation"; persist(); return summary(g.id);
    },
    admin_list_payment_providers() { need(isAdmin(), "payments:forbidden"); if (S().providersDown) throw serr("providers unavailable"); return T("payment_providers").slice().sort((a, b) => a.sort_order - b.sort_order || (a.slug > b.slug ? 1 : -1)); },
    admin_list_payment_queue() {
      need(isAdmin(), "payments:forbidden");
      if (S().queueDown) throw serr("queue unavailable");
      return T("payment_groups").filter((g) => { const p = T("payment_providers").find((x) => x.slug === g.provider); return ["awaiting_confirmation", "review"].includes(g.status) || (p.kind === "manual" && g.status === "pending"); })
        .sort((a, b) => (a.created_at > b.created_at ? 1 : -1)).map((g) => {
          const p = T("payment_providers").find((x) => x.slug === g.provider); const pr = T("profiles").find((x) => x.id === g.buyer_id) || {};
          return { id: g.id, provider: g.provider, provider_name: p.display_name, kind: p.kind, status: g.status, amount: g.amount, payer_reference: g.payer_reference, failure_reason: g.failure_reason, created_at: g.created_at, expires_at: g.expires_at, buyer_email: pr.email || null, buyer_phone: pr.phone || null, order_count: T("payment_transactions").filter((t) => t.group_id === g.id).length };
        });
    },
    admin_set_payment_provider(a) {
      need(isAdmin(), "payments:forbidden");
      const p = T("payment_providers").find((x) => x.slug === a.p_slug); need(p, "payments:unknown_provider");
      const n = { ...p };
      if (a.p_status != null) n.status = a.p_status;
      if (a.p_config != null) n.config = a.p_config;
      if (a.p_hold_minutes != null) { need(a.p_hold_minutes >= 15 && a.p_hold_minutes <= 10080, "payments:config_invalid"); n.hold_minutes = a.p_hold_minutes; }
      if (a.p_display_name != null) n.display_name = a.p_display_name;
      if (a.p_sort != null) n.sort_order = a.p_sort;
      if (a.p_enabled != null) n.enabled = a.p_enabled;
      if (n.enabled && !p.enabled) {
        if (n.kind === "manual") need(String((n.config || {}).instructions || "").trim(), "payments:instructions_required");
        else need(n.status !== "not_onboarded", "payments:not_onboarded");
      }
      Object.assign(p, n); persist(); return { ok: true, slug: p.slug };
    },
    admin_create_manual_provider({ p_slug, p_display_name, p_config }) {
      need(isAdmin(), "payments:forbidden");
      if (T("payment_providers").some((x) => x.slug === p_slug)) throw serr("duplicate key value violates unique constraint", "23505");
      T("payment_providers").push({ slug: p_slug, display_name: p_display_name, kind: "manual", status: "not_onboarded", enabled: false, sort_order: 100, description: "", config: p_config || {}, requires_secrets: [], hold_minutes: 1440, created_at: now(), updated_at: now() });
      persist(); return { ok: true };
    },
    payments_staff_confirm_manual({ p_group, p_approve, p_note }) {
      need(isAdmin(), "payments:forbidden");
      const g = T("payment_groups").find((x) => x.id === p_group); need(g, "payments:group_not_found");
      need(["pending", "awaiting_confirmation"].includes(g.status), "payments:group_not_open");
      if (S().confirmNeedsReview) { sim.review(g.id, "order_cancelled_meanwhile"); return { applied: false, reason: "review_required" }; }
      if (p_approve) sim.markPaid(g.id); else sim.markFailed(g.id, "failed", p_note || "rejected");
      return { applied: true };
    },
    admin_resolve_payment_review({ p_group, p_resolution, p_note }) {
      need(isAdmin(), "payments:forbidden"); need(p_resolution === "refunded", "payments:invalid_resolution");
      const g = T("payment_groups").find((x) => x.id === p_group); need(g && g.status === "review", "payments:group_not_in_review");
      g.status = "refunded"; g.failure_reason = p_note;
      T("payment_transactions").filter((t) => t.group_id === g.id).forEach((t) => { const o = T("orders").find((x) => x.id === t.order_id); o.payment_status = o.status === "cancelled" ? "refunded" : "failed"; });
      persist(); return { ok: true };
    },
  };

  // ---- functions.invoke('dispatch-to-cablink') ----
  W.__FN = {
    "dispatch-to-cablink"(body) {
      const dr = T("delivery_requests").find((d) => d.id === (body || {}).delivery_request_id);
      const fail = (error) => ({ data: null, error: { message: error, context: { json: async () => ({ error }) } } });
      if (!dr) return fail("not_found");
      const o = T("orders").find((x) => x.id === dr.order_id);
      if (o.status === "cancelled") return fail("order_cancelled");
      if (o.payment_method !== "cod" && o.payment_status !== "paid") return fail("payment_required");
      if (S().cablinkDown) return fail("cablink_unavailable");
      if (dr.cablink_ride_id) return { data: { success: true, already_dispatched: true }, error: null };
      dr.cablink_ride_id = "ride-" + dr.id.slice(0, 6); dr.status = "dispatched"; persist();
      return { data: { success: true }, error: null };
    },
  };

  // ---- the `payments` edge function, served in-page ----
  const realFetch = W.fetch.bind(W);
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  W.fetch = async function (url, init) {
    const u = String((url && url.url) || url);
    const m = /\/functions\/v1\/payments\/([a-z]+)(?:\?(.*))?$/.exec(u);
    if (!m) return realFetch(url, init);
    const route = m[1]; const q = new URLSearchParams(m[2] || ""); const method = ((init && init.method) || "GET").toUpperCase();
    if (!W.__EDGE) { try { W.__EDGE = JSON.parse(sessionStorage.getItem("__EDGE") || "[]"); } catch { W.__EDGE = []; } }
    W.__EDGE.push({ route, method, q: m[2] || "" });
    try { sessionStorage.setItem("__EDGE", JSON.stringify(W.__EDGE)); } catch {}
    if (S().edgeDown) throw new TypeError("Failed to fetch");
    const auth = init && init.headers && (init.headers.Authorization || init.headers.authorization);
    let body = {}; try { body = init && init.body ? JSON.parse(init.body) : {}; } catch {}
    if (route === "ready") {
      if (method !== "POST") return json(405, { error: "method_not_allowed" });
      const slug = q.get("provider"); const p = T("payment_providers").find((x) => x.slug === slug && x.enabled);
      if (S().readyError) return json(500, { error: "internal_error" });
      const ready = !!S().readyForce || (!!p && (S().notReady || []).indexOf(slug) === -1);
      return json(200, { ready });
    }
    if (!auth) return json(401, { error: "unauthorized" });
    const user = me(); if (!user) return json(401, { error: "unauthorized" });
    if (route === "health") {
      if (!isAdmin()) return json(403, { error: "forbidden" });
      return json(200, { providers: S().health || [{ slug: "dpo", configured: false, missing: ["DPO_COMPANY_TOKEN", "DPO_SERVICE_TYPE"] }] });
    }
    if (route === "status") {
      const g = T("payment_groups").find((x) => x.id === body.group_id && (x.buyer_id === user.id || isAdmin()));
      if (!g) return json(404, { error: "group_not_found" });
      if (S().statusError) return json(500, { error: "internal_error" });
      if (S().payOnStatus && g.status === "pending") sim.markPaid(g.id, "PROV-REF-1");
      return json(200, { group: summary(g.id) });
    }
    if (route === "create") {
      const p = T("payment_providers").find((x) => x.slug === body.provider);
      if (!p) return json(400, { error: "unknown_provider" });
      if (!p.enabled) return json(409, { error: "provider_disabled" });
      if (S().createError) return json(S().createStatus || 502, { error: S().createError });
      const ids = body.order_ids || []; const orders = ids.map((id) => T("orders").find((o) => o.id === id));
      if (!orders.length || orders.some((o) => !o)) return json(404, { error: "order_not_found" });
      if (orders.some((o) => o.buyer_id !== user.id)) return json(403, { error: "forbidden" });
      const prior = T("payment_groups").find((g) => g.idempotency_key === body.idempotency_key);
      if (prior) return json(200, { group: summary(prior.id) });
      if (orders.some((o) => o.status !== "pending" || !["unpaid", "failed"].includes(o.payment_status) || o.payment_method === "cod")) return json(409, { error: "order_not_payable" });
      const gid = uid(); const total = Math.round(orders.reduce((s, o) => s + Number(o.total_amount), 0) * 100) / 100;
      T("payment_groups").push({ id: gid, buyer_id: user.id, provider: p.slug, amount: total, currency_code: "BWP", status: "pending", idempotency_key: body.idempotency_key, provider_reference: null, checkout_url: p.kind === "gateway" ? "https://pay.test/checkout/" + gid : null, payer_reference: null, provider_status: null, failure_reason: null, expires_at: new Date(Date.now() + p.hold_minutes * 60000).toISOString(), completed_at: null, confirmed_by: null, metadata: {}, created_at: now(), updated_at: now() });
      orders.forEach((o) => { T("payment_transactions").push({ id: uid(), order_id: o.id, provider: p.slug, idempotency_key: body.idempotency_key + o.id, provider_reference: null, status: "pending", amount: Number(o.total_amount), currency_code: "BWP", created_at: now(), completed_at: null, wallet_user_id: null, group_id: gid, failure_reason: null, provider_status: null, metadata: {}, updated_at: now() }); o.payment_group_id = gid; o.payment_status = "pending"; });
      persist(); return json(200, { group: summary(gid), group_id: gid });
    }
    return json(404, { error: "not_found" });
  };
})();
