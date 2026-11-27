-- Run once in Supabase SQL Editor. Makes sure each admin alert email is sent only once per order status / top-up.
create table if not exists admin_alert_log (
  key text primary key,
  created_at timestamptz not null default now()
);
alter table admin_alert_log enable row level security;   -- no policies: only the edge function (service role) can use it
