-- Run once in Supabase → SQL Editor.  Safe to re-run.

-- 1) one-time passwords for the Master Gateway (service-role only: RLS on, NO policies)
create table if not exists master_otps (
  id uuid primary key,
  otp_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  used boolean not null default false,
  created_at timestamptz default now()
);
alter table master_otps enable row level security;

-- 2) location + security log (anti-scam). Customers can only INSERT payment checks;
--    only admins can read.
create table if not exists geo_log (
  id bigint generated always as identity primary key,
  kind text not null,              -- order_payment | gateway_fail | gateway_ok
  order_id text,
  user_email text,
  lat double precision,
  lng double precision,
  accuracy double precision,
  consent boolean default false,   -- true = customer/admin allowed the browser location prompt
  ip text,
  ua text,
  note text,
  created_at timestamptz default now()
);
alter table geo_log enable row level security;
drop policy if exists geo_log_insert on geo_log;
create policy geo_log_insert on geo_log for insert to anon, authenticated with check (kind = 'order_payment');
drop policy if exists geo_log_admin_read on geo_log;
create policy geo_log_admin_read on geo_log for select using (is_admin());
create index if not exists geo_log_created on geo_log (created_at desc);

-- Secrets (run in your terminal, NOT here). Pick a long random MASTER_SECRET:
--   supabase secrets set MASTER_SECRET="$(openssl rand -hex 32)" \
--     MASTER_ADMIN_EMAIL="smmobiledealss@gmail.com" MASTER_ADMIN_PASS="<admin password>" \
--     MASTER_STAFF_USER="smmobile" MASTER_STAFF_PASS="<staff password>" \
--     OTP_TO="smmobiledealss@gmail.com" \
--     SMTP_HOST=smtp.gmail.com SMTP_PORT=465 SMTP_USER=<sender gmail> SMTP_PASS=<gmail app password>
--   supabase functions deploy master-gateway --no-verify-jwt
