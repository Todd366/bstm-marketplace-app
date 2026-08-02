/**
 * QR Code Generator for Referrals + Payments
 * Uses qrcode.js library (CDN)
 */

async function generateQR(data, elementId) {
  const qr = new QRCode(document.getElementById(elementId), {
    text: data,
    width: 256,
    height: 256,
    colorDark: "#667eea",
    colorLight: "#ffffff"
  });
}

// Usage:
// generateQR('https://bstm.bw/ref/BSTM-ABC123', 'qrcode');
