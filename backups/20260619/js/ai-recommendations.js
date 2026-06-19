/**
 * BSTM AI Recommendations Engine
 * Simple collaborative filtering for product recommendations
 */

const AIRecommendations = {
    
    // User behavior tracking
    trackView(productId) {
        let views = JSON.parse(localStorage.getItem('bstm_product_views') || '[]');
        views.push({
            productId,
            timestamp: Date.now(),
            userId: BSTMAuth.getCurrentUser()?.id
        });
        
        // Keep last 100 views
        views = views.slice(-100);
        localStorage.setItem('bstm_product_views', JSON.stringify(views));
    },
    
    trackPurchase(productId, category) {
        let purchases = JSON.parse(localStorage.getItem('bstm_purchases') || '[]');
        purchases.push({
            productId,
            category,
            timestamp: Date.now()
        });
        
        localStorage.setItem('bstm_purchases', JSON.stringify(purchases));
    },
    
    // Get personalized recommendations
    async getRecommendations(limit = 6) {
        const views = JSON.parse(localStorage.getItem('bstm_product_views') || '[]');
        const purchases = JSON.parse(localStorage.getItem('bstm_purchases') || '[]');
        
        // Get user's favorite categories
        const categoryScores = {};
        
        purchases.forEach(p => {
            categoryScores[p.category] = (categoryScores[p.category] || 0) + 2;
        });
        
        views.forEach(v => {
            // TODO: Get product category from database
            const category = 'general';
            categoryScores[category] = (categoryScores[category] || 0) + 1;
        });
        
        // Sort categories by score
        const topCategories = Object.entries(categoryScores)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([category]) => category);
        
        // TODO: Query Supabase for products in top categories
        // For now, return mock recommendations
        return this.getMockRecommendations(limit);
    },
    
    getMockRecommendations(limit) {
        const mockProducts = [
            { id: 1, name: 'Fresh Tomatoes', category: 'Room 22', price: 50, image: 'tomatoes.jpg' },
            { id: 2, name: 'iPhone 13', category: 'Electronics', price: 6500, image: 'iphone.jpg' },
            { id: 3, name: 'Spinach Bundle', category: 'Room 22', price: 35, image: 'spinach.jpg' },
            { id: 4, name: 'Leather Sofa', category: 'Furniture', price: 8900, image: 'sofa.jpg' },
            { id: 5, name: 'Running Shoes', category: 'Fashion', price: 450, image: 'shoes.jpg' },
            { id: 6, name: 'Coffee Maker', category: 'Appliances', price: 750, image: 'coffee.jpg' }
        ];
        
        return mockProducts.slice(0, limit);
    },
    
    // Trending products based on recent views
    async getTrending(limit = 10) {
        // TODO: Query Supabase for most viewed products in last 7 days
        return this.getMockRecommendations(limit);
    },
    
    // "Customers who bought X also bought Y"
    async getSimilarProducts(productId, limit = 4) {
        // TODO: Implement collaborative filtering with Supabase
        return this.getMockRecommendations(limit);
    },
    
    // Products frequently bought together
    async getBundleRecommendations(cartItems) {
        // Analyze cart and suggest complementary items
        const categories = [...new Set(cartItems.map(item => item.category))];
        
        // TODO: Find products that complement current cart
        return this.getMockRecommendations(3);
    },
    
    // Smart search with typo correction
    correctSearchTerm(term) {
        const commonMisspellings = {
            'tomatoe': 'tomato',
            'spinnach': 'spinach',
            'cabbege': 'cabbage',
            'iphone': 'iPhone',
            'cloths': 'clothes'
        };
        
        return commonMisspellings[term.toLowerCase()] || term;
    }
};

window.AIRecommendations = AIRecommendations;
