// js/pages/transactions.js
import { getOrders } from '../bstm-core.js';
import { supabase } from '../core/supabase-client.js';

window.BSTM.ready().then(async function(session) {
  if (!session) {
    document.getElementById('auth-wall').style.display = 'block';
    return;
  }
  document.getElementById('tx-content').style.display = 'block';

  var { data: orders } = await getOrders(session.user.id);

  // Real THB earned — sum actual credits from wallet_ledger, not a
  // recomputed guess that can drift from whatever rate checkout.js used.
  var { data: ledger } = await supabase
    .from('wallet_ledger')
    .select('amount_thb, type')
    .eq('user_id', session.user.id)
    .eq('reference_type', 'order');
  var thbEarned = (ledger || []).reduce(function(sum, e) {
    return sum + (e.type === 'credit' ? e.amount_thb : 0);
  }, 0);
  document.getElementById('thb-earned').textContent = thbEarned.toFixed(2) + ' THB';

  if (!orders || orders.length === 0) return;

  document.getElementById('total-orders').textContent = orders.length;

  var totalSpent = orders.reduce(function(sum, o) { return sum + (Number(o.total_amount) || 0); }, 0);
  document.getElementById('total-spent').textContent = 'P' + totalSpent.toFixed(2);

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
