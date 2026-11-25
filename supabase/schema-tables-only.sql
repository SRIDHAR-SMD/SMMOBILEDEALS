-- SM Mobile Deals — STEP 1: tables + RLS + storage buckets ONLY (no product data).
-- Then run seed/seed-1-of-6.sql ... seed-6-of-6.sql in order, one by one.
-- (Same as the top part of schema.sql; split out because the full file is too big to paste in one go.)

-- ==========================================================================
-- SM MOBILE DEALS — SUPABASE SCHEMA
-- Run this entire file in: Supabase Dashboard → SQL Editor → New Query → Run
-- Mirrors the localStorage collections used in js/data.js:
-- products, categories, orders, users(profiles), reviews, offers
-- ==========================================================================

-- ---------- PROFILES (extends built-in auth.users) ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address text,
  city text,
  state text,
  pincode text,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever someone signs up
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', 'Customer'), new.email, 'customer');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ---------- CATEGORIES ----------
create table if not exists categories (
  id text primary key,
  name text not null,
  icon text
);

-- ---------- PRODUCTS ----------
create table if not exists products (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  brand text not null,
  category text not null references categories(id),
  type text not null default 'phone',
  price numeric not null,
  mrp numeric not null,
  stock integer not null default 0,
  rating numeric default 4.3,
  reviews_count integer default 0,
  color text default '#4c8dff',
  specs text[] default '{}',
  description text,
  condition text not null default 'new' check (condition in ('new','sealed','seal_cut','demo','used')),
  cpu_tier text,
  is_pre_order boolean not null default false,
  avail_date text,
  image_url text,
  video_url text,
  images text[] default '{}',      -- up to 10 photo URLs for this product
  videos text[] default '{}',      -- extra video clip URLs (short demo/unboxing clips)
  product_url text,                -- optional external / manufacturer link shown on the product page
  warranty_type text check (warranty_type in ('checking','non_checking')),
  warranty_period text check (warranty_period in ('7_days','15_days','30_days','1_year')),
  created_at timestamptz not null default now()
);

-- Safe to re-run: adds the new media/warranty columns to an already-deployed
-- products table without touching existing data.
alter table products add column if not exists images text[] default '{}';
alter table products add column if not exists videos text[] default '{}';
alter table products add column if not exists product_url text;
alter table products add column if not exists warranty_type text;
alter table products add column if not exists warranty_period text;

-- Structured, individually-editable spec fields (separate from the free-form
-- `specs` bullet list) so Storage/RAM/Model/Color/Variant/Features can each
-- be edited on their own in the admin panel instead of being buried inside
-- one text blob. `custom_fields` covers anything not covered by a named
-- column — an array of {label, value} pairs, editable/addable/removable
-- per product from the admin panel.
alter table products add column if not exists storage text;
alter table products add column if not exists ram text;
alter table products add column if not exists model_name text;
alter table products add column if not exists color_name text;
alter table products add column if not exists variant text;
alter table products add column if not exists features text[] default '{}';
alter table products add column if not exists custom_fields jsonb default '[]';

-- ---------- STORE SETTINGS (key/value — admin signature image, etc.) ----------
create table if not exists store_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

-- ---------- NOTIFICATIONS (persistent bell/inbox — customer + admin) ----------
-- audience='customer' + user_id=<their id>  -> shown only to that customer
-- audience='admin'    + user_id=null        -> shown to every admin
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  audience text not null check (audience in ('customer','admin')),
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- OFFERS ----------
create table if not exists offers (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  sub text,
  code text
);

-- ---------- REVIEWS (site testimonials, not per-product) ----------
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  text text not null,
  rating numeric not null,
  created_at timestamptz not null default now()
);

-- ---------- SITE VISITS (lightweight visitor ping, used for admin notifications) ----------
create table if not exists site_visits (
  id bigint generated always as identity primary key,
  path text,
  visited_at timestamptz not null default now()
);
create table if not exists orders (
  id text primary key,                          -- e.g. SMD2607123456
  user_id uuid references auth.users(id),
  items jsonb not null,                          -- [{id,name,price,qty,type,color}]
  address jsonb not null,                        -- {name,phone,line1,city,state,pincode}
  payment_method text not null check (payment_method in ('upi','card','cod','advance')),
  totals jsonb not null,                         -- {subtotal,deliveryFee,cardSurcharge,total}
  delivery_estimate text,
  payment_status text not null default 'awaiting_payment'
    check (payment_status in ('awaiting_payment','pending_confirmation','confirmed','rejected','cod')),
  order_status text not null default 'payment_pending'
    check (order_status in ('payment_pending','confirmed','packed','shipped','out_for_delivery','delivered','cancelled')),
  screenshot_url text,                           -- Supabase Storage public URL
  reject_reason text,
  timeline jsonb not null default '[]',
  refund_status text check (refund_status in ('pending','sent')),  -- null = no refund applicable
  refund_amount numeric,           -- total minus commission, sent back to the customer
  refund_commission numeric,       -- fixed amount SM Mobile Deals keeps (₹1000)
  refund_due_date timestamptz,     -- cancellation date + 7 days
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Safe to re-run: adds refund columns to an already-deployed orders table.
alter table orders add column if not exists refund_status text;
alter table orders add column if not exists refund_amount numeric;
alter table orders add column if not exists refund_commission numeric;
alter table orders add column if not exists refund_due_date timestamptz;

-- Advance Payment option — customer pays a fixed ₹1000 non-refundable
-- booking amount, then pays the remaining balance separately. Same-day
-- courier dispatch only if the balance is paid before 6:00 PM; otherwise
-- dispatch moves to the next day.
alter table orders drop constraint if exists orders_payment_method_check;
alter table orders add constraint orders_payment_method_check
  check (payment_method in ('upi','card','cod','advance'));
alter table orders add column if not exists balance_status text
  check (balance_status in ('not_due','due','pending_confirmation','paid'));
alter table orders add column if not exists balance_screenshot_url text;
alter table orders add column if not exists balance_paid_at timestamptz;
alter table orders add column if not exists dispatch_note text;

-- Courier tracking (the app saves these on every order; without the columns
-- saving/loading orders fails, which breaks "My Orders" and tracking).
alter table orders add column if not exists courier text;
alter table orders add column if not exists tracking_number text;
alter table orders add column if not exists tracking_url text;

-- ==========================================================================
-- ROW LEVEL SECURITY
-- ==========================================================================

alter table profiles enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table offers enable row level security;
alter table reviews enable row level security;
alter table orders enable row level security;
alter table site_visits enable row level security;
alter table store_settings enable row level security;
alter table notifications enable row level security;

-- Helper: is the current user an admin?
create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- ---- profiles ----
create policy "profiles: read own or admin" on profiles for select
  using (auth.uid() = id or is_admin());
create policy "profiles: update own or admin" on profiles for update
  using (auth.uid() = id or is_admin());

-- ---- categories / products / offers / reviews: public read, admin write ----
create policy "categories: public read" on categories for select using (true);
create policy "categories: admin write" on categories for all using (is_admin());

create policy "products: public read" on products for select using (true);
create policy "products: admin write" on products for all using (is_admin());

create policy "offers: public read" on offers for select using (true);
create policy "offers: admin write" on offers for all using (is_admin());

create policy "reviews: public read" on reviews for select using (true);
create policy "reviews: signed-in insert" on reviews for insert with check (auth.uid() is not null);
create policy "reviews: admin manage" on reviews for update using (is_admin());
create policy "reviews: admin delete" on reviews for delete using (is_admin());

-- ---- store_settings: public read (invoice/signature shown to customers too), admin write ----
create policy "store_settings: public read" on store_settings for select using (true);
create policy "store_settings: admin write" on store_settings for all using (is_admin());

-- ---- notifications: customer sees/marks-read only their own; admin sees/marks-read admin ones ----
create policy "notifications: customer reads own" on notifications
  for select using (audience = 'customer' and user_id = auth.uid());
create policy "notifications: admin reads admin ones" on notifications
  for select using (audience = 'admin' and is_admin());
create policy "notifications: customer marks own read" on notifications
  for update using (audience = 'customer' and user_id = auth.uid());
create policy "notifications: admin marks admin ones read" on notifications
  for update using (audience = 'admin' and is_admin());
-- Either side can create a notification for the other — a customer placing/
-- paying for their own order notifies the admin, and an admin confirming a
-- payment notifies that customer.
create policy "notifications: authenticated can insert" on notifications
  for insert with check (auth.uid() is not null);

-- ---- orders: customers see only their own, admin sees & manages all ----
create policy "orders: read own or admin" on orders for select
  using (auth.uid() = user_id or is_admin());
create policy "orders: customer insert own" on orders for insert
  with check (auth.uid() = user_id);
create policy "orders: customer update own status fields only via admin" on orders for update
  using (is_admin());
create policy "orders: customer can upload screenshot on own pending order" on orders for update
  using (auth.uid() = user_id and payment_status = 'awaiting_payment');
create policy "orders: customer can upload balance screenshot on own order" on orders for update
  using (auth.uid() = user_id and balance_status = 'due');
create policy "orders: customer can cancel own order before shipping" on orders for update
  using (auth.uid() = user_id and order_status in ('payment_pending','confirmed','packed'));

-- ---- site_visits: anyone (including anonymous visitors) can log a ping; only admin reads them ----
create policy "site_visits: anyone can insert" on site_visits for insert with check (true);
create policy "site_visits: admin can read" on site_visits for select using (is_admin());

-- ==========================================================================
-- STORAGE — bucket for payment screenshots
-- ==========================================================================
insert into storage.buckets (id, name, public)
values ('payment-screenshots', 'payment-screenshots', true)
on conflict (id) do nothing;

create policy "screenshots: signed-in users can upload"
  on storage.objects for insert
  with check (bucket_id = 'payment-screenshots' and auth.uid() is not null);

create policy "screenshots: public read"
  on storage.objects for select
  using (bucket_id = 'payment-screenshots');

-- Bucket for admin-uploaded product images/videos (used by second-hand listings
-- and any product where an admin wants a real photo instead of the placeholder)
insert into storage.buckets (id, name, public)
values ('product-media', 'product-media', true)
on conflict (id) do nothing;

create policy "product-media: admin can upload"
  on storage.objects for insert
  with check (bucket_id = 'product-media' and is_admin());

create policy "product-media: admin can update/delete"
  on storage.objects for all
  using (bucket_id = 'product-media' and is_admin());

create policy "product-media: public read"
  on storage.objects for select
  using (bucket_id = 'product-media');

