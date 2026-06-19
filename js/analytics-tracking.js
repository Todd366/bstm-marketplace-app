// Google Analytics integration
function trackEvent(category, action, label, value) {
    if (typeof gtag !== 'undefined') {
        gtag('event', action, {
            'event_category': category,
            'event_label': label,
            'value': value
        });
    }
}

// Track page views
function trackPageView(page) {
    if (typeof gtag !== 'undefined') {
        gtag('config', 'G-XXXXXXXXXX', {
            'page_path': page
        });
    }
}

// Track purchases
function trackPurchase(orderId, value, items) {
    if (typeof gtag !== 'undefined') {
        gtag('event', 'purchase', {
            transaction_id: orderId,
            value: value,
            currency: 'BWP',
            items: items
        });
    }
}
