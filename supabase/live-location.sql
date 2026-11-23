-- =====================================================================
-- LIVE CUSTOMER LOCATION + SCAM ALERTS  (run once in Supabase SQL Editor)
-- Consent based: rows are written only after the customer taps
-- "Allow location" on the in-site notice AND the browser grants permission.
-- =====================================================================
create table if not exists live_locations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  lat double precision,
  lng double precision,
  accuracy double precision,
  last_action text,            -- e.g. "Added to wishlist: iPhone 15"
  flags text,                  -- scam flags, separated by " | "
  sharing boolean default true,
  updated_at timestamptz default now()
);
alter table live_locations enable row level security;
drop policy if exists live_loc_own on live_locations;
create policy live_loc_own on live_locations for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists live_loc_admin_read on live_locations;
create policy live_loc_admin_read on live_locations for select using (is_admin());

-- geo_log: allow signed-in customers to log login / register / activity / alert rows
drop policy if exists geo_log_insert on geo_log;
create policy geo_log_insert on geo_log for insert to anon, authenticated
  with check (kind in ('order_payment','login','register','activity','alert','denied'));

-- admin must be able to read every customer's wishlist + orders (for the Live Customers tab)
drop policy if exists wishlist_admin_read on wishlist;
create policy wishlist_admin_read on wishlist for select using (is_admin());
