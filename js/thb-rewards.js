* BSTM THB Rewards System
 * Automatically award THB for user actions
 */

const THBRewards = {
  
  // Reward rates (in THB)
  rates: {
    purchase: 0.01,        // 1% of purchase value
    cablink_ride: 0.8,     // Fixed per ride
    referral: 50,          // Per successful referral
    signup_bonus: 50,      // New user welcome
    daily_login: 0.1,      // Per day
    review: 0.5,           // Per product review
    streak_3day: 0.5,      // 3-day login streak
    streak_7day: 1.5,      // 7-day login streak
    streak_30day: 10,      // 30-day login streak
    room22_purchase: 0.015 // 1.5% for Room 22 products
  },
  
  // Award THB for purchase
  async rewardPurchase(orderId, amount, isRoom22 = false) {
    const rate = isRoom22 ? this.rates.room22_purchase : this.rates.purchase;
    const reward = amount * rate;
    
    const success = await THBDisplay.addTHB(
      reward,
      `Purchase reward - Order #${orderId}`
    );
    
    if (success) {
      this.logReward({
        type: 'purchase',
        amount: reward,
        metadata: { orderId, purchaseAmount: amount, isRoom22 }
      });
      
      // Check for milestone rewards
      this.checkMilestones();
    }
    
    return reward;
  },
  
  // Award THB for CabLink ride
  async rewardCabLinkRide(rideId, fare) {
    const reward = this.rates.cablink_ride;
    
    const success = await THBDisplay.addTHB(
      reward,
      `CabLink ride completed - ${rideId}`
    );
    
    if (success) {
      this.logReward({
        type: 'cablink',
        amount: reward,
        metadata: { rideId, fare }
      });
    }
    
    return reward;
  },
  
  // Award THB for referral
  async rewardReferral(referredUserId, referredUserEmail) {
    const reward = this.rates.referral;
    
    const success = await THBDisplay.addTHB(
      reward,
      `Referral bonus - ${referredUserEmail}`
    );
    
    if (success) {
      this.logReward({
        type: 'referral',
        amount: reward,
        metadata: { referredUserId, referredUserEmail }
      });
      
      // Update referral count
      this.incrementReferralCount();
    }
    
    return reward;
  },
  
  // Signup bonus
  async rewardSignup() {
    const reward = this.rates.signup_bonus;
    
    const success = await THBDisplay.addTHB(
      reward,
      '🎉 Welcome to BSTM! Signup bonus'
    );
    
    if (success) {
      this.logReward({
        type: 'signup',
        amount: reward,
        metadata: { timestamp: new Date().toISOString() }
      });
    }
    
    return reward;
  },
  
  // Daily login reward
  async rewardDailyLogin() {
    const lastLogin = localStorage.getItem('bstm_last_login_date');
    const today = new Date().toDateString();
    
    if (lastLogin === today) {
      return 0; // Already claimed today
    }
    
    const reward = this.rates.daily_login;
    
    const success = await THBDisplay.addTHB(
      reward,
      '📅 Daily login bonus'
    );
    
    if (success) {
      localStorage.setItem('bstm_last_login_date', today);
      this.updateLoginStreak();
      
      this.logReward({
        type: 'daily_login',
        amount: reward,
        metadata: { date: today }
      });
    }
    
    return reward;
  },
  
  // Update login streak
  updateLoginStreak() {
    const streakData = JSON.parse(localStorage.getItem('bstm_login_streak') || '{"count": 0, "lastDate": null}');
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    
    if (streakData.lastDate === yesterday) {
      // Continue streak
      streakData.count++;
    } else if (streakData.lastDate === today) {
      // Already counted today
      return;
    } else {
      // Streak broken
      streakData.count = 1;
    }
    
    streakData.lastDate = today;
    localStorage.setItem('bstm_login_streak', JSON.stringify(streakData));
    
    // Award streak bonuses
    if (streakData.count === 3) {
      THBDisplay.addTHB(this.rates.streak_3day, '🔥 3-day streak bonus!');
    } else if (streakData.count === 7) {
      THBDisplay.addTHB(this.rates.streak_7day, '🔥🔥 7-day streak bonus!');
    } else if (streakData.count === 30) {
      THBDisplay.addTHB(this.rates.streak_30day, '🔥🔥🔥 30-day streak bonus!');
    }
  },
  
  // Award THB for product review
  async rewardReview(productId, rating) {
    const reward = this.rates.review;
    
    const success = await THBDisplay.addTHB(
      reward,
      `Review reward - Product #${productId}`
    );
    
    if (success) {
      this.logReward({
        type: 'review',
        amount: reward,
        metadata: { productId, rating }
      });
    }
    
    return reward;
  },
  
  // Check and award milestone bonuses
  checkMilestones() {
    const user = BSTMAuth.getCurrentUser();
    if (!user) return;
    
    const milestones = JSON.parse(localStorage.getItem('bstm_milestones') || '{}');
    
    // First purchase
    if (!milestones.first_purchase) {
      THBDisplay.addTHB(5, '🎊 First purchase bonus!');
      milestones.first_purchase = true;
    }
    
    // 10 purchases
    const purchaseCount = this.getPurchaseCount();
    if (purchaseCount >= 10 && !milestones.ten_purchases) {
      THBDisplay.addTHB(25, '🏆 10 purchases milestone!');
      milestones.ten_purchases = true;
    }
    
    // 100 THB earned
    const lifetimeEarned = this.getLifetimeEarned();
    if (lifetimeEarned >= 100 && !milestones.hundred_thb) {
      THBDisplay.addTHB(10, '💯 100 THB earned milestone!');
      milestones.hundred_thb = true;
    }
    
    localStorage.setItem('bstm_milestones', JSON.stringify(milestones));
  },
  
  // Log reward
  logReward(reward) {
    let rewardLog = JSON.parse(localStorage.getItem('bstm_reward_log') || '[]');
    
    rewardLog.unshift({
      ...reward,
      timestamp: new Date().toISOString()
    });
    
    // Keep last 100 rewards
    rewardLog = rewardLog.slice(0, 100);
    
    localStorage.setItem('bstm_reward_log', JSON.stringify(rewardLog));
  },
  
  // Get reward history
  getRewardHistory(type = null) {
    const log = JSON.parse(localStorage.getItem('bstm_reward_log') || '[]');
    
    if (type) {
      return log.filter(r => r.type === type);
    }
    
    return log;
  },
  
  // Get purchase count
  getPurchaseCount() {
    const rewards = this.getRewardHistory('purchase');
    return rewards.length;
  },
  
  // Get lifetime earned
  getLifetimeEarned() {
    const log = JSON.parse(localStorage.getItem('bstm_reward_log') || '[]');
    return log.reduce((sum, r) => sum + r.amount, 0);
  },
  
  // Increment referral count
  incrementReferralCount() {
    const user = BSTMAuth.getCurrentUser();
    if (!user) return;
    
    const referralCount = parseInt(localStorage.getItem('bstm_referral_count') || '0');
    localStorage.setItem('bstm_referral_count', (referralCount + 1).toString());
  },
  
  // Get referral count
  getReferralCount() {
    return parseInt(localStorage.getItem('bstm_referral_count') || '0');
  }
};

// Auto-award daily login on page load
document.addEventListener('DOMContentLoaded', () => {
  if (BSTMAuth.isLoggedIn()) {
    THBRewards.rewardDailyLogin();
  }
});

// Export
window.THBRewards = THBRewards;
