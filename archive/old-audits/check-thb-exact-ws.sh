#!/bin/bash
cd ~/bstm-marketplace-app || exit 1
sed -n '465,472p' thb-wallet.html | cat -A
