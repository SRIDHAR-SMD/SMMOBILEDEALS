-- Customer Activity log (run ONCE in Supabase -> SQL Editor)
-- Customers can only INSERT rows about themselves; only admins can READ.
create table if not exists public.customer_activity (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid(),
  user_name     text,
  user_email    text,
  user_phone    text,
  kind          text not null check (kind in ('view','search','chat','message','service','cart','wishlist','checkout','login','logout')),
  product_id    text,
  product_name  text,
  product_brand text,
  product_price numeric,
  category      text,
  detail        text,
  device        text,
  platform      text,
  browser       text,
  is_app        boolean default false,
  page          text,
  created_at    timestamptz not null default now()
);
create index if not exists customer_activity_created_idx on public.customer_activity (created_at desc);
create index if not exists customer_activity_user_idx    on public.customer_activity (user_id, created_at desc);
create index if not exists customer_activity_kind_idx    on public.customer_activity (kind, created_at desc);

alter table public.customer_activity enable row level security;

drop policy if exists "activity: customer inserts own" on public.customer_activity;
create policy "activity: customer inserts own" on public.customer_activity
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "activity: admin reads" on public.customer_activity;
create policy "activity: admin reads" on public.customer_activity
  for select to authenticated using (is_admin());

drop policy if exists "activity: admin deletes" on public.customer_activity;
create policy "activity: admin deletes" on public.customer_activity
  for delete to authenticated using (is_admin());

grant select, insert, delete on public.customer_activity to authenticated;
