#!/bin/bash
cd ~/bstm-marketplace-app || exit 1
mkdir -p .scratch
OUT=corruption-dump-$(date +%Y%m%d-%H%M).txt
{
python3 << 'PYEOF'
import re

pages = ['cablink', 'checkout', 'earnings', 'room22-farm', 'thb-wallet', 'transactions']

for p in pages:
    fname = p + '.html'
    with open(fname, 'r', encoding='utf-8') as f:
        content = f.read()

    print(f"===== {fname} =====")
    # find every <script ...> opening tag (with or without attrs) and every </script>
    for m in re.finditer(r'<script[^>]*>|</script>', content):
        start = m.start()
        end = m.end()
        before = content[max(0, start-40):start].replace('\n', '\\n')
        after = content[end:end+40].replace('\n', '\\n')
        line_no = content[:start].count('\n') + 1
        tag = m.group()
        print(f"L{line_no}: ...{before}[{tag}]{after}...")
    print("")
PYEOF
} > "$OUT" 2>&1
echo "DONE -> $OUT"
cat "$OUT"
