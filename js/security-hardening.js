/**
 * BSTM Security Hardening
 * Client-side security measures
 */

const SecurityHardening = {
    
    init() {
        this.preventXSS();
        this.validateInputs();
        this.detectDevTools();
        this.preventClickjacking();
        this.sanitizeUserContent();
    },
    
    // Prevent XSS attacks
    preventXSS() {
        // Override innerHTML to sanitize
        const originalInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
        
        Object.defineProperty(Element.prototype, 'innerHTML', {
            set: function(value) {
                const sanitized = this.sanitizeHTML(value);
                originalInnerHTML.set.call(this, sanitized);
            },
            get: originalInnerHTML.get
        });
    },
    
    sanitizeHTML(html) {
        const temp = document.createElement('div');
        temp.textContent = html;
        return temp.innerHTML;
    },
    
    // Validate all inputs
    validateInputs() {
        document.addEventListener('submit', (e) => {
            const form = e.target;
            if (!form.checkValidity()) {
                e.preventDefault();
                this.highlightInvalidFields(form);
            }
        });
    },
    
    highlightInvalidFields(form) {
        const invalid = form.querySelectorAll(':invalid');
        invalid.forEach(field => {
            field.classList.add('border-red-500');
            field.addEventListener('input', () => {
                if (field.validity.valid) {
                    field.classList.remove('border-red-500');
                }
            }, { once: true });
        });
    },
    
    // Detect developer tools (optional, for sensitive operations)
    detectDevTools() {
        let devtools = false;
        
        const threshold = 160;
        const widthThreshold = window.outerWidth - window.innerWidth > threshold;
        const heightThreshold = window.outerHeight - window.innerHeight > threshold;
        
        if (widthThreshold || heightThreshold) {
            devtools = true;
        }
        
        return devtools;
    },
    
    // Prevent clickjacking
    preventClickjacking() {
        if (window !== window.top) {
            // Page is in iframe
            console.warn('Clickjacking attempt detected');
            window.top.location = window.location;
        }
    },
    
    // Sanitize user-generated content
    sanitizeUserContent(content) {
        return content
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    },
    
    // Rate limiting for API calls
    rateLimit: {
        calls: {},
        
        check(key, maxCalls = 10, windowMs = 60000) {
            const now = Date.now();
            
            if (!this.calls[key]) {
                this.calls[key] = [];
            }
            
            // Remove old calls
            this.calls[key] = this.calls[key].filter(time => now - time < windowMs);
            
            // Check limit
            if (this.calls[key].length >= maxCalls) {
                return false;
            }
            
            // Add current call
            this.calls[key].push(now);
            return true;
        }
    }
};

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
    SecurityHardening.init();
});

window.SecurityHardening = SecurityHardening;
