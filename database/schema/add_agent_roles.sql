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
