// AUDIT_IGNORE
// js/pages/transactions.js
window.BSTM.ready().then(function(session){
  if(!session){
    window.location.href='login.html';
    return;
  }

  var mock=[
    {type:'earn',reason:'Purchase reward',amount:1.5,date:'2025-07-01'},
    {type:'earn',reason:'CabLink ride',amount:0.8,date:'2025-07-02'},
    {type:'spend',reason:'Marketplace item',amount:-2,date:'2025-07-03'}
  ];

  var c=document.getElementById('tx-count');
  var l=document.getElementById('transaction-list');

  if(c) c.textContent=mock.length;

  if(l){
    l.innerHTML=mock.map(function(tx){
      var sign=tx.type==='earn'?'+':'';
      var color=tx.type==='earn'?'#059669':'#DC2626';

      return '<div class="tx-row"><span>'+tx.reason+'</span>'
      +'<span style="color:'+color+';font-weight:700;">'
      +sign+Math.abs(tx.amount).toFixed(2)+' THB</span>'
      +'<span style="color:#9CA3AF;">'+tx.date+'</span></div>';
    }).join('');
  }
});


// ===== INLINE EXTRACTED (transactions.html) [2026-07-04 12:29] =====
import { getOrders } from './js/bstm-core.js';

<script>
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
// ============================================
