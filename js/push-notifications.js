/**
 * BSTM Push Notifications System
 */

const PushNotifications = {
    
    async requestPermission() {
        if (!('Notification' in window)) {
            console.log('Push notifications not supported');
            return false;
        }
        
        if (Notification.permission === 'granted') {
            return true;
        }
        
        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
        
        return false;
    },
    
    async showNotification(title, options = {}) {
        const hasPermission = await this.requestPermission();
        
        if (!hasPermission) {
            console.log('Notification permission denied');
            return;
        }
        
        const defaultOptions = {
            badge: '/assets/icons/icon-96.png',
            icon: '/assets/icons/icon-192.png',
            vibrate: [200, 100, 200],
            tag: 'bstm-notification',
            requireInteraction: false,
            ...options
        };
        
        // Use service worker if available
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(title, defaultOptions);
            });
        } else {
            // Fallback to regular notification
            new Notification(title, defaultOptions);
        }
    },
    
    // Notification templates
    orderDelivered(orderNumber) {
        this.showNotification('Order Delivered! 🎉', {
            body: `Your order #${orderNumber} has been delivered`,
            icon: '/assets/icons/delivery.png',
            data: { url: `order-tracking.html?id=${orderNumber}` },
            actions: [
                { action: 'view', title: 'View Order' },
                { action: 'close', title: 'Close' }
            ]
        });
    },
    
    thbEarned(amount) {
        this.showNotification('THB Earned! 💰', {
            body: `You earned ${amount} THB from your recent activity`,
            icon: '/assets/icons/thb.png',
            data: { url: 'thb-wallet.html' },
            actions: [
                { action: 'view', title: 'View Wallet' },
                { action: 'close', title: 'Close' }
            ]
        });
    },
    
    newMessage(sender, preview) {
        this.showNotification(`New message from ${sender}`, {
            body: preview,
            icon: '/assets/icons/message.png',
            data: { url: 'messages.html' },
            tag: 'message-notification',
            actions: [
                { action: 'reply', title: 'Reply' },
                { action: 'view', title: 'View' }
            ]
        });
    },
    
    productBackInStock(productName) {
        this.showNotification('Product Back in Stock! 🛍️', {
            body: `${productName} is now available`,
            icon: '/assets/icons/product.png',
            data: { url: 'index.html' },
            actions: [
                { action: 'buy', title: 'Buy Now' },
                { action: 'close', title: 'Close' }
            ]
        });
    },
    
    kycApproved() {
        this.showNotification('KYC Approved! ✅', {
            body: 'Your seller account has been verified. Start selling now!',
            icon: '/assets/icons/verified.png',
            data: { url: 'seller-dashboard.html' },
            requireInteraction: true
        });
    }
};

// Handle notification clicks
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'notification-click') {
            window.location.href = event.data.url;
        }
    });
}

window.PushNotifications = PushNotifications;
