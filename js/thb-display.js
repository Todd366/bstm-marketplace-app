/**
 * BSTM THB Display System
 * Real-time THB balance display across all pages
 */

const THBDisplay = {
  
  // Initialize THB displays on page
  init() {
    this.updateAllDisplays();
    
    // Auto-refresh every 30 seconds
    setInterval(() => {
      this.updateAllDisplays();
    }, 30000);
    
    // Listen for THB changes
    window.addEventListener('thb-updated', () => {
      this.updateAllDisplays();
    });
  },
  
  // Update all THB displays on page
  updateAllDisplays() {
    const user = BSTMAuth.getCurrentUser();
    if (!user) return;
    
    const balance = user.thb_balance || 0;
    
    // Update nav balance
    const navBalance = document.getElementById('navTHBBalance');
    if (navBalance) {
      navBalance.textContent = balance.toFixed(1);
    }
    
    // Update any other THB displays
    const thbDisplays = document.querySelectorAll('[data-thb-display]');
    thbDisplays.forEach(display => {
      display.textContent = balance.toFixed(1);
    });
  },
  
  // Add THB to user's balance
  async addTHB(amount, reason = 'Manual addition') {
    const user = BSTMAuth.getCurrentUser();
    if (!user) return false;
    
    const newBalance = (user.thb_balance || 0) + amount;
    
    // Update user object
    BSTMAuth.updateUser({ thb_balance: newBalance });
    
    // Log transaction
    this.logTransaction({
      type: 'earn',
      amount: amount,
      reason: reason,
      balance_after: newBalance,
      timestamp: new Date().toISOString()
    });
    
    // Trigger update event
    window.dispatchEvent(new Event('thb-updated'));
    
    // Show notification
    this.showTHBNotification(amount, 'earned');
    
    // TODO: Update Supabase
    
    return true;
  },
  
  // Subtract THB from user's balance
  async spendTHB(amount, reason = 'Purchase') {
    const user = BSTMAuth.getCurrentUser();
    if (!user) return false;
    
    const currentBalance = user.thb_balance || 0;
    
    if (currentBalance < amount) {
      alert('Insufficient THB balance');
      return false;
    }
    
    const newBalance = currentBalance - amount;
    
    // Update user object
    BSTMAuth.updateUser({ thb_balance: newBalance });
    
    // Log transaction
    this.logTransaction({
      type: 'spend',
      amount: amount,
      reason: reason,
      balance_after: newBalance,
      timestamp: new Date().toISOString()
    });
    
    // Trigger update event
    window.dispatchEvent(new Event('thb-updated'));
    
    // Show notification
    this.showTHBNotification(amount, 'spent');
    
    // TODO: Update Supabase
    
    return true;
  },
  
  // Log THB transaction
  logTransaction(transaction) {
    // Get existing transactions
    let transactions = JSON.parse(localStorage.getItem('bstm_thb_transactions') || '[]');
    
    // Add new transaction
    transactions.unshift(transaction);
    
    // Keep only last 100 transactions
    transactions = transactions.slice(0, 100);
    
    // Save back
    localStorage.setItem('bstm_thb_transactions', JSON.stringify(transactions));
  },
  
  // Get THB transaction history
  getTransactionHistory() {
    return JSON.parse(localStorage.getItem('bstm_thb_transactions') || '[]');
  },
  
  // Show THB notification
  showTHBNotification(amount, type) {
    const notification = document.createElement('div');
    notification.className = `fixed top-20 right-4 bg-${type === 'earned' ? 'green' : 'red'}-500 text-white px-6 py-4 rounded-xl shadow-2xl z-50 flex items-center space-x-3`;
    notification.innerHTML = `
      <i class="fas fa-coins text-2xl"></i>
      <div>
        <p class="font-bold">${type === 'earned' ? '+' : '-'}${amount.toFixed(1)} THB</p>
        <p class="text-sm">${type === 'earned' ? 'Earned' : 'Spent'}</p>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      notification.remove();
    }, 3000);
  },
  
  // Convert BWP to THB
  bwpToTHB(bwp) {
    const conversionRate = 0.1; // 1 THB = ~10 BWP
    return bwp * conversionRate;
  },
  
  // Convert THB to BWP
  thbToBWP(thb) {
    const conversionRate = 10; // 1 THB = ~10 BWP
    return thb * conversionRate;
  },
  
  // Format currency display
  formatCurrency(amount, currency = 'BWP') {
    if (currency === 'BWP') {
      return `P${amount.toLocaleString('en-BW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (currency === 'THB') {
      return `${amount.toFixed(1)} THB`;
    }
  }
};

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  THBDisplay.init();
});

// Export for global use
window.THBDisplay = THBDisplay;
