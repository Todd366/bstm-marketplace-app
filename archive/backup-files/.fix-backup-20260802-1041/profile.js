// AUDIT_IGNORE
// js/pages/profile.js
window.BSTM.ready().then(function(session){
  if(!session){
    window.location.href='login.html';
    return;
  }

  var u=session.user;

  var n=document.getElementById('profile-name');
  var e=document.getElementById('profile-email');
  var a=document.getElementById('profile-avatar');

  if(n) n.textContent=u.email.split('@')[0];
  if(e) e.textContent=u.email;
  if(a) a.textContent=u.email.charAt(0).toUpperCase();
});

window.logout=function(){
  if(confirm('Logout?')){
    window.BSTM.logout();
  }
};


// ===== INLINE EXTRACTED (profile.html) [2026-07-04 12:29] =====
import { getProfile, updateProfile } from './js/bstm-core.js';

var currentUser = null;

window.BSTM.ready().then(async function(session) {
  if (!session) {
    document.getElementById('auth-wall').style.display = 'block';
    return;
  }
  document.getElementById('profile-content').style.display = 'block';
  currentUser = session.user;

  var name = session.user.email.split('@')[0];
  document.getElementById('avatar-letter').textContent = name.charAt(0).toUpperCase();
  document.getElementById('profile-name').textContent = name;
  document.getElementById('profile-email').textContent = session.user.email;
  document.getElementById('edit-email').value = session.user.email;

  var { data: profile } = await getProfile(session.user.id);
  if (profile) {
    document.getElementById('profile-thb').textContent = (profile.thb_balance || 0).toFixed(2) + ' THB';
    document.getElementById('profile-role').textContent = profile.role || 'buyer';
    if (profile.full_name) {
      document.getElementById('edit-name').value = profile.full_name;
      document.getElementById('profile-name').textContent = profile.full_name;
      document.getElementById('avatar-letter').textContent = profile.full_name.charAt(0).toUpperCase();
    }
  }
});

document.getElementById('profile-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  if (!currentUser) return;
  var status = document.getElementById('save-status');
  var updates = {
    full_name: document.getElementById('edit-name').value
  };
  var { error } = await updateProfile(currentUser.id, updates);
  status.style.display = 'block';
  if (error) {
    status.style.background = '#FEE2E2';
    status.style.color = '#991B1B';
    status.textContent = '❌ Failed to save: ' + error.message;
  } else {
    status.style.background = '#DCFCE7';
    status.style.color = '#166534';
    status.textContent = '✅ Profile updated successfully!';
    if (updates.full_name) {
      document.getElementById('profile-name').textContent = updates.full_name;
      document.getElementById('avatar-letter').textContent = updates.full_name.charAt(0).toUpperCase();
    }
  }
  setTimeout(function(){ status.style.display = 'none'; }, 3000);
});
// ============================================


// ===== INLINE EXTRACTED (profile.html) [2026-07-04 12:29] =====
let →</a>
    </div>

    <!-- Edit profile form -->
    <div style="background:#fff;border-radius:20px;padding:24px;border:1px solid #EDE9FE;margin-bottom:16px;">
      <h2 style="font-size:16px;font-weight:900;color:#1E1B4B;margin-bottom:16px;">Edit Profile</h2>
      <div id="save-status" style="display:none;padding:12px;border-radius:10px;font-weight:600;font-size:13px;margin-bottom:16px;"></div>
      <form id="profile-form">
        <div class="field">
          <label>Full Name</label>
          <input type="text" id="edit-name" placeholder="Your full name">
        </div>
        <div class="field">
          <label>Email (cannot change)</label>
          <input type="email" id="edit-email" disabled style="background:#F9FAFB;color:#9CA3AF;">
        </div>
        <div class="field">
          <label>Phone Number</label>
          <input type="tel" id="edit-phone" placeholder="+267 XX XXX XXX">
        </div>
        <div class="field">
          <label>Location</label>
          <select id="edit-location">
            <option value="">Select City</option>
            <option value="Gaborone">Gaborone</option>
            <option value="Francistown">Francistown</option>
            <option value="Maun">Maun</option>
            <option value="Molepolole">Molepolole</option>
            <option value="Kasane">Kasane</option>
            <option value="Palapye">Palapye</option>
          </select>
        </div>
        <button type="submit" style="width:100%;background:linear-gradient(135deg,#7C3AED,#4F46E5);color:#fff;border:none;padding:14px;border-radius:12px;font-weight:800;cursor:pointer;font-size:15px;">Save Changes</button>
      </form>
    </div>

    <!-- Quick links -->
    <div style="background:#fff;border-radius:20px;padding:20px;border:1px solid #EDE9FE;">
      <h2 style="font-size:14px;font-weight:900;color:#1E1B4B;margin-bottom:14px;">Quick Links</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <a href="buyer-dashboard.html" style="background:#F5F3FF;color:#7C3AED;padding:12px;border-radius:12px;font-weight:700;text-decoration:none;font-size:13px;text-align:center;">🏠 Dashboard</a>
        <a href="settings.html" style="background:#F5F3FF;color:#7C3AED;padding:12px;border-radius:12px;font-weight:700;text-decoration:none;font-size:13px;text-align:center;">⚙️ Settings</a>
        <a href="kyc-verification.html" style="background:#F0FDF4;color:#166534;padding:12px;border-radius:12px;font-weight:700;text-decoration:none;font-size:13px;text-align:center;">✅ KYC Verify</a>
        <a href="order-tracking.html" style="background:#EFF6FF;color:#1D4ED8;padding:12px;border-radius:12px;font-weight:700;text-decoration:none;font-size:13px;text-align:center;">📦 Orders</a>
      </div>
    </div>
  </div>
</div>

<div id="bstm-footer"></div>
// ============================================
