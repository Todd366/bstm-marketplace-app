# 🚀 BSTM Digital Nation - Deployment Guide

Complete guide to deploy your Digital Nation to production.

---

## 📋 **PRE-DEPLOYMENT CHECKLIST**

### **1. Required Accounts**
- [ ] GitHub account (for hosting)
- [ ] Supabase account (database)
- [ ] Paystack account (payments)
- [ ] Cloudflare account (CDN + SSL)
- [ ] Domain registrar account (Namecheap/Google Domains)

### **2. Environment Setup**
- [ ] All files uploaded to GitHub
- [ ] Database schema deployed to Supabase
- [ ] API keys secured
- [ ] Domain purchased

---

## 🗄️ **STEP 1: DATABASE SETUP (Supabase)**

### **Create Supabase Project**
1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Project name: `bstm-digital-nation`
4. Database password: **Save this securely!**
5. Region: Choose closest to Botswana (South Africa)

### **Run Database Schema**
1. In Supabase Dashboard → SQL Editor
2. Copy entire contents of `database/schema.sql`
3. Click "Run"
4. Verify all tables created

### **Get API Keys**
1. Settings → API
2. Copy:
   - `Project URL` → This is your `SUPABASE_URL`
   - `anon public` key → This is your `SUPABASE_ANON_KEY`

### **Update Code**
In `js/supabase-integration.js`:
```javascript
const SUPABASE_URL = 'YOUR_PROJECT_URL_HERE';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';
