// Queue actions when offline
const OfflineQueue = {
    queue: [],
    
    add(action) {
        this.queue.push(action);
        localStorage.setItem('bstm_offline_queue', JSON.stringify(this.queue));
    },
    
    async processQueue() {
        if (!navigator.onLine) return;
        
        while (this.queue.length > 0) {
            const action = this.queue.shift();
            try {
                await this.executeAction(action);
            } catch (error) {
                console.error('Failed to process queued action:', error);
            }
        }
        
        localStorage.setItem('bstm_offline_queue', JSON.stringify(this.queue));
    },
    
    async executeAction(action) {
        switch (action.type) {
            case 'create_order':
                await SupabaseAPI.createOrder(action.data);
                break;
            case 'claim_thb':
                await THBRewards.rewardPurchase(action.orderId, action.amount);
                break;
        }
    }
};

window.addEventListener('online', () => OfflineQueue.processQueue());
