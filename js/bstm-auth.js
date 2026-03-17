/**
 * BSTM DIGITAL NATION - AUTHENTICATION SYSTEM
 * Single Sign-On across all 63 rooms
 * Version: 2.0
 */

const BSTMAuth = {
  
  // Check if user is logged in
  isLoggedIn() {
    const user = localStorage.getItem('bstm_user');
    const session = localStorage.getItem('bstm_session');
    
    if (!user || !session) return false;
    
    // Check session expiry (7 days)
    const sessionTime = parseInt(session);
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    
    if (now - sessionTime > sevenDays) {
      this.logout();
      return false;
    }
    
    return true;
  },
  
  // Get current user
  getCurrentUser() {
    const user = localStorage.getItem('bstm_user');
    return user ? JSON.parse(user) : null;
  },
  
  // Login user
  async login(email, password) {
    try {
      // TODO: Replace with real Supabase auth
      // For now, mock login
      
      const userData = {
        id: 'user_' + Date.now(),
        email: email,
        name: email.split('@')[0],
        role: 'buyer', // buyer, seller, or admin
        thb_balance: 0,
        verified: false,
        avatar: 'https://via.placeholder.com/100',
        created_at: new Date().toISOString()
      };
      
      localStorage.setItem('bstm_user', JSON.stringify(userData));
      localStorage.setItem('bstm_session', Date.now().toString());
      
      return { success: true, user: userData };
      
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Register user
  async register(name, email, password, role = 'buyer') {
    try {
      // TODO: Replace with real Supabase registration
      
      const userData = {
        id: 'user_' + Date.now(),
        email: email,
        name: name,
        role: role,
        thb_balance: 50, // Welcome bonus
        verified: false,
        avatar: 'https://via.placeholder.com/100',
        created_at: new Date().toISOString()
      };
      
      localStorage.setItem('bstm_user', JSON.stringify(userData));
      localStorage.setItem('bstm_session', Date.now().toString());
      
      return { success: true, user: userData };
      
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Logout user
  logout() {
    localStorage.removeItem('bstm_user');
    localStorage.removeItem('bstm_session');
    localStorage.removeItem('bstm_cart');
    window.location.href = 'login.html';
  },
  
  // Update user data
  updateUser(updates) {
    const user = this.getCurrentUser();
    if (!user) return false;
    
    const updatedUser = { ...user, ...updates };
    localStorage.setItem('bstm_user', JSON.stringify(updatedUser));
    return true;
  },
  
  // Check user role
  hasRole(role) {
    const user = this.getCurrentUser();
    return user && user.role === role;
  },
  
  // Redirect based on role
  redirectByRole() {
    const user = this.getCurrentUser();
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    
    switch(user.role) {
      case 'admin':
        window.location.href = 'gov-dashboard.html';
        break;
      case 'seller':
        window.location.href = 'seller-dashboard.html';
        break;
      default:
        window.location.href = 'buyer-dashboard.html';
    }
  },
  
  // Require authentication
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname);
    }
  },
  
  // Require specific role
  requireRole(role) {
    this.requireAuth();
    const user = this.getCurrentUser();
    if (user.role !== role) {
      alert('Access denied. You need ' + role + ' privileges.');
      this.redirectByRole();
    }
  }
};

// Auto-protect pages (run on every page load)
document.addEventListener('DOMContentLoaded', () => {
  // Public pages that don't need auth
  const publicPages = [
    'index.html',
    'login.html',
    'help.html',
    'terms.html',
    'product-detail.html',
    ''
  ];
  
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  
  // If not public page and not logged in, redirect to login
  if (!publicPages.includes(currentPage)) {
    BSTMAuth.requireAuth();
  }
  
  // Load user info in nav if logged in
  if (BSTMAuth.isLoggedIn()) {
    loadUserInfoIntoNav();
  }
});

// Load user data into navigation
function loadUserInfoIntoNav() {
  const user = BSTMAuth.getCurrentUser();
  if (!user) return;
  
  // Update nav elements
  const nameEl = document.getElementById('navUserName');
  const emailEl = document.getElementById('navUserEmail');
  const avatarEl = document.getElementById('navUserAvatar');
  const thbEl = document.getElementById('navTHBBalance');
  
  if (nameEl) nameEl.textContent = user.name;
  if (emailEl) emailEl.textContent = user.email;
  if (avatarEl && user.avatar) avatarEl.src = user.avatar;
  if (thbEl) thbEl.textContent = (user.thb_balance || 0).toFixed(1);
}

// Export for global use
window.BSTMAuth = BSTMAuth;
