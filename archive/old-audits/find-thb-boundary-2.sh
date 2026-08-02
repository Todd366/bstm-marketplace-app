#!/bin/bash
cd ~/bstm-marketplace-app || exit 1
echo "=== backup file lines 465-490 ==="
sed -n '465,490p' .fix-backup-20260802-1051-batch3/thb-wallet.html
