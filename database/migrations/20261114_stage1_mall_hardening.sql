-- APPLIED 2026-11-14 to project tvtfxkavjqvurdezhyvu as migration "stage1_mall_hardening_20261114" (Todd approved). Proven in a cancelled transaction (25 checks PASS), re-proven live afterwards; live row counts unchanged.
-- STAGE 1 HARDENING (2026-11-13) for the Digital Mall tables.
-- Additive / replace-only: no DROP of any function, table or column. Forge, Activation and CabLink tables are not touched.
-- Closes (see claude/audit-2026-11-09.md): S1 forged-item reward, S3 KYC self-approval, S4 transfer hijack,
-- S5 orders trust the browser for seller/room, S6 over-broad grants, S7 public views, S9 missing indexes.
-- NOT closed here (closed later by Stage 2a, see 20261120_stage2a_stock_reservations_rewards.sql): S2 stock functions, quantity over stock.

-- ------------------------------------------------------------ 1. order items: real product, database price, pending order only
create or replace function public.order_items_enforce_pricing()
returns trigger language plpgsql security definer set search_path to 'public' as $f$
declare
  v_status text;
  v_order_seller uuid;
  v_name text;
  v_price numeric;
  v_product_seller uuid;
begin
  if new.quantity is null or new.quantity <= 0 then
    raise exception 'Quantity must be positive';
  end if;
  select status, seller_id into v_status, v_order_seller from public.orders where id = new.order_id;
  if v_status is null then
    raise exception 'Order not found';
  end if;
  if v_status <> 'pending' then
    raise exception 'Items can only be added to a pending order (status is %)', v_status;
  end if;
  if new.product_id is null then
    raise exception 'order_items:product_required';
  end if;
  select name, price, seller_id into v_name, v_price, v_product_seller from public.products where id = new.product_id;
  if not found then
    raise exception 'order_items:product_not_found';
  end if;
  if v_price is null or v_price < 0 then
    raise exception 'order_items:product_unpriced';
  end if;
  if v_order_seller is not null and v_product_seller is distinct from v_order_seller then
    raise exception 'order_items:product_not_from_order_seller';
  end if;
  new.unit_price := v_price;
  new.product_name := coalesce(v_name, new.product_name);
  return new;
end;
$f$;

-- ------------------------------------------------------------ 2. orders: seller and room come from the product, never from the browser
create or replace function public.orders_enforce_integrity()
returns trigger language plpgsql security definer set search_path to 'public' as $f$
declare
  v_seller uuid;
  v_room uuid;
begin
  if new.product_id is null then
    raise exception 'orders:product_required';
  end if;
  select seller_id, room_id into v_seller, v_room from public.products where id = new.product_id;
  if not found then
    raise exception 'orders:product_not_found';
  end if;
  new.seller_id := v_seller;
  new.room_id := v_room;
  if new.total_amount is not null and new.total_amount < 0 then
    raise exception 'orders:total_invalid';
  end if;
  return new;
end;
$f$;

create or replace trigger trg_00_orders_enforce_integrity
  before insert on public.orders
  for each row execute function public.orders_enforce_integrity();

-- ------------------------------------------------------------ 3. reward: delivered orders only, never to the room's own people, once per order
create unique index if not exists wallet_ledger_order_reward_once
  on public.wallet_ledger (reference_id) where reference_type = 'order' and type = 'credit';

create or replace function public.credit_purchase_reward(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare
  v_buyer uuid;
  v_seller uuid;
  v_room uuid;
  v_status text;
  v_total numeric;
  v_reward integer;
  v_pct numeric := 0.01; -- matches CONFIG.MARKETPLACE.REWARD_PERCENT in the frontend
  v_rows integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select buyer_id, seller_id, room_id, status into v_buyer, v_seller, v_room, v_status
    from public.orders where id = p_order_id;
  if v_buyer is null then
    raise exception 'Order not found';
  end if;
  if v_buyer <> auth.uid() then
    raise exception 'Not your order';
  end if;
  if v_status <> 'delivered' then
    raise exception 'Rewards are credited once the order is delivered';
  end if;
  -- no self-dealing: the room's owner and staff never earn a reward on their own room
  if (v_seller is not null and v_seller = v_buyer)
     or (v_room is not null and exists (select 1 from public.room_roles rr where rr.room_id = v_room and rr.user_id = v_buyer)) then
    return jsonb_build_object('success', true, 'reward', 0, 'reason', 'own_room');
  end if;

  select coalesce(sum(quantity * unit_price), 0) into v_total
    from public.order_items where order_id = p_order_id and product_id is not null;
  v_reward := round(v_total * v_pct);

  if v_reward > 0 then
    insert into public.wallet_ledger (user_id, amount_thb, type, reference_type, reference_id, meta)
    values (v_buyer, v_reward, 'credit', 'order', p_order_id, jsonb_build_object('reason', 'purchase_reward'))
    on conflict (reference_id) where reference_type = 'order' and type = 'credit' do nothing;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      return jsonb_build_object('success', true, 'already_rewarded', true);
    end if;
  end if;
  return jsonb_build_object('success', true, 'reward', v_reward);
end;
$f$;

-- ------------------------------------------------------------ 4. KYC: a new row is always pending; identity changes after approval go back to review
create or replace function public.kyc_force_pending_on_insert()
returns trigger language plpgsql security definer set search_path to 'public' as $f$
begin
  if not public.is_staff() then
    new.status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;
  return new;
end;
$f$;

create or replace trigger kyc_force_pending_on_insert
  before insert on public.kyc_submissions
  for each row execute function public.kyc_force_pending_on_insert();

create or replace function public.lock_kyc_review_columns()
returns trigger language plpgsql security definer set search_path to 'public' as $f$
begin
  if not public.is_staff() then
    new.user_id := old.user_id;
    if old.status = 'approved' and (
         new.full_name is distinct from old.full_name
      or new.national_id is distinct from old.national_id
      or new.phone is distinct from old.phone
      or new.country is distinct from old.country
      or new.document_storage_path is distinct from old.document_storage_path) then
      -- changed identity details are no longer what staff approved
      new.status := 'pending';
      new.reviewed_by := null;
      new.reviewed_at := null;
    elsif new.status = 'pending' then
      new.reviewed_by := null;
      new.reviewed_at := null;
    else
      new.status := old.status;
      new.reviewed_by := old.reviewed_by;
      new.reviewed_at := old.reviewed_at;
    end if;
  end if;
  return new;
end;
$f$;

-- ------------------------------------------------------------ 5. profiles.email follows the login email; transfers find the recipient by login email
create or replace function public.lock_privileged_profile_columns()
returns trigger language plpgsql security definer set search_path to 'public' as $f$
begin
  if not public.is_staff() and coalesce(current_setting('bstm.trusted_balance_write', true), '') <> 'on' then
    new.role := old.role;
    new.thb_balance := old.thb_balance;
  end if;
  if auth.uid() is not null and not public.is_staff() then
    new.email := old.email;
  end if;
  return new;
end;
$f$;

create or replace function public.transfer_thb(recipient_email text, amount integer)
returns jsonb language plpgsql security definer set search_path to 'public' as $f$
declare
  sender_id uuid := auth.uid();
  sender_balance integer;
  recipient_id uuid;
  v_matches integer;
  v_sender_email text;
  v_to text := lower(trim(coalesce(recipient_email, '')));
begin
  if sender_id is null then
    raise exception 'Not authenticated';
  end if;
  if amount is null or amount <= 0 then
    raise exception 'Invalid amount';
  end if;

  -- FOR UPDATE locks this row until the transaction commits, so a second concurrent call from
  -- the same sender blocks here instead of both reading a stale pre-debit balance.
  select thb_balance into sender_balance from public.profiles where id = sender_id for update;
  if coalesce(sender_balance, 0) < amount then
    raise exception 'Insufficient balance';
  end if;

  select count(*) into v_matches from auth.users u where lower(u.email) = v_to;
  if v_to = '' or v_matches <> 1 then
    raise exception 'No BSTM user found with that email';
  end if;
  select u.id into recipient_id from auth.users u where lower(u.email) = v_to;
  if not exists (select 1 from public.profiles where id = recipient_id) then
    raise exception 'No BSTM user found with that email';
  end if;
  if recipient_id = sender_id then
    raise exception 'You cannot send THB to yourself';
  end if;

  select email into v_sender_email from auth.users where id = sender_id;

  insert into public.wallet_ledger (user_id, amount_thb, type, reference_type, meta)
  values (sender_id, amount, 'debit', 'transfer', jsonb_build_object('to', v_to));
  insert into public.wallet_ledger (user_id, amount_thb, type, reference_type, meta)
  values (recipient_id, amount, 'credit', 'transfer', jsonb_build_object('from', v_sender_email));

  return jsonb_build_object('success', true, 'recipient_email', v_to, 'amount', amount);
end;
$f$;

-- ------------------------------------------------------------ 6. public views: sellers only, no email fallback
create or replace view public.seller_public_info as
  select p.id,
         coalesce(
           nullif(case when lower(u.raw_user_meta_data ->> 'full_name') = lower(split_part(u.email, '@', 1))
                       then null else u.raw_user_meta_data ->> 'full_name' end, ''),
           (select r.name from public.rooms r where r.seller_id = p.id order by r.room_number limit 1),
           'BSTM Seller'
         ) as display_name,
         exists (select 1 from public.kyc_submissions k where k.user_id = p.id and k.status = 'approved') as is_verified
  from public.profiles p
  join auth.users u on u.id = p.id
  where exists (select 1 from public.rooms r where r.seller_id = p.id);

create or replace view public.seller_verification as
  select p.id,
         exists (select 1 from public.kyc_submissions k where k.user_id = p.id and k.status = 'approved') as is_verified
  from public.profiles p
  where exists (select 1 from public.rooms r where r.seller_id = p.id);

-- ------------------------------------------------------------ 7. privileges: RLS stays, but the grants stop being "everything for everyone"
do $g$
declare
  t text;
begin
  foreach t in array array[
    'orders','order_items','products','product_images','profiles','rooms','room_roles','user_roles','roles',
    'kyc_submissions','wallet_ledger','bwp_wallet_accounts','bwp_wallet_ledger','notifications','conversations',
    'messages','reviews','referrals','wishlist','analytics_events','admin_audit_log','delivery_requests',
    'order_status_history','counter_sales','counter_sale_items','categories','room_questions','events'
  ] loop
    execute format('revoke truncate, references, trigger on table public.%I from anon, authenticated', t);
    if t <> 'events' then
      execute format('revoke insert, update, delete on table public.%I from anon', t);
    end if;
  end loop;
  -- payment tables are reached only through the payments edge function and the definer RPCs
  foreach t in array array['payment_events','payment_groups','payment_providers','payment_transactions','payment_account_connections','seller_payout_queue'] loop
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end
$g$;

-- trigger functions and the balance recompute are internal: nobody calls them through the API
do $g$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prorettype = 'trigger'::regtype
      and p.proname <> 'handle_new_user'
      and p.proname not like 'forge\_%' and p.proname not like 'act\_%' and p.proname not like 'cablink%'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end
$g$;
revoke execute on function public.recompute_thb_balance(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------ 8. indexes the dashboards and policies already need
create index if not exists idx_order_items_order_id on public.order_items (order_id);
create index if not exists idx_order_items_product_id on public.order_items (product_id);
create index if not exists idx_rooms_seller_id on public.rooms (seller_id);
create index if not exists idx_room_roles_room_id on public.room_roles (room_id);
create index if not exists idx_wishlist_product_id on public.wishlist (product_id);
create index if not exists idx_orders_payment_group_id on public.orders (payment_group_id);
create index if not exists idx_admin_audit_log_actor on public.admin_audit_log (actor);
create index if not exists idx_messages_sender_id on public.messages (sender_id);

notify pgrst, 'reload schema';
