/**
 * Authentication Logic - Magic Links + JWT
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-this';
const SESSION_EXPIRY = '7d';

// In-memory token store (use Redis in production)
const magicTokenStore = new Map();

/**
 * Generate magic link token
 */
function generateMagicToken(email) {
  const token = crypto.randomBytes(32).toString('hex');
  
  const tokenData = {
    email,
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    used: false
  };
  
  magicTokenStore.set(token, tokenData);
  
  // Auto-cleanup after expiry
  setTimeout(() => {
    magicTokenStore.delete(token);
  }, 15 * 60 * 1000);
  
  return token;
}

/**
 * Verify magic token
 */
function verifyMagicToken(token) {
  const tokenData = magicTokenStore.get(token);
  
  if (!tokenData) {
    throw new Error('Invalid or expired token');
  }
  
  if (tokenData.used) {
    throw new Error('Token already used');
  }
  
  if (Date.now() > tokenData.expires) {
    magicTokenStore.delete(token);
    throw new Error('Token expired');
  }
  
  // Mark as used
  tokenData.used = true;
  
  return tokenData.email;
}

/**
 * Generate session JWT
 */
function generateSessionToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: SESSION_EXPIRY }
  );
}

/**
 * Verify session JWT
 */
function verifySessionToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired session');
  }
}

/**
 * Extract token from Authorization header
 */
function extractToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No token provided');
  }
  return authHeader.split(' ')[1];
}

module.exports = {
  generateMagicToken,
  verifyMagicToken,
  generateSessionToken,
  verifySessionToken,
  extractToken
};
