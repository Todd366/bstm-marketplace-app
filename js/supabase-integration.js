/**
 * BSTM SUPABASE INTEGRATION
 * Replace localStorage with real database
 */

// Initialize Supabase client
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

let supabase;

// Load Supabase client
async function initSupabase() {
    if (typeof window.supabase === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        document.head.appendChild(script);
        
        await new Promise(resolve => script.onload = resolve);
    }
    
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabase;
}

const SupabaseAPI = {
    
    // === AUTH ===
    
    async signUp(email, password, metadata) {
        await initSupabase();
        
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: metadata
            }
        });
        
        if (error) throw error;
        
        // Create user profile
        await this.createUserProfile(data.user.id, metadata);
        
        return data;
    },
    
    async signIn(email, password) {
        await initSupabase();
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        // Load user profile
        const profile = await this.getUserProfile(data.user.id);
        
        return { ...data, profile };
    },
    
    async signOut() {
        await initSupabase();
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    },
    
    async getCurrentUser() {
        await initSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
            const profile = await this.getUserProfile(user.id);
            return { ...user, ...profile };
        }
        
        return null;
    },
    
    // === USER PROFILES ===
    
    async createUserProfile(userId, data) {
        const { error } = await supabase
            .from('users')
            .insert({
                id: userId,
                name: data.name,
                email: data.email,
                role: data.role || 'buyer',
                thb_balance: 50, // Welcome bonus
                referral_code: 'BSTM-' + userId.substr(-6).toUpperCase(),
                created_at: new Date().toISOString()
            });
        
        if (error) throw error;
    },
    
    async getUserProfile(userId) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) throw error;
        return data;
    },
    
    async updateUserProfile(userId, updates) {
        const { error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', userId);
        
        if (error) throw error;
    },
    
    // === PRODUCTS ===
    
    async getProducts(filters = {}) {
        let query = supabase
            .from('products')
            .select('*')
            .eq('available', true);
        
        if (filters.category) {
            query = query.eq('category', filters.category);
        }
        
        if (filters.room_id) {
            query = query.eq('room_id', filters.room_id);
        }
        
        if (filters.search) {
            query = query.ilike('title', `%${filters.search}%`);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        return data;
    },
    
    async getProduct(productId) {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();
        
        if (error) throw error;
        return data;
    },
    
    async createProduct(productData) {
        const { data, error } = await supabase
            .from('products')
            .insert(productData)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },
    
    async updateProduct(productId, updates) {
        const { error } = await supabase
            .from('products')
            .update(updates)
            .eq('id', productId);
        
        if (error) throw error;
    },
    
    // === ORDERS ===
    
    async createOrder(orderData) {
        const { data, error } = await supabase
            .from('orders')
            .insert(orderData)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },
    
    async getOrders(userId) {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('buyer_id', userId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data;
    },
    
    async updateOrderStatus(orderId, status) {
        const { error } = await supabase
            .from('orders')
            .update({ status })
            .eq('id', orderId);
        
        if (error) throw error;
    },
    
    // === THB TRANSACTIONS ===
    
    async addTHB(userId, amount, reason) {
        // Update user balance
        const { data: user } = await supabase
            .from('users')
            .select('thb_balance')
            .eq('id', userId)
            .single();
        
        const newBalance = (user.thb_balance || 0) + amount;
        
        await supabase
            .from('users')
            .update({ thb_balance: newBalance })
            .eq('id', userId);
        
        // Log transaction
        await supabase
            .from('thb_transactions')
            .insert({
                user_id: userId,
                type: 'earn',
                amount: amount,
                reason: reason,
                balance_after: newBalance
            });
        
        return newBalance;
    },
    
    async spendTHB(userId, amount, reason) {
        // Get current balance
        const { data: user } = await supabase
            .from('users')
            .select('thb_balance')
            .eq('id', userId)
            .single();
        
        if (user.thb_balance < amount) {
            throw new Error('Insufficient THB balance');
        }
        
        const newBalance = user.thb_balance - amount;
        
        await supabase
            .from('users')
            .update({ thb_balance: newBalance })
            .eq('id', userId);
        
        // Log transaction
        await supabase
            .from('thb_transactions')
            .insert({
                user_id: userId,
                type: 'spend',
                amount: amount,
                reason: reason,
                balance_after: newBalance
            });
        
        return newBalance;
    },
    
    async getTHBTransactions(userId) {
        const { data, error } = await supabase
            .from('thb_transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(100);
        
        if (error) throw error;
        return data;
    },
    
    // === REFERRALS ===
    
    async createReferral(referrerCode, referredUserId) {
        const { error } = await supabase
            .from('referrals')
            .insert({
                referrer_code: referrerCode,
                referred_user_id: referredUserId,
                status: 'completed',
                reward_amount: 50
            });
        
        if (error) throw error;
        
        // Award referrer
        const { data: referrer } = await supabase
            .from('users')
            .select('id')
            .eq('referral_code', referrerCode)
            .single();
        
        if (referrer) {
            await this.addTHB(referrer.id, 50, 'Referral bonus');
        }
    },
    
    async getReferrals(userId) {
        const { data: user } = await supabase
            .from('users')
            .select('referral_code')
            .eq('id', userId)
            .single();
        
        const { data, error } = await supabase
            .from('referrals')
            .select('*')
            .eq('referrer_code', user.referral_code)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data;
    }
};

// Export for global use
window.SupabaseAPI = SupabaseAPI;

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
});
