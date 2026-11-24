-- ==========================================================================
-- FIX ROLES  (run ONCE in Supabase -> SQL Editor; safe to re-run, no passwords)
--   smmobiledealss@gmail.com  -> admin     (OTP)  -> admin.html
--   sridhariphone7@gmail.com  -> staff     (OTP)  -> admin.html (Staff)
--   7999@gmail.com            -> customer  (NO OTP) -> profile.html
--   any new customer          -> customer  (OTP)  -> profile.html
-- ==========================================================================
alter table public.profiles add column if not exists otp_exempt boolean not null default false;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('customer','staff','admin'));

do $$
begin
  perform set_config('app.bypass_role_guard', '1', true);

  -- make sure every auth user has a profile row (a missing row = shown as "customer")
  insert into public.profiles (id, name, email, role)
  select u.id, coalesce(u.raw_user_meta_data->>'name', split_part(u.email,'@',1)), lower(u.email), 'customer'
  from auth.users u
  where lower(u.email) in ('smmobiledealss@gmail.com','sridhariphone7@gmail.com','7999@gmail.com')
    and not exists (select 1 from public.profiles p where p.id = u.id);

  update public.profiles set role = 'admin',    otp_exempt = false where lower(email) = 'smmobiledealss@gmail.com';
  update public.profiles set role = 'staff',    otp_exempt = false where lower(email) = 'sridhariphone7@gmail.com';
  update public.profiles set role = 'customer', otp_exempt = true  where lower(email) = '7999@gmail.com';
end $$;

select email, role, otp_exempt from public.profiles
where lower(email) in ('smmobiledealss@gmail.com','sridhariphone7@gmail.com','7999@gmail.com');
