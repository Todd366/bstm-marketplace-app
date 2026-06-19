/**
 * THB Wallet Endpoints
 * Real balance, send, receive, history
 */

const express = require('express');
const router = express.Router();
const { verifySessionToken, extractToken } = require('./auth');
const { getUserById, db } = require('./db');
const admin = require('firebase-admin');

// Middleware: Verify auth
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
 * GET /wallet/balance
 * Get current THB balance
 */
router.get('/balance', requireAuth, async (req, res) => {
  try {
    const user = await getUserById(req.userId);
    
    res.json({
      success: true,
      balance: user.thb_balance,
      formatted: `${user.thb_balance.toFixed(2)} THB`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

/**
 * POST /wallet/send
 * Send THB to another user
 * Body: { toEmail, amount, note }
 */
router.post('/send', requireAuth, async (req, res) => {
  try {
    const { toEmail, amount, note } = req.body;
    
    if (!toEmail || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const sender = await getUserById(req.userId);
    
    if (sender.thb_balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Get recipient
    const recipientSnapshot = await db.collection('users')
      .where('email', '==', toEmail)
      .limit(1)
      .get();
    
    if (recipientSnapshot.empty) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    const recipient = recipientSnapshot.docs[0];
    const recipientData = recipient.data();

    // Create transaction
    const batch = db.batch();

    // Deduct from sender
    batch.update(db.collection('users').doc(req.userId), {
      thb_balance: admin.firestore.FieldValue.increment(-amount)
    });

    // Add to recipient
    batch.update(recipient.ref, {
      thb_balance: admin.firestore.FieldValue.increment(amount)
    });

    // Log transaction
    batch.set(db.collection('transactions').doc(), {
      from: req.userId,
      to: recipient.id,
      amount,
      note: note || '',
      type: 'transfer',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();

    res.json({
      success: true,
      message: `Sent ${amount} THB to ${toEmail}`,
      newBalance: sender.thb_balance - amount
    });

  } catch (error) {
    console.error('Send error:', error);
    res.status(500).json({ error: 'Transfer failed' });
  }
});

/**
 * GET /wallet/history
 * Get transaction history
 */
router.get('/history', requireAuth, async (req, res) => {
  try {
    const transactions = await db.collection('transactions')
      .where('from', '==', req.userId)
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();

    const received = await db.collection('transactions')
      .where('to', '==', req.userId)
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();

    const all = [
      ...transactions.docs.map(doc => ({ id: doc.id, ...doc.data(), direction: 'sent' })),
      ...received.docs.map(doc => ({ id: doc.id, ...doc.data(), direction: 'received' }))
    ].sort((a, b) => b.timestamp - a.timestamp);

    res.json({
      success: true,
      transactions: all
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to get history' });
  }
});

module.exports = router;
