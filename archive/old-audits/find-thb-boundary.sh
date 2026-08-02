#!/bin/bash
cd ~/bstm-marketplace-app || exit 1
echo "=== backup file lines 440-465 (looking for HTML-to-JS boundary) ==="
sed -n '440,465p' .fix-backup-20260802-1051-batch3/thb-wallet.html
