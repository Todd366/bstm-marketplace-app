 * BSTM Referral System
 * Track referrals, generate codes, award bonuses
 */

const ReferralSystem = {
  
  // Generate unique referral code
  generateReferralCode(userId) {
    const prefix = 'BSTM';
    const hash = userId.substr(-6).toUpperCase();
    return `${prefix}-${hash}`;
  },
  
  // Store referral code for user
  setReferralCode(code) {
    const user = BSTMAuth.getCurrentUser();
    if (!user) return false;
    
    BSTMAuth.updateUser({ referral_code: code });
    return true;
  },
  
  // Get user's referral code
  getReferralCode() {
    const user = BSTMAuth.getCurrentUser();
    if (!user) return null;
    
    if (!user.referral_code) {
      const code = this.generateReferralCode(user.id);
      this.setReferralCode(code);
      return code;
    }
    
    return user.referral_code;
  },
  
  // Apply referral code during signup
  applyReferralCode(code) {
    // Store code to apply after signup
    sessionStorage.setItem('bstm_referral_code', code);
    return true;
  },
  
  // Process referral after signup
  async processReferralAfterSignup(newUserId, newUserEmail) {
    const referralCode = sessionStorage.getItem('bstm_referral_code');
    if (!referralCode) return false;
    
    // Find referrer by code
    // TODO: Replace with Supabase query
    // For now, store locally
    
    const referral = {
      referrer_code: referralCode,
      referred_user_id: newUserId,
      referred_user_email: newUserEmail,
      status: 'completed',
      reward_amount: 50,
      timestamp: new Date().toISOString()
    };
    
    // Store referral
    this.storeReferral(referral);
    
    // Award referrer (this would be done via webhook in production)
    // For demo, we'll simulate
    this.notifyReferrer(referralCode, newUserEmail);
    
    // Clear stored code
    sessionStorage.removeItem('bstm_referral_code');
    
    return true;
  },
  
  // Store referral record
  storeReferral(referral) {
    let referrals = JSON.parse(localStorage.getItem('bstm_referrals') || '[]');
    referrals.unshift(referral);
    localStorage.setItem('bstm_referrals', JSON.stringify(referrals));
  },
  
  // Get user's referrals
  getUserReferrals() {
    const user = BSTMAuth.getCurrentUser();
    if (!user || !user.referral_code) return [];
    
    const allReferrals = JSON.parse(localStorage.getItem('bstm_referrals') || '[]');
    return allReferrals.filter(r => r.referrer_code === user.referral_code);
  },
  
  // Get referral stats
  getReferralStats() {
    const referrals = this.getUserReferrals();
    
    return {
      total: referrals.length,
      completed: referrals.filter(r => r.status === 'completed').length,
      pending: referrals.filter(r => r.status === 'pending').length,
      totalEarned: referrals.reduce((sum, r) => sum + r.reward_amount, 0)
    };
  },
  
  // Notify referrer of new signup
  notifyReferrer(referralCode, newUserEmail) {
    // In production, this would trigger a notification
    console.log(`Referrer with code ${referralCode} earned 50 THB from ${newUserEmail}`);
    
    // Simulate adding to notification queue
    const notification = {
      type: 'referral_success',
      title: 'New Referral! 🎉',
      message: `${newUserEmail} joined using your code. You earned 50 THB!`,
      timestamp: new Date().toISOString(),
      read: false
    };
    
    let notifications = JSON.parse(localStorage.getItem('bstm_notifications') || '[]');
    notifications.unshift(notification);
    localStorage.setItem('bstm_notifications', JSON.stringify(notifications));
  },
  
  // Generate referral link
  getReferralLink() {
    const code = this.getReferralCode();
    if (!code) return null;
    
    const baseUrl = window.location.origin;
    return `${baseUrl}/login.html?ref=${code}`;
  },
  
  // Share referral
  async shareReferral() {
    const code = this.getReferralCode();
    const link = this.getReferralLink();
    
    const shareData = {
      title: 'Join BSTM Digital Nation',
      text: `Join Botswana's first Digital Nation and get 50 THB! Use my referral code: ${code}`,
      url: link
    };
    
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return true;
      } catch (err) {
        console.log('Share cancelled');
        return false;
      }
    } else {
      // Fallback: copy to clipboard
      const fullText = `${shareData.text}\n\n${shareData.url}`;
      await navigator.clipboard.writeText(fullText);
      alert('Referral link copied to clipboard!');
      return true;
    }
  },
  
  // Get leaderboard
  getReferralLeaderboard() {
    // TODO: Implement Supabase query for global leaderboard
    // For now, return mock data
    return [
      { rank: 1, name: 'Thobo M.', referrals: 127, earned: '6,350 THB' },
      { rank: 2, name: 'Mpho K.', referrals: 89, earned: '4,450 THB' },
      { rank: 3, name: 'Lesego R.', referrals: 56, earned: '2,800 THB' },
      { rank: 4, name: 'You', referrals: this.getUserReferrals().length, earned: this.getReferralStats().totalEarned + ' THB' }
    ];
  }
};

// Check for referral code in URL on page load
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get('ref');
  
  if (refCode) {
    ReferralSystem.applyReferralCode(refCode);
    
    // Show referral message
    const banner = document.createElement('div');
    banner.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-xl shadow-2xl z-50';
    banner.innerHTML = `
      <p class="font-bold">🎉 Referral Code Applied!</p>
      <p class="text-sm">Sign up now to get 50 THB bonus</p>
    `;
    document.body.appendChild(banner);
    
    setTimeout(() => banner.remove(), 5000);
  }
});

// Export
window.ReferralSystem = ReferralSystem;
