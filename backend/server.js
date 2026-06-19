/**
 * BSTM Marketplace Room 8 - Production Server
 * Serves ALL 26 HTML files from root directory
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const { sendMagicLink, testEmailConfig } = require('./email');
const { 
  generateMagicToken, 
  verifyMagicToken,
  generateSessionToken,
  verifySessionToken,
  extractToken
} = require('./auth');
const { 
  getUserByEmail, 
  getUserById, 
  createUser, 
  updateLastLogin,
  updateUserBalance
} = require('./db');

const app = express();

// CORS
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// SERVE ROOT DIRECTORY (where all 26 HTML files are)
const ROOT_DIR = path.join(__dirname, '..');
app.use(express.static(ROOT_DIR));
app.use('/js', express.static(path.join(ROOT_DIR, 'js')));
app.use('/css', express.static(path.join(ROOT_DIR, 'css')));
app.use('/components', express.static(path.join(ROOT_DIR, 'components')));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 60000,
  max: 5,
  message: { error: 'Too many requests. Wait 1 minute.' }
});

testEmailConfig();

// Auth middleware
function requireAuth(req, res, next) {
  try {
    const token = extractToken(req.headers.authorization);
    const decoded = verifySessionToken(token);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

/**
 * AUTH ENDPOINTS
 */

app.post('/auth/send-link', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    console.log(`📧 Magic link: ${email}`);

    const token = generateMagicToken(email);
    const magicUrl = `http://localhost:3000/verify.html?token=${token}`;
    
    try {
      await sendMagicLink(email, magicUrl);
    } catch (e) {
      console.log(`⚠️  Email failed: ${e.message}`);
    }
    
    console.log(`🔗 DEV: ${magicUrl}`);
    
    res.json({ 
      success: true,
      message: 'Check console for dev link',
      devLink: magicUrl
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/auth/verify', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    let email;
    try {
      email = verifyMagicToken(token);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    console.log(`🔐 Verifying: ${email}`);

    let user = await getUserByEmail(email);
    const isNew = !user;
    
    if (!user) {
      user = await createUser(email);
      console.log(`🎉 New: ${email}`);
    } else {
      await updateLastLogin(user.id);
      console.log(`👋 Login: ${email}`);
    }

    const sessionToken = generateSessionToken(user);

    res.json({
      success: true,
      message: isNew ? 'Account created!' : 'Welcome back!',
      token: sessionToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        thb_balance: user.thb_balance,
        referral_code: user.referral_code
      }
    });
    
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Failed' });
  }
});

app.get('/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await getUserById(req.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        thb_balance: user.thb_balance,
        referral_code: user.referral_code
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

app.post('/auth/logout', (req, res) => {
  res.json({ success: true });
});

/**
 * WALLET ENDPOINTS
 */

app.get('/wallet/balance', requireAuth, async (req, res) => {
  try {
    const user = await getUserById(req.userId);
    res.json({
      success: true,
      balance: user.thb_balance,
      formatted: `${user.thb_balance.toFixed(2)} THB`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.post('/wallet/send', requireAuth, async (req, res) => {
  try {
    const { toEmail, amount } = req.body;
    
    if (!toEmail || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid' });
    }

    const sender = await getUserById(req.userId);
    
    if (sender.thb_balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const recipient = await getUserByEmail(toEmail);
    
    if (!recipient) {
      return res.status(404).json({ error: 'Not found' });
    }

    await updateUserBalance(sender.id, -amount);
    await updateUserBalance(recipient.id, amount);

    console.log(`💸 ${sender.email} → ${toEmail}: ${amount} THB`);

    res.json({
      success: true,
      message: `Sent ${amount} THB`,
      newBalance: sender.thb_balance - amount
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});


// Get user balance and profile
app.get("/user/balance", requireAuth, async (req, res) => {
  try {
    const user = await getUserById(req.userId);
    res.json({
      success: true,
      balance: user.thb_balance,
      name: user.name,
      email: user.email,
      referral_code: user.referral_code,
      rating: 4.8,
      total_orders: 0
    });
  } catch (error) {
    res.status(500).json({ error: "Failed" });
  }
});

// Get all products (mock for now - add real DB later)
app.get("/products", async (req, res) => {
  try {
    // Return empty for now - add real Firestore query later
    const products = [];
    res.json({
      success: true,
      products: products,
      count: products.length
    });
  } catch (error) {
    res.status(500).json({ error: "Failed" });
  }
});

// Get wishlist
app.get("/wishlist", requireAuth, async (req, res) => {
  try {
    // Return empty for now - add real wishlist DB later
    res.json({
      success: true,
      items: [],
      count: 0
    });
  } catch (error) {
    res.status(500).json({ error: "Failed" });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Count HTML files in root
const fs = require('fs');
const htmlFiles = fs.readdirSync(ROOT_DIR).filter(f => f.endsWith('.html'));

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('');
  console.log('🚀 BSTM MARKETPLACE ROOM 8');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📍 Server: http://localhost:${PORT}`);
  console.log(`🔐 JWT: ${process.env.JWT_SECRET ? '✅' : '❌ Missing in .env'}`);
  console.log(`🔥 Firebase: ✅`);
  console.log(`📧 Email: ${process.env.EMAIL_USER ? '✅' : '⚠️  Console only'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`📂 Serving: ROOT (${htmlFiles.length} HTML files)`);
  console.log('🔗 Login: http://localhost:3000/login.html');
  console.log('🔗 Dashboard: http://localhost:3000/buyer-dashboard.html');
  console.log('🔗 Wallet: http://localhost:3000/thb-wallet.html');
  console.log('');
  console.log('📄 All pages:');
  htmlFiles.forEach(f => console.log(`   - http://localhost:3000/${f}`));
  console.log('');
});

module.exports = app;
