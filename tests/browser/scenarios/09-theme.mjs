// One theme for the whole app (BSTM ecosystem theme, css/bstm-theme.css).
// Opens every page as the role that really uses it, reads the COMPUTED colours/fonts of everything visible,
// and fails on anything outside the theme: blue / purple / pink / cyan / orange hues, dark storefronts,
// or a text font other than the theme font. Status colours (green = ok, amber = warning, red = problem) and
// neutrals are part of the theme.   THEME_REPORT=1 prints every offender instead of only failing.
import { test, open, settle } from "../run.mjs";
import { U, world, R, P, CART, iso } from "../fixtures.mjs";

const GOV = { id: "00000000-0000-4000-8000-000000000009", email: "gov@test.bw", role: "government", phone: null };
const CATS = ["agriculture", "fresh-produce", "electronics", "fashion", "home", "vehicles", "services", "food-beverage", "catering", "retail", "car-wash"];

function themedWorld() {
  const db = world();
  db.profiles.push({ ...GOV, thb_balance: 0, created_at: iso(-20000), location: null, notification_prefs: null, wallet_address: null });
  CATS.forEach((c, i) => db.rooms.push({ id: `00000000-0000-4000-8000-0000000003${String(i).padStart(2, "0")}`, seller_id: U.seller.id, room_number: 10 + i, name: `Room ${c}`, description: "x", category: c, banner_emoji: "🏬", banner_color: "#00708E", status: "active", created_at: iso(-100 - i) }));
  return db;
}

// page, role (null = logged out), extra open options
const PAGES = [
  ["index.html", null], ["marketplace.html", null], ["help.html", null], ["terms.html", null], ["login.html", null], ["verify.html", null],
  ["agriculture.html", null], ["cablink.html", null], ["ecosystem-hub.html", null], ["404.html", null],
  [`room.html?id=${R.r1}`, null], [`product-detail.html?id=${P.p1}`, null],
  ["buyer-dashboard.html", U.buyer], ["thb-wallet.html", U.buyer], ["transactions.html", U.buyer], ["wishlist.html", U.buyer], ["messages.html", U.buyer],
  ["profile.html", U.buyer], ["settings.html", U.buyer], ["kyc-verification.html", U.buyer], ["notifications-all.html", U.buyer], ["open-room.html", U.buyer],
  ["checkout.html", U.buyer, { cart: CART.two }], ["order-tracking.html", U.buyer], ["payment-status.html", U.buyer],
  ["seller-dashboard.html", U.seller], ["upload-product.html", U.seller], ["earnings.html", U.seller], ["analytics.html", U.seller],
  ["admin-dashboard.html", U.admin], ["admin-payments.html", U.admin], ["admin-dashboard.html", U.agent, { tag: "agent" }], ["admin-dashboard.html", U.superAdmin, { tag: "super" }],
  ["monitoring-dashboard.html", GOV], ["gov-dashboard.html", GOV],
  ...CATS.map((c, i) => [`room.html?id=00000000-0000-4000-8000-0000000003${String(i).padStart(2, "0")}`, null, { tag: c }]),
];

// runs inside the page
function measure() {
  const THEME_FONTS = /^(roboto|system-ui|-apple-system|segoe ui|arial|sans-serif)$/i;
  const parse = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }; };
  const fam = ({ r, g, b }) => {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (d < 0.08) return "neutral";
    const s = d / (1 - Math.abs(2 * l - 1));
    if (s < 0.13 || l > 0.97 || l < 0.04) return "neutral";
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360;
    if (h >= 207 && h < 255 && s < 0.35) return "neutral"; // Tailwind cool greys (#1F2937, #374151 ...) are neutrals
    if (h < 15 || h >= 345) return "red";
    if (h < 29 && l >= 0.4) return "orange"; // bright orange; dark amber text (#92400E) is the warning colour
    if (h < 35) return "amber";
    if (h < 70) return "amber";
    if (h < 165) return "green";
    if (h < 207) return "teal";
    if (h < 255) return "blue";
    return "purple";
  };
  const BAD = new Set(["orange", "blue", "purple"]);
  const out = [];
  const seen = new Set();
  const label = (el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "");
  const note = (el, kind, val, f) => { const k = kind + "|" + val + "|" + label(el); if (seen.has(k)) return; seen.add(k); out.push({ kind, val, fam: f, el: label(el), text: (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 30) }); };
  for (const el of document.querySelectorAll("body *")) {
    if (["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "PATH", "IMG", "BR"].includes(el.tagName.toUpperCase())) continue;
    if (!el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (ownText) {
      const c = parse(cs.color); if (c && c.a > 0.3) { const f = fam(c); if (BAD.has(f)) note(el, "text", cs.color, f); }
      const first = cs.fontFamily.split(",")[0].replace(/["']/g, "").trim();
      const icon = /awesome|icon|emoji/i.test(first);
      if (!icon && !THEME_FONTS.test(first) && !/monospace|mono/i.test(cs.fontFamily)) note(el, "font", first, "font");
    }
    const bg = parse(cs.backgroundColor); if (bg && bg.a > 0.15) { const f = fam(bg); if (BAD.has(f)) note(el, "bg", cs.backgroundColor, f); else if (f === "neutral" && bg.r + bg.g + bg.b < 160 * 3 / 3 && bg.a > 0.6 && el.getBoundingClientRect().width > 200 && el.getBoundingClientRect().height > 60) note(el, "dark-panel", cs.backgroundColor, "dark"); }
    if (cs.backgroundImage && cs.backgroundImage !== "none") for (const m of cs.backgroundImage.matchAll(/rgba?\([^)]+\)/g)) { const c = parse(m[0]); if (c && c.a > 0.3) { const f = fam(c); if (BAD.has(f)) note(el, "gradient", m[0], f); } }
    for (const side of ["Top", "Right", "Bottom", "Left"]) {
      if (parseFloat(cs["border" + side + "Width"]) > 0 && cs["border" + side + "Style"] !== "none") { const c = parse(cs["border" + side + "Color"]); if (c && c.a > 0.3) { const f = fam(c); if (BAD.has(f)) { note(el, "border", cs["border" + side + "Color"], f); break; } } }
    }
  }
  return out;
}

for (const [pg, user, extra = {}] of PAGES) {
  const name = `theme: ${pg.split("?")[0]} as ${extra.tag || (user ? user.role : "visitor")}${extra.tag && CATS.includes(extra.tag) ? " (room template)" : ""}`;
  test(name, async (t) => {
    t.allowErrors(/./);
    const page = await open(t, "/" + pg, { user: user || undefined, db: themedWorld(), cart: extra.cart });
    await settle(page, 700);
    const found = await page.evaluate(measure);
    if (process.env.THEME_REPORT) { for (const f of found) console.log(`   THEME ${pg} [${extra.tag || (user ? user.role : "visitor")}] ${f.kind} ${f.fam} ${f.val}  ${f.el}  "${f.text}"`); t.ok(true, "report only"); return; }
    t.eq(found.map((f) => `${f.kind} ${f.val} ${f.el} "${f.text}"`), [], "nothing outside the BSTM theme is visible");
  });
}

// ------------------------------------------------------------------ source guard (covers markup that is hidden until used: modals, tabs, error states)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

test("theme: no off-theme colours, hues or fonts anywhere in the page sources", async (t) => {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!["archive", "node_modules", ".git", "tests", "scripts", "docs", "database"].includes(e.name)) walk(p); } else if (/\.(html|js)$/.test(e.name)) files.push(p); } };
  walk(ROOT);
  const hueOf = (hex) => {
    let h = hex.slice(1); if (h.length === 3) h = [...h].map((c) => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (d < 0.08) return "neutral";
    const s = d / (1 - Math.abs(2 * l - 1)); if (s < 0.13 || l > 0.97 || l < 0.04) return "neutral";
    let x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; x = (x * 60 + 360) % 360;
    if (x >= 207 && x < 255) return s < 0.35 ? "neutral" : "blue";
    if (x >= 255 && x < 345) return "purple";
    if (x >= 15 && x < 29 && l >= 0.4) return "orange";
    return "ok";
  };
  const bad = [];
  for (const f of files) {
    const rel = path.relative(ROOT, f); const src = fs.readFileSync(f, "utf8");
    if (rel === "js/core/payments.js" && false) continue;
    for (const m of src.matchAll(/(?<![A-Za-z0-9_-])(?:[a-z][a-z-]*:)*(?:bg|text|border|from|via|to|ring|divide|fill|stroke|placeholder|accent|shadow|outline)-(blue|cyan|purple|indigo|violet|sky|pink|fuchsia|rose|orange|emerald|lime|teal)-\d{2,3}\b/g)) bad.push(`${rel}: class ${m[0]}`);
    for (const m of src.matchAll(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) { const k = hueOf(m[0]); if (k === "blue" || k === "purple" || k === "orange") bad.push(`${rel}: ${m[0]} (${k})`); }
    if (/fonts\.googleapis\.com/.test(src)) bad.push(`${rel}: loads a web font`);
    if (/font-family\s*:\s*['"]?(Inter|Georgia|Courier New)/i.test(src)) bad.push(`${rel}: sets its own font`);
    if (/linear-gradient\(\s*135deg\s*,\s*#00708E/i.test(src)) bad.push(`${rel}: hard-codes the brand gradient (use var(--bstm-grad))`);
  }
  t.eq([...new Set(bad)], [], "every page and script uses only the BSTM theme");
});
