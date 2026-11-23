/* Admin: decline / cancel an order, and change the cancellation charge.
   Wraps AdminUI.orderRow / AdminUI.refundCard (js/admin.js) — loaded right after it. */
(function(){
  if (typeof AdminUI === 'undefined' || typeof Orders === 'undefined') return;
  const inr = (n) => (typeof Utils !== 'undefined' ? Utils.formatINR(n) : '₹' + n);

  const origRow = AdminUI.orderRow;
  AdminUI.orderRow = function(order){
    let html = origRow(order);
    if (order.orderStatus === 'cancelled' || order.orderStatus === 'delivered') return html;
    const btn = `<button class="btn btn-ghost btn-sm" style="color:var(--danger,#d33);" onclick="AdminUI.cancelOrder('${order.id}')" title="Decline / cancel this order"><i class="fa-solid fa-ban"></i></button>`;
    return html.replace(/<\/td>\s*<\/tr>\s*$/, btn + '</td></tr>');
  };

  const origCard = AdminUI.refundCard;
  AdminUI.refundCard = function(order){
    const html = origCard(order);
    const extra = `<button class="btn btn-outline btn-sm" onclick="AdminUI.changeCharge('${order.id}')"><i class="fa-solid fa-pen"></i> Change charge</button>`;
    // put both buttons in one grid cell
    return html.replace(/(<button[^>]*markRefundSent[^>]*>[\s\S]*?<\/button>)/, `<div style="display:flex;flex-direction:column;gap:8px;">$1${extra}</div>`);
  };

  // Admin declines/cancels: choose the charge (0 = waive) and a reason the customer will see.
  AdminUI.cancelOrder = async function(orderId){
    const order = Orders.byId(orderId); if (!order) return;
    const paid = Orders.amountPaid(order);
    let charge = 0;
    if (paid > 0){
      const def = Math.min(paid, Orders.REFUND_COMMISSION);
      const v = prompt(`Cancel order ${orderId}.\nCustomer has paid ${inr(paid)}.\n\nCancellation charge to KEEP from the customer (₹).\nEnter 0 to waive it (store-side decline = usually 0):`, '0');
      if (v === null) return;
      charge = Number(v);
      if (!Number.isFinite(charge) || charge < 0 || charge > paid){ Notify.toast(`Enter an amount from 0 to ${paid}.`, 'error'); return; }
      void def;
    }
    const reason = prompt('Reason shown to the customer (optional):', '') ;
    if (reason === null) return;
    const refund = paid - charge;
    if (!confirm(`Cancel order ${orderId}?\n\nPaid: ${inr(paid)}\nCharge kept: ${inr(charge)}\nRefund to customer: ${inr(refund)}`)) return;
    const res = await Orders.adminCancelOrder(orderId, { charge, reason: (reason || '').trim() });
    if (!res.ok){ Notify.toast(res.error || 'Could not cancel.', 'error'); return; }
    Notify.toast(refund > 0 ? `Order cancelled. Refund ${inr(refund)} added to Refunds.` : 'Order cancelled.', 'success');
    document.dispatchEvent(new CustomEvent('admin:refresh'));
  };

  AdminUI.changeCharge = async function(orderId){
    const order = Orders.byId(orderId); if (!order) return;
    const paid = Orders.amountPaid(order);
    const v = prompt(`Order ${orderId}: customer paid ${inr(paid)}.\nCurrent charge: ${inr(order.refundCommission || 0)}.\n\nNew cancellation charge (₹, 0 = waive):`, String(order.refundCommission || 0));
    if (v === null) return;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > paid){ Notify.toast(`Enter an amount from 0 to ${paid}.`, 'error'); return; }
    const res = await Orders.setRefundCharge(orderId, n);
    if (!res.ok){ Notify.toast(res.error || 'Could not update.', 'error'); return; }
    Notify.toast(`Charge set to ${inr(res.quote.charge)} — refund ${inr(res.quote.refund)}.`, 'success');
    document.dispatchEvent(new CustomEvent('admin:refresh'));
  };
})();
