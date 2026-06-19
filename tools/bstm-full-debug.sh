#!/bin/bash

PROJECT=$(pwd)
REPORT="bstm-debug-$(date +%Y%m%d-%H%M).txt"

echo "════════════════════════════════════════════" | tee $REPORT
echo "  BSTM FULL SYSTEM DEBUG REPORT" | tee -a $REPORT
echo "  $(date)" | tee -a $REPORT
echo "  $PROJECT" | tee -a $REPORT
echo "════════════════════════════════════════════" | tee -a $REPORT

echo "" | tee -a $REPORT

############################################
# 1. FILE STRUCTURE HEALTH
############################################
echo "[1] FILE STRUCTURE CHECK" | tee -a $REPORT

HTML_COUNT=$(find . -name "*.html" | wc -l)
JS_COUNT=$(find . -name "*.js" | wc -l)
CSS_COUNT=$(find . -name "*.css" | wc -l)
NODE_COUNT=$(find . -name "node_modules" | wc -l)

echo "HTML: $HTML_COUNT | JS: $JS_COUNT | CSS: $CSS_COUNT" | tee -a $REPORT

if [ -d node_modules ]; then
  echo "⚠ node_modules exists (bloat risk)" | tee -a $REPORT
fi

############################################
# 2. MISSING CORE FILES
############################################
echo "" | tee -a $REPORT
echo "[2] CORE FILE CHECK" | tee -a $REPORT

FILES=(
  "js/bstm-config.js"
  "js/bstm-core.js"
  "css/bstm-styles.css"
  "manifest.json"
)

for f in "${FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "❌ MISSING: $f" | tee -a $REPORT
  else
    echo "✅ OK: $f" | tee -a $REPORT
  fi
done

############################################
# 3. AUTH CONFLICT DETECTION
############################################
echo "" | tee -a $REPORT
echo "[3] AUTH SYSTEM CHECK" | tee -a $REPORT

grep -R "localStorage.getItem(\"bstm_token\")" . --exclude-dir=node_modules > /tmp/auth.txt 2>/dev/null
grep -R "firebase" js/ --exclude-dir=node_modules > /tmp/firebase.txt 2>/dev/null
grep -R "supabase" js/ > /tmp/supabase.txt 2>/dev/null

echo "Legacy Auth usage:" | tee -a $REPORT
wc -l /tmp/auth.txt | tee -a $REPORT

echo "Firebase references:" | tee -a $REPORT
wc -l /tmp/firebase.txt | tee -a $REPORT

echo "Supabase references:" | tee -a $REPORT
wc -l /tmp/supabase.txt | tee -a $REPORT

############################################
# 4. HTML STRUCTURE ISSUES
############################################
echo "" | tee -a $REPORT
echo "[4] HTML VALIDATION CHECK" | tee -a $REPORT

BAD_SCRIPTS=$(grep -R "</html>" -n . | grep -v "node_modules")

if [ ! -z "$BAD_SCRIPTS" ]; then
  echo "❌ Scripts or content after </html> detected" | tee -a $REPORT
  echo "$BAD_SCRIPTS" | tee -a $REPORT
fi

############################################
# 5. SECURITY SCAN
############################################
echo "" | tee -a $REPORT
echo "[5] SECURITY SCAN" | tee -a $REPORT

grep -R "apiKey" . --exclude-dir=node_modules > /tmp/secrets.txt
grep -R "secret" . --exclude-dir=node_modules >> /tmp/secrets.txt

if [ -s /tmp/secrets.txt ]; then
  echo "⚠ Possible exposed secrets found:" | tee -a $REPORT
  cat /tmp/secrets.txt | tee -a $REPORT
else
  echo "✅ No obvious secrets detected" | tee -a $REPORT
fi

############################################
# 6. BROKEN LINKS CHECK
############################################
echo "" | tee -a $REPORT
echo "[6] LINK HEALTH CHECK" | tee -a $REPORT

grep -R "href=" *.html > /tmp/links.txt 2>/dev/null

echo "Links scanned: $(wc -l < /tmp/links.txt)" | tee -a $REPORT

############################################
# 7. JS SYNTAX CHECK (basic)
############################################
echo "" | tee -a $REPORT
echo "[7] JS SYNTAX CHECK" | tee -a $REPORT

for file in $(find js -name "*.js"); do
  node -c "$file" 2>> $REPORT
done

############################################
# 8. SUMMARY
############################################
echo "" | tee -a $REPORT
echo "════════════════════════════════════════════" | tee -a $REPORT
echo "REPORT SAVED: $REPORT" | tee -a $REPORT
echo "════════════════════════════════════════════" | tee -a $REPORT

