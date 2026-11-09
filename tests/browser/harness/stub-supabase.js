// Test double for @supabase/supabase-js: in-memory PostgREST-like engine that REJECTS unknown tables/columns/relations
// using the live schema. No RLS is emulated (RLS/trigger behaviour is verified separately on the live database).
const W = window;
const save = () => { try { sessionStorage.setItem("__DB", JSON.stringify(W.__DB)); sessionStorage.setItem("__LOG", JSON.stringify(W.__LOG)); sessionStorage.setItem("__VIOL", JSON.stringify(W.__VIOL)); } catch {} };
(function init() {
  const ss = (k) => { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } };
  W.__DB = ss("__DB") || JSON.parse(JSON.stringify(W.__DB_INIT || {}));
  W.__LOG = ss("__LOG") || [];
  W.__VIOL = ss("__VIOL") || [];
})();
const viol = (m) => { W.__VIOL.push(m); save(); };
const perr = (code, message) => ({ code, message, details: null, hint: null });
const uuid = () => crypto.randomUUID();
const cols = (t) => W.__SCHEMA[t];
const rows = (t) => (W.__DB[t] ||= []);

function splitTop(s, sep = ",") { const out = []; let d = 0, cur = ""; for (const ch of s) { if (ch === "(") d++; if (ch === ")") d--; if (ch === sep && d === 0) { out.push(cur); cur = ""; } else cur += ch; } if (cur.trim()) out.push(cur); return out.map((x) => x.trim()).filter(Boolean); }
function parseSel(str) {
  return splitTop(str || "*").map((it) => {
    if (it === "*") return { star: true };
    const m = /^(?:(\w+):)?([\w]+)(?:!([\w]+))?(?:!(inner|left))?\s*\(([\s\S]*)\)$/.exec(it);
    if (m) return { rel: m[2], alias: m[1] || m[2], hint: m[3] || null, inner: m[4] === "inner" || m[3] === "inner", sel: parseSel(m[5]) };
    const c = /^(?:(\w+):)?(\w+)(?:::\w+)?$/.exec(it);
    if (!c) { throw perr("PGRST100", "unparseable select item: " + it); }
    return { col: c[2], alias: c[1] || c[2] };
  });
}
function relOf(T, name, hint) {
  const FK = W.__FK;
  let c = FK.filter((f) => f.table === T && f.ref === name).map((f) => ({ ...f, many: false }))
    .concat(FK.filter((f) => f.table === name && f.ref === T).map((f) => ({ ...f, many: true })));
  if (hint && hint !== "inner") c = c.filter((f) => f.name === hint || f.col === hint);
  if (!c.length) throw perr("PGRST200", `Could not find a relationship between '${T}' and '${name}' in the schema cache`);
  if (c.length > 1) throw perr("PGRST201", `Could not embed because more than one relationship was found for '${T}' and '${name}'`);
  return c[0];
}
function project(T, row, sel) {
  const out = {};
  for (const it of sel) {
    if (it.star) { for (const c of cols(T)) out[c] = row[c] ?? null; continue; }
    if (it.col) { if (!cols(T).includes(it.col)) throw perr("42703", `column ${T}.${it.col} does not exist`); out[it.alias] = row[it.col] ?? null; continue; }
    const r = relOf(T, it.rel, it.hint);
    if (!r.many) { const hit = rows(r.ref).find((x) => String(x.id ?? x[Object.keys(x)[0]]) === String(row[r.col])); out[it.alias] = hit ? project(r.ref, hit, it.sel) : null; }
    else { out[it.alias] = rows(r.table).filter((x) => String(x[r.col]) === String(row.id)).map((x) => project(r.table, x, it.sel)); }
  }
  return out;
}
function cmp(a, op, v) {
  switch (op) {
    case "eq": return String(a) === String(v);
    case "neq": return String(a) !== String(v);
    case "gt": return a > v; case "gte": return a >= v; case "lt": return a < v; case "lte": return a <= v;
    case "is": return v === null || v === "null" ? a == null : String(a) === String(v);
    case "in": { const l = Array.isArray(v) ? v : String(v).replace(/^\(|\)$/g, "").split(","); return l.map(String).includes(String(a)); }
    case "like": case "ilike": return new RegExp("^" + String(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*") + "$", op === "ilike" ? "i" : "").test(String(a ?? ""));
    case "contains": case "cs": return JSON.stringify(a) === JSON.stringify(v) || (a && typeof a === "object" && Object.entries(typeof v === "string" ? {} : v).every(([k, x]) => a[k] === x));
    default: throw perr("PGRST100", "unsupported operator " + op);
  }
}
function parseOr(s) {
  return splitTop(s).map((p) => {
    const a = /^and\((.*)\)$/.exec(p); if (a) return { and: parseOr(a[1]) };
    const m = /^([\w.]+)\.(not\.)?(\w+)\.(.*)$/.exec(p); if (!m) throw perr("PGRST100", "bad or() term " + p);
    return { col: m[1], not: !!m[2], op: m[3], val: m[4] };
  });
}
function evalTerm(T, row, t) {
  if (t.and) return t.and.every((x) => evalTerm(T, row, x));
  if (!cols(T).includes(t.col)) throw perr("42703", `column ${T}.${t.col} does not exist`);
  const r = cmp(row[t.col], t.op, t.val); return t.not ? !r : r;
}

class Q {
  constructor(kind, a, b) { this.kind = kind; this.T = a; this.args = b; this.f = []; this.ord = []; this.sel = null; this.opt = {}; this.ret = false; }
  select(s, o) { this.sel = s ?? "*"; this.opt = o || {}; if (this.kind !== "rpc") { if (this.kind !== "select") this.ret = true; else this.kind = "select"; } return this; }
  _f(col, op, val, not) { this.f.push({ col, op, val, not }); return this; }
  eq(c, v) { return this._f(c, "eq", v); } neq(c, v) { return this._f(c, "neq", v); }
  gt(c, v) { return this._f(c, "gt", v); } gte(c, v) { return this._f(c, "gte", v); } lt(c, v) { return this._f(c, "lt", v); } lte(c, v) { return this._f(c, "lte", v); }
  is(c, v) { return this._f(c, "is", v); } in(c, v) { return this._f(c, "in", v); } like(c, v) { return this._f(c, "like", v); } ilike(c, v) { return this._f(c, "ilike", v); }
  contains(c, v) { return this._f(c, "contains", v); } not(c, op, v) { return this._f(c, op, v, true); } filter(c, op, v) { return this._f(c, op, v); }
  or(s) { this.f.push({ or: parseOr(s) }); return this; }
  order(c, o) { this.ord.push({ c, asc: !(o && o.ascending === false) }); return this; }
  limit(n) { this.lim = n; return this; } range(a, b) { this.rng = [a, b]; return this; }
  single() { this.one = "single"; return this; } maybeSingle() { this.one = "maybe"; return this; }
  then(res, rej) { return this._run().then(res, rej); }
  async _run() {
    const id = W.__LOG.length;
    try {
      const r = this.kind === "rpc" ? await this._rpc() : this._exec();
      W.__LOG.push({ kind: this.kind, T: this.T, args: this.args, filters: this.f, ok: !r.error }); save(); return r;
    } catch (e) {
      // e.server = a deliberate emulated database error (trigger / constraint), not a schema violation by the page.
      if (e && e.code) { W.__LOG.push({ kind: this.kind, T: this.T, error: e.message }); if (!e.server) viol(`${this.kind} ${this.T}: ${e.message}`); return { data: null, error: e, count: null, status: 400 }; }
      throw e;
    }
  }
  _match(T) {
    let r = rows(T);
    for (const f of this.f) {
      if (f.or) r = r.filter((row) => f.or.some((t) => evalTerm(T, row, t)));
      else { if (!f.col.includes(".") && !cols(T).includes(f.col)) throw perr("42703", `column ${T}.${f.col} does not exist`); r = r.filter((row) => { const x = cmp(row[f.col], f.op, f.val); return f.not ? !x : x; }); }
    }
    return r;
  }
  _finish(T, out, count) {
    for (const o of [...this.ord].reverse()) out.sort((a, b) => (a[o.c] > b[o.c] ? 1 : a[o.c] < b[o.c] ? -1 : 0) * (o.asc ? 1 : -1));
    if (this.rng) out = out.slice(this.rng[0], this.rng[1] + 1); if (this.lim != null) out = out.slice(0, this.lim);
    if (this.one) {
      if (out.length === 1) return { data: out[0], error: null, count };
      if (out.length === 0 && this.one === "maybe") return { data: null, error: null, count };
      return { data: null, error: perr("PGRST116", "JSON object requested, multiple (or no) rows returned"), count };
    }
    return { data: out, error: null, count };
  }
  _exec() {
    const T = this.T;
    if (!W.__SCHEMA[T]) throw perr("42P01", `relation "public.${T}" does not exist`);
    const hooks = (W.__HOOKS || {})[T] || {};
    if (this.kind === "select") {
      const sel = parseSel(this.sel || "*"); const m = this._match(T);
      let out = m.map((r) => project(T, r, sel)).filter((r, i) => sel.every((s) => !s.inner || (Array.isArray(r[s.alias]) ? r[s.alias].length : r[s.alias])));
      if (this.opt.head) return { data: null, error: null, count: this.opt.count ? out.length : null };
      return this._finish(T, out, this.opt.count ? out.length : null);
    }
    const chk = (o) => { for (const k of Object.keys(o)) if (!cols(T).includes(k)) throw perr("PGRST204", `Could not find the '${k}' column of '${T}' in the schema cache`); };
    if (this.kind === "insert" || this.kind === "upsert") {
      const list = Array.isArray(this.args) ? this.args : [this.args]; const made = [];
      for (const o of list) {
        chk(o); let row = { ...o }; if (cols(T).includes("id") && !row.id) row.id = uuid(); if (cols(T).includes("created_at") && !row.created_at) row.created_at = new Date().toISOString();
        if (hooks.before_insert) { const r = hooks.before_insert(row); if (r) row = r; }
        rows(T).push(row); made.push(row); if (hooks.after_insert) hooks.after_insert(row);
      }
      if (!this.ret) return { data: null, error: null }; const sel = parseSel(this.sel || "*");
      return this._finish(T, made.map((r) => project(T, r, sel)));
    }
    if (this.kind === "update") {
      chk(this.args); const m = this._match(T);
      for (const r of m) { const nw = { ...r, ...this.args }; if (hooks.before_update) hooks.before_update(r, nw); Object.assign(r, nw); }
      if (!this.ret) return { data: null, error: null }; const sel = parseSel(this.sel || "*");
      return this._finish(T, m.map((r) => project(T, r, sel)));
    }
    if (this.kind === "delete") { const m = this._match(T); W.__DB[T] = rows(T).filter((r) => !m.includes(r)); return { data: null, error: null }; }
    throw perr("PGRST100", "unsupported op " + this.kind);
  }
  async _rpc() {
    const fn = (W.__RPC || {})[this.T];
    if (!fn) { throw perr("PGRST202", `Could not find the function public.${this.T} in the schema cache`); }
    try { const d = await fn(this.args || {}, W.__SESSION && W.__SESSION.user); const out = this.one ? (Array.isArray(d) ? d[0] ?? null : d) : d; return { data: out === undefined ? null : out, error: null }; }
    catch (e) { return { data: null, error: perr(e.code || "P0001", e.message || String(e)) }; }
  }
}
export function createClient(url, key) {
  return {
    from: (T) => ({ select: (s, o) => new Q("select", T).select(s, o), insert: (o) => new Q("insert", T, o), update: (o) => new Q("update", T, o), upsert: (o) => new Q("upsert", T, o), delete: () => new Q("delete", T) }),
    rpc: (n, a) => new Q("rpc", n, a),
    auth: {
      getSession: async () => ({ data: { session: W.__SESSION || null }, error: null }),
      getUser: async () => ({ data: { user: (W.__SESSION || {}).user || null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => { W.__SESSION = null; return { error: null }; },
      signInWithPassword: async () => ({ data: null, error: perr("stub", "signIn not supported in harness") }),
    },
    functions: { invoke: async (name, opt) => { const h = (W.__FN || {})[name]; W.__LOG.push({ kind: "fn", T: name, args: opt && opt.body }); save(); if (!h) { viol("function not stubbed: " + name); return { data: null, error: { message: "stub: no function " + name } }; } return await h(opt && opt.body); } },
    channel: () => { const c = { on: () => c, subscribe: () => c, unsubscribe() {} }; return c; },
    removeChannel: async () => {},
    storage: { from: () => ({ getPublicUrl: (p) => ({ data: { publicUrl: "https://stub.local/" + p } }), upload: async () => ({ data: {}, error: null }), createSignedUrl: async (p) => ({ data: { signedUrl: "https://stub.local/" + p }, error: null }) }) },
  };
}
