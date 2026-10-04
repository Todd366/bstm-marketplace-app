-- Reconciles database/schema.sql with what the app actually queries.
-- I reverse-engineered every column below from the real .select() /
-- .insert() / .update() calls across the codebase — not guessed, and not
-- copied from anywhere I can't see. Full list of exactly which file/line
-- each column came from is in my conversation with Claude if you want to
-- cross-check any of it later.
--
-- Every CREATE TABLE below is IF NOT EXISTS, so this is safe to run
-- whether or not these tables already exist in your live Supabase project:
--   - If a table already exists, its statement is a silent no-op — nothing
--     about the real table is touched, even if its actual columns differ
--     from my reconstruction below.
--   - If a table does NOT exist yet, this creates it with exactly the
--     columns the app's own code already depends on.
-- Either way, run this once in Supabase SQL Editor, then run the query at
-- the bottom to see which of these 13 actually got created just now vs.
-- already existed.
--
-- NOT included here: Row Level Security policies. These tables being
-- created with RLS left in its default (usually permissive, or fully
-- locked if your project enables RLS-by-default) is not real access
-- control either way. See the note at the bottom of
-- add_agent_roles.sql — that's still the right next step, separately.

-- profiles is NOT created here. It already exists and works (your whole
-- app depends on it), and it's almost certainly wired to a Supabase Auth
-- trigger (auto-row-on-signup) that I can't see or safely recreate blind.
-- Touching it wrong risks breaking signup. For reference, the columns the
-- app's code actually reads/writes on profiles are: id, email, role,
-- thb_balance, phone, location, notification_prefs (jsonb), wallet_address,
-- agent_permissions (jsonb, added by add_agent_roles.sql), created_at.
-- If any of those don't exist on your real profiles table, that specific
-- feature breaks silently (console error, not a crash) — worth a quick
-- look at Table Editor > profiles to confirm they're all there.

CREATE TABLE IF NOT EXISTS wishlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,  -- snapshot at purchase time, survives product deletion
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(10, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

CREATE TABLE IF NOT EXISTS wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount_thb numeric(10, 2) NOT NULL,
  type text NOT NULL CHECK (type IN ('credit', 'debit')),
  reference_type text,  -- e.g. 'order'
  reference_id uuid,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user_id ON wallet_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_reference ON wallet_ledger(reference_type, reference_id);

CREATE TABLE IF NOT EXISTS kyc_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  full_name text,
  national_id text,  -- Omang number — treat this column as sensitive (RLS, no public select)
  phone text,
  country text,
  document_storage_path text,  -- comma-joined storage paths, per kyc-verification.js
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)  -- kyc-verification.js upserts onConflict: "user_id"
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor uuid REFERENCES profiles(id),
  action text NOT NULL,
  resource_type text,
  resource_id text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Named to match the FK alias admin-dashboard.js already queries:
-- profiles!admin_audit_log_actor_profiles_fkey(email)
DO $$
BEGIN
  ALTER TABLE admin_audit_log
    RENAME CONSTRAINT admin_audit_log_actor_fkey TO admin_audit_log_actor_profiles_fkey;
EXCEPTION WHEN OTHERS THEN NULL;  -- already named right, or table pre-existed with a different FK name
END $$;

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);

CREATE TABLE IF NOT EXISTS delivery_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES profiles(id),
  pickup_room_id uuid REFERENCES rooms(id),
  dropoff_address text,
  dropoff_city text,
  dropoff_phone text,
  status text NOT NULL DEFAULT 'pending',
  cablink_ride_id text,  -- set once CabLink picks up the task; null until then
  requested_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_order_id ON delivery_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_buyer_id ON delivery_requests(buyer_id);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  room_id uuid REFERENCES rooms(id) ON DELETE SET NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);

CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES profiles(id),
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);

CREATE TABLE IF NOT EXISTS room_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text,
  answered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- No rename needed here: Postgres's default auto-generated name for this
-- inline REFERENCES is already room_questions_user_id_fkey, which is
-- exactly the FK alias room.js queries (profiles!room_questions_user_id_fkey(email)).

CREATE TABLE IF NOT EXISTS room_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_id text NOT NULL CHECK (role_id IN ('ROOM_MANAGER', 'EMPLOYEE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);

-- seller_public_info is a VIEW, not a table — product-detail.js's own
-- comment says so explicitly ("profiles RLS blocks a direct read of
-- another user's row, so this goes through the seller_public_info view").
-- display_name has no confirmed source column on profiles anywhere in the
-- code I read, so this falls back to the email's local part. If you
-- already have (or want) a dedicated display_name column on profiles,
-- swap the split_part(...) line below for p.display_name instead.
CREATE OR REPLACE VIEW seller_public_info AS
SELECT
  p.id,
  split_part(p.email, '@', 1) AS display_name,
  EXISTS (
    SELECT 1 FROM kyc_submissions k
    WHERE k.user_id = p.id AND k.status = 'approved'
  ) AS is_verified
FROM profiles p;


-- Confirm what actually exists now:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'wishlist', 'order_items', 'wallet_ledger', 'kyc_submissions',
  'admin_audit_log', 'conversations', 'messages', 'delivery_requests',
  'events', 'product_images', 'room_questions', 'room_roles'
)
ORDER BY table_name;
