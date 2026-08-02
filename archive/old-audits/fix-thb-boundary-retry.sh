#!/bin/bash
cd ~/bstm-marketplace-app || exit 1

python3 << 'PYEOF'
with open('thb-wallet.html', 'r', encoding='utf-8') as f:
    content = f.read()

old_boundary = "    </div>\n\n    // Load wallet data"
new_boundary = "    </div>\n\n<script>\n    // Load wallet data"
assert old_boundary in content, "still not found"
content = content.replace(old_boundary, new_boundary)

with open('thb-wallet.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("script tag inserted at correct boundary")
PYEOF

echo ""
echo "=== VERIFY ==="
o=$(grep -o '<script' thb-wallet.html | wc -l)
c=$(grep -o '</script>' thb-wallet.html | wc -l)
echo "open:$o close:$c $([ "$o" -eq "$c" ] && echo BALANCED || echo STILL-MISMATCH)"
node --check js/pages/thb-wallet.js 2>&1 || echo "(no separate js/pages/thb-wallet.js issue expected, checking html syntax not applicable via node)"
echo "--- final sanity: re-run full 6-page balance check ---"
for p in cablink checkout earnings room22-farm thb-wallet transactions; do
  oo=$(grep -o '<script' "$p.html" | wc -l)
  cc=$(grep -o '</script>' "$p.html" | wc -l)
  echo "$p.html — open:$oo close:$cc $([ "$oo" -eq "$cc" ] && echo BALANCED || echo MISMATCH)"
done
