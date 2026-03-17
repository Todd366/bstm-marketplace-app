// Monitor page load performance
window.addEventListener('load', () => {
    const perfData = performance.timing;
    const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
    
    // Log to analytics
    trackEvent('Performance', 'page_load', window.location.pathname, pageLoadTime);
});
