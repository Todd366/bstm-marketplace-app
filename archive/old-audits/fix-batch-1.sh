#!/bin/bash
cd ~/bstm-marketplace-app || exit 1
BK=".fix-backup-$(date +%Y%m%d-%H%M)"
mkdir -p "$BK"
cp profile.html order-success.html js/pages/profile.js js/pages/earnings.js js/pages/transactions.js js/pages/order-success.js "$BK/" 2>/dev/null
echo "Backed up to $BK"

python3 << 'PYEOF'
import re

# ---- 1. Fix profile.html: content trapped inside phantom <script> ----
with open('profile.html', 'r', encoding='utf-8') as f:
    html = f.read()

old1 = "View Wal<script>\nlet \u2192</a>"
new1 = "View Wallet \u2192</a>"
if old1 in html:
    html = html.replace(old1, new1)
    print("profile.html: fixed 'View Wallet' corruption")
else:
    print("profile.html: WARNING pattern 1 not found, skipping")

old2 = '<div id="bstm-footer"></div>\n</script>\n<script>\n/**\n * BSTM SAFE RUNTIME BRIDGE'
new2 = '<div id="bstm-footer"></div>\n<script>\n/**\n * BSTM SAFE RUNTIME BRIDGE'
if old2 in html:
    html = html.replace(old2, new2)
    print("profile.html: removed stray closing </script>")
else:
    print("profile.html: WARNING pattern 2 not found, skipping")

with open('profile.html', 'w', encoding='utf-8') as f:
    f.write(html)

# ---- 2. Fix order-success.html: same phantom <script> issue ----
with open('order-success.html', 'r', encoding='utf-8') as f:
    html2 = f.read()

old3 = "Check your wal<script>\nlet for your balance</div>"
new3 = "Check your wallet for your balance</div>"
if old3 in html2:
    html2 = html2.replace(old3, new3)
    print("order-success.html: fixed 'wallet for your balance' corruption")
else:
    print("order-success.html: WARNING pattern 3 not found, skipping")

old4 = '<div id="bstm-footer"></div>\n</script>\n<script>\n// Get order ID from URL params if available'
new4 = '<div id="bstm-footer"></div>\n<script>\n// Get order ID from URL params if available'
if old4 in html2:
    html2 = html2.replace(old4, new4)
    print("order-success.html: removed stray closing </script>")
else:
    print("order-success.html: WARNING pattern 4 not found, skipping")

with open('order-success.html', 'w', encoding='utf-8') as f:
    f.write(html2)

# ---- 3. Fix js/pages/profile.js: bad import path + trailing HTML garbage ----
with open('js/pages/profile.js', 'r', encoding='utf-8') as f:
    pj = f.read()

pj = pj.replace("from './js/bstm-core.js'", "from '../bstm-core.js'")
marker = "// ===== INLINE EXTRACTED (profile.html)"
idx = pj.find(marker)
if idx != -1:
    pj = pj[:idx].rstrip() + "\n"
    print("profile.js: import path fixed, garbage tail removed")
else:
    print("profile.js: garbage marker not found (already clean?)")

with open('js/pages/profile.js', 'w', encoding='utf-8') as f:
    f.write(pj)

# ---- 4. Fix js/pages/order-success.js: corrupted demo-data call + garbage tail ----
with open('js/pages/order-success.js', 'r', encoding='utf-8') as f:
    oj = f.read()

oj = oj.replace("// REMOVED_DEMO_DATA()", "Math.random()")

markers = [m.start() for m in re.finditer(r"// ===== INLINE EXTRACTED \(order-success\.html\)", oj)]
if len(markers) >= 2:
    second = markers[1]
    end_marker = oj.find("// ============================================", second)
    keep_before = oj[:markers[0]]
    first_block_end = oj.find("// ============================================", markers[0])
    first_block = oj[markers[0]:first_block_end + len("// ============================================")]
    oj = keep_before + first_block + "\n"
    print("order-success.js: demo-data fixed, garbage tail removed, kept real order-id logic")
else:
    print("order-success.js: markers not found as expected, only demo-data fix applied")

with open('js/pages/order-success.js', 'w', encoding='utf-8') as f:
    f.write(oj)

# ---- 5. Rewrite earnings.js clean (real data, fixed import) ----
earnings_clean = """// js/pages/earnings.js
import { getProfile } from '../bstm-core.js';

window.BSTM.ready().then(async function(session) {
  if (!session) {
    document.getElementById('auth-wall').style.display = 'block';
    return;
  }
  document.getElementById('earnings-content').style.display = 'block';

  var { data: profile } = await getProfile(session.user.id);
  if (profile) {
    var thb = parseFloat(profile.thb_balance || 0);
    document.getElementById('thb-balance').textContent = thb.toFixed(2) + ' THB';
    var estEarnings = thb * 10 * 0.95;
    document.getElementById('total-earnings').textContent = estEarnings.toFixed(2);
    document.getElementById('commission-paid').textContent = 'P' + (estEarnings * 0.05 / 0.95).toFixed(2);
  }
});
"""
with open('js/pages/earnings.js', 'w', encoding='utf-8') as f:
    f.write(earnings_clean)
print("earnings.js: rewritten clean")

# ---- 6. Rewrite transactions.js clean (real data, fixed import) ----
transactions_clean = """// js/pages/transactions.js
import { getOrders } from '../bstm-core.js';

window.BSTM.ready().then(async function(session) {
  if (!session) {
    document.getElementById('auth-wall').style.display = 'block';
    return;
  }
  document.getElementById('tx-content').style.display = 'block';

  var { data: orders } = await getOrders(session.user.id);
  if (!orders || orders.length === 0) return;

  document.getElementById('total-orders').textContent = orders.length;

  var totalSpent = orders.reduce(function(sum, o) { return sum + (Number(o.total_amount) || 0); }, 0);
  document.getElementById('total-spent').textContent = 'P' + totalSpent.toFixed(2);

  var thbEarned = totalSpent * 0.01;
  document.getElementById('thb-earned').textContent = thbEarned.toFixed(2) + ' THB';

  document.getElementById('tx-list').innerHTML = orders.map(function(o) {
    var date = new Date(o.created_at).toLocaleDateString('en-BW', {day:'numeric',month:'short',year:'numeric'});
    var statusColor = o.status === 'delivered' ? '#059669' : o.status === 'pending' ? '#D97706' : '#7C3AED';
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:16px 0;border-bottom:1px solid #F9FAFB;">'
      + '<div>'
      + '<div style="font-weight:700;color:#1E1B4B;font-size:14px;">Order #' + String(o.id).slice(-8).toUpperCase() + '</div>'
      + '<div style="font-size:12px;color:#9CA3AF;margin-top:2px;">' + date + '</div>'
      + '</div>'
      + '<div style="text-align:right;">'
      + '<div style="font-weight:900;color:#1E1B4B;">P' + Number(o.total_amount || 0).toFixed(2) + '</div>'
      + '<div style="font-size:11px;font-weight:700;color:' + statusColor + ';margin-top:2px;">' + (o.status || 'pending').toUpperCase() + '</div>'
      + '</div>'
      + '</div>';
  }).join('');
});
"""
with open('js/pages/transactions.js', 'w', encoding='utf-8') as f:
    f.write(transactions_clean)
print("transactions.js: rewritten clean")

PYEOF

echo ""
echo "=== VERIFY: node --check on all 4 fixed files ==="
for f in js/pages/earnings.js js/pages/transactions.js js/pages/profile.js js/pages/order-success.js; do
  err=$(node --check "$f" 2>&1)
  if [ -z "$err" ]; then echo "OK: $f"; else echo "STILL BROKEN: $f"; echo "$err"; fi
done

echo ""
echo "=== VERIFY: phantom <script> gone from profile.html / order-success.html ==="
grep -n "View Wallet" profile.html
grep -n "Check your wallet for your balance" order-success.html
echo "(if both lines printed above, the fix worked)"
