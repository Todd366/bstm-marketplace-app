#!/usr/bin/env python3
"""Generate css/bstm-theme.css (BSTM ecosystem theme).

The Tailwind CLI is not available in the build environment, so the committed css/tailwind.css is
hand-extended here: brand colour utilities (every shade, plus the hover/focus/peer variants the pages
actually use) and the few stock utilities that were missing from the stale compiled file.
Colours are sampled from the BSTM ecosystem logo and the CabLink / Activation screenshots.
Run from the repo root:  python3 scripts/gen-theme-css.py
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent

BRAND = {
    50: "#EAF5F8", 100: "#E0F2F6", 200: "#B6E0EA", 300: "#68BECF", 400: "#2FA0B8",
    500: "#0A87A3", 600: "#00708E", 700: "#005A74", 800: "#064A5E", 900: "#06303C",
}


def rgb(h):
    h = h.lstrip("#")
    return " ".join(str(int(h[i:i + 2], 16)) for i in (0, 2, 4))


def util(kind, shade):
    c = BRAND[shade]
    r = rgb(c)
    if kind == "bg":
        return f"--tw-bg-opacity:1;background-color:rgb({r}/var(--tw-bg-opacity,1))"
    if kind == "text":
        return f"--tw-text-opacity:1;color:rgb({r}/var(--tw-text-opacity,1))"
    if kind == "border":
        return f"--tw-border-opacity:1;border-color:rgb({r}/var(--tw-border-opacity,1))"
    if kind == "ring":
        return f"--tw-ring-opacity:1;--tw-ring-color:rgb({r}/var(--tw-ring-opacity,1))"
    if kind == "from":
        return (f"--tw-gradient-from:{c} var(--tw-gradient-from-position);"
                f"--tw-gradient-to:rgb({r}/0) var(--tw-gradient-to-position);"
                "--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)")
    if kind == "via":
        return (f"--tw-gradient-to:rgb({r}/0) var(--tw-gradient-to-position);"
                f"--tw-gradient-stops:var(--tw-gradient-from),{c} var(--tw-gradient-via-position),var(--tw-gradient-to)")
    if kind == "to":
        return f"--tw-gradient-to:{c} var(--tw-gradient-to-position)"
    raise ValueError(kind)


KINDS = ("bg", "text", "border", "ring", "from", "via", "to")

# every shade of the base utilities
out = []
for k in KINDS:
    for s in BRAND:
        out.append(f".{k}-brand-{s}{{{util(k, s)}}}")

# variants actually used by the pages
pat = re.compile(r"(?<![A-Za-z0-9_-])((?:[a-z][a-z-]*:)+)(bg|text|border|ring|from|via|to)-brand-(\d+)(?![0-9/])")
used = set()
for p in ROOT.rglob("*"):
    if not p.is_file() or p.suffix not in (".html", ".js", ".mjs"):
        continue
    if p.relative_to(ROOT).parts[0] in ("archive", "node_modules", ".git"):
        continue
    for m in pat.finditer(p.read_text(encoding="utf-8", errors="ignore")):
        used.add((m.group(1), m.group(2), int(m.group(3))))

for prefix, k, s in sorted(used):
    if int(s) not in BRAND:
        continue
    esc = prefix.replace(":", "\\:")
    cls = f"{esc}{k}-brand-{s}"
    body = util(k, s)
    if prefix == "hover:":
        out.append(f".{cls}:hover{{{body}}}")
    elif prefix == "focus:":
        out.append(f".{cls}:focus{{{body}}}")
    elif prefix == "peer-focus:":
        out.append(f".peer:focus~.{cls}{{{body}}}")
    elif prefix == "peer-checked:":
        out.append(f".peer:checked~.{cls}{{{body}}}")
    elif prefix == "group-hover:":
        out.append(f".group:hover .{cls}{{{body}}}")
    else:
        raise SystemExit(f"unhandled variant prefix {prefix!r} - extend scripts/gen-theme-css.py")

# stock utilities that the committed compiled CSS was missing (found by scanning every page and script)
GRAY = {100: "#f3f4f6", 400: "#9ca3af"}
STOCK = r"""
.border-gray-100{--tw-border-opacity:1;border-color:rgb(243 244 246/var(--tw-border-opacity,1))}
.text-blue-700{--tw-text-opacity:1;color:rgb(29 78 216/var(--tw-text-opacity,1))}
.hover\:bg-blue-200:hover{--tw-bg-opacity:1;background-color:rgb(191 219 254/var(--tw-bg-opacity,1))}
.text-red-700{--tw-text-opacity:1;color:rgb(185 28 28/var(--tw-text-opacity,1))}
.text-red-300{--tw-text-opacity:1;color:rgb(252 165 165/var(--tw-text-opacity,1))}
.bg-red-100{--tw-bg-opacity:1;background-color:rgb(254 226 226/var(--tw-bg-opacity,1))}
.hover\:bg-red-200:hover{--tw-bg-opacity:1;background-color:rgb(254 202 202/var(--tw-bg-opacity,1))}
.bg-amber-50{--tw-bg-opacity:1;background-color:rgb(255 251 235/var(--tw-bg-opacity,1))}
.border-amber-200{--tw-border-opacity:1;border-color:rgb(253 230 138/var(--tw-border-opacity,1))}
.text-amber-800{--tw-text-opacity:1;color:rgb(146 64 14/var(--tw-text-opacity,1))}
.text-amber-600{--tw-text-opacity:1;color:rgb(217 119 6/var(--tw-text-opacity,1))}
.bg-orange-500{--tw-bg-opacity:1;background-color:rgb(249 115 22/var(--tw-bg-opacity,1))}
.bg-gray-400{--tw-bg-opacity:1;background-color:rgb(156 163 175/var(--tw-bg-opacity,1))}
.text-green-700{--tw-text-opacity:1;color:rgb(21 128 61/var(--tw-text-opacity,1))}
.py-1\.5{padding-top:.375rem;padding-bottom:.375rem}
.py-2\.5{padding-top:.625rem;padding-bottom:.625rem}
.gap-1{gap:.25rem}
.gap-1\.5{gap:.375rem}
.opacity-70{opacity:.7}
.underline{text-decoration-line:underline}
.pt-3{padding-top:.75rem}
.pb-2{padding-bottom:.5rem}
.pb-4{padding-bottom:1rem}
.pl-4{padding-left:1rem}
.mt-10{margin-top:2.5rem}
.mb-5{margin-bottom:1.25rem}
.mb-10{margin-bottom:2.5rem}
.ml-auto{margin-left:auto}
.uppercase{text-transform:uppercase}
.tracking-wide{letter-spacing:.025em}
.font-normal{font-weight:400}
.font-medium{font-weight:500}
.whitespace-nowrap{white-space:nowrap}
.overflow-x-auto{overflow-x:auto}
.border-l-2{border-left-width:2px}
.shadow-sm{--tw-shadow:0 1px 2px 0 rgb(0 0 0/.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}
.hover\:shadow-md:hover{--tw-shadow:0 4px 6px -1px rgb(0 0 0/.1),0 2px 4px -2px rgb(0 0 0/.1);--tw-shadow-colored:0 4px 6px -1px var(--tw-shadow-color),0 2px 4px -2px var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}
.transition-shadow{transition-property:box-shadow;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}
.last\:mb-0:last-child{margin-bottom:0}
.last\:pb-0:last-child{padding-bottom:0}
@media (min-width:768px){.md\:col-span-2{grid-column:span 2/span 2}}
.animate-slide-up{animation:bstm-slide-up .25s ease-out both}
@keyframes bstm-slide-up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
"""

TOKENS = """
/* ===== BSTM ecosystem theme =====
   Generated by scripts/gen-theme-css.py - edit the generator, not this file.
   Colours sampled from the BSTM ecosystem logo and the CabLink / Activation app screenshots. */
:root{
  --bstm-teal-50:#EAF5F8;--bstm-teal-100:#E0F2F6;--bstm-teal-200:#B6E0EA;--bstm-teal-300:#68BECF;
  --bstm-teal-400:#2FA0B8;--bstm-teal-500:#0A87A3;--bstm-teal-600:#00708E;--bstm-teal-700:#005A74;
  --bstm-teal-800:#064A5E;--bstm-teal-900:#06303C;
  --bstm-green:#06502F;--bstm-green-logo:#005B32;
  --bstm-bg:#F2F7FA;--bstm-surface:#FFFFFF;--bstm-border:#D7DEE4;
  --bstm-ink:#122128;--bstm-muted:#54656D;
  --bstm-radius-card:24px;--bstm-radius-btn:16px;
  --bstm-font:Roboto,system-ui,-apple-system,"Segoe UI",Arial,sans-serif;
}
html{-webkit-text-size-adjust:100%}
body{font-family:var(--bstm-font);color:var(--bstm-ink)}
:focus-visible{outline:3px solid var(--bstm-teal-300);outline-offset:2px}
@media (pointer:coarse){
  input:not([type=checkbox]):not([type=radio]):not([type=range]),select,textarea,button[type=submit]{min-height:44px}
}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}
}
/* shared pieces matching the CabLink / Activation look */
.bstm-hero{background:linear-gradient(160deg,#0A5447 0%,#076275 55%,#1F839B 100%);color:#fff}
.bstm-card{background:var(--bstm-surface);border:1px solid var(--bstm-border);border-radius:var(--bstm-radius-card)}
.bstm-btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 22px;border-radius:var(--bstm-radius-btn);font-weight:700;background:var(--bstm-teal-700);color:#fff;border:2px solid var(--bstm-teal-700)}
.bstm-btn:hover{background:var(--bstm-teal-800);border-color:var(--bstm-teal-800)}
.bstm-btn-outline{background:#fff;color:#096D87;border:2px solid #096D87}
.bstm-btn-outline:hover{background:var(--bstm-teal-50)}
"""

target = ROOT / "css" / "bstm-theme.css"
target.write_text(TOKENS + "\n/* brand utilities */\n" + "\n".join(out) + "\n\n/* stock utilities missing from the compiled tailwind.css */" + STOCK, encoding="utf-8")
print(f"wrote {target.relative_to(ROOT)}: {len(out)} brand rules, {len(used)} variants")
