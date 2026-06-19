/**
 * BSTM Dark Mode System
 * Theme toggle with persistence
 */

const DarkMode = {
  
  // Initialize dark mode
  init() {
    // Check saved preference
    const savedTheme = localStorage.getItem('bstm_theme') || 'light';
    this.setTheme(savedTheme);
    
    // Add toggle button to nav if not exists
    this.addToggleButton();
  },
  
  // Set theme
  setTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('bg-gray-900', 'text-white');
      document.body.classList.remove('bg-gray-50', 'text-gray-900');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('bg-gray-900', 'text-white');
      document.body.classList.add('bg-gray-50', 'text-gray-900');
    }
    
    localStorage.setItem('bstm_theme', theme);
    
    // Update toggle button icon
    this.updateToggleButton(theme);
  },
  
  // Toggle theme
  toggle() {
    const currentTheme = localStorage.getItem('bstm_theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  },
  
  // Add toggle button to nav
  addToggleButton() {
    const navActions = document.querySelector('.bstm-nav-desktop .flex.items-center.space-x-4');
    if (!navActions || document.getElementById('darkModeToggle')) return;
    
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'darkModeToggle';
    toggleBtn.className = 'hover:bg-purple-800 p-2 rounded-lg transition-all';
    toggleBtn.onclick = () => this.toggle();
    
    const searchBtn = navActions.querySelector('button');
    if (searchBtn) {
      navActions.insertBefore(toggleBtn, searchBtn);
    }
    
    this.updateToggleButton(localStorage.getItem('bstm_theme') || 'light');
  },
  
  // Update toggle button icon
  updateToggleButton(theme) {
    const toggleBtn = document.getElementById('darkModeToggle');
    if (!toggleBtn) return;
    
    if (theme === 'dark') {
      toggleBtn.innerHTML = '<i class="fas fa-sun text-yellow-300"></i>';
    } else {
      toggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
    }
  }
};

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
  DarkMode.init();
});

// Export for global use
window.DarkMode = DarkMode;

// Add dark mode CSS classes
const darkModeStyles = `
  .dark {
    --bg-primary: #1a202c;
    --bg-secondary: #2d3748;
    --text-primary: #f7fafc;
    --text-secondary: #e2e8f0;
  }
  
  .dark .bg-white {
    background-color: #2d3748 !important;
  }
  
  .dark .text-gray-800,
  .dark .text-gray-900 {
    color: #e2e8f0 !important;
  }
  
  .dark .text-gray-600 {
    color: #cbd5e0 !important;
  }
  
  .dark .border-gray-200,
  .dark .border-gray-300 {
    border-color: #4a5568 !important;
  }
  
  .dark .bg-gray-50,
  .dark .bg-gray-100 {
    background-color: #374151 !important;
  }
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = darkModeStyles;
document.head.appendChild(styleSheet);
