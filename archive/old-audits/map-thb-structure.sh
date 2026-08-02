#!/bin/bash
cd ~/bstm-marketplace-app || exit 1
echo "=== key structural tag line numbers ==="
grep -n '</style>\|<body\|</head>\|<script\|</script>\|function ' thb-wallet.html
