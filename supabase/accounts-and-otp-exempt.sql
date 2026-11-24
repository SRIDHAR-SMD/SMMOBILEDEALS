-- ==========================================================================
-- RUN THIS LAST (after every other file in RUN-ORDER.md).
-- 1) creates / repairs the 3 accounts so password login works
-- 2) test account 7999@gmail.com = NO OTP.  Admin + Store Admin = OTP required.
-- Safe to re-run. DELETE the passwords from this file after running it.
-- ==========================================================================
create extension if not exists pgcrypto;

alter table public.profiles add column if not exists otp_exempt boolean not null default false;

create temp table _acc(email text, pass text, name text, role text);
insert into _acc values
  ('smmobiledealss@gmail.com', 'RacingSport7999@#', 'SRIDHAR SUGI',  'admin'),
  ('sridhariphone7@gmail.com', 'RacingSport7999@#', 'Store Admin',   'staff'),
  ('7999@gmail.com',           '7999',              'Customer 7999', 'customer');

do $$
declare a record; uid uuid; c text;
begin
  alter table public.profiles drop constraint if exists profiles_role_check;
  alter table public.profiles add constraint profiles_role_check check (role in ('customer','staff','admin'));

  for a in select * from _acc loop
    select id into uid from auth.users where lower(email) = lower(a.email);

    if uid is null then
      uid := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                              raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', lower(a.email),
              crypt(a.pass, gen_salt('bf')), now(),
              '{"provider":"email","providers":["email"]}', jsonb_build_object('name', a.name), now(), now());
    else
      update auth.users
         set encrypted_password = crypt(a.pass, gen_salt('bf')),
             email_confirmed_at = coalesce(email_confirmed_at, now()),
             aud = 'authenticated', role = 'authenticated',
             banned_until = null, deleted_at = null,
             raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"provider":"email","providers":["email"]}'::jsonb,
             updated_at = now()
       where id = uid;
    end if;

    foreach c in array array['confirmation_token','recovery_token','email_change_token_new','email_change',
                             'email_change_token_current','phone_change','phone_change_token','reauthentication_token'] loop
      if exists (select 1 from information_schema.columns where table_schema='auth' and table_name='users' and column_name=c) then
        execute format('update auth.users set %I = coalesce(%I, '''') where id = $1', c, c) using uid;
      end if;
    end loop;

    if not exists (select 1 from auth.identities where user_id = uid and provider = 'email') then
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), uid, uid::text,
              jsonb_build_object('sub', uid::text, 'email', lower(a.email), 'email_verified', true),
              'email', now(), now(), now());
    end if;

    perform set_config('app.bypass_role_guard', '1', true);
    insert into public.profiles (id, name, email, role) values (uid, a.name, lower(a.email), a.role)
    on conflict (id) do update set role = a.role, email = lower(a.email);
  end loop;
end $$;

-- test account: no emailed OTP at login
update public.profiles set otp_exempt = true
where lower(email) = '7999@gmail.com' and role = 'customer';

create or replace function is_otp_exempt(p_email text) returns boolean
language sql security definer set search_path = public as $$
  select coalesce((select otp_exempt and role = 'customer' from public.profiles where lower(email) = lower(p_email) limit 1), false)
$$;
revoke all on function is_otp_exempt(text) from public;
grant execute on function is_otp_exempt(text) to anon, authenticated;

-- customers can never switch roles / otp_exempt / temp-admin on for themselves
create or replace function prevent_role_escalation()
returns trigger as $$
begin
  if coalesce(current_setting('app.bypass_role_guard', true), '') = '1' then return new; end if;
  if new.role is distinct from old.role and auth.uid() is not null and not is_admin() then
    new.role := old.role;
  end if;
  if new.otp_exempt is distinct from old.otp_exempt and auth.uid() is not null and not is_admin() then
    new.otp_exempt := old.otp_exempt;
  end if;
  if (new.temp_admin_until is distinct from old.temp_admin_until
      or new.temp_admin_by is distinct from old.temp_admin_by
      or new.temp_delete_on_expiry is distinct from old.temp_delete_on_expiry)
     and auth.uid() is not null and not is_admin() then
    new.temp_admin_until := old.temp_admin_until;
    new.temp_admin_by := old.temp_admin_by;
    new.temp_delete_on_expiry := old.temp_delete_on_expiry;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists profiles_no_role_escalation on public.profiles;
create trigger profiles_no_role_escalation
  before update on public.profiles
  for each row execute procedure prevent_role_escalation();

-- RESULT: all 3 rows must show password_ok = true, confirmed = true, right role
select u.email, p.role, p.otp_exempt, (u.email_confirmed_at is not null) as confirmed,
       (u.encrypted_password = crypt(a.pass, u.encrypted_password)) as password_ok
from _acc a
join auth.users u on lower(u.email) = lower(a.email)
left join public.profiles p on p.id = u.id
order by u.email;
