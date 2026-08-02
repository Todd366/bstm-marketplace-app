// AUDIT_IGNORE
// js/pages/earnings.js
window.BSTM.ready().then(function(session) {
  if (!session) {
    window.location.href='login.html';
    return;
  }

  var mock=[
    {type:'Purchase Reward',amount:1.5,date:'2025-07-01'},
    {type:'CabLink Ride',amount:0.8,date:'2025-07-02'},
    {type:'Referral Bonus',amount:5.0,date:'2025-07-03'}
  ];

  var total=mock.reduce(function(s,e){return s+e.amount;},0);

  var t=document.getElementById('total-earnings');
  var l=document.getElementById('earnings-list');

  if(t) t.textContent=total.toFixed(2)+' THB';

  if(l){
    l.innerHTML=mock.map(function(e){
      return '<div class="earning-row"><span>'+e.type+'</span>'
      +'<span style="color:#059669;font-weight:700;">+'+e.amount.toFixed(2)+' THB</span>'
      +'<span style="color:#9CA3AF;">'+e.date+'</span></div>';
    }).join('');
  }
});


// ===== INLINE EXTRACTED (earnings.html) [2026-07-04 12:29] =====
import { getProfile } from './js/bstm-core.js';

<script>
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
    // Estimate BWP earnings from THB (1 THB = 10 BWP / 0.01 rate = 100x)
    var estEarnings = thb * 10 * 0.95;
    document.getElementById('total-earnings').textContent = estEarnings.toFixed(2);
    document.getElementById('commission-paid').textContent = 'P' + (estEarnings * 0.05 / 0.95).toFixed(2);
  }
});
// ============================================
