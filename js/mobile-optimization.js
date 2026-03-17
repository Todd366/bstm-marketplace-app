/**
 * BSTM Mobile Optimization
 * Responsive navigation, PWA install prompts, mobile gestures
 */

const MobileOptimization = {
  
  // Initialize mobile features
  init() {
    this.setupMobileMenu();
    this.setupPWAInstall();
    this.setupTouchGestures();
    this.setupResponsiveImages();
  },
  
  // Setup mobile menu
  setupMobileMenu() {
    // Already handled in universal-nav.html
    // Just add swipe gesture to close
    
    const mobileMenu = document.getElementById('mobileMenu');
    if (!mobileMenu) return;
    
    let startX = 0;
    
    mobileMenu.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
    });
    
    mobileMenu.addEventListener('touchend', (e) => {
      const endX = e.changedTouches[0].clientX;
      const diff = startX - endX;
      
      // Swipe left to close
      if (diff > 100) {
        closeMobileMenu();
      }
    });
  },
  
  // Setup PWA install prompt
  setupPWAInstall() {
    let deferredPrompt;
    
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      
      // Show install banner
      this.showInstallBanner(deferredPrompt);
    });
    
    // Check if already installed
    window.addEventListener('appinstalled', () => {
      console.log('BSTM PWA installed successfully');
      localStorage.setItem('bstm_pwa_installed', 'true');
    });
    
    // Check if running as PWA
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      console.log('Running as PWA');
      document.body.classList.add('pwa-mode');
    }
  },
  
  // Show PWA install banner
  showInstallBanner(deferredPrompt) {
    // Don't show if already dismissed or installed
    if (localStorage.getItem('bstm_pwa_dismissed') || localStorage.getItem('bstm_pwa_installed')) {
      return;
    }
    
    const banner = document.createElement('div');
    banner.id = 'pwaInstallBanner';
    banner.className = 'fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-2xl shadow-2xl p-6 z-50 border-2 border-purple-600';
    banner.innerHTML = `
      <div class="flex items-start justify-between mb-4">
        <div class="flex items-center space-x-3">
          <div class="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center">
            <span class="text-white font-bold text-xl">B</span>
          </div>
          <div>
            <p class="font-bold text-gray-800">Install BSTM App</p>
            <p class="text-sm text-gray-600">Get the full experience</p>
          </div>
        </div>
        <button onclick="dismissPWABanner()" class="text-gray-400 hover:text-gray-600">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <p class="text-sm text-gray-700 mb-4">
        Install BSTM on your device for:
      </p>
      <ul class="text-sm text-gray-700 mb-4 space-y-1">
        <li>✓ Offline access</li>
        <li>✓ Push notifications</li>
        <li>✓ Faster loading</li>
        <li>✓ Home screen access</li>
      </ul>
      <div class="flex space-x-3">
        <button onclick="installPWA()" class="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold">
          Install Now
        </button>
        <button onclick="dismissPWABanner()" class="px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold">
          Later
        </button>
      </div>
    `;
    
    document.body.appendChild(banner);
    
    // Store prompt for later
    window.deferredPWAPrompt = deferredPrompt;
  },
  
  // Setup touch gestures
  setupTouchGestures() {
    // Pull to refresh (disabled to prevent conflicts)
    document.body.addEventListener('touchmove', (e) => {
      if (e.touches[0].clientY > 0 && window.scrollY === 0) {
        // At top of page, could enable pull-to-refresh here
      }
    }, { passive: true });
    
    // Add haptic feedback to buttons
    const buttons = document.querySelectorAll('button, a');
    buttons.forEach(btn => {
      btn.addEventListener('touchstart', () => {
        if (navigator.vibrate) {
          navigator.vibrate(10); // Subtle haptic feedback
        }
      }, { passive: true });
    });
  },
  
  // Setup responsive images
  setupResponsiveImages() {
    const images = document.querySelectorAll('img[data-src]');
    
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            imageObserver.unobserve(img);
          }
        });
      });
      
      images.forEach(img => imageObserver.observe(img));
    } else {
      // Fallback for older browsers
      images.forEach(img => {
        img.src = img.dataset.src;
      });
    }
  }
};

// Global functions for PWA install
function installPWA() {
  const deferredPrompt = window.deferredPWAPrompt;
  if (!deferredPrompt) return;
  
  deferredPrompt.prompt();
  
  deferredPrompt.userChoice.then((choiceResult) => {
    if (choiceResult.outcome === 'accepted') {
      console.log('User accepted PWA install');
      localStorage.setItem('bstm_pwa_installed', 'true');
    }
    window.deferredPWAPrompt = null;
    dismissPWABanner();
  });
}

function dismissPWABanner() {
  const banner = document.getElementById('pwaInstallBanner');
  if (banner) {
    banner.remove();
    localStorage.setItem('bstm_pwa_dismissed', 'true');
  }
}

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
  MobileOptimization.init();
});

// Export for global use
window.MobileOptimization = MobileOptimization;
