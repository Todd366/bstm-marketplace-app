#!/bin/bash

echo "======================================"
echo "🚀 BSTM FULL SYSTEM AUDIT START"
echo "======================================"

mkdir -p audit_logs

# 1. JS Syntax Check
echo "→ Checking JavaScript syntax..."
find . -name "*.js" ! -path "./node_modules/*" -exec node --check {} \; 2>&1 | tee audit_logs/js_syntax.txt

# 2. HTML Script Detection
echo "→ Scanning inline scripts in HTML..."
grep -RIn "<script" . --include="*.html" | tee audit_logs/html_scripts.txt

# 3. Broken Module Imports
echo "→ Checking ES module imports..."
grep -RIn "import " js 2>/dev/null | tee audit_logs/js_imports.txt

# 4. Missing Auth Usage
echo "→ Checking auth system usage..."
grep -RIn "bstm_token\|bstm_user\|localStorage.getItem" . | tee audit_logs/auth_usage.txt

# 5. Menu System Check
echo "→ Checking menu system usage..."
grep -RIn "menu-btn\|sidebar\|classList.toggle" . | tee audit_logs/menu_usage.txt

# 6. Event System Audit
echo "→ Checking event listeners..."
grep -RIn "addEventListener" js 2>/dev/null | tee audit_logs/events.txt

# 7. TODO / FIX / BROKEN CODE TRACKING
echo "→ Searching for unfinished logic..."
grep -RInE "TODO|FIXME|bug|error|hack" . | tee audit_logs/todo_fixme.txt

# 8. Duplicate IDs in HTML
echo "→ Checking duplicate IDs..."
grep -Rho 'id="[^"]*"' . | sort | uniq -d | tee audit_logs/duplicate_ids.txt

# 9. Missing Smart Loader
echo "→ Checking smart-loader usage..."
grep -RIn "smart-loader.js" . --include="*.html" | tee audit_logs/smart_loader.txt

# 10. Orphan JS Files (not linked in HTML)
echo "→ Checking orphan JS files..."
for f in js/pages/*.js 2>/dev/null; do
  base=$(basename "$f")
  grep -R "$base" . --include="*.html" > /dev/null || echo "ORPHAN: $base"
done | tee audit_logs/orphan_js.txt

# 11. Large Inline Script Blocks (bad architecture)
echo "→ Detecting large inline scripts..."
awk '/<script>/,/<\/script>/' *.html 2>/dev/null | wc -l | tee audit_logs/inline_script_blocks.txt

# 12. LocalStorage Abuse Scan
echo "→ Checking localStorage usage..."
grep -RIn "localStorage" . | tee audit_logs/localstorage_usage.txt

# 13. Final Summary
echo "======================================"
echo "✅ BSTM AUDIT COMPLETE"
echo "Check /audit_logs for full report"
echo "======================================"
