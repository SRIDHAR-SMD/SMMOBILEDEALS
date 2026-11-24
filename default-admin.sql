-- ==========================================================================
-- ACCOUNTS SETUP  (run ONCE in Supabase -> SQL Editor; safe to re-run)
--   * ADMIN    : smmobiledealss@gmail.com   -> real Supabase user, role = 'admin'
--   * CUSTOMER : 7999@gmail.com / 7999       -> normal customer (role = 'customer')
-- Both log in on the normal Login page: password -> emailed OTP -> in.
-- After running, DELETE the passwords from this file (they only need to exist
-- while the script runs).
-- ==========================================================================
create extension if not exists pgcrypto;

-- allow the store-admin (staff) role before creating that account
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('customer','staff','admin'));

create or replace function pg_temp.upsert_account(p_email text, p_pass text, p_name text, p_role text)
returns void language plpgsql as $$
declare uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(p_email);

  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users
      (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
       raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
       confirmation_token, email_change, email_change_token_new, recovery_token)
    values
      ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', lower(p_email),
       crypt(p_pass, gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', jsonb_build_object('name', p_name), now(), now(),
       '', '', '', '');
    insert into auth.identities
      (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values
      (gen_random_uuid(), uid, uid::text,
       jsonb_build_object('sub', uid::text, 'email', lower(p_email), 'email_verified', true),
       'email', now(), now(), now());
  else
    update auth.users
       set encrypted_password = crypt(p_pass, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = uid;
  end if;

  insert into public.profiles (id, name, email, role)
  values (uid, p_name, lower(p_email), p_role)
  on conflict (id) do update set role = p_role, email = lower(p_email);
end $$;

-- 1) the real admin
select pg_temp.upsert_account('smmobiledealss@gmail.com', 'RacingSport7999@#', 'SRIDHAR SUGI', 'admin');

-- 1a) the earlier admin address (smmobilesdealss@...) is no longer an admin
update public.profiles set role = 'customer' where lower(email) = 'smmobilesdealss@gmail.com';

-- 1b) the store admin (limited tabs)
select pg_temp.upsert_account('sridhariphone7@gmail.com', 'RacingSport7999@#', 'Store Admin', 'staff');

-- 2) 7999@gmail.com is now a plain CUSTOMER (it used to be the admin)
select pg_temp.upsert_account('7999@gmail.com', '7999', 'Customer 7999', 'customer');

-- check
select u.email, p.role
from auth.users u join public.profiles p on p.id = u.id
where lower(u.email) in ('smmobiledealss@gmail.com', 'sridhariphone7@gmail.com', '7999@gmail.com');
