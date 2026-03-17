/**
 * BSTM Share API
 * Native sharing functionality
 */

const ShareAPI = {
    
    async shareProduct(product) {
        const shareData = {
            title: product.name,
            text: `Check out ${product.name} on BSTM Marketplace for P${product.price}`,
            url: `${window.location.origin}/product-detail.html?id=${product.id}`
        };
        
        return await this.share(shareData);
    },
    
    async shareReferralCode(code) {
        const shareData = {
            title: 'Join BSTM Digital Nation',
            text: `Join BSTM and get 50 THB! Use my referral code: ${code}`,
            url: `${window.location.origin}/login.html?ref=${code}`
        };
        
        return await this.share(shareData);
    },
    
    async shareOrder(orderId) {
        const shareData = {
            title: 'My BSTM Order',
            text: `Track my order #${orderId} on BSTM`,
            url: `${window.location.origin}/order-tracking.html?id=${orderId}`
        };
        
        return await this.share(shareData);
    },
    
    async share(data) {
        if (navigator.share) {
            try {
                await navigator.share(data);
                return true;
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Share error:', error);
                    this.fallbackShare(data);
                }
                return false;
            }
        } else {
            this.fallbackShare(data);
            return false;
        }
    },
    
    fallbackShare(data) {
        // Fallback: Copy to clipboard
        const text = `${data.title}\n\n${data.text}\n\n${data.url}`;
        
        navigator.clipboard.writeText(text).then(() => {
            alert('Link copied to clipboard!');
        }).catch(() => {
            // Final fallback: Show modal with text
            this.showShareModal(text);
        });
    },
    
    showShareModal(text) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl p-8 max-w-md w-full">
                <h3 class="text-2xl font-bold text-gray-800 mb-4">Share</h3>
                <textarea readonly class="w-full px-4 py-3 border-2 border-gray-300 rounded-xl mb-4 h-32">${text}</textarea>
                <div class="flex space-x-3">
                    <button onclick="navigator.clipboard.writeText(\`${text}\`); this.textContent='Copied!'" class="flex-1 bg-purple-600 text-white py-3 rounded-xl font-semibold">
                        Copy Text
                    </button>
                    <button onclick="this.closest('.fixed').remove()" class="flex-1 bg-gray-200 text-gray-800 py-3 rounded-xl font-semibold">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
    }
};

window.ShareAPI = ShareAPI;
