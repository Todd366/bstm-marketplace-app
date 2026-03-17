/**
 * BSTM QR Code Generator
 * Generate QR codes for order verification
 */

const QRCodeGenerator = {
    
    async generate(data, size = 256) {
        // Using QRCode.js library via CDN
        if (typeof QRCode === 'undefined') {
            await this.loadLibrary();
        }
        
        const canvas = document.createElement('canvas');
        
        QRCode.toCanvas(canvas, data, {
            width: size,
            margin: 2,
            color: {
                dark: '#667eea',
                light: '#ffffff'
            }
        });
        
        return canvas.toDataURL();
    },
    
    async loadLibrary() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },
    
    async generateOrderQR(orderId) {
        const data = JSON.stringify({
            type: 'bstm_order',
            orderId: orderId,
            timestamp: Date.now()
        });
        
        return await this.generate(data);
    },
    
    async displayQR(containerId, data) {
        const qrDataURL = await this.generate(data);
        const img = document.createElement('img');
        img.src = qrDataURL;
        img.className = 'mx-auto';
        
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = '';
            container.appendChild(img);
        }
    }
};

window.QRCodeGenerator = QRCodeGenerator;
