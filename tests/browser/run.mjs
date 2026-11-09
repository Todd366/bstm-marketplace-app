// Browser test runner for the payments frontend.
//   node tests/browser/run.mjs [name-filter]
// Serves the repo over HTTP, drives real Chromium (Playwright), replaces supabase-js with the in-memory
// stub (harness/stub-supabase.js, which rejects unknown tables/columns) and emulates the server contract
// in-page (harness/backend.js). RLS is NOT emulated. Exit code 1 if any check fails.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { sessionFor, world } from "./fixtures.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { SCHEMA, FK } = require("./harness/schema.cjs");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const STUB = fs.readFileSync(path.join(HERE, "harness/stub-supabase.js"), "utf8");
const BACKEND = fs.readFileSync(path.join(HERE, "harness/backend.js"), "utf8");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".txt": "text/plain" };

// ------------------------------------------------------------------ static server
function serve() {
  const missing = new Set();
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      missing.add(p); res.writeHead(404); res.end("not found"); return;
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port, missing })));
}

// ------------------------------------------------------------------ results
const results = { pass: 0, fail: 0, scenarios: [] };
const failures = [];

class T {
  constructor(name) { this.name = name; this.checks = []; this.page = null; this.errors = []; this.allow = []; }
  ok(cond, msg) { this.checks.push({ ok: !!cond, msg }); if (!cond) failures.push(`${this.name}: ${msg}`); return !!cond; }
  eq(a, b, msg) { const ok = JSON.stringify(a) === JSON.stringify(b); this.checks.push({ ok, msg: ok ? msg : `${msg} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}` }); if (!ok) failures.push(`${this.name}: ${msg} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); return ok; }
  has(text, sub, msg) { return this.ok(String(text).includes(sub), `${msg} (looking for ${JSON.stringify(sub)} in ${JSON.stringify(String(text).slice(0, 200))})`); }
  allowErrors(...res) { this.allow.push(...res); }
}

let browser; let base; const tests = [];
export function test(name, fn) { tests.push({ name, fn }); }

// ------------------------------------------------------------------ page factory
// opts: { user, db, scen, cart, session:null to be logged out }
export async function open(t, pathAndQuery, opts = {}) {
  const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1280, height: 900 } });
  const db = opts.db || world();
  const session = opts.user === undefined ? null : opts.user === null ? null : sessionFor(opts.user);
  const boot = { SCHEMA, FK, db, session, scen: opts.scen || {}, cart: opts.cart || null, local: opts.local || {} };
  await ctx.addInitScript(({ SCHEMA, FK, db, session, scen, cart, local }) => {
    window.__SCHEMA = SCHEMA; window.__FK = FK; window.__DB_INIT = db; window.__SESSION = session;
    try {
      window.__SCEN = JSON.parse(sessionStorage.getItem("__SCEN") || "null") || scen;
      sessionStorage.setItem("__SCEN", JSON.stringify(window.__SCEN));
      if (!sessionStorage.getItem("__SEEDED")) {
        if (cart) localStorage.setItem("bstm_cart", JSON.stringify(cart));
        for (const [k, v] of Object.entries(local)) localStorage.setItem(k, v);
        sessionStorage.setItem("__SEEDED", "1");
      }
    } catch (e) { window.__SCEN = scen; }
  }, boot);
  await ctx.addInitScript({ content: BACKEND });
  const external = [];
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    const u = route.request().url();
    if (/esm\.sh\/@supabase\/supabase-js/.test(u)) return route.fulfill({ status: 200, contentType: "text/javascript", headers: { "access-control-allow-origin": "*" }, body: STUB });
    if (/^https:\/\/pay\.test\//.test(u)) return route.fulfill({ status: 200, contentType: "text/html", body: "<html><body><h1>Provider checkout page</h1></body></html>" });
    external.push(u);
    if (/tvtfxkavjqvurdezhyvu\.supabase\.co/.test(u)) { t.errors.push("unstubbed Supabase network call: " + u); return route.abort(); }
    const ct = /\.css|fonts\.googleapis|font-awesome/.test(u) ? "text/css" : /\.(woff2?|ttf)/.test(u) ? "font/woff2" : "text/javascript";
    return route.fulfill({ status: 200, contentType: ct, headers: { "access-control-allow-origin": "*" }, body: ct === "text/javascript" ? "" : "" });
  });
  const page = await ctx.newPage();
  t.page = page; t.ctx = ctx; t.external = external;
  page.on("pageerror", (e) => t.errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") t.errors.push("console.error: " + m.text()); });
  if (pathAndQuery) await page.goto(base + pathAndQuery, { waitUntil: "load" });
  return page;
}

export const url = (page) => new URL(page.url());
export const text = async (page, sel) => (await page.locator(sel).first().innerText().catch(() => "")).replace(/\s+/g, " ").trim();
export const bodyText = async (page) => (await page.locator("body").innerText()).replace(/\s+/g, " ");
// Reads the persisted harness state. If the tab is on a provider page (other origin) go back to the local origin first.
async function onLocal(page) { if (!page.url().startsWith(base)) await page.goto(base + "/robots.txt"); }
export const dbOf = async (page) => { await onLocal(page); return page.evaluate(() => JSON.parse(sessionStorage.getItem("__DB") || "{}")); };
export const viol = async (page) => { await onLocal(page); return page.evaluate(() => JSON.parse(sessionStorage.getItem("__VIOL") || "[]")); };
export const edgeCalls = async (page) => { await onLocal(page); return page.evaluate(() => JSON.parse(sessionStorage.getItem("__EDGE") || "[]")); };
export const sim = (page, fn, ...args) => page.evaluate(({ fn, args }) => window.__sim[fn](...args), { fn, args });
export const scen = (page, patch) => page.evaluate((patch) => { Object.assign(window.__SCEN, patch); sessionStorage.setItem("__SCEN", JSON.stringify(window.__SCEN)); }, patch);
export const settle = (page, ms = 400) => page.waitForTimeout(ms);

// ------------------------------------------------------------------ main
async function main() {
  const filter = process.argv[2] || "";
  const { server, port, missing } = await serve();
  base = `http://127.0.0.1:${port}`;
  browser = await chromium.launch();
  for (const f of fs.readdirSync(path.join(HERE, "scenarios")).filter((x) => x.endsWith(".mjs")).sort()) {
    await import(pathToFileURL(path.join(HERE, "scenarios", f)).href);
  }
  for (const { name, fn } of tests) {
    if (filter && !name.includes(filter)) continue;
    const t = new T(name);
    try {
      await fn(t);
      if (t.page && !t.page.isClosed()) {
        const v = await viol(t.page).catch(() => []);
        t.ok(v.length === 0, "no schema/column violations from the page" + (v.length ? ": " + [...new Set(v)].join(" | ") : ""));
      }
      const bad = t.errors.filter((e) => !t.allow.some((r) => r.test(e)));
      t.ok(bad.length === 0, "no unexpected console errors / page errors" + (bad.length ? ": " + [...new Set(bad)].slice(0, 4).join(" | ") : ""));
    } catch (e) {
      t.ok(false, "scenario threw: " + (e && e.stack ? e.stack.split("\n").slice(0, 2).join(" ⏎ ") : e) + (t.errors.length ? "  | page errors: " + [...new Set(t.errors)].slice(0, 4).join(" | ") : ""));
    } finally {
      if (t.ctx) await t.ctx.close().catch(() => {});
    }
    const p = t.checks.filter((c) => c.ok).length; const f = t.checks.length - p;
    results.pass += p; results.fail += f;
    results.scenarios.push({ name, pass: p, fail: f, failed: t.checks.filter((c) => !c.ok).map((c) => c.msg) });
    console.log(`${f ? "FAIL" : "ok  "}  ${name}  (${p}/${t.checks.length})`);
    for (const c of t.checks.filter((c) => !c.ok)) console.log("        ✗ " + c.msg);
  }
  await browser.close(); server.close();
  console.log(`\nSCENARIOS ${results.scenarios.length}   CHECKS PASSED ${results.pass}   FAILED ${results.fail}`);
  if (missing.size) console.log("404s from the static server (informational): " + [...missing].join(", "));
  if (process.env.REPORT) fs.writeFileSync(process.env.REPORT, JSON.stringify({ ...results, missing: [...missing] }, null, 2));
  process.exit(results.fail ? 1 : 0);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
