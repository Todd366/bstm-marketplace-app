#!/bin/bash
cd ~/bstm-marketplace-app || exit 1
BK=".fix-backup-$(date +%Y%m%d-%H%M)-batch3"
mkdir -p "$BK"
cp cablink.html checkout.html earnings.html room22-farm.html thb-wallet.html transactions.html "$BK/"
echo "Backed up to $BK"

python3 << 'PYEOF'
import re

pages = ['cablink.html', 'checkout.html', 'earnings.html', 'room22-farm.html', 'thb-wallet.html', 'transactions.html']

for fname in pages:
    with open(fname, 'r', encoding='utf-8') as f:
        content = f.read()
    original = content
    changes = []

    # Fix 1: stray bare <script> jammed right before a <style> block
    new_content, n = re.subn(r'<script>\s*\n(\s*<style>)', r'\1', content)
    if n: changes.append(f"removed stray <script> before <style> x{n}")
    content = new_content

    # Fix 2: duplicate consecutive bare <script> open tags -> collapse to one
    new_content, n = re.subn(r'<script>\s*\n\s*<script>\s*\n', '<script>\n', content)
    if n: changes.append(f"collapsed duplicate <script> opens x{n}")
    content = new_content

    # Fix 3: duplicate consecutive </script> close tags -> collapse to one
    new_content, n = re.subn(r'</script>\s*\n\s*</script>\s*\n', '</script>\n', content)
    if n: changes.append(f"collapsed duplicate </script> closes x{n}")
    content = new_content

    # Fix 4: stray </script> sandwiched between a self-closed script and the SAFE RUNTIME BRIDGE comment
    new_content, n = re.subn(
        r'(</script>)\n\n</script>\n\n(<script>\n/\*\*\n \* BSTM SAFE RUNTIME BRIDGE)',
        r'\1\n\n\2', content)
    if n: changes.append(f"removed stray </script> before BRIDGE comment x{n}")
    content = new_content

    # Fix 5: stray </script> sandwiched between page-module script and the calculateFare fallback block
    new_content, n = re.subn(
        r'(<script type="module" src="js/pages/[\w-]+\.js"></script>)\n\n</script>\n\n(<script>\n\nif \(typeof window\.calculateFare)',
        r'\1\n\n\2', content)
    if n: changes.append(f"removed stray </script> before calculateFare fallback x{n}")
    content = new_content

    # Fix 6: stray <script> jammed inside the import-then-ready() module block (earnings/transactions)
    new_content, n = re.subn(
        r"(from '\./js/bstm-core\.js';)\n\n<script>\n(window\.BSTM\.ready)",
        r"\1\n\n\2", content)
    if n: changes.append(f"removed stray <script> inside module import block x{n}")
    content = new_content

    # Fix 7: mid-word title corruption specific to thb-wallet.html
    old_title = "THB Wal<script>\nlet - BSTM Digital Nation</title>"
    new_title = "THB Wallet - BSTM Digital Nation</title>"
    if old_title in content:
        content = content.replace(old_title, new_title)
        changes.append("fixed 'THB Wallet' title corruption")

    if content != original:
        with open(fname, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"{fname}: {', '.join(changes)}")
    else:
        print(f"{fname}: no changes applied")
PYEOF

echo ""
echo "=== VERIFY: script tag balance after fixes ==="
for p in cablink checkout earnings room22-farm thb-wallet transactions; do
  o=$(grep -o '<script' "$p.html" | wc -l)
  c=$(grep -o '</script>' "$p.html" | wc -l)
  echo "$p.html — open:$o close:$c $([ "$o" -eq "$c" ] && echo BALANCED || echo STILL-MISMATCH)"
done
