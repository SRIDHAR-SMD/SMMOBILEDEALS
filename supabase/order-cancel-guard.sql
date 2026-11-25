-- ==========================================================================
-- SERVER-SIDE cancellation charge (run ONCE in Supabase -> SQL Editor).
-- Customers can update their own order (RLS), so without this a customer could
-- edit refund_amount / refund_commission from the browser. This trigger makes
-- the database compute the ₹1000 charge itself; only admins may change it.
-- ==========================================================================
create or replace function orders_cancel_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  paid numeric := 0; adv numeric; bal numeric; tot numeric; charge numeric;
begin
  if auth.uid() is null or is_admin() then return new; end if;   -- admin / server: free to set

  if new.order_status = 'cancelled' and old.order_status is distinct from 'cancelled' then
    adv := coalesce((new.totals->>'advanceAmount')::numeric, 0);
    bal := coalesce((new.totals->>'balanceAmount')::numeric, 0);
    tot := coalesce((new.totals->>'total')::numeric, 0);
    if new.payment_method = 'advance' then
      paid := (case when new.payment_status = 'confirmed' then adv else 0 end)
            + (case when new.balance_status = 'paid' then bal else 0 end);
    elsif new.payment_method = 'cod' then
      paid := case when new.payment_status = 'confirmed' then adv else 0 end;
    else
      paid := case when new.payment_status = 'confirmed' then tot else 0 end;
    end if;
    charge := least(paid, 1000);
    new.refund_commission := charge;
    new.refund_amount := paid - charge;
    new.refund_due_date := case when paid - charge > 0 then now() + interval '7 days' else null end;
    new.refund_status := case when paid - charge > 0 then 'pending' else null end;
  else
    -- no cancellation happening: customers cannot touch refund fields
    new.refund_status := old.refund_status;
    new.refund_amount := old.refund_amount;
    new.refund_commission := old.refund_commission;
    new.refund_due_date := old.refund_due_date;
  end if;
  return new;
end $$;

drop trigger if exists orders_cancel_guard_trg on orders;
create trigger orders_cancel_guard_trg before update on orders
  for each row execute procedure orders_cancel_guard();
