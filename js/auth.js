// BSTM Nation SSO - One login, everywhere access

const BSTMAuth = {
  // Check if user is logged in
  isLoggedIn() {
    return localStorage.getItem('bstm_user') !== null;
  },
  
  // Get current user
  getCurrentUser() {
    const user = localStorage.getItem('bstm_user');
    return user ? JSON.parse(user) : null;
  },
  
  // Login user
  login(userData) {
    localStorage.setItem('bstm_user', JSON.stringify(userData));
    localStorage.setItem('bstm_session', Date.now());
  },
  
  // Logout user
  logout() {
    localStorage.removeItem('bstm_user');
    localStorage.removeItem('bstm_session');
    window.location.href = 'login.html';
  },
  
  // Redirect based on role
  redirectByRole() {
    const user = this.getCurrentUser();
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    
    if (user.role === 'admin') {
      window.location.href = 'gov-dashboard.html';
    } else if (user.role === 'seller') {
      window.location.href = 'seller-dashboard.html';
    } else {
      window.location.href = 'buyer-dashboard.html';
    }
  }
};

// Auto-check login on every page
document.addEventListener('DOMContentLoaded', () => {
  const publicPages = ['index.html', 'login.html', 'help.html', 'terms.html'];
  const currentPage = window.location.pathname.split('/').pop();
  
  if (!publicPages.includes(currentPage) && !BSTMAuth.isLoggedIn()) {
    window.location.href = 'login.html';
  }
});
