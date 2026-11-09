#!/data/data/com.termux/files/usr/bin/bash
set -e
echo "Writing 2 SQL migration files: corrected role constraint (now includes 'government'), and the 13 missing tables reconciliation..."

mkdir -p "$(dirname "database/schema/add_agent_roles.sql")"
cat > database/schema/add_agent_roles.sql << 'BSTM_PATCH_EOF'
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New Query).
-- I can't run this myself — no network/DB access from where I work — so
-- this has to be pasted and run by hand, once, before the code changes
-- in this patch will actually work.

-- 1. Column agents' granted dashboard sections live in. Safe no-op if it
--    already exists.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_permissions jsonb;

-- 2. Widen whatever CHECK constraint governs profiles.role so 'agent' and
--    'super_admin' are valid values, not just 'buyer'/'seller'/'admin'.
--    This assumes the constraint has Postgres's default auto-generated name
--    (profiles_role_check) — the usual case when it wasn't explicitly named.
--    If the next ALTER TABLE ADD CONSTRAINT errors with "already exists" or
--    a name conflict, your constraint has a different name: run
--      SELECT conname FROM pg_constraint WHERE conrelid = 'profiles'::regclass AND contype = 'c';
--    to find its real name, swap it into the DROP line below, and re-run.
--    If profiles.role has NO check constraint at all (a plain text column),
--    both statements below are harmless no-ops.
DO $$
BEGIN
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 'government' is included here because monitoring-dashboard.js's own
-- access check already allows it (!["admin","super_admin","government"]) —
-- this constraint has to admit every role value any page actually checks
-- for, even ones this patch didn't add. If you've never used that role and
-- never plan to, it's harmless to leave allowed; it's just not possible to
-- safely guess it belonged here without having read that file.
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('buyer', 'seller', 'admin', 'agent', 'super_admin', 'government'));

-- 3. Make yourself the one and only super_admin. Replace the email below
--    with the actual email on your account before running.
UPDATE profiles SET role = 'super_admin' WHERE email = 'YOUR_EMAIL_HERE';

-- 4. Make your business partner an admin. Replace the email below with
--    theirs. (You can also do this later from Control Center's user
--    search instead of SQL — that's what it's now built for.)
UPDATE profiles SET role = 'admin' WHERE email = 'PARTNER_EMAIL_HERE';

-- 5. Confirm it worked.
SELECT email, role, agent_permissions FROM profiles WHERE role IN ('admin', 'agent', 'super_admin');


-- ============================================================================
-- IMPORTANT — READ THIS PART
-- ============================================================================
-- Everything above makes the role model exist in the database. It does NOT
-- by itself stop an agent's browser from directly querying tables outside
-- their granted sections — hiding a <div> in the dashboard is a UX
-- convenience, not access control. The actual enforcement has to happen
-- here, in Postgres, via Row Level Security (RLS) policies on each table
-- admin-dashboard.js and control-center.js touch: profiles, orders,
-- order_items, kyc_submissions, rooms, products, admin_audit_log.
--
-- I can't write correct RLS policies for you sight-unseen — they depend on
-- policies you already have (which I can't see from this repo; several of
-- these tables, like admin_audit_log itself, aren't even in your schema
-- files), and a wrong policy can either lock legitimate users out or leave
-- a hole wide open. Two honest options:
--   a) Paste me the output of this, for each table above, and I'll write
--      exact policies against what's actually there:
--        SELECT * FROM pg_policies WHERE tablename = 'orders';
--   b) Treat this patch as staff UI only for now (safe for a small,
--      trusted team, which is what you have today) and come back to RLS
--      before the team grows past people you'd trust with database access
--      directly.
BSTM_PATCH_EOF

mkdir -p "$(dirname "database/schema/missing_tables.sql")"
cat > database/schema/missing_tables.sql << 'BSTM_PATCH_EOF'
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
BSTM_PATCH_EOF

git add -A
git commit -m "Add missing_tables.sql reconciliation; fix add_agent_roles.sql to allow the government role"
git push
echo ""
echo "Pushed. Next: open database/schema/add_agent_roles.sql in Supabase SQL Editor"
echo "(fill in both emails first), run it, then run database/schema/missing_tables.sql"
echo "the same way — no email placeholders needed in that one, just run it as-is."
