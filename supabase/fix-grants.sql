-- FIX: "permission denied for table ..." (store_settings, products, orders ...)
-- New Supabase projects do not give the API roles access to tables by default.
-- Run this ONCE in Supabase -> SQL Editor. Row-Level Security (policies) still decides who sees/changes which rows.
grant usage on schema public to anon, authenticated;

-- public site data: anyone can read, RLS limits writes to admin
grant select on public.categories, public.products, public.offers, public.reviews, public.store_settings to anon, authenticated;
grant insert, update, delete on public.categories, public.products, public.offers, public.reviews, public.store_settings to authenticated;

-- visitors can log a visit
grant insert on public.site_visits to anon, authenticated;
grant select on public.site_visits to authenticated;

-- signed-in only
grant select, insert, update, delete on public.profiles, public.orders, public.notifications to authenticated;

-- any other table in public (spare parts, inbox, recharge, etc.) for signed-in users; RLS still applies
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t.tablename);
  end loop;
end $$;

grant usage, select on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated;
