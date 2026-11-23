-- ==========================================================================
-- security-v29.sql — run once in Supabase SQL Editor (safe to re-run)
-- ==========================================================================

-- 1) Admin SMS-OTP storage (only the edge function / service role can touch these)
create table if not exists admin_sms_otps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  used boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists admin_sms_otps_user_idx on admin_sms_otps (user_id, created_at desc);
alter table admin_sms_otps enable row level security;     -- no policies = nobody but service role

create table if not exists admin_sms_verified (
  user_id uuid primary key references auth.users(id) on delete cascade,
  verified_until timestamptz not null
);
alter table admin_sms_verified enable row level security; -- no policies = nobody but service role

-- 2) Notifications: a signed-in user may only create
--      * an admin-audience note (user_id null)   -> customer activity / chatbot messages
--      * a customer note addressed to themselves
--    Admins may create any. (Before this, any signed-in user could write a note to ANY customer.)
drop policy if exists "notifications: authenticated can insert" on notifications;
drop policy if exists "notifications: scoped insert" on notifications;
create policy "notifications: scoped insert" on notifications
  for insert with check (
    is_admin()
    or (audience = 'admin' and user_id is null)
    or (audience = 'customer' and user_id = auth.uid())
  );

-- 3) store_settings: only the admin may write (already true) — the admin online heartbeat uses key 'admin_heartbeat'.

-- 4) OPTIONAL hard enforcement (run ONLY after the SMS code arrives on your phone and works):
--    makes the database itself refuse admin actions until the phone code was verified in the last 12 h.
--
-- create or replace function is_admin()
-- returns boolean as $$
--   select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
--      and exists (select 1 from admin_sms_verified where user_id = auth.uid() and verified_until > now());
-- $$ language sql security definer stable;
