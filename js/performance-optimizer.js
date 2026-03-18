/**
 * BSTM Performance Optimizer
 * Automatic performance improvements
 */

const PerformanceOptimizer = {
    
    init() {
        this.lazyLoadImages();
        this.prefetchLinks();
        this.optimizeAnimations();
        this.deferNonCriticalJS();
        this.enableGPUAcceleration();
    },
    
    // Lazy load images
    lazyLoadImages() {
        const images = document.querySelectorAll('img[data-src]');
        
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        observer.unobserve(img);
                    }
                });
            }, {
                rootMargin: '50px'
            });
            
            images.forEach(img => observer.observe(img));
        }
    },
    
    // Prefetch critical pages
    prefetchLinks() {
        const criticalLinks = [
            'product-detail.html',
            'checkout.html',
            'thb-wallet.html'
        ];
        
        criticalLinks.forEach(link => {
            const prefetchLink = document.createElement('link');
            prefetchLink.rel = 'prefetch';
            prefetchLink.href = link;
            document.head.appendChild(prefetchLink);
        });
    },
    
    // Optimize animations for 60fps
    optimizeAnimations() {
        // Force GPU acceleration on animated elements
        const animated = document.querySelectorAll('.animate, .transition');
        animated.forEach(el => {
            el.style.willChange = 'transform';
        });
    },
    
    // Defer non-critical JavaScript
    deferNonCriticalJS() {
        const scripts = document.querySelectorAll('script[data-defer]');
        
        window.addEventListener('load', () => {
            scripts.forEach(script => {
                const newScript = document.createElement('script');
                newScript.src = script.dataset.defer;
                document.body.appendChild(newScript);
            });
        });
    },
    
    // Enable GPU acceleration
    enableGPUAcceleration() {
        document.documentElement.style.transform = 'translateZ(0)';
    },
    
    // Measure page speed
    measurePerformance() {
        if (!window.performance) return;
        
        window.addEventListener('load', () => {
            const perfData = performance.timing;
            const loadTime = perfData.loadEventEnd - perfData.navigationStart;
            const domReady = perfData.domContentLoadedEventEnd - perfData.navigationStart;
            
            console.log('Performance Metrics:');
            console.log('Page Load Time:', loadTime + 'ms');
            console.log('DOM Ready:', domReady + 'ms');
            
            // Send to analytics
            if (typeof gtag !== 'undefined') {
                gtag('event', 'timing_complete', {
                    name: 'load',
                    value: loadTime,
                    event_category: 'Performance'
                });
            }
        });
    }
};

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
    PerformanceOptimizer.init();
    PerformanceOptimizer.measurePerformance();
});

window.PerformanceOptimizer = PerformanceOptimizer;
