#!/bin/bash
cd ~/bstm-marketplace-app || exit 1
OUT=html-scripts-dump.txt
{
for p in earnings transactions profile order-success; do
  echo "=== $p.html — all <script> blocks (inline, no src) ==="
  awk '/<script>/{flag=1} flag{print} /<\/script>/{if(flag)flag=0}' "$p.html"
  echo ""
  echo "=== $p.html — all <script src=...> tags ==="
  grep -n '<script src=' "$p.html"
  echo "------------------------------------------"
done
} > "$OUT"
cat "$OUT"
