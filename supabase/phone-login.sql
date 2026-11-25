-- Phone-number login + mandatory phone/email. Run ONCE in Supabase -> SQL Editor.
-- 1) look up a customer's login email from their 10-digit phone number
create or replace function public.login_email_for_phone(p_phone text)
returns text language sql security definer set search_path = public as $$
  select email from public.profiles
  where right(regexp_replace(coalesce(phone,''), '\D', '', 'g'), 10) = right(regexp_replace(p_phone, '\D', '', 'g'), 10)
  order by created_at limit 1;
$$;
-- 2) is this phone already registered? (used by the Register page)
create or replace function public.phone_exists(p_phone text)
returns boolean language sql security definer set search_path = public as $$
  select exists(select 1 from public.profiles
  where right(regexp_replace(coalesce(phone,''), '\D', '', 'g'), 10) = right(regexp_replace(p_phone, '\D', '', 'g'), 10));
$$;
grant execute on function public.login_email_for_phone(text), public.phone_exists(text) to anon, authenticated;
