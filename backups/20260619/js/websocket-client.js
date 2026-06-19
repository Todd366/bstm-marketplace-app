/**
 * BSTM WebSocket Client
 * Real-time order updates, notifications
 */

const WebSocketClient = {
    ws: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    reconnectDelay: 1000,
    
    connect() {
        const user = BSTMAuth.getCurrentUser();
        if (!user) return;
        
        // Use Supabase Realtime
        if (typeof supabase !== 'undefined') {
            this.subscribeToRealtime(user.id);
        }
    },
    
    subscribeToRealtime(userId) {
        // Subscribe to order updates
        const orderChannel = supabase
            .channel('orders')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'orders',
                filter: `buyer_id=eq.${userId}`
            }, (payload) => {
                this.handleOrderUpdate(payload);
            })
            .subscribe();
        
        // Subscribe to notifications
        const notifChannel = supabase
            .channel('notifications')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${userId}`
            }, (payload) => {
                this.handleNotification(payload);
            })
            .subscribe();
        
        // Subscribe to THB transactions
        const thbChannel = supabase
            .channel('thb')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'thb_transactions',
                filter: `user_id=eq.${userId}`
            }, (payload) => {
                this.handleTHBUpdate(payload);
            })
            .subscribe();
    },
    
    handleOrderUpdate(payload) {
        const order = payload.new;
        
        // Update UI if on orders page
        if (window.location.pathname.includes('order-tracking')) {
            location.reload();
        }
        
        // Show notification
        if (order.status === 'delivered') {
            PushNotifications.orderDelivered(order.id);
        }
    },
    
    handleNotification(payload) {
        const notification = payload.new;
        
        // Update notification badge
        const badge = document.getElementById('notifBadge');
        if (badge) {
            const count = parseInt(badge.textContent) || 0;
            badge.textContent = count + 1;
            badge.classList.remove('hidden');
        }
        
        // Show push notification
        PushNotifications.showNotification(notification.title, {
            body: notification.message,
            data: { url: notification.link }
        });
    },
    
    handleTHBUpdate(payload) {
        const transaction = payload.new;
        
        // Update THB display
        THBDisplay.updateAllDisplays();
        
        // Show notification if earning
        if (transaction.type === 'earn') {
            PushNotifications.thbEarned(transaction.amount);
        }
    },
    
    disconnect() {
        if (typeof supabase !== 'undefined') {
            supabase.removeAllChannels();
        }
    }
};

// Auto-connect on page load
document.addEventListener('DOMContentLoaded', () => {
    if (BSTMAuth.isLoggedIn()) {
        WebSocketClient.connect();
    }
});

// Disconnect on page unload
window.addEventListener('beforeunload', () => {
    WebSocketClient.disconnect();
});

window.WebSocketClient = WebSocketClient;
