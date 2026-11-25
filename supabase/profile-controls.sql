-- ==========================================================================
-- PROFILE CONTROLS: permanent account delete + TEMPORARY admin ownership
-- Run ONCE in Supabase -> SQL Editor (after default-admin.sql). Safe to re-run.
-- ==========================================================================

-- 1) roles + temp-access columns
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('customer','staff','admin'));
alter table profiles add column if not exists temp_admin_until timestamptz;
alter table profiles add column if not exists temp_admin_by uuid;
alter table profiles add column if not exists temp_delete_on_expiry boolean not null default true;

-- 2) an admin whose temporary time is over is NOT an admin any more (exact to the second)
create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
      and (temp_admin_until is null or temp_admin_until > now())
  );
$$ language sql security definer stable;

-- 3) role guard: customers can't promote themselves, but our own functions may
create or replace function prevent_role_escalation()
returns trigger as $$
begin
  if coalesce(current_setting('app.bypass_role_guard', true), '') = '1' then return new; end if;
  if new.role is distinct from old.role and auth.uid() is not null and not is_admin() then
    new.role := old.role;
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

-- 4) permanent delete of a user (shared by self-delete and auto-expiry)
create or replace function pg_delete_user(p_uid uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  update orders set user_id = null where user_id = p_uid;   -- keep order records
  delete from auth.users where id = p_uid;                  -- cascades to profiles etc.
end $$;
revoke all on function pg_delete_user(uuid) from public, anon, authenticated;

-- 5) auto-expiry: ends temporary admin time (deletes the account or just removes admin)
create or replace function expire_temp_admins() returns int
language plpgsql security definer set search_path = public, auth as $$
declare r record; n int := 0;
begin
  perform set_config('app.bypass_role_guard', '1', true);
  for r in select id, temp_delete_on_expiry from profiles
           where temp_admin_until is not null and temp_admin_until <= now() loop
    if r.temp_delete_on_expiry then
      perform pg_delete_user(r.id);
    else
      update profiles set role = 'customer', temp_admin_until = null, temp_admin_by = null where id = r.id;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
grant execute on function expire_temp_admins() to anon, authenticated;

-- 6) permanent admin grants temporary admin (1..500 hours) to a registered email
create or replace function grant_temp_admin(p_email text, p_hours int, p_delete_on_expiry boolean default true)
returns json language plpgsql security definer set search_path = public, auth as $$
declare me profiles; tgt profiles;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null or me.role <> 'admin' or me.temp_admin_until is not null then
    return json_build_object('ok', false, 'error', 'Only the permanent admin can transfer ownership.');
  end if;
  if p_hours is null or p_hours < 1 or p_hours > 500 then
    return json_build_object('ok', false, 'error', 'Hours must be between 1 and 500.');
  end if;
  select * into tgt from profiles where lower(email) = lower(trim(p_email));
  if tgt.id is null then return json_build_object('ok', false, 'error', 'No account found with that email. They must register first.'); end if;
  if tgt.id = me.id then return json_build_object('ok', false, 'error', 'You already own this store.'); end if;
  if tgt.role = 'admin' and tgt.temp_admin_until is null then
    return json_build_object('ok', false, 'error', 'That account is already a permanent admin.');
  end if;
  perform set_config('app.bypass_role_guard', '1', true);
  update profiles set role = 'admin', temp_admin_until = now() + make_interval(hours => p_hours),
         temp_admin_by = me.id, temp_delete_on_expiry = coalesce(p_delete_on_expiry, true)
   where id = tgt.id;
  return json_build_object('ok', true, 'until', now() + make_interval(hours => p_hours));
end $$;
grant execute on function grant_temp_admin(text, int, boolean) to authenticated;

-- 7) revoke early (permanent admin only). Does NOT delete the account; it just ends admin access.
create or replace function revoke_temp_admin(p_user uuid) returns json
language plpgsql security definer set search_path = public, auth as $$
declare me profiles;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null or me.role <> 'admin' or me.temp_admin_until is not null then
    return json_build_object('ok', false, 'error', 'Only the permanent admin can do this.');
  end if;
  perform set_config('app.bypass_role_guard', '1', true);
  update profiles set role = 'customer', temp_admin_until = null, temp_admin_by = null
   where id = p_user and temp_admin_until is not null;
  return json_build_object('ok', true);
end $$;
grant execute on function revoke_temp_admin(uuid) to authenticated;

-- 8) permanent self-delete (customer / store admin). The app calls this ONLY after email-OTP verification.
create or replace function delete_my_account() returns json
language plpgsql security definer set search_path = public, auth as $$
declare me profiles;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null then return json_build_object('ok', false, 'error', 'Not logged in.'); end if;
  if me.role = 'admin' then
    return json_build_object('ok', false, 'error', 'Admin accounts cannot be deleted. Use temporary ownership transfer instead.');
  end if;
  perform pg_delete_user(me.id);
  return json_build_object('ok', true);
end $$;
grant execute on function delete_my_account() to authenticated;

-- 9) run the expiry every minute (Supabase pg_cron). The app also calls expire_temp_admins() on page load.
do $$ begin
  create extension if not exists pg_cron;
  perform cron.unschedule('expire-temp-admins') from cron.job where jobname = 'expire-temp-admins';
  perform cron.schedule('expire-temp-admins', '* * * * *', 'select public.expire_temp_admins()');
exception when others then
  raise notice 'pg_cron not enabled (Dashboard -> Database -> Extensions -> pg_cron). The app-side expiry still works.';
end $$;
