-- Mobile recharge requests + admin switch. Run in Supabase SQL Editor (after schema-tables-only.sql).
create table if not exists recharge_requests (
  id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  user_email text, user_name text,
  type text not null check (type in ('Prepaid','Postpaid')),
  mobile text not null, operator text not null, circle text,
  amount numeric not null check (amount >= 10 and amount <= 10000),
  plan text, screenshot_url text,
  status text not null default 'pending' check (status in ('pending','accepted','done','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table recharge_requests enable row level security;
drop policy if exists "recharge: customer inserts own" on recharge_requests;
create policy "recharge: customer inserts own" on recharge_requests for insert with check (auth.uid() = user_id and status = 'pending');
drop policy if exists "recharge: read own or admin" on recharge_requests;
create policy "recharge: read own or admin" on recharge_requests for select using (auth.uid() = user_id or is_admin());
drop policy if exists "recharge: admin update" on recharge_requests;
create policy "recharge: admin update" on recharge_requests for update using (is_admin());
-- Admin switch: store_settings key 'recharge_direct' = '1' (open operator sites) / '0' (shop takes payment). Default 0.
insert into store_settings(key, value) values ('recharge_direct', '0') on conflict (key) do nothing;

-- AI screenshot check (filled by the recharge-mail edge function)
alter table recharge_requests add column if not exists ai_status text default 'pending' check (ai_status in ('pending','verified','failed'));
alter table recharge_requests add column if not exists ai_notes text;
alter table recharge_requests add column if not exists utr text;
create unique index if not exists recharge_utr_unique on recharge_requests(utr) where utr is not null and ai_status = 'verified';
