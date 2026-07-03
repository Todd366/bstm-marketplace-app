#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════╗
# ║   BSTM FULL DEEP AUDIT — 300 files, all layers      ║
# ║   Checks: HTML, JS, CSS, links, imports, leaks,     ║
# ║   auth, nav, footer, duplicates, live-readiness     ║
# ╚══════════════════════════════════════════════════════╝

ROOT="$(pwd)"
RPT="$ROOT/AUDIT-$(date +%Y%m%d-%H%M).txt"
> "$RPT"

# Color codes
G='\033[0;32m' R='\033[0;31m' Y='\033[0;33m'
C='\033[0;36m' W='\033[1;37m' P='\033[0;35m'
DIM='\033[2m' N='\033[0m' BOLD='\033[1m'

TOTAL_PASS=0; TOTAL_FAIL=0; TOTAL_WARN=0

log()  { echo -e "$*" | tee -a "$RPT"; }
ok()   { log "  ${G}✅ $*${N}"; TOTAL_PASS=$((TOTAL_PASS+1)); }
fail() { log "  ${R}❌ $*${N}"; TOTAL_FAIL=$((TOTAL_FAIL+1)); }
warn() { log "  ${Y}⚠️  $*${N}"; TOTAL_WARN=$((TOTAL_WARN+1)); }
info() { log "  ${C}ℹ  $*${N}"; }
sec()  { log ""; log "${P}${BOLD}══════════════════════════════════════════════════${N}"; log "  ${W}${BOLD}$*${N}"; log "${P}──────────────────────────────────────────────────${N}"; }

log "${P}${BOLD}"
log "  ╔══════════════════════════════════════════════════╗"
log "  ║        BSTM FULL AUDIT — $(date '+%Y-%m-%d %H:%M')        ║"
log "  ╚══════════════════════════════════════════════════╝${N}"
log "  Root: $ROOT"
log "  Report: $RPT"

# ──────────────────────────────────────────────────────
sec "[1] FILE INVENTORY"
# ──────────────────────────────────────────────────────
HTML_COUNT=$(find . -maxdepth 1 -name "*.html" | grep -v ".bak" | wc -l)
JS_ROOT=$(find ./js -name "*.js" 2>/dev/null | grep -v node_modules | wc -l)
JS_PAGES=$(find ./js/pages -name "*.js" 2>/dev/null | wc -l)
JS_CORE=$(find ./js/core -name "*.js" 2>/dev/null | wc -l)
COMP=$(find ./components -type f 2>/dev/null | wc -l)
BAK=$(find . -name "*.bak*" | grep -v ".git" | wc -l)
TOTAL_FILES=$(find . -type f | grep -v ".git" | grep -v "node_modules" | wc -l)

log "  Total files (excl .git): $TOTAL_FILES"
log "  HTML pages (root):       $HTML_COUNT"
log "  JS root files:           $JS_ROOT"
log "  JS page modules:         $JS_PAGES"
log "  JS core modules:         $JS_CORE"
log "  Component files:         $COMP"
log "  Backup files (.bak*):    $BAK"

if [ "$BAK" -gt 10 ]; then
    warn "$BAK backup files cluttering root — run: find . -name '*.bak*' -delete"
fi

# List all root HTML pages
log ""
log "  ${C}Root HTML pages:${N}"
for f in $(find . -maxdepth 1 -name "*.html" | grep -v ".bak" | sort); do
    lines=$(wc -l < "$f")
    printf "  ${DIM}%-40s ${C}%d lines${N}\n" "$(basename $f)" "$lines"
done | tee -a "$RPT"

# ──────────────────────────────────────────────────────
sec "[2] HTML STRUCTURAL INTEGRITY"
# ──────────────────────────────────────────────────────
BROKEN_HTML=0
for f in $(find . -maxdepth 1 -name "*.html" | grep -v ".bak" | sort); do
    pg=$(basename "$f")
    H1=$(grep -co '<head>' "$f" 2>/dev/null || echo 0)
    H2=$(grep -co '</head>' "$f" 2>/dev/null || echo 0)
    B1=$(grep -co '<body' "$f" 2>/dev/null || echo 0)
    B2=$(grep -co '</body>' "$f" 2>/dev/null || echo 0)
    HT1=$(grep -co '<html' "$f" 2>/dev/null || echo 0)
    HT2=$(grep -co '</html>' "$f" 2>/dev/null || echo 0)
    S1=$(grep -co '<script' "$f" 2>/dev/null || echo 0)
    S2=$(grep -co '</script>' "$f" 2>/dev/null || echo 0)
    BAD=""
    [ "$H1" != "$H2" ] && BAD="$BAD head=$H1/$H2"
    [ "$B1" != "$B2" ] && BAD="$BAD body=$B1/$B2"
    [ "$HT1" != "$HT2" ] && BAD="$BAD html=$HT1/$HT2"
    [ "$S1" != "$S2" ] && BAD="$BAD scripts=$S1/$S2"
    if [ -n "$BAD" ]; then
        fail "$pg —$BAD"
        BROKEN_HTML=$((BROKEN_HTML+1))
    else
        ok "$pg — balanced ($S1 scripts)"
    fi
done
[ "$BROKEN_HTML" -eq 0 ] && log "  ${G}All HTML pages structurally balanced${N}" \
                          || log "  ${R}$BROKEN_HTML pages have structural issues${N}"

# ──────────────────────────────────────────────────────
sec "[3] JS LEAKING OUTSIDE <script> TAGS"
# ──────────────────────────────────────────────────────
python3 << 'PYEOF' | tee -a "$RPT"
import glob, re

found_any = False
for fname in sorted(glob.glob("*.html")):
    if ".bak" in fname: continue
    try:
        content = open(fname, errors="replace").read()
    except:
        continue

    # Find content between last </script> and the smart-loader <script>
    sl_pos = content.find('<script src="components/smart-loader')
    if sl_pos == -1:
        sl_pos = content.find("<script src='components/smart-loader")
    if sl_pos == -1:
        sl_pos = len(content)

    before = content[:sl_pos]
    last_close = before.rfind("</script>")
    if last_close == -1:
        gap = before
    else:
        gap = before[last_close+9:]

    gap_stripped = gap.strip()
    if not gap_stripped:
        continue

    # Check if it looks like JS
    js_patterns = ["function ", "var ", "const ", "let ", "document.", "window.", "setTimeout", "=>", "//"]
    is_js = any(p in gap_stripped for p in js_patterns)
    if is_js and len(gap_stripped) > 20:
        lines = len(gap_stripped.split('\n'))
        print(f"  \033[0;31m❌ {fname} — {lines} lines of JS leaking before smart-loader\033[0m")
        found_any = True

if not found_any:
    print("  \033[0;32m✅ No pages have JS leaking outside <script> tags\033[0m")
PYEOF

# ──────────────────────────────────────────────────────
sec "[4] HEAD CORRUPTION CHECK"
# ──────────────────────────────────────────────────────
python3 << 'PYEOF' | tee -a "$RPT"
import glob
found = False
for f in sorted(glob.glob("*.html")):
    if ".bak" in f: continue
    content = open(f, errors="replace").read()
    if "</head>display=swap" in content or "</head>display=" in content:
        print(f"  \033[0;31m❌ {f} — fused </head> corruption detected\033[0m")
        found = True
    if content.count("</head>") > 1:
        print(f"  \033[0;31m❌ {f} — {content.count('</head>')} closing </head> tags\033[0m")
        found = True
if not found:
    print("  \033[0;32m✅ Zero head corruptions found\033[0m")
PYEOF

# ──────────────────────────────────────────────────────
sec "[5] DUPLICATE IDs PER PAGE"
# ──────────────────────────────────────────────────────
python3 << 'PYEOF' | tee -a "$RPT"
import re, glob
found = False
for fname in sorted(glob.glob("*.html")):
    if ".bak" in fname: continue
    ids = re.findall(r'id="([^"]+)"', open(fname, errors="replace").read())
    seen = {}
    for i in ids:
        seen[i] = seen.get(i, 0) + 1
    dupes = {k: v for k, v in seen.items() if v > 1}
    if dupes:
        print(f"  \033[0;31m❌ {fname}: duplicate IDs — {dupes}\033[0m")
        found = True
if not found:
    print("  \033[0;32m✅ No duplicate IDs on any page\033[0m")
PYEOF

# ──────────────────────────────────────────────────────
sec "[6] JS SYNTAX VALIDATION (all .js files)"
# ──────────────────────────────────────────────────────
JS_FAIL=0; JS_PASS=0
while IFS= read -r -d '' jsfile; do
    echo "$jsfile" | grep -q "node_modules\|supabase_fix_backup\|.bak\|_legacy\|_all_backup" && continue
    if node --input-type=module < "$jsfile" 2>/dev/null; then
        JS_PASS=$((JS_PASS+1))
    elif node --check "$jsfile" 2>/tmp/jserr; then
        JS_PASS=$((JS_PASS+1))
    else
        ERR=$(head -1 /tmp/jserr 2>/dev/null)
        fail "SYNTAX: $jsfile — $ERR"
        JS_FAIL=$((JS_FAIL+1))
    fi
done < <(find . -name "*.js" -not -path "*/node_modules/*" -not -path "*supabase_fix_backup*" -not -path "*_legacy*" -not -path "*_all_backup*" -not -path "*/.git/*" -not -name "*.bak*" -print0)
log "  JS files: $JS_PASS passed, $JS_FAIL failed"
[ "$JS_FAIL" -eq 0 ] && ok "All JS files pass syntax check" || fail "$JS_FAIL JS files have syntax errors"

# ──────────────────────────────────────────────────────
sec "[7] ES MODULE IMPORT CHAIN"
# ──────────────────────────────────────────────────────
python3 << 'PYEOF' | tee -a "$RPT"
import re, glob, os
found = False
skip = ["node_modules","supabase_fix_backup","_legacy","_all_backup",".git"]
for fname in glob.glob("js/**/*.js", recursive=True) + glob.glob("js/*.js"):
    if any(s in fname for s in skip): continue
    if ".bak" in fname: continue
    try:
        content = open(fname, errors="replace").read()
    except: continue
    for m in re.finditer(r'from\s+["\']([^"\']+)["\']', content):
        ref = m.group(1)
        if not ref.startswith("."): continue
        base = os.path.dirname(fname)
        target = os.path.normpath(os.path.join(base, ref))
        if not (os.path.exists(target) or os.path.exists(target+".js")):
            print(f"  \033[0;31m❌ {fname}: import '{ref}' → MISSING\033[0m")
            found = True
if not found:
    print("  \033[0;32m✅ All relative JS imports resolve to existing files\033[0m")
PYEOF

# ──────────────────────────────────────────────────────
sec "[8] LOCAL ASSET 404s (scripts, CSS, images)"
# ──────────────────────────────────────────────────────
python3 << 'PYEOF' | tee -a "$RPT"
import re, glob, os
found = False
for fname in sorted(glob.glob("*.html")):
    if ".bak" in fname: continue
    content = open(fname, errors="replace").read()
    # Scripts
    for m in re.finditer(r'src="([^"]+\.js)"', content):
        ref = m.group(1)
        if ref.startswith(("http","//","data:")): continue
        clean = ref.lstrip("/")
        if not os.path.exists(clean):
            print(f"  \033[0;31m❌ {fname}: missing script → {ref}\033[0m")
            found = True
    # CSS
    for m in re.finditer(r'href="([^"]+\.css)"', content):
        ref = m.group(1)
        if ref.startswith(("http","//")): continue
        clean = ref.lstrip("/")
        if not os.path.exists(clean):
            print(f"  \033[0;31m❌ {fname}: missing CSS → {ref}\033[0m")
            found = True
    # Images
    for m in re.finditer(r'src="([^"]+\.(png|jpg|jpeg|svg|webp|ico))"', content):
        ref = m.group(1)
        if ref.startswith(("http","//","data:","$","'")): continue
        clean = ref.lstrip("/")
        if not os.path.exists(clean):
            print(f"  \033[0;33m⚠️  {fname}: missing image → {ref}\033[0m")
if not found:
    print("  \033[0;32m✅ All local script/CSS references resolve\033[0m")
PYEOF

# ──────────────────────────────────────────────────────
sec "[9] INTERNAL PAGE LINKS"
# ──────────────────────────────────────────────────────
python3 << 'PYEOF' | tee -a "$RPT"
import re, glob, os
found = False
for fname in sorted(glob.glob("*.html")):
    if ".bak" in fname: continue
    content = open(fname, errors="replace").read()
    for m in re.finditer(r'href="([^"#?]+\.html)"', content):
        ref = m.group(1)
        if ref.startswith(("http","//")): continue
        clean = ref.lstrip("/")
        if not os.path.exists(clean):
            print(f"  \033[0;31m❌ {fname}: broken link → {ref}\033[0m")
            found = True
if not found:
    print("  \033[0;32m✅ All internal HTML links point to existing pages\033[0m")
PYEOF

# ──────────────────────────────────────────────────────
sec "[10] ONCLICK HANDLER RESOLUTION"
# ──────────────────────────────────────────────────────
python3 << 'PYEOF' | tee -a "$RPT"
import re, glob

# Collect all defined functions from HTML + JS
defined = set()
for fpath in glob.glob("*.html") + glob.glob("js/**/*.js", recursive=True) + glob.glob("components/*.js"):
    if ".bak" in fpath: continue
    try: content = open(fpath, errors="replace").read()
    except: continue
    for m in re.finditer(r"function\s+(\w+)\s*\(", content): defined.add(m.group(1))
    for m in re.finditer(r"window\.(\w+)\s*=\s*(?:function|\()", content): defined.add(m.group(1))

missing_fns = False
for fname in sorted(glob.glob("*.html")):
    if ".bak" in fname: continue
    content = open(fname, errors="replace").read()
    for m in re.finditer(r'on(?:click|submit|change|input)="(\w+)\(', content):
        fn = m.group(1)
        if fn not in defined:
            print(f"  \033[0;31m❌ {fname}: onclick=\"{fn}()\" — function not defined\033[0m")
            missing_fns = True

if not missing_fns:
    print("  \033[0;32m✅ All onclick/onsubmit handlers resolve to defined functions\033[0m")
PYEOF

# ──────────────────────────────────────────────────────
sec "[11] NAVIGATION SYSTEM AUDIT"
# ──────────────────────────────────────────────────────
SL=$(grep -l "smart-loader.js" *.html 2>/dev/null | grep -v ".bak" | wc -l)
UNL=$(grep -l "universal-nav-loader.js" *.html 2>/dev/null | grep -v ".bak" | wc -l)
NAV=$(grep -l 'id="bstm-nav"' *.html 2>/dev/null | grep -v ".bak" | wc -l)
FOOT=$(grep -l 'id="bstm-footer"' *.html 2>/dev/null | grep -v ".bak" | wc -l)
TOTAL_HTML=$(find . -maxdepth 1 -name "*.html" | grep -v ".bak" | wc -l)

log "  smart-loader.js:        $SL / $TOTAL_HTML pages"
log "  universal-nav-loader:   $UNL pages (should be 0)"
log "  #bstm-nav placeholder:  $NAV / $TOTAL_HTML pages"
log "  #bstm-footer placeholder: $FOOT / $TOTAL_HTML pages"

[ "$UNL" -eq 0 ] && ok "Zero pages loading legacy universal-nav-loader" \
                  || fail "$UNL pages still load universal-nav-loader.js"
[ "$SL" -eq "$TOTAL_HTML" ] && ok "All pages load smart-loader.js" \
                              || warn "$((TOTAL_HTML-SL)) pages missing smart-loader.js"

log ""
log "  ${C}Pages missing #bstm-nav:${N}"
for f in $(find . -maxdepth 1 -name "*.html" | grep -v ".bak" | sort); do
    grep -q 'id="bstm-nav"' "$f" || warn "$(basename $f) — no #bstm-nav div"
done

log ""
log "  ${C}Pages missing #bstm-footer:${N}"
for f in $(find . -maxdepth 1 -name "*.html" | grep -v ".bak" | sort); do
    grep -q 'id="bstm-footer"' "$f" || warn "$(basename $f) — no #bstm-footer div"
done

# ──────────────────────────────────────────────────────
sec "[12] SCRIPT LOAD ORDER"
# ──────────────────────────────────────────────────────
python3 << 'PYEOF' | tee -a "$RPT"
import glob, re
bad = 0
for fname in sorted(glob.glob("*.html")):
    if ".bak" in fname: continue
    lines = open(fname, errors="replace").readlines()
    sl = next((i for i,l in enumerate(lines) if "smart-loader.js" in l), None)
    app = next((i for i,l in enumerate(lines) if '"js/app.js"' in l), None)
    if sl is None or app is None: continue
    if sl > app:
        print(f"  \033[0;31m❌ {fname} — smart-loader(L{sl}) AFTER app.js(L{app})\033[0m")
        bad += 1
if bad == 0:
    print("  \033[0;32m✅ Script load order correct on all pages\033[0m")
PYEOF

# ──────────────────────────────────────────────────────
sec "[13] AUTH SYSTEM — placeholder code detection"
# ──────────────────────────────────────────────────────
python3 << 'PYEOF' | tee -a "$RPT"
import glob, re
found = False
BAD_PATTERNS = [
    (r'setTimeout\s*\(\s*\(\)\s*=>\s*\{[\s\S]{0,50}?if\s*\(!token\)', "placeholder auth timeout"),
    (r'localStorage\.getItem\(["\']bstm_token["\']\)', "localStorage token auth"),
    (r'localStorage\.getItem\(["\']bstm_user["\']\)', "localStorage user auth"),
    (r'if\s*\(!token\s*\|\|\s*token\s*===\s*["\']temp["\']', "hardcoded 'temp' token check"),
]
for fname in sorted(glob.glob("*.html") + glob.glob("js/pages/*.js")):
    if ".bak" in fname: continue
    try: content = open(fname, errors="replace").read()
    except: continue
    for pattern, label in BAD_PATTERNS:
        if re.search(pattern, content, re.DOTALL):
            print(f"  \033[0;31m❌ {fname}: {label}\033[0m")
            found = True
            break

if not found:
    print("  \033[0;32m✅ No placeholder auth code found\033[0m")
PYEOF

# ──────────────────────────────────────────────────────
sec "[14] DASHBOARD AUTH PROTECTION"
# ──────────────────────────────────────────────────────
PROTECTED=(buyer-dashboard.html seller-dashboard.html settings.html
           thb-wallet.html wishlist.html admin-dashboard.html
           gov-dashboard.html kyc-verification.html profile.html
           earnings.html transactions.html)
for f in "${PROTECTED[@]}"; do
    [ -f "$f" ] || { warn "$f — FILE MISSING"; continue; }
    if grep -q "BSTM.ready\|getSession\|auth-wall\|window.location.*login" "$f" 2>/dev/null; then
        ok "$f — auth-protected"
    else
        JS_MOD=$(grep -o 'js/pages/[a-zA-Z-]*\.js' "$f" | head -1)
        if [ -n "$JS_MOD" ] && [ -f "$JS_MOD" ]; then
            if grep -q "BSTM.ready\|getSession\|auth-wall" "$JS_MOD" 2>/dev/null; then
                ok "$f — auth via $JS_MOD"
            else
                fail "$f — NO auth guard (public access)"
            fi
        else
            warn "$f — no page module found to verify auth"
        fi
    fi
done

# ──────────────────────────────────────────────────────
sec "[15] PAGE MODULE COVERAGE"
# ──────────────────────────────────────────────────────
log "  ${C}Checking every root HTML page has a js/pages/ module:${N}"
for f in $(find . -maxdepth 1 -name "*.html" | grep -v ".bak" | sort); do
    pg=$(basename "$f" .html)
    mod="js/pages/${pg}.js"
    if [ -f "$mod" ]; then
        if grep -q "$mod" "$f" 2>/dev/null; then
            ok "$(basename $f) → $mod (loaded)"
        else
            warn "$(basename $f) — $mod exists but NOT LOADED in HTML"
        fi
    else
        # Some pages are intentionally module-free
        case "$pg" in
            index|404|order-success|verify|nav-backup|success) info "$(basename $f) — no module (intentional)" ;;
            *) warn "$(basename $f) — missing js/pages/$pg.js" ;;
        esac
    fi
done

# ──────────────────────────────────────────────────────
sec "[16] SUPABASE CONNECTION"
# ──────────────────────────────────────────────────────
if [ -f "js/core/supabase-client.js" ]; then
    URL=$(grep -o "tvtfxkavjqvurdezhyvu\.supabase\.co" js/core/supabase-client.js | head -1)
    KEY=$(grep -o "sb_publishable[^\"']*" js/core/supabase-client.js | head -1 | cut -c1-30)
    [ -n "$URL" ] && ok "Supabase URL present: $URL" || fail "Supabase URL missing"
    [ -n "$KEY" ] && ok "Supabase anon key present: ${KEY}..." || fail "Supabase key missing"
else
    fail "js/core/supabase-client.js MISSING"
fi

DB_CALLS=$(grep -r "\.from(" js/pages/ js/bstm-core.js 2>/dev/null | grep -v ".bak" | wc -l)
info "Total Supabase DB calls across all modules: $DB_CALLS"

# ──────────────────────────────────────────────────────
sec "[17] MANIFEST + SERVICE WORKER"
# ──────────────────────────────────────────────────────
if [ -f "manifest.json" ]; then
    python3 -c "import json; json.load(open('manifest.json'))" 2>/dev/null \
        && ok "manifest.json — valid JSON" || fail "manifest.json — INVALID JSON"
else
    fail "manifest.json MISSING"
fi

MANIFEST_PAGES=$(grep -l "manifest" *.html 2>/dev/null | grep -v ".bak" | wc -l)
log "  Pages linking to manifest: $MANIFEST_PAGES / $TOTAL_HTML"

if [ -f "sw.js" ]; then
    node --check sw.js 2>/dev/null && ok "sw.js — valid syntax" || fail "sw.js — syntax error"
    grep -q "serviceWorker" js/app.js 2>/dev/null \
        && ok "Service worker registered in app.js" \
        || fail "Service worker NOT registered anywhere"
else
    fail "sw.js MISSING"
fi

# ──────────────────────────────────────────────────────
sec "[18] PRODUCTION READINESS — console/alert leaks"
# ──────────────────────────────────────────────────────
log "  ${C}console.log calls in production JS:${N}"
CONSOLE_TOTAL=0
for f in js/app.js js/bstm-core.js components/smart-loader.js js/pages/*.js; do
    [ -f "$f" ] || continue
    N=$(grep -c "console\." "$f" 2>/dev/null || echo 0)
    if [ "$N" -gt 0 ]; then
        warn "$(basename $f) — $N console call(s)"
        CONSOLE_TOTAL=$((CONSOLE_TOTAL+N))
    fi
done
[ "$CONSOLE_TOTAL" -eq 0 ] && ok "Zero console calls in production JS" \
    || info "Total: $CONSOLE_TOTAL console calls (review before production)"

log ""
log "  ${C}alert() calls (replace with toast UI):${N}"
ALERT_TOTAL=0
for f in *.html js/pages/*.js; do
    [ -f "$f" ] || continue
    [ ".bak" = "${f:(-4)}" ] && continue
    N=$(grep -c "alert(" "$f" 2>/dev/null || echo 0)
    if [ "$N" -gt 0 ]; then
        warn "$(basename $f) — $N alert()"
        ALERT_TOTAL=$((ALERT_TOTAL+N))
    fi
done
[ "$ALERT_TOTAL" -eq 0 ] && ok "Zero alert() calls" \
    || info "Total: $ALERT_TOTAL alert() calls"

# ──────────────────────────────────────────────────────
sec "[19] PLACEHOLDER / INCOMPLETE CONTENT"
# ──────────────────────────────────────────────────────
log "  ${C}Placeholder images:${N}"
PH=$(grep -rn "via\.placeholder\.com\|api/placeholder" *.html 2>/dev/null | grep -v ".bak" | wc -l)
[ "$PH" -gt 0 ] && warn "$PH placeholder images found (replace before launch)" \
                 || ok "No placeholder images"

log ""
log "  ${C}Hardcoded test data:${N}"
TD=$(grep -rn "YOUR_PAYSTACK_KEY\|Mpho Kgosi\|mpho@example\.com\|pk_test_YOUR" *.html js/pages/*.js 2>/dev/null | grep -v ".bak" | wc -l)
[ "$TD" -gt 0 ] && warn "$TD hardcoded test values found" \
                 || ok "No hardcoded test data"

log ""
log "  ${C}TODO / FIXME in production code:${N}"
TODO=$(grep -rn "TODO\|FIXME" js/pages/*.js js/bstm-core.js js/app.js 2>/dev/null | grep -v ".bak" | wc -l)
[ "$TODO" -gt 0 ] && warn "$TODO TODO/FIXME comments in production JS" \
                   || ok "No TODO/FIXME in core production files"

# ──────────────────────────────────────────────────────
sec "[20] CSS CONSISTENCY"
# ──────────────────────────────────────────────────────
log "  ${C}Pages missing Tailwind CSS:${N}"
NOTW=0
for f in $(find . -maxdepth 1 -name "*.html" | grep -v ".bak" | sort); do
    grep -q "tailwindcss" "$f" || { warn "$(basename $f) — no Tailwind"; NOTW=$((NOTW+1)); }
done
[ "$NOTW" -eq 0 ] && ok "All pages load Tailwind CSS"

log ""
log "  ${C}Pages missing Inter font:${N}"
NOFONT=0
for f in $(find . -maxdepth 1 -name "*.html" | grep -v ".bak" | sort); do
    grep -q "Inter\|fonts.google" "$f" || { warn "$(basename $f) — no Inter font"; NOFONT=$((NOFONT+1)); }
done
[ "$NOFONT" -eq 0 ] && ok "All pages load Inter font"

# ──────────────────────────────────────────────────────
sec "[21] LIVE-READINESS CHECK"
# ──────────────────────────────────────────────────────
log "  ${C}Simulating what the browser console would show at runtime:${N}"
python3 << 'PYEOF' | tee -a "$RPT"
import glob, re, os

LIVE_ISSUES = {}

for fname in sorted(glob.glob("*.html")):
    if ".bak" in fname: continue
    issues = []
    content = open(fname, errors="replace").read()

    # Check 1: smart-loader present
    if "smart-loader.js" not in content:
        issues.append("smart-loader.js not loaded — nav/footer won't appear")

    # Check 2: app.js present
    if "js/app.js" not in content:
        issues.append("js/app.js not loaded — auth won't work")

    # Check 3: bstm-nav div
    if 'id="bstm-nav"' not in content:
        issues.append("No #bstm-nav div — nav won't inject")

    # Check 4: bstm-footer div
    if 'id="bstm-footer"' not in content:
        issues.append("No #bstm-footer div — footer won't inject")

    # Check 5: missing page module
    basename = fname.replace(".html","")
    module = f"js/pages/{basename}.js"
    if os.path.exists(module) and module not in content:
        issues.append(f"Page module exists ({module}) but not loaded in HTML")

    # Check 6: Paystack placeholder
    if "YOUR_PAYSTACK_KEY" in content:
        issues.append("Paystack key is placeholder — payments WILL FAIL")

    # Check 7: JS leaking
    sl_pos = content.find('<script src="components/smart-loader')
    if sl_pos > 0:
        before = content[:sl_pos]
        last_close = before.rfind("</script>")
        gap = before[last_close+9:].strip() if last_close >= 0 else before.strip()
        if len(gap) > 30 and any(p in gap for p in ["function ", "var ", "const ", "let "]):
            issues.append(f"JS leaking as visible text (~{len(gap)} chars)")

    if issues:
        LIVE_ISSUES[fname] = issues

if not LIVE_ISSUES:
    print("  \033[0;32m✅ All pages appear live-ready\033[0m")
else:
    print(f"  \033[0;31m{len(LIVE_ISSUES)} pages have live-readiness issues:\033[0m")
    for fname, issues in LIVE_ISSUES.items():
        print(f"\n  \033[0;33m{fname}:\033[0m")
        for issue in issues:
            print(f"    \033[0;31m• {issue}\033[0m")
PYEOF

# ──────────────────────────────────────────────────────
sec "[22] GIT STATE"
# ──────────────────────────────────────────────────────
log "  ${C}Last 5 commits:${N}"
git log --oneline -5 2>/dev/null | while read l; do info "$l"; done
log ""
UNCOMMITTED=$(git status --short 2>/dev/null | wc -l)
if [ "$UNCOMMITTED" -gt 0 ]; then
    warn "$UNCOMMITTED uncommitted changes"
    git status --short 2>/dev/null | head -20 | while read l; do log "  ${DIM}$l${N}"; done
else
    ok "Working tree clean — nothing uncommitted"
fi

# ──────────────────────────────────────────────────────
sec "[23] BACKUP FILE CLEANUP"
# ──────────────────────────────────────────────────────
BAK_LIST=$(find . -maxdepth 2 -name "*.bak*" | grep -v ".git" | sort)
BAK_COUNT=$(echo "$BAK_LIST" | grep -c . || echo 0)
if [ "$BAK_COUNT" -gt 0 ]; then
    warn "$BAK_COUNT backup files found (safe to delete once app is confirmed working):"
    echo "$BAK_LIST" | while read f; do log "  ${DIM}$f${N}"; done
    log ""
    log "  ${C}To delete all backups, run:${N}"
    log "  ${Y}find . -maxdepth 3 -name '*.bak*' -not -path './.git/*' -delete${N}"
else
    ok "No backup files"
fi

# ──────────────────────────────────────────────────────
sec "[FINAL] SCORECARD"
# ──────────────────────────────────────────────────────
TOTAL=$((TOTAL_PASS + TOTAL_FAIL + TOTAL_WARN))
if [ "$TOTAL" -gt 0 ]; then
    SCORE=$(( (TOTAL_PASS * 100) / TOTAL ))
else
    SCORE=0
fi

log ""
log "  ${G}✅ Passed:   $TOTAL_PASS${N}"
log "  ${R}❌ Failed:   $TOTAL_FAIL${N}"
log "  ${Y}⚠️  Warnings: $TOTAL_WARN${N}"
log "  ${C}   Total:   $TOTAL${N}"
log ""

if [ "$SCORE" -ge 90 ]; then
    GRADE="${G}EXCELLENT — nearly production-ready${N}"
elif [ "$SCORE" -ge 75 ]; then
    GRADE="${G}GOOD — minor fixes needed${N}"
elif [ "$SCORE" -ge 55 ]; then
    GRADE="${Y}FAIR — several issues to fix${N}"
elif [ "$SCORE" -ge 35 ]; then
    GRADE="${Y}POOR — significant work needed${N}"
else
    GRADE="${R}CRITICAL — not functional${N}"
fi

log "  ${W}${BOLD}Health: $SCORE% — $GRADE${N}"
log ""
log "${P}${BOLD}══════════════════════════════════════════════════${N}"
log "  ${W}Full report saved: ${C}$RPT${N}"
log "${P}${BOLD}══════════════════════════════════════════════════${N}"
log ""

