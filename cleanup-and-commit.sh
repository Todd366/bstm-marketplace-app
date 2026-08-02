#!/bin/bash
cd ~/bstm-marketplace-app || exit 1

mkdir -p archive/old-audits archive/backup-files archive/supabase_fix_backup

echo "=== Archiving old audit files/scripts ==="
for f in audit-debug.sh audit.sh AUDIT-20260802-1020.txt bstm-audit-20260619-2155.txt \
         bstm-full-audit.sh bstm-mega-audit-20260620-0245.txt bstm-architecture-audit-4phase.py \
         bstm-architecture-audit-v3.py bstm-system-audit-v4.py system-audit-v4-20260704-1827.txt \
         audit_logs learn-app.sh learn-app-2.sh find-corruption-6pages.sh check-script-balance.sh \
         check-thb-wallet.sh check-thb-style-area.sh find-thb-boundary.sh find-thb-boundary-2.sh \
         map-thb-structure.sh check-thb-exact-ws.sh fix-thb-wallet-correct.sh fix-thb-boundary-retry.sh \
         pull-broken.sh pull-html-scripts.sh fix-batch-1.sh fix-batch-2.sh fix-batch-3.sh \
         corruption-dump-*.txt broken-files-dump.txt html-scripts-dump.txt learn-report-*.txt; do
  if [ -e "$f" ]; then
    git mv "$f" archive/old-audits/ 2>/dev/null || mv "$f" archive/old-audits/
  fi
done

echo "=== Archiving .bak files ==="
for f in login.html.pre-cleanfallback.bak login.html.emergencyfix.bak verify.html.fallback.bak; do
  if [ -e "$f" ]; then
    git mv "$f" archive/backup-files/ 2>/dev/null || mv "$f" archive/backup-files/
  fi
done

echo "=== Archiving supabase_fix_backup/ contents ==="
if [ -d "supabase_fix_backup" ]; then
  mv supabase_fix_backup/* archive/supabase_fix_backup/ 2>/dev/null
  rmdir supabase_fix_backup 2>/dev/null
fi

echo "=== Archiving our own .fix-backup-* dirs from this session ==="
for d in .fix-backup-*; do
  if [ -d "$d" ]; then
    mv "$d" archive/backup-files/ 2>/dev/null
  fi
done

echo ""
echo "=== git status summary ==="
git add -A
git status --short | head -40
echo "..."
echo "Total changed files: $(git status --short | wc -l)"

echo ""
echo "=== Committing ==="
git commit -m "Fix critical script-tag corruption across 8 pages

- Fixed phantom <script> tags trapping real page content as inert text
  (profile.html, order-success.html)
- Fixed duplicate open/close <script> pairs and misplaced script tags
  (cablink.html, checkout.html, earnings.html, room22-farm.html,
  thb-wallet.html, transactions.html)
- Fixed corrupted module imports and stray HTML fragments in
  js/pages/earnings.js, transactions.js, profile.js, order-success.js
- All above now pass node --check and have balanced script tags
- Archived legacy audit scripts/reports, .bak files, and dead
  supabase_fix_backup/ folder to archive/ for history"

echo ""
echo "=== DONE — git log ==="
git log --oneline -5
