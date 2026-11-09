/**
 * BSTM Advanced Search System
 * Fuzzy search, filters, sorting
 */

const AdvancedSearch = {
    
    filters: {
        category: null,
        priceMin: null,
        priceMax: null,
        room: null,
        inStock: true,
        sortBy: 'relevance'
    },
    
    // Fuzzy search algorithm
    fuzzyMatch(text, pattern) {
        text = text.toLowerCase();
        pattern = pattern.toLowerCase();
        
        let patternIdx = 0;
        let score = 0;
        
        for (let i = 0; i < text.length; i++) {
            if (text[i] === pattern[patternIdx]) {
                score += 1;
                patternIdx++;
                
                if (patternIdx === pattern.length) {
                    return score;
                }
            }
        }
        
        return patternIdx === pattern.length ? score : 0;
    },
    
    // Search products with filters
    async search(query, filters = {}) {
        this.filters = { ...this.filters, ...filters };
        
        // TODO: Replace with Supabase query
        let results = await this.getMockProducts();
        
        // Apply fuzzy search
        if (query) {
            results = results.map(product => ({
                ...product,
                score: this.fuzzyMatch(product.name + ' ' + product.description, query)
            }))
            .filter(p => p.score > 0)
            .sort((a, b) => b.score - a.score);
        }
        
        // Apply filters
        results = this.applyFilters(results);
        
        // Apply sorting
        results = this.applySorting(results);
        
        return results;
    },
    
    applyFilters(products) {
        return products.filter(p => {
            if (this.filters.category && p.category !== this.filters.category) return false;
            if (this.filters.room && p.room_id !== this.filters.room) return false;
            if (this.filters.priceMin && p.price < this.filters.priceMin) return false;
            if (this.filters.priceMax && p.price > this.filters.priceMax) return false;
            if (this.filters.inStock && !p.available) return false;
            return true;
        });
    },
    
    applySorting(products) {
        const sortFunctions = {
            'relevance': (a, b) => (b.score || 0) - (a.score || 0),
            'price_low': (a, b) => a.price - b.price,
            'price_high': (a, b) => b.price - a.price,
            'newest': (a, b) => new Date(b.created_at) - new Date(a.created_at),
            'popular': (a, b) => (b.views || 0) - (a.views || 0),
            'rating': (a, b) => (b.rating || 0) - (a.rating || 0)
        };
        
        return products.sort(sortFunctions[this.filters.sortBy] || sortFunctions.relevance);
    },
    
    // Get search suggestions
    getSuggestions(query) {
        const suggestions = [
            'tomatoes',
            'spinach',
            'iPhone',
            'laptop',
            'shoes',
            'furniture',
            'electronics',
            'fresh produce'
        ];
        
        return suggestions
            .filter(s => s.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 5);
    },
    
    // Save recent searches
    saveRecentSearch(query) {
        let recent = JSON.parse(localStorage.getItem('bstm_recent_searches') || '[]');
        recent = [query, ...recent.filter(s => s !== query)].slice(0, 10);
        localStorage.setItem('bstm_recent_searches', JSON.stringify(recent));
    },
    
    getRecentSearches() {
        return JSON.parse(localStorage.getItem('bstm_recent_searches') || '[]');
    },
    
    async getMockProducts() {
        // Mock product data
        return [
            { id: 1, name: 'Fresh Tomatoes', category: 'Produce', room_id: 22, price: 50, available: true, views: 1247 },
            { id: 2, name: 'iPhone 13 Pro', category: 'Electronics', room_id: 18, price: 6500, available: true, views: 892 },
            { id: 3, name: 'Spinach Bundle', category: 'Produce', room_id: 22, price: 35, available: true, views: 645 }
        ];
    }
};

window.AdvancedSearch = AdvancedSearch;
