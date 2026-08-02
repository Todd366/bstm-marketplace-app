#!/bin/bash
cd ~/bstm-marketplace-app || exit 1
echo "=== lines 1-20 ==="
sed -n '1,20p' thb-wallet.html
echo ""
echo "=== lines 655-670 ==="
sed -n '655,670p' thb-wallet.html
echo ""
echo "=== backup (pre-fix) lines 1-20 for comparison ==="
sed -n '1,20p' .fix-backup-20260802-1051-batch3/thb-wallet.html
