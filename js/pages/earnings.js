// js/pages/earnings.js
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
