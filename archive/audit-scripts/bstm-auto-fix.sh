#!/bin/bash

ROOT="."

echo "🔧 BSTM AUTO FIX ENGINE"

for file in *.html; do
  [ -f "$file" ] || continue

  echo "Fixing $file..."

  # 1. Fix script imbalance before smart-loader
  python3 - <<PY
import re

path = "$file"
with open(path, "r", encoding="utf-8", errors="ignore") as f:
    c = f.read()

if "<script src=\"components/smart-loader.js\">" not in c:
    print("⚠️ no smart-loader, skipping")
    exit()

i = c.find("<script src=\"components/smart-loader.js\">")
before = c[:i]

opens = before.count("<script")
closes = before.count("</script>")

if opens > closes:
    diff = opens - closes
    before = before.rstrip() + "\n" + ("</script>\n" * diff)

new = before + c[i:]

with open(path, "w", encoding="utf-8") as f:
    f.write(new)

print("✅ fixed:", path)
PY

done

echo "🎉 AUTO FIX COMPLETE"
