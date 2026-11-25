-- Stage 3: a separate account per workspace (Buyer, Seller, Agent, Admin, Government).
--
-- One person (one sign-in email) can hold several workspace accounts, each created at that workspace's own door
-- and each with its own recorded acceptance of the Terms and Privacy Policy. Buyer and Seller accounts are created
-- by the person (register_workspace). Agent, Admin and Government accounts are never self-registered: they follow
-- the staff role in public.profiles (trigger below) and are created by BSTM.
--
-- Server-enforced: only a Seller account can open a room, only a Buyer account can place an order.
-- Nothing is dropped. Existing people keep what they already had (backfill at the bottom).

create table if not exists public.workspace_accounts (
  user_id          uuid        not null references auth.users(id) on delete cascade,
  workspace        text        not null check (workspace in ('buyer','seller','agent','admin','government')),
  status           text        not null default 'active' check (status in ('active','suspended')),
  registered_via   text        not null default 'self'   check (registered_via in ('self','staff','migrated')),
  registered_at    timestamptz not null default now(),
  terms_version    text,
  terms_accepted_at timestamptz,
  primary key (user_id, workspace)
);

alter table public.workspace_accounts enable row level security;

revoke all on table public.workspace_accounts from public, anon, authenticated;
grant select on table public.workspace_accounts to authenticated;

create policy wa_select_own on public.workspace_accounts
  for select to authenticated using (user_id = (select auth.uid()));

create policy wa_select_staff on public.workspace_accounts
  for select to authenticated using ((select public.is_staff()));

-- Create (or re-accept terms for) your own Buyer or Seller account. Staff workspaces cannot be self-registered.
create or replace function public.register_workspace(p_workspace text, p_terms_version text)
returns public.workspace_accounts
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_row public.workspace_accounts;
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if p_workspace is null or p_workspace not in ('buyer','seller') then
    raise exception 'Accounts for this workspace are created by BSTM' using errcode = '42501';
  end if;
  if coalesce(btrim(p_terms_version), '') = '' then
    raise exception 'You must accept the Terms and Privacy Policy' using errcode = '22023';
  end if;

  insert into public.workspace_accounts (user_id, workspace, registered_via, terms_version, terms_accepted_at)
  values (v_uid, p_workspace, 'self', btrim(p_terms_version), now())
  on conflict (user_id, workspace) do update
    set terms_version = excluded.terms_version, terms_accepted_at = excluded.terms_accepted_at
    where public.workspace_accounts.status = 'active'
  returning * into v_row;

  if v_row.user_id is null then
    raise exception 'This account is suspended' using errcode = '42501';
  end if;
  return v_row;
end $$;

-- Record acceptance of a newer Terms version on an account you already have (any workspace, staff included).
create or replace function public.accept_terms(p_workspace text, p_terms_version text)
returns public.workspace_accounts
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_row public.workspace_accounts;
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if coalesce(btrim(p_terms_version), '') = '' then
    raise exception 'You must accept the Terms and Privacy Policy' using errcode = '22023';
  end if;
  update public.workspace_accounts
     set terms_version = btrim(p_terms_version), terms_accepted_at = now()
   where user_id = v_uid and workspace = p_workspace and status = 'active'
  returning * into v_row;
  if v_row.user_id is null then
    raise exception 'No active % account', p_workspace using errcode = '42501';
  end if;
  return v_row;
end $$;

revoke all on function public.register_workspace(text, text) from public, anon;
revoke all on function public.accept_terms(text, text) from public, anon;
grant execute on function public.register_workspace(text, text) to authenticated;
grant execute on function public.accept_terms(text, text) to authenticated;

-- Staff workspace accounts follow the staff role in profiles (roles themselves are still locked by
-- profiles_block_role_change; this only keeps the two in step whenever BSTM sets a role).
create or replace function public.workspace_accounts_sync_staff()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_ws text := case new.role
    when 'agent' then 'agent'
    when 'admin' then 'admin'
    when 'super_admin' then 'admin'
    when 'government' then 'government'
    else null end;
begin
  if v_ws is not null then
    insert into public.workspace_accounts (user_id, workspace, registered_via)
    values (new.id, v_ws, 'staff')
    on conflict (user_id, workspace) do update set status = 'active';
  end if;
  update public.workspace_accounts
     set status = 'suspended'
   where user_id = new.id
     and workspace in ('agent','admin','government')
     and workspace is distinct from v_ws
     and status = 'active';
  return new;
end $$;

revoke all on function public.workspace_accounts_sync_staff() from public, anon, authenticated;

create trigger profiles_sync_workspace_accounts
  after insert or update of role on public.profiles
  for each row execute function public.workspace_accounts_sync_staff();

-- The server refuses what the front door already hides.
create policy rooms_insert_needs_seller_account on public.rooms
  as restrictive for insert to authenticated
  with check (exists (
    select 1 from public.workspace_accounts w
     where w.user_id = (select auth.uid()) and w.workspace = 'seller' and w.status = 'active'));

create policy orders_insert_needs_buyer_account on public.orders
  as restrictive for insert to authenticated
  with check (exists (
    select 1 from public.workspace_accounts w
     where w.user_id = (select auth.uid()) and w.workspace = 'buyer' and w.status = 'active'));

-- Backfill: everyone keeps what they already could use. Terms version stays empty: they accept at their next sign-in.
insert into public.workspace_accounts (user_id, workspace, registered_via)
select distinct x.user_id, x.workspace, 'migrated'
from (
  select p.id as user_id, 'buyer'::text as workspace from public.profiles p where p.role in ('buyer','seller','admin','super_admin')
  union all select p.id, 'seller' from public.profiles p where p.role in ('seller','admin','super_admin')
  union all select rr.user_id, 'seller' from public.room_roles rr
  union all select r.seller_id, 'seller' from public.rooms r
  union all select p.id, 'agent' from public.profiles p where p.role = 'agent'
  union all select p.id, 'admin' from public.profiles p where p.role in ('admin','super_admin')
  union all select p.id, 'government' from public.profiles p where p.role = 'government'
) x
where exists (select 1 from auth.users u where u.id = x.user_id)
on conflict (user_id, workspace) do nothing;
