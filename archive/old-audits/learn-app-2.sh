#!/bin/bash
cd ~/bstm-marketplace-app || exit 1
OUT=learn-report-2-$(date +%Y%m%d-%H%M).txt
mkdir -p /tmp/bstmscan
{
echo "=== SCRIPT TAG BALANCE — ALL ROOT HTML PAGES ==="
for p in *.html; do
  o=$(grep -o '<script' "$p" | wc -l)
  c=$(grep -o '</script>' "$p" | wc -l)
  if [ "$o" -ne "$c" ]; then
    echo "MISMATCH: $p — open:$o close:$c"
  fi
done
echo "(pages not listed above are balanced)"

echo ""
echo "=== SAME CORRUPTION PATTERN CHECK: stray <script> mid-tag or mid-word ==="
grep -rn '<script>$' *.html 2>/dev/null | while read -r line; do
  file=$(echo "$line" | cut -d: -f1)
  lnum=$(echo "$line" | cut -d: -f2)
  prevline=$((lnum-1))
  prevcontent=$(sed -n "${prevline}p" "$file")
  # flag if previous line doesn't end cleanly (mid-tag/mid-word suspicion: ends with text not a closing tag or blank)
  echo "$file:$lnum  prev-line-ends-with: [${prevcontent: -20}]"
done

echo ""
echo "=== REMOVED_DEMO_DATA / INLINE EXTRACTED markers still present anywhere ==="
grep -rl "REMOVED_DEMO_DATA\|INLINE EXTRACTED" --include="*.html" --include="*.js" . 2>/dev/null | grep -v node_modules | grep -v "\.git" | grep -v archive | grep -v supabase_fix_backup | grep -v ".fix-backup"

echo ""
echo "=== RE-CHECK: 6 pages flagged imbalanced in ORIGINAL audit ==="
for p in cablink checkout earnings room22-farm thb-wallet transactions; do
  o=$(grep -o '<script' "$p.html" | wc -l)
  c=$(grep -o '</script>' "$p.html" | wc -l)
  echo "$p.html — open:$o close:$c $([ "$o" -eq "$c" ] && echo OK || echo STILL-MISMATCH)"
done

echo ""
echo "=== DUPLICATE FILES (content hash, fixed version) ==="
find . -type f \( -name "*.html" -o -name "*.js" \) -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./archive/*" -not -path "./supabase_fix_backup/*" -not -path "./.fix-backup*" -print0 | xargs -0 md5sum > /tmp/bstmscan/allhashes.txt
awk '{print $1}' /tmp/bstmscan/allhashes.txt | sort | uniq -d > /tmp/bstmscan/duphashes.txt
if [ -s /tmp/bstmscan/duphashes.txt ]; then
  while read -r h; do grep "^$h" /tmp/bstmscan/allhashes.txt; echo "---"; done < /tmp/bstmscan/duphashes.txt
else
  echo "No exact-duplicate files found"
fi

echo ""
echo "=== JUNK AT ROOT (audits, .bak, backup dirs) — for archival ==="
find . -maxdepth 1 -iname "*audit*" -o -maxdepth 1 -iname "*.bak*" -o -maxdepth 1 -type d -iname "*backup*"

} > "$OUT" 2>&1
echo "DONE -> $OUT"
cat "$OUT"
