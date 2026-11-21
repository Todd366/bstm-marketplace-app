-- APPLIED 2026-11-20 to project tvtfxkavjqvurdezhyvu as migration "stage2a_stock_reservations_cancel_restore_reward_20261120".
-- Proven first in a rolled-back transaction (13 checks PASS), re-verified live afterwards (row counts unchanged).
-- Stage 2a (additive, nothing dropped): stock reservations, stock back on cancel, reward on delivery.
-- 1. Reservations: stock can only be given back by the person who reserved it.
create table if not exists public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  qty integer not null check (qty > 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '20 minutes',
  closed_at timestamptz,
  closed_reason text check (closed_reason in ('consumed','released','expired'))
);
create index if not exists stock_reservations_open_idx on public.stock_reservations (user_id, product_id) where closed_at is null;
create index if not exists stock_reservations_expiry_idx on public.stock_reservations (expires_at) where closed_at is null;
alter table public.stock_reservations enable row level security;
revoke all on public.stock_reservations from anon, authenticated;

create table if not exists public.order_stock_releases (
  order_id uuid primary key references public.orders(id) on delete cascade,
  released_at timestamptz not null default now()
);
alter table public.order_stock_releases enable row level security;
revoke all on public.order_stock_releases from anon, authenticated;

create or replace function public.decrement_product_stock(p_product_id uuid, p_qty integer)
returns boolean language plpgsql security definer set search_path to 'public','pg_temp' as $f$
declare v_uid uuid := auth.uid(); v_open integer; v_updated integer;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_qty is null or p_qty <= 0 or p_qty > 100 then raise exception 'Quantity must be between 1 and 100'; end if;
  select coalesce(sum(qty), 0) into v_open from public.stock_reservations
   where user_id = v_uid and product_id = p_product_id and closed_at is null and expires_at > now();
  if v_open + p_qty > 100 then raise exception 'Too much of this item is already reserved'; end if;
  update public.products set quantity = quantity - p_qty
   where id = p_product_id and quantity >= p_qty and status = 'active';
  get diagnostics v_updated = row_count;
  if v_updated = 0 then return false; end if;
  insert into public.stock_reservations (user_id, product_id, qty) values (v_uid, p_product_id, p_qty);
  return true;
end $f$;

create or replace function public.restore_product_stock(p_product_id uuid, p_qty integer)
returns void language plpgsql security definer set search_path to 'public','pg_temp' as $f$
declare v_uid uuid := auth.uid(); v_left integer := p_qty; v_take integer; r record;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Quantity must be positive'; end if;
  for r in select id, qty from public.stock_reservations
            where user_id = v_uid and product_id = p_product_id and closed_at is null
            order by created_at for update loop
    exit when v_left <= 0;
    v_take := least(r.qty, v_left);
    if v_take = r.qty then
      update public.stock_reservations set closed_at = now(), closed_reason = 'released' where id = r.id;
    else
      update public.stock_reservations set qty = qty - v_take where id = r.id;
      insert into public.stock_reservations (user_id, product_id, qty, closed_at, closed_reason)
      values (v_uid, p_product_id, v_take, now(), 'released');
    end if;
    update public.products set quantity = quantity + v_take where id = p_product_id;
    v_left := v_left - v_take;
  end loop;
end $f$;

-- 2. A buyer's order line must be covered by stock that buyer reserved (stops ordering more than is in stock).
create or replace function public.order_items_consume_reservation()
returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $f$
declare
  v_role text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
  v_buyer uuid; v_left integer; v_take integer; r record;
begin
  if v_role <> 'authenticated' then return new; end if;
  select buyer_id into v_buyer from public.orders where id = new.order_id;
  if v_buyer is null or v_buyer <> auth.uid() then return new; end if;
  if new.product_id is null then return new; end if;
  if new.quantity is null or new.quantity <= 0 then raise exception 'Quantity must be positive'; end if;
  v_left := new.quantity;
  for r in select id, qty from public.stock_reservations
            where user_id = v_buyer and product_id = new.product_id and closed_at is null and expires_at > now()
            order by created_at for update loop
    exit when v_left <= 0;
    v_take := least(r.qty, v_left);
    if v_take = r.qty then
      update public.stock_reservations set closed_at = now(), closed_reason = 'consumed' where id = r.id;
    else
      update public.stock_reservations set qty = qty - v_take where id = r.id;
      insert into public.stock_reservations (user_id, product_id, qty, closed_at, closed_reason)
      values (v_buyer, new.product_id, v_take, now(), 'consumed');
    end if;
    v_left := v_left - v_take;
  end loop;
  if v_left > 0 then
    raise exception 'Stock for "%" is not reserved (it may have expired). Please place the order again.', coalesce(new.product_name, 'item');
  end if;
  return new;
end $f$;
drop trigger if exists trg_10_order_items_consume_reservation on public.order_items;
create trigger trg_10_order_items_consume_reservation before insert on public.order_items
  for each row execute function public.order_items_consume_reservation();
do $c$ begin
  if not exists (select 1 from pg_constraint where conname = 'order_items_qty_positive') then
    alter table public.order_items add constraint order_items_qty_positive check (quantity > 0) not valid;
  end if;
end $c$;

-- 3. Unpaid reservations go back on the shelf.
create or replace function public.stock_reservations_release_expired()
returns integer language plpgsql security definer set search_path to 'public','pg_temp' as $f$
declare r record; n integer := 0;
begin
  for r in select id, product_id, qty from public.stock_reservations
            where closed_at is null and expires_at < now() order by expires_at for update skip locked loop
    update public.products set quantity = quantity + r.qty where id = r.product_id;
    update public.stock_reservations set closed_at = now(), closed_reason = 'expired' where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $f$;
revoke all on function public.stock_reservations_release_expired() from public, anon, authenticated;

-- 4. Cancelled order -> stock back, exactly once.
create or replace function public.orders_release_stock_on_cancel()
returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $f$
declare it record; v_ins integer;
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    insert into public.order_stock_releases (order_id) values (new.id) on conflict do nothing;
    get diagnostics v_ins = row_count;
    if v_ins = 1 then
      for it in select product_id, quantity from public.order_items where order_id = new.id and product_id is not null loop
        update public.products set quantity = quantity + coalesce(it.quantity, 1) where id = it.product_id;
      end loop;
    end if;
  end if;
  return null;
end $f$;
revoke all on function public.orders_release_stock_on_cancel() from public, anon, authenticated;
drop trigger if exists trg_orders_release_stock_on_cancel on public.orders;
create trigger trg_orders_release_stock_on_cancel after update of status on public.orders
  for each row execute function public.orders_release_stock_on_cancel();

-- the payment-expiry job used to put stock back itself; the trigger above now does it (once)
create or replace function public.payments_expire_stale()
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $f$
declare g record; o record; v_groups integer := 0; v_orders integer := 0;
begin
  for g in select id from public.payment_groups where status = 'pending' and expires_at < now() order by expires_at loop
    perform public.payments_apply_outcome(g.id, 'expired', 'expired', null, null, null, null, 'payment window expired');
    v_groups := v_groups + 1;
  end loop;
  for o in
    select id from public.orders
     where coalesce(payment_method, 'cod') <> 'cod' and status = 'pending'
       and payment_status in ('unpaid','failed') and payment_due_at is not null and payment_due_at < now()
     order by id for update skip locked
  loop
    perform set_config('bstm.trusted_order_write', 'on', true);
    update public.orders set status = 'cancelled' where id = o.id;
    perform set_config('bstm.trusted_order_write', 'off', true);
    insert into public.order_status_history (order_id, changed_by, from_status, to_status, note)
    values (o.id, null, 'pending', 'cancelled', 'Payment not received in time - stock released');
    update public.delivery_requests set status = 'cancelled', updated_at = now()
     where order_id = o.id and status = 'pending' and cablink_ride_id is null;
    v_orders := v_orders + 1;
  end loop;
  return jsonb_build_object('groups_expired', v_groups, 'orders_cancelled', v_orders);
end $f$;

-- 5. Reward is paid by the database when an order becomes delivered (1%, once per order, never to the room's own staff).
create or replace function public.credit_purchase_reward_internal(p_order_id uuid)
returns integer language plpgsql security definer set search_path to 'public','pg_temp' as $f$
declare v_buyer uuid; v_seller uuid; v_room uuid; v_status text; v_total numeric; v_reward integer; v_rows integer;
begin
  select buyer_id, seller_id, room_id, status into v_buyer, v_seller, v_room, v_status from public.orders where id = p_order_id;
  if v_buyer is null or v_status <> 'delivered' then return 0; end if;
  if (v_seller is not null and v_seller = v_buyer)
     or (v_room is not null and exists (select 1 from public.room_roles rr where rr.room_id = v_room and rr.user_id = v_buyer)) then
    return 0;
  end if;
  select coalesce(sum(quantity * unit_price), 0) into v_total from public.order_items where order_id = p_order_id and product_id is not null;
  v_reward := round(v_total * 0.01);
  if v_reward <= 0 then return 0; end if;
  insert into public.wallet_ledger (user_id, amount_thb, type, reference_type, reference_id, meta)
  values (v_buyer, v_reward, 'credit', 'order', p_order_id, jsonb_build_object('reason', 'purchase_reward'))
  on conflict (reference_id) where reference_type = 'order' and type = 'credit' do nothing;
  get diagnostics v_rows = row_count;
  return case when v_rows = 1 then v_reward else 0 end;
end $f$;
revoke all on function public.credit_purchase_reward_internal(uuid) from public, anon, authenticated;

create or replace function public.orders_reward_on_delivered()
returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $f$
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    perform public.credit_purchase_reward_internal(new.id);
  end if;
  return null;
end $f$;
revoke all on function public.orders_reward_on_delivered() from public, anon, authenticated;
drop trigger if exists trg_orders_reward_on_delivered on public.orders;
create trigger trg_orders_reward_on_delivered after update of status on public.orders
  for each row execute function public.orders_reward_on_delivered();

select cron.schedule('stock-reservations-release', '*/5 * * * *', 'select public.stock_reservations_release_expired()');

-- APPLIED 2026-11-20 as migration "stage2a_revoke_trigger_fn_execute_20261120" (the Supabase advisor flagged the trigger function as callable through the API):
revoke all on function public.order_items_consume_reservation() from public, anon, authenticated;
