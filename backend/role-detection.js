/**
 * Auto-detect user role based on email domain or KYC
 */

function detectRole(email) {
  // Government emails
  if (email.endsWith('@gov.bw') || email.endsWith('@bstm.bw')) {
    return 'admin';
  }
  
  // Business domains
  if (email.endsWith('@business.com') || email.includes('shop')) {
    return 'seller';
  }
  
  // Default
  return 'buyer';
}

module.exports = { detectRole };
