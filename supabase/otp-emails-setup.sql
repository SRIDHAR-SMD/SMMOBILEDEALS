-- ==========================================================================
-- OTP login/register + automatic emails + admin-only customer data
-- Run ONCE in Supabase Dashboard -> SQL Editor.
-- ==========================================================================

-- 1) Track last login on each customer (filled by the send-email function)
alter table profiles add column if not exists last_login_at timestamptz;
alter table profiles add column if not exists login_count int not null default 0;

-- 2) Log of every automatic email (welcome / login alert). Only admins can read it.
create table if not exists email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  email text not null,
  kind text not null,                 -- 'welcome' | 'login_alert'
  status text not null,               -- 'sent' | 'failed'
  error text,
  created_at timestamptz not null default now()
);
alter table email_log enable row level security;
drop policy if exists "email_log: admin read" on email_log;
create policy "email_log: admin read" on email_log for select using (is_admin());
-- (no insert/update/delete policy on purpose: only the edge function, using the
--  service-role key, can write here. Customers can never see or change it.)

-- 3) SECURITY: stop customers promoting themselves to admin.
-- The old "update own profile" policy let a customer set role='admin' on their own row.
create or replace function prevent_role_escalation()
returns trigger as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not is_admin() then
    new.role := old.role;            -- silently keep the old role
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists profiles_no_role_escalation on profiles;
create trigger profiles_no_role_escalation
  before update on profiles
  for each row execute procedure prevent_role_escalation();
-- Running `update profiles set role='admin' ...` from the SQL Editor still works
-- (auth.uid() is null there).

-- 4) Full admin control: let admins delete orders and manage customer profiles.
drop policy if exists "orders: admin delete" on orders;
create policy "orders: admin delete" on orders for delete using (is_admin());
drop policy if exists "profiles: admin delete" on profiles;
create policy "profiles: admin delete" on profiles for delete using (is_admin());
drop policy if exists "profiles: admin insert" on profiles;
create policy "profiles: admin insert" on profiles for insert with check (is_admin());

-- 5) Orders / tracking fix
-- Courier tracking (the app saves these on every order; without the columns
-- saving/loading orders fails, which breaks "My Orders" and tracking).
alter table orders add column if not exists courier text;
alter table orders add column if not exists tracking_number text;
alter table orders add column if not exists tracking_url text;
