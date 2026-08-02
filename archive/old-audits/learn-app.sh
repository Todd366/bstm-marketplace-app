#!/bin/bash
cd ~/bstm-marketplace-app || exit 1
OUT=learn-report-$(date +%Y%m%d-%H%M).txt
{
echo "=== DUPLICATE FILES (same content, different name/location) ==="
find . -type f \( -name "*.html" -o -name "*.js" \) -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./archive/*" -exec md5sum {} \; > /tmp/allhashes
awk '{print $1}' /tmp/allhashes | sort | uniq -d > /tmp/duphashes
while read -r h; do grep "^$h" /tmp/allhashes; echo "---"; done < /tmp/duphashes

echo ""
echo "=== JUNK/AUDIT FILES AT ROOT ==="
find . -maxdepth 1 -iname "*audit*" -o -iname "*.bak*" 2>/dev/null

echo ""
echo "=== REAL JS SYNTAX CHECK (node --check) ==="
find . -name "*.js" -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./archive/*" | while read -r f; do
  err=$(node --check "$f" 2>&1)
  if [ -n "$err" ]; then echo "FAIL: $f"; echo "$err" | head -3; fi
done

echo ""
echo "=== bstm-core.js import mismatch check ==="
grep -n "bstm-core" js/pages/earnings.js js/pages/transactions.js js/pages/profile.js 2>/dev/null
echo "--- actual bstm-core.js location(s) ---"
find . -name "bstm-core.js" -not -path "./node_modules/*"

echo ""
echo "=== JS LEAKING AS VISIBLE TEXT (raw preview) ==="
for p in ecosystem-hub kyc-verification monitoring-dashboard notifications-all product-detail settings terms; do
  echo "--- $p.html (first 12 lines after <body>) ---"
  sed -n '/<body/,+12p' "$p.html" 2>/dev/null
done

echo ""
echo "=== PLACEHOLDER / MOCK MARKERS ==="
grep -rli "placeholder\|lorem ipsum\|TODO\|FIXME\|mock-data\|dummy" --include="*.html" --include="*.js" . 2>/dev/null | grep -v node_modules | grep -v "\.git" | grep -v archive

echo ""
echo "=== OTHER BSTM APP FOLDERS ON DEVICE (possible duplicate ecosystems) ==="
ls -la ~ | grep -i bstm

} > "$OUT" 2>&1
echo "DONE -> $OUT"
cat "$OUT"
