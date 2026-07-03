#!/usr/bin/env bash

echo "=============================================="
echo "      BSTM MASTER AUDIT ENGINE v1.0"
echo "      MOBILE-FIRST FULL SYSTEM CHECK"
echo "=============================================="

ROOT="$(pwd)"
RPT="AUDIT-$(date +%Y%m%d-%H%M).txt"
> "$RPT"

PASS=0
FAIL=0
WARN=0

log() { echo -e "$1" | tee -a "$RPT"; }
ok() { log "✅ $1"; PASS=$((PASS+1)); }
fail() { log "❌ $1"; FAIL=$((FAIL+1)); }
warn() { log "⚠️  $1"; WARN=$((WARN+1)); }

section() {
  echo ""
  echo "----------------------------------------------"
  echo "$1"
  echo "----------------------------------------------"
  echo "$1" >> "$RPT"
}

# ==================================================
section "[01] PROJECT INVENTORY"
# ==================================================
HTML_COUNT=$(find . -name "*.html" | wc -l)
JS_COUNT=$(find . -name "*.js" | wc -l)
CSS_COUNT=$(find . -name "*.css" | wc -l)

ok "HTML files: $HTML_COUNT"
ok "JS files: $JS_COUNT"
ok "CSS files: $CSS_COUNT"

# ==================================================
section "[02] HTML STRUCTURE CHECK"
# ==================================================
for f in *.html; do
  [ -f "$f" ] || continue

  grep -q "<!DOCTYPE html>" "$f" && d=1 || d=0
  grep -q "<head>" "$f" && h=1 || h=0
  grep -q "<body" "$f" && b=1 || b=0

  if [ $d -eq 1 ] && [ $h -eq 1 ] && [ $b -eq 1 ]; then
    ok "$f structure OK"
  else
    fail "$f broken HTML structure"
  fi
done

# ==================================================
section "[03] MOBILE-FIRST AUDIT"
# ==================================================
for f in *.html; do
  [ -f "$f" ] || continue

  grep -q "viewport" "$f" && ok "$f viewport present" || warn "$f missing viewport"

  # overflow risk
  if grep -q "width:1000\|overflow-x.*scroll" "$f"; then
    warn "$f possible horizontal scroll issue"
  fi

  # touch targets
  if grep -q "button\|onclick" "$f"; then
    warn "$f check touch-friendly UI"
  fi
done

# ==================================================
section "[04] JS SYNTAX CHECK"
# ==================================================
for f in js/*.js js/pages/*.js 2>/dev/null; do
  [ -f "$f" ] || continue
  node --check "$f" 2>/dev/null && ok "$f syntax OK" || fail "$f JS error"
done

# ==================================================
section "[05] INLINE JS DETECTION"
# ==================================================
for f in *.html; do
  [ -f "$f" ] || continue

  if grep -q "<script>" "$f"; then
    warn "$f contains inline script blocks"
  fi
done

# ==================================================
section "[06] SMART LOADER CHECK"
# ==================================================
for f in *.html; do
  [ -f "$f" ] || continue

  grep -q "smart-loader.js" "$f" && ok "$f loader present" || warn "$f missing smart-loader"
done

# ==================================================
section "[07] NAVIGATION SYSTEM"
# ==================================================
for f in *.html; do
  [ -f "$f" ] || continue

  grep -q "bstm-nav" "$f" && ok "$f nav OK" || warn "$f missing nav"
done

# ==================================================
section "[08] BROKEN LINKS"
# ==================================================
grep -R "href=\".*\.html\"" . | tee -a "$RPT" >/dev/null

# ==================================================
section "[09] ASSETS CHECK"
# ==================================================
for f in *.html; do
  [ -f "$f" ] || continue

  grep -o 'src="[^"]*"' "$f" | cut -d'"' -f2 | while read img; do
    [[ "$img" =~ ^http ]] && continue
    [ -f "$img" ] || warn "$f missing asset: $img"
  done
done

# ==================================================
section "[10] AUTH CHECK"
# ==================================================
grep -R "localStorage.getItem" . | tee -a "$RPT" >/dev/null

# ==================================================
section "[11] DATABASE (SUPABASE)"
# ==================================================
grep -R "\.from(" . | tee -a "$RPT" >/dev/null

# ==================================================
section "[12] SECURITY CHECK"
# ==================================================
grep -R "console.log\|alert(" . | tee -a "$RPT" >/dev/null

# ==================================================
section "[13] PLACEHOLDER DETECTION"
# ==================================================
grep -R "TODO\|FIXME\|YOUR_API_KEY\|test@example" . | tee -a "$RPT" >/dev/null

# ==================================================
section "[14] PWA CHECK"
# ==================================================
[ -f "manifest.json" ] && ok "manifest found" || warn "missing manifest"
[ -f "sw.js" ] && ok "service worker found" || warn "missing service worker"

# ==================================================
section "[15] GIT STATUS"
# ==================================================
git status --short | tee -a "$RPT"

# ==================================================
section "[16] FINAL SCORE"
# ==================================================
TOTAL=$((PASS + FAIL + WARN))
SCORE=$(( PASS * 100 / TOTAL ))

echo ""
echo "=============================================="
echo "PASS: $PASS"
echo "FAIL: $FAIL"
echo "WARN: $WARN"
echo "SCORE: $SCORE%"
echo "REPORT: $RPT"
echo "=============================================="
