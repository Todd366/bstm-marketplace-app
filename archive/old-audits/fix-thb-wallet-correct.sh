#!/bin/bash
cd ~/bstm-marketplace-app || exit 1

cp .fix-backup-20260802-1051-batch3/thb-wallet.html thb-wallet.html
echo "Restored thb-wallet.html from pre-batch3 backup"

python3 << 'PYEOF'
with open('thb-wallet.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix title corruption
old_title = "THB Wal<script>\nlet - BSTM Digital Nation</title>"
new_title = "THB Wallet - BSTM Digital Nation</title>"
assert old_title in content, "title pattern not found"
content = content.replace(old_title, new_title)

# 2. Remove the misplaced <script> from before <style> (it doesn't belong here)
old_mislocated = '<script src="js/thb-display.js"></script>\n<script>\n<style>'
new_mislocated = '<script src="js/thb-display.js"></script>\n<style>'
assert old_mislocated in content, "misplaced-script-before-style pattern not found"
content = content.replace(old_mislocated, new_mislocated)

# 3. Collapse the duplicate consecutive </script> close (old L666/667 area)
import re
content, n_dup = re.subn(r'</script>\s*\n\s*</script>\s*\n', '</script>\n', content)
print(f"collapsed duplicate closes: {n_dup}")

# 4. Insert the real <script> open right before the actual JS content starts
old_boundary = "    </div>\n    \n    // Load wallet data"
new_boundary = "    </div>\n\n<script>\n    // Load wallet data"
assert old_boundary in content, "HTML-to-JS boundary pattern not found"
content = content.replace(old_boundary, new_boundary)

with open('thb-wallet.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("thb-wallet.html: title fixed, misplaced script relocated, duplicate close collapsed")
PYEOF

echo ""
echo "=== VERIFY ==="
o=$(grep -o '<script' thb-wallet.html | wc -l)
c=$(grep -o '</script>' thb-wallet.html | wc -l)
echo "open:$o close:$c $([ "$o" -eq "$c" ] && echo BALANCED || echo STILL-MISMATCH)"
grep -n "THB Wallet - BSTM" thb-wallet.html
echo "--- context around the new script open ---"
grep -n "// Load wallet data" thb-wallet.html
