-- Notifications: allow users to delete (X / Clear all) their own notifications.
-- Without a DELETE policy, Supabase RLS silently deletes 0 rows (no error),
-- so the bell panel looked like "Clear all" and "X" did nothing.
-- Run once in Supabase -> SQL Editor.

drop policy if exists "notifications: customer deletes own" on notifications;
create policy "notifications: customer deletes own" on notifications
  for delete using (audience = 'customer' and user_id = auth.uid());

drop policy if exists "notifications: admin deletes admin ones" on notifications;
create policy "notifications: admin deletes admin ones" on notifications
  for delete using (audience = 'admin' and is_admin());

grant delete on public.notifications to authenticated;
