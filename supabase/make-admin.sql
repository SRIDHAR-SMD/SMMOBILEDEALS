-- Run ONCE in Supabase -> SQL Editor. Makes your login a REAL admin in the database
-- (the SMS step and every admin save/upload depend on profiles.role = 'admin').
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('customer','staff','admin'));
do $$
begin
  perform set_config('app.bypass_role_guard', '1', true);
  insert into public.profiles (id, name, email, role)
  select u.id, coalesce(u.raw_user_meta_data->>'name', split_part(u.email,'@',1)), lower(u.email), 'customer'
  from auth.users u
  where lower(u.email) = 'smmobiledealss@gmail.com' and not exists (select 1 from public.profiles p where p.id = u.id);
  update public.profiles set role = 'admin' where lower(email) = 'smmobiledealss@gmail.com';
end $$;
select email, role from public.profiles where role in ('admin','staff');
