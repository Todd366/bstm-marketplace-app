#!/bin/bash
cd ~/bstm-marketplace-app || exit 1

python3 << 'PYEOF'
for fname in ['profile.html', 'order-success.html']:
    with open(fname, 'r', encoding='utf-8') as f:
        html = f.read()

    old = '<div id="bstm-footer"></div>\n</script>\n<script src="components/smart-loader.js"></script>'
    new = '<div id="bstm-footer"></div>\n<script src="components/smart-loader.js"></script>'

    if old in html:
        html = html.replace(old, new)
        with open(fname, 'w', encoding='utf-8') as f:
            f.write(html)
        print(f"{fname}: removed stray </script>, fixed")
    else:
        print(f"{fname}: WARNING pattern not found, no change made")
PYEOF

echo ""
echo "=== VERIFY: script tag balance ==="
for p in profile order-success; do
  o=$(grep -o '<script' "$p.html" | wc -l)
  c=$(grep -o '</script>' "$p.html" | wc -l)
  echo "$p.html — open: $o  close: $c  $([ "$o" -eq "$c" ] && echo BALANCED || echo MISMATCH)"
done
