/**
 * BSTM Multi-Language System
 * English & Setswana support
 */

const MultiLanguage = {
    currentLanguage: 'en',
    
    translations: {
        en: {
            // Navigation
            'nav.home': 'Home',
            'nav.marketplace': 'Marketplace',
            'nav.farm': 'Farm',
            'nav.cablink': 'CabLink',
            'nav.wallet': 'THB Wallet',
            'nav.help': 'Help',
            
            // Common
            'common.search': 'Search',
            'common.login': 'Login',
            'common.signup': 'Sign Up',
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
            'nav.home': 'Gae',
            'nav.marketplace': 'Mmaraka',
            'nav.farm': 'Polasi',
            'nav.cablink': 'CabLink',
            'nav.wallet': 'Mokotla wa THB',
            'nav.help': 'Thuso',
            
            // Common
            'common.search': 'Batla',
            'common.login': 'Tsena',
            'common.signup': 'Kwadisa',
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

        // Highlight the active language button (real markup lives in nav.html,
        // outside the desktop-only nav, so it stays visible on mobile too)
        this.updateSwitcherState();
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
        this.updateSwitcherState();
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

    updateSwitcherState() {
        const enBtn = document.getElementById('lang-en-btn');
        const tnBtn = document.getElementById('lang-tn-btn');
        if (!enBtn || !tnBtn) return;
        const active = 'background:#7C3AED;color:#fff;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700;';
        const inactive = 'background:#F3F4F6;color:#374151;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700;';
        enBtn.style.cssText = this.currentLanguage === 'en' ? active : inactive;
        tnBtn.style.cssText = this.currentLanguage === 'tn' ? active : inactive;
    }
};

// Auto-initialize once the nav (loaded async by smart-loader.js) is in the DOM
document.addEventListener('DOMContentLoaded', () => {
    let attempts = 0;
    const tryInit = () => {
        attempts++;
        if (document.getElementById('lang-en-btn')) {
            MultiLanguage.init();
        } else if (attempts < 50) {
            setTimeout(tryInit, 100);
        }
    };
    tryInit();
});

window.MultiLanguage = MultiLanguage;
