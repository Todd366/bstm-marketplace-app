/**
 * BSTM Multi-Language System
 * English & Setswana support
 */

const MultiLanguage = {
    currentLanguage: 'en',
    
    translations: {
        en: {
            // Navigation
            'nav.marketplace': 'Marketplace',
            'nav.farm': 'Farm',
            'nav.cablink': 'CabLink',
            'nav.wallet': 'THB Wallet',
            'nav.help': 'Help',
            
            // Common
            'common.search': 'Search',
            'common.login': 'Login',
            'common.signup': 'Sign Up',
            'common.logout': 'Logout',
            'common.cart': 'Cart',
            'common.checkout': 'Checkout',
            'common.buy': 'Buy Now',
            'common.add_to_cart': 'Add to Cart',
            'common.price': 'Price',
            'common.total': 'Total',
            'common.submit': 'Submit',
            'common.cancel': 'Cancel',
            
            // Products
            'product.available': 'Available',
            'product.out_of_stock': 'Out of Stock',
            'product.view_details': 'View Details',
            'product.category': 'Category',
            
            // Orders
            'order.pending': 'Pending',
            'order.processing': 'Processing',
            'order.shipped': 'Shipped',
            'order.delivered': 'Delivered',
            'order.track': 'Track Order',
            
            // THB
            'thb.earn': 'Earn THB',
            'thb.balance': 'Balance',
            'thb.rewards': 'Rewards',
            'thb.withdraw': 'Withdraw',
            
            // Messages
            'msg.welcome': 'Welcome to BSTM',
            'msg.order_placed': 'Order placed successfully!',
            'msg.added_to_cart': 'Added to cart',
            'msg.error': 'An error occurred',
            'msg.success': 'Success!'
        },
        
        tn: {
            // Navigation (Setswana)
            'nav.marketplace': 'Mmaraka',
            'nav.farm': 'Polasi',
            'nav.cablink': 'CabLink',
            'nav.wallet': 'Mokotla wa THB',
            'nav.help': 'Thuso',
            
            // Common
            'common.search': 'Batla',
            'common.login': 'Tsena',
            'common.signup': 'Kwadisa',
            'common.logout': 'Tswa',
            'common.cart': 'Koloi',
            'common.checkout': 'Duela',
            'common.buy': 'Reka Jaanong',
            'common.add_to_cart': 'Tsenya mo Koloeng',
            'common.price': 'Tlotlego',
            'common.total': 'Palomoka',
            'common.submit': 'Romela',
            'common.cancel': 'Khansela',
            
            // Products
            'product.available': 'E Teng',
            'product.out_of_stock': 'Ga e Yo',
            'product.view_details': 'Bona Dintlha',
            'product.category': 'Mofuta',
            
            // Orders
            'order.pending': 'E Emetse',
            'order.processing': 'E Dirwa',
            'order.shipped': 'E Rometswe',
            'order.delivered': 'E Isitswe',
            'order.track': 'Latela Taelo',
            
            // THB
            'thb.earn': 'Bona THB',
            'thb.balance': 'Palogotlhe',
            'thb.rewards': 'Diputswa',
            'thb.withdraw': 'Ntsha',
            
            // Messages
            'msg.welcome': 'O amogelwa kwa BSTM',
            'msg.order_placed': 'Taelo e romeletswe!',
            'msg.added_to_cart': 'E tsenngwe mo koloeng',
            'msg.error': 'Go diragaditse phoso',
            'msg.success': 'Go atlega!'
        }
    },
    
    // Initialize
    init() {
        // Load saved language preference
        const saved = localStorage.getItem('bstm_language');
        if (saved) {
            this.currentLanguage = saved;
        }
        
        // Apply translations
        this.applyTranslations();
        
        // Add language switcher
        this.addLanguageSwitcher();
    },
    
    // Get translation
    t(key) {
        return this.translations[this.currentLanguage][key] || key;
    },
    
    // Switch language
    setLanguage(lang) {
        if (!this.translations[lang]) {
            console.error('Language not supported:', lang);
            return;
        }
        
        this.currentLanguage = lang;
        localStorage.setItem('bstm_language', lang);
        this.applyTranslations();
        
        // Reload page to apply changes
        location.reload();
    },
    
    // Apply translations to page
    applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = this.t(key);
        });
        
        // Translate placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            element.placeholder = this.t(key);
        });
    },
    
    // Add language switcher to nav
    addLanguageSwitcher() {
        const switcher = document.createElement('div');
        switcher.className = 'flex items-center space-x-2';
        switcher.innerHTML = `
            <button onclick="MultiLanguage.setLanguage('en')" 
                    class="px-3 py-1 rounded ${this.currentLanguage === 'en' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700'}">
                EN
            </button>
            <button onclick="MultiLanguage.setLanguage('tn')" 
                    class="px-3 py-1 rounded ${this.currentLanguage === 'tn' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700'}">
                TN
            </button>
        `;
        
        // Add to navigation
        const nav = document.querySelector('.bstm-nav-desktop');
        if (nav) {
            nav.appendChild(switcher);
        }
    }
};

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
    MultiLanguage.init();
});

window.MultiLanguage = MultiLanguage;
