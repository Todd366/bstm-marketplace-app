#!/bin/bash
cd ~/bstm-marketplace-app || exit 1
for p in profile order-success; do
  echo "=== $p.html: script tag counts ==="
  echo "open:  $(grep -o '<script' "$p.html" | wc -l)"
  echo "close: $(grep -o '</script>' "$p.html" | wc -l)"
  echo "--- lines around bstm-footer (with line numbers, raw) ---"
  grep -n "bstm-footer" "$p.html"
  echo "--- exact 6 lines after bstm-footer div (cat -A to show hidden chars) ---"
  LINE=$(grep -n "bstm-footer" "$p.html" | head -1 | cut -d: -f1)
  START=$((LINE))
  END=$((LINE+6))
  sed -n "${START},${END}p" "$p.html" | cat -A
  echo "------------------------------------------"
done
