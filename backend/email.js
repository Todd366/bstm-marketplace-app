/**
 * Email Service - Real Gmail SMTP
 */

const nodemailer = require('nodemailer');

let transporter = null;

// Create transporter with Gmail
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  try {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  } catch (error) {
    console.error('⚠️ Email transporter failed:', error.message);
  }
}

/**
 * Send magic link email
 */
async function sendMagicLink(email, magicUrl) {
  if (!transporter) {
    console.log('⚠️  Email not configured - check .env for EMAIL_USER and EMAIL_PASS');
    return; // Don't throw error, just log dev link
  }

  const mailOptions = {
    from: `"BSTM Marketplace Room 8" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '🔐 Your BSTM Login Link',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; color: white; }
    .logo { width: 80px; height: 80px; background: white; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; font-size: 40px; font-weight: bold; color: #667eea; }
    .content { padding: 40px; }
    .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white !important; padding: 16px 40px; text-decoration: none; border-radius: 10px; font-weight: bold; margin: 20px 0; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #999; font-size: 12px; }
    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">B</div>
      <h1 style="margin: 0; font-size: 28px;">BSTM Marketplace</h1>
      <p style="margin: 10px 0 0; opacity: 0.9;">🇧🇼 Room 8 - Digital Shopping</p>
    </div>
    
    <div class="content">
      <h2 style="color: #333; margin-bottom: 20px;">Click to sign in</h2>
      <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
        You requested a login link for <strong>${email}</strong>.
        Click the button below to access your BSTM account:
      </p>
      
      <a href="${magicUrl}" class="button">🚀 Sign In to BSTM</a>
      
      <div class="warning">
        <p style="margin: 0; color: #856404; font-size: 14px;">
          <strong>⏱️ This link expires in 15 minutes</strong><br>
          For security, you can only use this link once.
        </p>
      </div>
      
      <p style="color: #999; font-size: 13px; margin-top: 30px;">
        Didn't request this? You can safely ignore this email.
      </p>
    </div>
    
    <div class="footer">
      <p>© 2026 BSTM Marketplace Room 8. All rights reserved.</p>
      <p>Gaborone, Botswana 🇧🇼</p>
    </div>
  </div>
</body>
</html>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Email send failed:', error.message);
    throw error;
  }
}

/**
 * Test email configuration
 */
async function testEmailConfig() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('⚠️  Email not configured (EMAIL_USER/EMAIL_PASS missing)');
    console.log('   Magic links will be logged to console instead');
    console.log('   To enable email: Set EMAIL_USER and EMAIL_PASS in .env');
    return false;
  }

  if (!transporter) {
    console.log('❌ Email transporter failed to initialize');
    return false;
  }

  try {
    await transporter.verify();
    console.log('✅ Email server ready');
    return true;
  } catch (error) {
    console.error('❌ Email server error:', error.message);
    console.log('   Make sure you\'re using a Gmail App Password, not regular password');
    console.log('   Get one at: https://myaccount.google.com/apppasswords');
    return false;
  }
}

module.exports = { sendMagicLink, testEmailConfig };
