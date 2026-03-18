/**
 * BSTM ECOSYSTEM LINKS
 * Central registry of all BSTM properties
 */

const BSTMEcosystem = {
    
    // All BSTM Properties
    properties: {
        // Core Platforms
        marketplace: {
            name: 'BSTM Marketplace',
            url: 'https://todd366.github.io/bstm-marketplace-app/',
            description: 'Main e-commerce platform',
            room: 18,
            status: 'active',
            icon: '🏪'
        },
        
        cablink: {
            name: 'CabLink PWA',
            url: 'https://todd366.github.io/CabLink-pwa/',
            description: 'Ride-booking platform with THB rewards',
            room: 'CabLink',
            status: 'active',
            icon: '🚗'
        },
        
        // THoBoCoin Platforms
        thobocoin: {
            name: 'THoBoCoin Hub',
            url: 'https://thobocoin-project-frontend.vercel.app/',
            description: 'THB token management and staking',
            room: 'THB',
            status: 'active',
            icon: '💰'
        },
        
        // Business & Analytics
        businessHub: {
            name: 'Business Hub',
            url: 'https://business-hub-bstm.vercel.app/',
            description: 'Business management platform',
            room: 'Business',
            status: 'active',
            icon: '📊'
        },
        
        flowLedger: {
            name: 'FlowLedger Analytics',
            url: 'https://bstm-flowledger-92bt.vercel.app/',
            description: 'Analytics and financial tracking',
            room: 'Analytics',
            status: 'active',
            icon: '📈'
        },
        
        // Network & Maps
        ecosystemNetwork: {
            name: 'Ecosystem Network Map',
            url: 'https://todd366.github.io/bstm-ecosystem-network/',
            description: 'Visual map of all BSTM connections',
            room: 'Network',
            status: 'active',
            icon: '🗺️'
        },
        
        systemMap: {
            name: 'System Architecture Map',
            url: 'https://todd366.github.io/bstm-system-map/',
            description: 'Technical architecture overview',
            room: 'System',
            status: 'active',
            icon: '🏗️'
        },
        
        // Landing Pages
        mainSite: {
            name: 'BSTM Main Website',
            url: 'https://todd366.github.io/',
            description: 'Official BSTM homepage',
            room: 'Home',
            status: 'active',
            icon: '🏠'
        },
        
        figSite: {
            name: 'BSTM Hello Fig',
            url: 'https://bstm.hellofigwebsite.com/',
            description: 'Marketing and information site',
            room: 'Marketing',
            status: 'active',
            icon: '📢'
        },
        
        bstmX: {
            name: 'BSTM-X Platform',
            url: 'https://bstm-x.vercel.app/',
            description: 'Experimental features platform',
            room: 'Labs',
            status: 'beta',
            icon: '🧪'
        },
        
        // Social & Communication
        telegram: {
            name: 'BSTM Telegram Bot',
            url: 'https://t.me/Todd366Bot',
            description: 'Automated BSTM assistant',
            room: 'Support',
            status: 'active',
            icon: '🤖'
        },
        
        signals: {
            name: 'BSTM Signals',
            url: 'https://t.me/bstm_signals',
            description: 'Real-time updates and alerts',
            room: 'Alerts',
            status: 'active',
            icon: '📡'
        },
        
        facebook: {
            name: 'BSTM Facebook',
            url: 'https://www.facebook.com/BotswanaonlineNew',
            description: 'Social media community',
            room: 'Social',
            status: 'active',
            icon: '📱'
        },
        
        linkedin: {
            name: 'BSTM LinkedIn',
            url: 'https://www.linkedin.com/in/bstm-dept',
            description: 'Professional network',
            room: 'Professional',
            status: 'active',
            icon: '💼'
        }
    },
    
    // Get all active platforms
    getActivePlatforms() {
        return Object.entries(this.properties)
            .filter(([key, prop]) => prop.status === 'active')
            .map(([key, prop]) => ({ key, ...prop }));
    },
    
    // Get platforms by category
    getPlatformsByCategory() {
        return {
            core: ['marketplace', 'cablink', 'thobocoin'],
            business: ['businessHub', 'flowLedger'],
            network: ['ecosystemNetwork', 'systemMap'],
            landing: ['mainSite', 'figSite', 'bstmX'],
            social: ['telegram', 'signals', 'facebook', 'linkedin']
        };
    },
    
    // Generate ecosystem navigation
    generateNavigation() {
        const categories = this.getPlatformsByCategory();
        const html = [];
        
        Object.entries(categories).forEach(([category, keys]) => {
            const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
            html.push(`<div class="mb-6">`);
            html.push(`<h3 class="text-lg font-bold text-gray-700 mb-3">${categoryName}</h3>`);
            html.push(`<div class="grid grid-cols-1 md:grid-cols-2 gap-3">`);
            
            keys.forEach(key => {
                const platform = this.properties[key];
                html.push(`
                    <a href="${platform.url}" target="_blank" 
                       class="flex items-center space-x-3 p-3 bg-white rounded-lg shadow hover:shadow-lg transition-all border-2 border-transparent hover:border-purple-300">
                        <span class="text-3xl">${platform.icon}</span>
                        <div class="flex-1">
                            <p class="font-semibold text-gray-800">${platform.name}</p>
                            <p class="text-xs text-gray-600">${platform.description}</p>
                        </div>
                        <i class="fas fa-external-link-alt text-gray-400"></i>
                    </a>
                `);
            });
            
            html.push(`</div></div>`);
        });
        
        return html.join('');
    },
    
    // Quick access widget
    createQuickAccessWidget() {
        const quickLinks = ['marketplace', 'cablink', 'thobocoin', 'telegram'];
        
        const widget = document.createElement('div');
        widget.id = 'bstm-quick-access';
        widget.className = 'fixed bottom-4 right-4 z-50';
        widget.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl p-4 w-64">
                <div class="flex items-center justify-between mb-4">
                    <h4 class="font-bold text-gray-800">Quick Access</h4>
                    <button onclick="document.getElementById('bstm-quick-access').classList.add('hidden')" 
                            class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="space-y-2">
                    ${quickLinks.map(key => {
                        const platform = this.properties[key];
                        return `
                            <a href="${platform.url}" target="_blank" 
                               class="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-all">
                                <span class="text-xl">${platform.icon}</span>
                                <span class="text-sm font-semibold text-gray-800">${platform.name}</span>
                            </a>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
        
        return widget;
    },
    
    // Get referral link with tracking
    getReferralLink(platform, referralCode) {
        const baseUrl = this.properties[platform]?.url;
        if (!baseUrl) return null;
        
        return `${baseUrl}?ref=${referralCode}`;
    },
    
    // Track cross-platform navigation
    trackNavigation(from, to) {
        if (typeof gtag !== 'undefined') {
            gtag('event', 'platform_navigation', {
                from_platform: from,
                to_platform: to,
                timestamp: new Date().toISOString()
            });
        }
    }
};

window.BSTMEcosystem = BSTMEcosystem;
