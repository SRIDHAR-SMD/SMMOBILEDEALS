-- ==========================================================================
-- ADMIN: permanently delete a Store Admin (staff) or a test/customer account
-- Run ONCE in Supabase -> SQL Editor, AFTER profile-controls.sql (needs pg_delete_user).
-- Only the permanent Admin can call it. Admin accounts can never be deleted.
-- Orders are kept (user_id set to null).
-- ==========================================================================
create or replace function admin_delete_account(p_user uuid) returns json
language plpgsql security definer set search_path = public, auth as $$
declare me profiles; tgt profiles;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null or me.role <> 'admin' or me.temp_admin_until is not null then
    return json_build_object('ok', false, 'error', 'Only the permanent admin can delete accounts.');
  end if;
  select * into tgt from profiles where id = p_user;
  if tgt.id is null then return json_build_object('ok', false, 'error', 'Account not found.'); end if;
  if tgt.id = me.id then return json_build_object('ok', false, 'error', 'You cannot delete your own account.'); end if;
  if tgt.role = 'admin' then return json_build_object('ok', false, 'error', 'Admin accounts cannot be deleted.'); end if;
  perform pg_delete_user(tgt.id);
  return json_build_object('ok', true);
end $$;
revoke all on function admin_delete_account(uuid) from public, anon;
grant execute on function admin_delete_account(uuid) to authenticated;
