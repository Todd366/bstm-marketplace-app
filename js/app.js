// BSTM Marketplace - Main Application
// v1.1.0 - Phone Built

console.log('🇧🇼 BSTM Marketplace Loading...');

// Configuration
const CONFIG = {
  APP_NAME: 'BSTM Marketplace',
  VERSION: '1.1.0',
  THB_CONTRACT: '0xaf2f749ea89b3aa9a2d2028dba4004cb3c615628',
  NETWORK_MAP: 'https://todd366.github.io/bstm-ecosystem-network/',
  CABLINK_URL: 'https://cablink.bstm.bw'
};

// State Management
const AppState = {
  user: null,
  cart: [],
  products: [],
  isOnline: navigator.onLine,
  selectedRoom: null
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ DOM Loaded');
  
  // Register Service Worker
  registerServiceWorker();
  
  // Load products
  loadProducts();
  
  // Setup event listeners
  setupEventListeners();
  
  // Check online status
  setupOnlineDetection();
  
  // Load cart from localStorage
  loadCart();
  
  // Update live stats
  updateLiveStats();
  setInterval(updateLiveStats, 60000);
});

// Service Worker Registration
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('✅ Service Worker registered:', registration);
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
    }
  }
}

// Load Products (Mock Data - Replace with Supabase)
function loadProducts() {
  // TODO: Replace with Supabase query
  const mockProducts = [
    {
      id: 1,
      title: 'Fresh Tomatoes (5kg)',
      description: 'Organic, locally grown from Room 22 Farm',
      price: 50,
      thb_price: 0.5,
      category: 'Fresh Produce',
      room_id: 22,
      image: 'https://via.placeholder.com/400x300/4ade80/ffffff?text=Tomatoes',
      seller: 'Room 22 Farm',
      location: 'Gaborone',
      verified: true
    },
    {
      id: 2,
      title: 'iPhone 13 Pro Max',
      description: '256GB, Pacific Blue, Excellent condition',
      price: 6500,
      thb_price: 65,
      category: 'Electronics',
      room_id: 18,
      image: 'https://via.placeholder.com/400x300/3b82f6/ffffff?text=iPhone',
      seller: 'Tech Hub BW',
      location: 'Gaborone',
      verified: true
    },
    {
      id: 3,
      title: 'Leather Sofa Set',
      description: '3-seater, Premium quality',
      price: 8900,
      thb_price: 89,
      category: 'Home & Garden',
      room_id: 18,
      image: 'https://via.placeholder.com/400x300/10b981/ffffff?text=Sofa',
      seller: 'Home Decor Ltd',
      location: 'Maun',
      verified: true
    },
    {
      id: 4,
      title: 'Professional Photography',
      description: 'Events & portraits, 5 years experience',
      price: 1200,
      thb_price: 12,
      category: 'Services',
      room_id: 18,
      image: 'https://via.placeholder.com/400x300/f59e0b/ffffff?text=Photography',
      seller: 'CaptureBW',
      location: 'Gaborone',
      verified: true
    }
  ];
  
  AppState.products = mockProducts;
  renderProducts(mockProducts);
}

// Render Products
function renderProducts(products) {
  const grid = document.getElementById('productGrid');
  if (!grid) return;
  
  grid.innerHTML = products.map(product => `
    <div class="bg-white rounded-2xl border overflow-hidden card-hover">
      <img src="${product.image}" alt="${product.title}" class="w-full h-64 object-cover">
      <div class="p-5">
        <span class="thb-badge text-gray-800 text-xs font-bold px-3 py-1 rounded-full">
          <i class="fas fa-coins mr-1"></i>Earn ${product.thb_price} THB
        </span>
        ${product.room_id === 22 ? '<span class="bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded ml-2">Room 22</span>' : ''}
        <h3 class="font-bold text-lg mt-2">${product.title}</h3>
        <p class="text-gray-600 text-sm mb-3">${product.description}</p>
        <div class="flex justify-between items-center mb-4">
          <span class="text-2xl font-bold">P${product.price}</span>
          <span class="text-sm text-purple-600">or ${product.thb_price} THB</span>
        </div>
        <button onclick="addToCart(${product.id})" class="w-full gradient-bg text-white py-3 rounded-lg font-semibold">
          <i class="fas fa-shopping-cart mr-2"></i>Add to Cart
        </button>
      </div>
    </div>
  `).join('');
}

// Add to Cart
function addToCart(productId) {
  const product = AppState.products.find(p => p.id === productId);
  if (!product) return;
  
  AppState.cart.push(product);
  saveCart();
  showToast(`${product.title} added to cart!`);
  
  // Vibrate if supported
  if (navigator.vibrate) {
    navigator.vibrate(50);
  }
}

// Save Cart to localStorage
function saveCart() {
  localStorage.setItem('bstm_cart', JSON.stringify(AppState.cart));
}

// Load Cart from localStorage
function loadCart() {
  const saved = localStorage.getItem('bstm_cart');
  if (saved) {
    AppState.cart = JSON.parse(saved);
  }
}

// Show Toast Notification
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `fixed top-20 right-4 bg-${type === 'success' ? 'green' : 'red'}-500 text-white px-6 py-3 rounded-lg shadow-lg z-50`;
  toast.innerHTML = `<i class="fas fa-check-circle mr-2"></i>${message}`;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Update Live Stats
function updateLiveStats() {
  const users = Math.floor(Math.random() * 100) + 1200;
  const userCountEl = document.getElementById('liveUserCount');
  if (userCountEl) {
    userCountEl.textContent = users.toLocaleString();
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Room Selector
  const roomSelector = document.getElementById('roomSelector');
  if (roomSelector) {
    roomSelector.addEventListener('change', (e) => {
      const roomId = e.target.value;
      if (roomId) {
        const filtered = AppState.products.filter(p => p.room_id == roomId);
        renderProducts(filtered);
      } else {
        renderProducts(AppState.products);
      }
    });
  }
  
  // Voice Search (if supported)
  const voiceBtn = document.getElementById('voiceSearch');
  if (voiceBtn && 'webkitSpeechRecognition' in window) {
    voiceBtn.addEventListener('click', startVoiceSearch);
  }
}

// Voice Search
function startVoiceSearch() {
  const recognition = new webkitSpeechRecognition();
  recognition.lang = 'en-US';
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.value = transcript;
    }
    showToast(`Searching for: ${transcript}`);
  };
  recognition.start();
}

// Online/Offline Detection
function setupOnlineDetection() {
  window.addEventListener('online', () => {
    AppState.isOnline = true;
    document.getElementById('offlineNotice').style.display = 'none';
    showToast('Back online!', 'success');
  });
  
  window.addEventListener('offline', () => {
    AppState.isOnline = false;
    document.getElementById('offlineNotice').style.display = 'block';
    showToast('You are offline', 'error');
  });
}

// Export for global access
window.addToCart = addToCart;
window.AppState = AppState;

console.log('✅ BSTM Marketplace Loaded');
