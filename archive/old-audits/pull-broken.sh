#!/bin/bash
cd ~/bstm-marketplace-app || exit 1
OUT=broken-files-dump.txt
{
echo "=== earnings.js (full) ==="
cat -A js/pages/earnings.js | sed -n '1,50p'
echo ""
echo "=== transactions.js (full) ==="
cat -A js/pages/transactions.js | sed -n '1,50p'
echo ""
echo "=== profile.js lines 75-95 ==="
sed -n '75,95p' js/pages/profile.js
echo ""
echo "=== order-success.js (full) ==="
cat js/pages/order-success.js
echo ""
echo "=== bstm-core.js exports ==="
grep -n "^export" js/bstm-core.js
} > "$OUT"
cat "$OUT"
