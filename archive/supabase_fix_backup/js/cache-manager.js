/**
 * BSTM Cache Manager
 * Intelligent caching for offline & speed
 */

const CacheManager = {
    cacheName: 'bstm-cache-v2.0',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    
    // Cache strategies
    strategies: {
        CACHE_FIRST: 'cache-first',
        NETWORK_FIRST: 'network-first',
        CACHE_ONLY: 'cache-only',
        NETWORK_ONLY: 'network-only'
    },
    
    // Cache data with metadata
    async set(key, data, strategy = this.strategies.CACHE_FIRST) {
        const cacheData = {
            data: data,
            timestamp: Date.now(),
            strategy: strategy
        };
        
        try {
            const cache = await caches.open(this.cacheName);
            const response = new Response(JSON.stringify(cacheData));
            await cache.put(key, response);
        } catch (error) {
            console.error('Cache set error:', error);
        }
    },
    
    // Get cached data
    async get(key) {
        try {
            const cache = await caches.open(this.cacheName);
            const response = await cache.match(key);
            
            if (!response) return null;
            
            const cacheData = await response.json();
            
            // Check if expired
            if (Date.now() - cacheData.timestamp > this.maxAge) {
                await cache.delete(key);
                return null;
            }
            
            return cacheData.data;
        } catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    },
    
    // Fetch with cache strategy
    async fetchWithCache(url, strategy = this.strategies.NETWORK_FIRST) {
        switch (strategy) {
            case this.strategies.CACHE_FIRST:
                return await this.cacheFirstStrategy(url);
            case this.strategies.NETWORK_FIRST:
                return await this.networkFirstStrategy(url);
            case this.strategies.CACHE_ONLY:
                return await this.get(url);
            case this.strategies.NETWORK_ONLY:
                return await fetch(url).then(r => r.json());
            default:
                return await this.networkFirstStrategy(url);
        }
    },
    
    async cacheFirstStrategy(url) {
        const cached = await this.get(url);
        if (cached) return cached;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            await this.set(url, data);
            return data;
        } catch (error) {
            console.error('Network error:', error);
            return null;
        }
    },
    
    async networkFirstStrategy(url) {
        try {
            const response = await fetch(url);
            const data = await response.json();
            await this.set(url, data);
            return data;
        } catch (error) {
            console.error('Network error, falling back to cache:', error);
            return await this.get(url);
        }
    },
    
    // Clear old cache
    async clearOldCache() {
        const cacheNames = await caches.keys();
        return Promise.all(
            cacheNames
                .filter(name => name !== this.cacheName)
                .map(name => caches.delete(name))
        );
    },
    
    // Get cache size
    async getCacheSize() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            const estimate = await navigator.storage.estimate();
            return {
                usage: estimate.usage,
                quota: estimate.quota,
                percent: (estimate.usage / estimate.quota * 100).toFixed(2)
            };
        }
        return null;
    }
};

window.CacheManager = CacheManager;
