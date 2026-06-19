-- BSTM DIGITAL NATION DATABASE SCHEMA
-- Supabase PostgreSQL Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer', 'seller', 'admin')),
    
    -- Profile
    avatar TEXT,
    phone TEXT,
    location TEXT,
    bio TEXT,
    
    -- Verification
    verified BOOLEAN DEFAULT FALSE,
    kyc_status TEXT DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'approved', 'rejected')),
    kyc_documents JSONB,
    
    -- THB Wallet
    thb_balance DECIMAL(10,2) DEFAULT 0,
    wallet_address TEXT,
    
    -- Referral
    referral_code TEXT UNIQUE,
    referred_by TEXT,
    
    -- Seller Info
    paystack_account_id TEXT,
    seller_rating DECIMAL(3,2),
    total_sales INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- Index for faster queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_referral_code ON users(referral_code);
CREATE INDEX idx_users_role ON users(role);

-- ============================================
-- PRODUCTS TABLE
-- ============================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Room Assignment
    room_id INTEGER NOT NULL,
    
    -- Product Info
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    
    -- Pricing
    price DECIMAL(10,2) NOT NULL,
    thb_price DECIMAL(10,2),
    
    -- Media
    images TEXT[],
    
    -- Stock & Availability
    stock INTEGER DEFAULT 0,
    available BOOLEAN DEFAULT TRUE,
    
    -- Location
    location TEXT,
    
    -- Metadata
    tags TEXT[],
    featured BOOLEAN DEFAULT FALSE,
    
    -- Admin Approval
    approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    
    -- Stats
    views INTEGER DEFAULT 0,
    sales INTEGER DEFAULT 0,
    rating DECIMAL(3,2),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_seller ON products(seller_id);
CREATE INDEX idx_products_room ON products(room_id);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_approval ON products(approval_status);

-- ============================================
-- ORDERS TABLE
-- ============================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Parties
    buyer_id UUID REFERENCES users(id),
    seller_id UUID REFERENCES users(id),
    product_id UUID REFERENCES products(id),
    
    -- Order Details
    quantity INTEGER DEFAULT 1,
    total_price DECIMAL(10,2) NOT NULL,
    thb_used DECIMAL(10,2) DEFAULT 0,
    
    -- Payment
    payment_method TEXT NOT NULL,
    payment_reference TEXT,
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    
    -- Delivery
    delivery_address JSONB,
    delivery_method TEXT,
    delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
    
    -- CabLink Integration
    cablink_ride_id TEXT,
    driver_id TEXT,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ
);

CREATE INDEX idx_orders_buyer ON orders(buyer_id);
CREATE INDEX idx_orders_seller ON orders(seller_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- ============================================
-- THB TRANSACTIONS TABLE
-- ============================================
CREATE TABLE thb_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Transaction Details
    type TEXT NOT NULL CHECK (type IN ('earn', 'spend', 'transfer', 'stake', 'unstake', 'admin_mint')),
    amount DECIMAL(10,2) NOT NULL,
    reason TEXT,
    
    -- Related Entities
    order_id UUID REFERENCES orders(id),
    referral_id UUID,
    
    -- Balance Tracking
    balance_before DECIMAL(10,2),
    balance_after DECIMAL(10,2),
    
    -- Blockchain (future)
    transaction_hash TEXT,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_thb_user ON thb_transactions(user_id);
CREATE INDEX idx_thb_type ON thb_transactions(type);
CREATE INDEX idx_thb_created ON thb_transactions(created_at DESC);

-- ============================================
-- REFERRALS TABLE
-- ============================================
CREATE TABLE referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    referrer_code TEXT NOT NULL,
    referred_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    
    -- Reward
    reward_amount DECIMAL(10,2) DEFAULT 50,
    reward_paid BOOLEAN DEFAULT FALSE,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_referrals_code ON referrals(referrer_code);
CREATE INDEX idx_referrals_user ON referrals(referred_user_id);

-- ============================================
-- REVIEWS TABLE
-- ============================================
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id),
    
    -- Review Content
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    
    -- Media
    images TEXT[],
    
    -- Status
    verified_purchase BOOLEAN DEFAULT FALSE,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reviews_product ON reviews(product_id);
CREATE INDEX idx_reviews_user ON reviews(user_id);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Notification Content
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    
    -- Link
    link TEXT,
    
    -- Status
    read BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    metadata JSONB,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- ============================================
-- ROOMS TABLE (63 Rooms Metadata)
-- ============================================
CREATE TABLE rooms (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    emoji TEXT,
    status TEXT DEFAULT 'coming_soon' CHECK (status IN ('active', 'coming_soon', 'maintenance')),
    
    -- Stats
    total_users INTEGER DEFAULT 0,
    total_products INTEGER DEFAULT 0,
    total_revenue DECIMAL(10,2) DEFAULT 0,
    
    -- Metadata
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert active rooms
INSERT INTO rooms (id, name, description, emoji, status) VALUES
(18, 'Marketplace', 'E-commerce Hub', '🏪', 'active'),
(22, 'Farm', 'Fresh Organic Produce', '🌾', 'active');

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE thb_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read own profile
CREATE POLICY "Users can read own profile"
ON users FOR SELECT
USING (auth.uid() = id);

-- Users can update own profile
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid() = id);

-- Anyone can read approved products
CREATE POLICY "Anyone can read approved products"
ON products FOR SELECT
USING (approval_status = 'approved' AND available = true);

-- Sellers can manage own products
CREATE POLICY "Sellers can manage own products"
ON products FOR ALL
USING (auth.uid() = seller_id);

-- Users can read own orders
CREATE POLICY "Users can read own orders"
ON orders FOR SELECT
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Users can create orders
CREATE POLICY "Users can create orders"
ON orders FOR INSERT
WITH CHECK (auth.uid() = buyer_id);

-- Users can read own THB transactions
CREATE POLICY "Users can read own THB transactions"
ON thb_transactions FOR SELECT
USING (auth.uid() = user_id);

-- Users can read own notifications
CREATE POLICY "Users can read own notifications"
ON notifications FOR SELECT
USING (auth.uid() = user_id);

-- Users can update own notifications
CREATE POLICY "Users can update own notifications"
ON notifications FOR UPDATE
USING (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-award THB on order completion
CREATE OR REPLACE FUNCTION award_purchase_thb()
RETURNS TRIGGER AS $$
DECLARE
    thb_reward DECIMAL(10,2);
    is_room22 BOOLEAN;
BEGIN
    IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
        -- Check if Room 22 product
        SELECT room_id = 22 INTO is_room22
        FROM products WHERE id = NEW.product_id;
        
        -- Calculate reward (1% or 1.5% for Room 22)
        thb_reward := NEW.total_price * CASE WHEN is_room22 THEN 0.015 ELSE 0.01 END;
        
        -- Update user balance
        UPDATE users 
        SET thb_balance = thb_balance + thb_reward
        WHERE id = NEW.buyer_id;
        
        -- Log transaction
        INSERT INTO thb_transactions (user_id, type, amount, reason, order_id)
        VALUES (NEW.buyer_id, 'earn', thb_reward, 'Purchase reward', NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER award_purchase_thb_trigger
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION award_purchase_thb();

-- ============================================
-- INITIAL ADMIN USER
-- ============================================
-- Run this after first user signup to make them admin:
-- UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
