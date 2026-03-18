/**
 * BSTM A/B Testing
 * Test different UX variants
 */

const ABTesting = {
    experiments: {},
    
    // Define experiment
    defineExperiment(name, variants) {
        this.experiments[name] = {
            variants: variants,
            activeVariant: null
        };
    },
    
    // Get variant for user
    getVariant(experimentName) {
        const experiment = this.experiments[experimentName];
        if (!experiment) return null;
        
        // Check if user already assigned
        const saved = localStorage.getItem(`ab_${experimentName}`);
        if (saved) {
            experiment.activeVariant = saved;
            return saved;
        }
        
        // Randomly assign variant
        const variant = experiment.variants[
            Math.floor(Math.random() * experiment.variants.length)
        ];
        
        localStorage.setItem(`ab_${experimentName}`, variant);
        experiment.activeVariant = variant;
        
        return variant;
    },
    
    // Track conversion
    trackConversion(experimentName, metricName, value = 1) {
        const variant = this.getVariant(experimentName);
        if (!variant) return;
        
        // TODO: Send to analytics
        if (typeof gtag !== 'undefined') {
            gtag('event', 'ab_conversion', {
                experiment: experimentName,
                variant: variant,
                metric: metricName,
                value: value
            });
        }
    }
};

// Example: Test checkout button colors
ABTesting.defineExperiment('checkout_button', ['purple', 'green', 'orange']);

// Apply variant
document.addEventListener('DOMContentLoaded', () => {
    const variant = ABTesting.getVariant('checkout_button');
    const checkoutButtons = document.querySelectorAll('.checkout-btn');
    
    checkoutButtons.forEach(btn => {
        switch(variant) {
            case 'purple':
                btn.classList.add('bg-purple-600');
                break;
            case 'green':
                btn.classList.add('bg-green-600');
                break;
            case 'orange':
                btn.classList.add('bg-orange-600');
                break;
        }
    });
});

window.ABTesting = ABTesting;
