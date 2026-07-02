# 🚀 BSTM PRODUCTION DEPLOYMENT GUIDE

## TODAY'S LAUNCH CHECKLIST

### ✅ CRITICAL (DO THIS NOW)

#### 1. Environment Setup
```bash
# Create .env file with your production keys
cp .env.example .env
```

**Add these:**
- `SUPABASE_URL` → Your Supabase project URL
- `SUPABASE_ANON_KEY` → Your Supabase anonymous key
- `PAYSTACK_PUBLIC_KEY` → pk_live_xxx (LIVE, not test)
- `PAYSTACK_SECRET_KEY` → sk_live_xxx (LIVE, not test)

#### 2. Database Setup (Supabase)
1. Go to https://supabase.com → Create new project
2. Run schema from `db/schema.sql`
3. Enable Row Level Security (RLS)
4. Create tables:
   - `users` (registration)
   - `products` (listings)
   - `orders` (transactions)
   - `thb_wallet` (rewards)

#### 3. Payment Gateway (Paystack)
1. Sign up at https://paystack.com
2. Get LIVE API keys (not test)
3. Set webhook URL: `https://yourdomain.com/api/paystack-webhook`
4. Enable payment notifications

#### 4. Deployment

**Option A: GitHub Pages (Free)**
```bash
git push origin main
# GitHub Actions auto-deploys
```

**Option B: Vercel (Recommended)**
```bash
npm install -g vercel
vercel --prod
```

**Option C: Render**
```bash
# Connect GitHub repo to Render
# Set environment variables
# Deploy
```

### ✅ TESTING BEFORE LAUNCH

**Test Core Features:**
- [ ] User registration works
- [ ] Login via email works
- [ ] Can add items to cart
- [ ] Checkout process completes
- [ ] Payment gateway processes (use test card)
- [ ] Orders appear in dashboard
- [ ] THB rewards awarded

**Test on Devices:**
- [ ] Desktop (Chrome, Safari, Firefox)
- [ ] Mobile (iOS Safari, Android Chrome)
- [ ] Tablet
- [ ] Offline mode works

### ✅ SECURITY CHECKLIST

- [ ] HTTPS enabled
- [ ] No API keys in code
- [ ] Environment variables configured
- [ ] CORS properly set
- [ ] Rate limiting enabled
- [ ] SQL injection prevention active

### ⏰ LAUNCH DAY TIMELINE

**2 hours before:**
- Final testing
- Verify all systems
- Team briefing

**1 hour before:**
- Check database
- Verify payment gateway
- Monitor error logs

**At launch:**
- Switch live
- Monitor first hour closely
- Have support team ready

**After launch:**
- Check server logs every 10 minutes
- Monitor user signups
- Track payment success rate
- Be ready to rollback if needed

### 📊 SUCCESS METRICS (DAY 1)

- [ ] 100+ visitors
- [ ] 10+ signups
- [ ] 1+ completed orders
- [ ] 0 critical errors
- [ ] <3 second page load time

### 🆘 EMERGENCY CONTACTS

**Critical Issues:**
- Database down → Check Supabase dashboard
- Payments failing → Check Paystack status
- Site down → Check hosting provider
- Contact: bstm366@gmail.com

### 📝 NEXT STEPS

1. Fill in `.env.production` file
2. Deploy to production server
3. Run final tests
4. Monitor first 24 hours
5. Collect user feedback
6. Plan Phase 2 rollout

---

**ALL DONE? YOU'RE READY TO LAUNCH!** 🎉
