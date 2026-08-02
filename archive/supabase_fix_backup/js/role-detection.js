/**
 * BSTM Role Detection & Auto-Redirect System
 * Automatically routes users to the correct dashboard based on their role
 */

const BSTMRoles = {
  
  // Detect user role and redirect
  autoRedirect() {
    const user = BSTMAuth.getCurrentUser();
    if (!user) {
      // Not logged in
      const publicPages = [
        '', 
        'index.html', 
        'login.html', 
        'help.html', 
        'terms.html',
        'product-detail.html',
        'room22-farm.html'
      ];
      
      const currentPage = window.location.pathname.split('/').pop();
      
      if (!publicPages.includes(currentPage)) {
        // Redirect to login with return URL
        const returnUrl = encodeURIComponent(window.location.href);
        window.location.href = `login.html?return=${returnUrl}`;
      }
      
      return;
    }
    
    // User is logged in - check if they're on a dashboard page
    const currentPage = window.location.pathname.split('/').pop();
    const dashboardPages = [
      'buyer-dashboard.html',
      'seller-dashboard.html',
      'gov-dashboard.html'
    ];
    
    if (dashboardPages.includes(currentPage)) {
      // Check if user has access to this dashboard
      this.enforceRoleAccess(currentPage, user.role);
    }
  },
  
  // Enforce role-based access
  enforceRoleAccess(page, userRole) {
    const rolePages = {
      'buyer-dashboard.html': ['buyer', 'seller', 'admin'],
      'seller-dashboard.html': ['seller', 'admin'],
      'gov-dashboard.html': ['admin']
    };
    
    const allowedRoles = rolePages[page] || [];
    
    if (!allowedRoles.includes(userRole)) {
      // User doesn't have access - redirect to their correct dashboard
      this.redirectToCorrectDashboard(userRole);
    }
  },
  
  // Redirect to correct dashboard based on role
  redirectToCorrectDashboard(role) {
    const dashboards = {
      'buyer': 'buyer-dashboard.html',
      'seller': 'seller-dashboard.html',
      'admin': 'gov-dashboard.html'
    };
    
    const targetDashboard = dashboards[role] || 'buyer-dashboard.html';
    const currentPage = window.location.pathname.split('/').pop();
    
    if (currentPage !== targetDashboard) {
      window.location.href = targetDashboard;
    }
  },
  
  // Check if user has specific permission
  hasPermission(permission) {
    const user = BSTMAuth.getCurrentUser();
    if (!user) return false;
    
    const rolePermissions = {
      'admin': ['*'], // All permissions
      'seller': ['view_products', 'create_product', 'edit_own_product', 'view_orders', 'view_analytics'],
      'buyer': ['view_products', 'create_order', 'view_own_orders']
    };
    
    const userPermissions = rolePermissions[user.role] || [];
    
    return userPermissions.includes('*') || userPermissions.includes(permission);
  },
  
  // Show/hide elements based on role
  applyRoleVisibility() {
    const user = BSTMAuth.getCurrentUser();
    if (!user) return;
    
    // Hide admin-only elements
    const adminOnly = document.querySelectorAll('[data-role="admin"]');
    adminOnly.forEach(el => {
      if (user.role !== 'admin') {
        el.style.display = 'none';
      }
    });
    
    // Hide seller-only elements
    const sellerOnly = document.querySelectorAll('[data-role="seller"]');
    sellerOnly.forEach(el => {
      if (user.role !== 'seller' && user.role !== 'admin') {
        el.style.display = 'none';
      }
    });
    
    // Show role-specific nav items
    this.updateNavForRole(user.role);
  },
  
  // Update navigation based on role
  updateNavForRole(role) {
    // Add role-specific links to nav
    const navContainer = document.querySelector('.bstm-nav-desktop');
    if (!navContainer) return;
    
    if (role === 'seller' || role === 'admin') {
      // Add "Sell" link for sellers
      const sellLink = document.createElement('a');
      sellLink.href = 'seller-dashboard.html';
      sellLink.className = 'flex items-center space-x-2 hover:text-yellow-300 transition-colors';
      sellLink.innerHTML = '<span>📊</span><span>My Sales</span>';
      
      const helpLink = navContainer.querySelector('a[href="help.html"]');
      if (helpLink) {
        navContainer.insertBefore(sellLink, helpLink);
      }
    }
    
    if (role === 'admin') {
      // Highlight government link for admins
      const govLink = navContainer.querySelector('a[href="gov-dashboard.html"]');
      if (govLink) {
        govLink.classList.add('bg-red-600', 'px-3', 'py-1', 'rounded-lg');
      }
    }
  }
};

// Auto-run on page load
document.addEventListener('DOMContentLoaded', () => {
  BSTMRoles.autoRedirect();
  BSTMRoles.applyRoleVisibility();
});

// Export for global use
window.BSTMRoles = BSTMRoles;
