-- X One Fitness member portal — schema, RLS, and Storage.
-- A cleaned-up translation of the legacy MySQL POS schema (tec_* tables in
-- db_onefitness) — see scripts/migrate-mysql-to-supabase.mjs for the ETL.
--
-- Safe to run more than once (idempotent): tables/indexes use IF NOT EXISTS,
-- functions use CREATE OR REPLACE, and triggers/policies are dropped first
-- if they already exist. Re-running this does NOT delete any data that's
-- already in the tables — if you want a full reset, truncate the tables
-- yourself first (see the project README/chat history for the reset script).

create extension if not exists "pgcrypto";

-- ── stores ───────────────────────────────────────────────────────────────
create table if not exists stores (
  id bigint generated always as identity primary key,
  name text not null,
  code text not null unique,
  phone text,
  address text,
  city text
);

-- ── product_categories / products ───────────────────────────────────────
create table if not exists product_categories (
  id bigint generated always as identity primary key,
  code text not null unique,
  name text not null,
  image_url text
);

create table if not exists products (
  id bigint generated always as identity primary key,
  code text not null unique,
  name text not null,
  category_id bigint references product_categories (id),
  price numeric(14, 2) not null,
  image_url text,
  -- Free-text duration label from the source data ("1 month", "3 month",
  -- "admin", "1 day") — drives the package card's duration line as-is.
  lifetime text
);

-- ── members ──────────────────────────────────────────────────────────────
-- auth_user_id is nullable so legacy rows can be migrated first and paired
-- with an auth.users row in the same migration step; new self-registrations
-- always have it set from the start (see the trigger below).
create table if not exists members (
  id bigint generated always as identity primary key,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  name text not null,
  phone text not null unique,
  email text,
  member_code text not null unique,
  id_card_number text,
  occupation text,
  sex text,
  birthplace text,
  dob date,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  photo_url text,
  status text not null default 'active' check (status in ('active', 'inactive', 'pending')),
  start_date date,
  end_date date,
  store_id bigint references stores (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_members_auth_user on members (auth_user_id);

create or replace function is_member()
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from members where auth_user_id = auth.uid());
$$;

create or replace function current_member_id()
returns bigint
language sql
security definer
stable
as $$
  select id from members where auth_user_id = auth.uid();
$$;

-- Self-registration (Register screen) → auto-create the members profile.
-- Legacy/migrated members skip this path entirely (the migration script
-- inserts their `members` row directly and pairs it with a separately
-- created auth user via `auth_user_id`).
create or replace function handle_new_member_user()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  insert into members (auth_user_id, name, phone, email, member_code, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'Member'),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    new.email,
    'XOF' || upper(substr(md5(new.id::text), 1, 8)),
    'active'
  )
  on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_member_created on auth.users;
create trigger on_auth_member_created
  after insert on auth.users
  for each row
  when (coalesce(new.raw_user_meta_data->>'role', 'member') = 'member')
  execute function handle_new_member_user();

-- ── orders / order_items / payments ─────────────────────────────────────
create table if not exists orders (
  id bigint generated always as identity primary key,
  code text not null unique,
  member_id bigint not null references members (id) on delete cascade,
  store_id bigint references stores (id),
  total numeric(14, 2) not null default 0,
  grand_total numeric(14, 2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_member on orders (member_id);

create table if not exists order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references orders (id) on delete cascade,
  product_id bigint references products (id),
  product_name text not null,
  quantity numeric(10, 2) not null default 1,
  unit_price numeric(14, 2) not null,
  subtotal numeric(14, 2) not null
);

create index if not exists idx_order_items_order on order_items (order_id);

create table if not exists payments (
  id bigint generated always as identity primary key,
  order_id bigint references orders (id) on delete cascade,
  member_id bigint not null references members (id) on delete cascade,
  amount numeric(14, 2) not null,
  method text,
  transaction_id text,
  proof_path text, -- Storage object path in the `payment-proofs` bucket
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_member on payments (member_id);
create index if not exists idx_payments_order on payments (order_id);

-- ── check_ins ────────────────────────────────────────────────────────────
create table if not exists check_ins (
  id bigint generated always as identity primary key,
  member_id bigint not null references members (id) on delete cascade,
  checked_in_at timestamptz not null,
  checked_out_at timestamptz,
  store_id bigint references stores (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_check_ins_member on check_ins (member_id);
create index if not exists idx_check_ins_checked_in_at on check_ins (checked_in_at);

-- ── Row Level Security ───────────────────────────────────────────────────
alter table stores enable row level security;
alter table product_categories enable row level security;
alter table products enable row level security;
alter table members enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payments enable row level security;
alter table check_ins enable row level security;

-- Catalog/reference data — readable by any signed-in member.
drop policy if exists "members can read stores" on stores;
create policy "members can read stores" on stores for select using (is_member());

drop policy if exists "members can read categories" on product_categories;
create policy "members can read categories" on product_categories for select using (is_member());

drop policy if exists "members can read products" on products;
create policy "members can read products" on products for select using (is_member());

-- Members can only ever see/edit their own profile.
drop policy if exists "members can read own profile" on members;
create policy "members can read own profile" on members for select using (auth_user_id = auth.uid());

drop policy if exists "members can update own profile" on members;
create policy "members can update own profile" on members for update using (auth_user_id = auth.uid());

drop policy if exists "members can read own orders" on orders;
create policy "members can read own orders" on orders for select using (member_id = current_member_id());

drop policy if exists "members can create own orders" on orders;
create policy "members can create own orders" on orders for insert with check (member_id = current_member_id());

drop policy if exists "members can read own order items" on order_items;
create policy "members can read own order items" on order_items for select using (
  exists (select 1 from orders o where o.id = order_items.order_id and o.member_id = current_member_id())
);

drop policy if exists "members can create own order items" on order_items;
create policy "members can create own order items" on order_items for insert with check (
  exists (select 1 from orders o where o.id = order_items.order_id and o.member_id = current_member_id())
);

drop policy if exists "members can read own payments" on payments;
create policy "members can read own payments" on payments for select using (member_id = current_member_id());

drop policy if exists "members can create own payments" on payments;
create policy "members can create own payments" on payments for insert with check (member_id = current_member_id());

drop policy if exists "members can read own check-ins" on check_ins;
create policy "members can read own check-ins" on check_ins for select using (member_id = current_member_id());

drop policy if exists "members can create own check-ins" on check_ins;
create policy "members can create own check-ins" on check_ins for insert with check (member_id = current_member_id());

drop policy if exists "members can update own check-ins" on check_ins;
create policy "members can update own check-ins" on check_ins for update using (member_id = current_member_id());

-- ── Storage ──────────────────────────────────────────────────────────────
-- Private bucket for order payment-proof uploads, path convention
-- `members/{member_id}/{filename}`.
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

drop policy if exists "members can read own payment proofs" on storage.objects;
create policy "members can read own payment proofs" on storage.objects for select
  using (bucket_id = 'payment-proofs' and is_member());

drop policy if exists "members can upload own payment proofs" on storage.objects;
create policy "members can upload own payment proofs" on storage.objects for insert
  with check (bucket_id = 'payment-proofs' and is_member());
