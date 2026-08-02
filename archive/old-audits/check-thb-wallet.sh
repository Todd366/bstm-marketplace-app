#!/bin/bash
cd ~/bstm-marketplace-app || exit 1
python3 << 'PYEOF'
import re
with open('thb-wallet.html', 'r', encoding='utf-8') as f:
    content = f.read()

for m in re.finditer(r'<script[^>]*>|</script>', content):
    start = m.start()
    end = m.end()
    before = content[max(0, start-40):start].replace('\n', '\\n')
    after = content[end:end+40].replace('\n', '\\n')
    line_no = content[:start].count('\n') + 1
    print(f"L{line_no}: ...{before}[{m.group()}]{after}...")
PYEOF
