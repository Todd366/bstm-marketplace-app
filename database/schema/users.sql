-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  is_seller BOOLEAN DEFAULT FALSE,
  profile_picture TEXT,
  location TEXT,
  verified BOOLEAN DEFAULT FALSE,
  paystack_account_id TEXT,
  thb_wallet_address TEXT,
  rating DECIMAL(2,1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
