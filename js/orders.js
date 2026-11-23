/* ==========================================================================
   ORDERS — shared status metadata + helpers used by orders / tracking /
   order-success / admin pages
   ========================================================================== */

const Orders = (() => {

  const STATUS_META = {
    payment_pending: { label:'Payment Pending', badge:'badge-pending', icon:'fa-clock' },
    pending_confirmation: { label:'Waiting for Confirmation', badge:'badge-pending', icon:'fa-hourglass-half' },
    confirmed: { label:'Order Confirmed', badge:'badge-success', icon:'fa-circle-check' },
    packed: { label:'Packed', badge:'badge-accent', icon:'fa-box' },
    shipped: { label:'Shipped', badge:'badge-accent', icon:'fa-truck' },
    out_for_delivery: { label:'Out for Delivery', badge:'badge-accent', icon:'fa-truck-fast' },
    delivered: { label:'Delivered', badge:'badge-success', icon:'fa-house-circle-check' },
    cancelled: { label:'Cancelled', badge:'badge-danger', icon:'fa-circle-xmark' }
  };

  const TRACK_STEPS = ['confirmed','packed','shipped','out_for_delivery','delivered'];

  function displayStatus(order){
    if (order.orderStatus === 'cancelled') return 'cancelled';
    if (order.paymentMethod !== 'cod' && order.paymentStatus === 'awaiting_payment') return 'payment_pending';
    if (order.paymentMethod !== 'cod' && order.paymentStatus === 'pending_confirmation') return 'pending_confirmation';
    if (order.paymentStatus === 'rejected') return 'payment_pending';
    return order.orderStatus;
  }

  function forUser(userId){
    return DB.getOrders().filter(o => o.userId === userId).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function byId(orderId){
    return DB.getOrders().find(o => o.id === orderId);
  }

  function pendingConfirmationQueue(){
    return DB.getOrders().filter(o => o.paymentStatus === 'pending_confirmation').sort((a,b) => new Date(a.updatedAt) - new Date(b.updatedAt));
  }

  // Admin: attach a courier + tracking number (or a full tracking link
  // pasted directly) to an order, and notify the customer with a direct
  // link to track it live on the courier's own site.
  function buildTrackingUrl(courierKey, trackingNumber){
    const courier = SITE_CONFIG.couriers[courierKey];
    if (!courier) return null;
    return courier.trackingUrl.replace('{trackingNumber}', encodeURIComponent(trackingNumber));
  }
  async function setTracking(orderId, courierKey, trackingInput){
    const order = byId(orderId);
    if (!order) return { ok:false, error:'Order not found.' };
    let trackingNumber = trackingInput.trim();
    let trackingUrl;
    // Admin can paste either the bare number/barcode OR a full URL they
    // already have — if it looks like a URL, use it as-is instead of
    // rebuilding one from the template.
    if (/^https?:\/\//i.test(trackingNumber)){
      trackingUrl = trackingNumber;
    } else {
      trackingUrl = buildTrackingUrl(courierKey, trackingNumber);
      if (!trackingUrl) return { ok:false, error:'Unknown courier.' };
    }
    order.courier = courierKey;
    order.trackingNumber = trackingNumber;
    order.trackingUrl = trackingUrl;
    order.updatedAt = new Date().toISOString();
    await DB.saveOrder(order);
    const courierName = SITE_CONFIG.couriers[courierKey]?.name || courierKey;
    if (typeof Inbox !== 'undefined' && order.userId){
      Inbox.sendToCustomer(order.userId, 'Your order has shipped',
        `Order #${order.id} is on its way via ${courierName}. Tracking: ${trackingUrl}`,
        `pages/tracking.html?order=${order.id}`);
    }
    return { ok:true, order };
  }

  // Advance Payment orders whose balance screenshot is uploaded and awaiting
  // admin verification — separate from the initial-payment queue above,
  // since paymentStatus is already 'confirmed' by this point.
  function balanceConfirmationQueue(){
    return DB.getOrders().filter(o => o.balanceStatus === 'pending_confirmation').sort((a,b) => new Date(a.updatedAt) - new Date(b.updatedAt));
  }

  // Admin: advance fulfilment status (post-confirmation)
  async function advanceStatus(orderId, newStatus){
    const order = byId(orderId);
    if (!order) return { ok:false };
    order.orderStatus = newStatus;
    order.timeline.push({ status:newStatus, at:new Date().toISOString() });
    order.updatedAt = new Date().toISOString();
    await DB.saveOrder(order);
    return { ok:true, order };
  }

  // Customer-facing: cancel an order they placed. Allowed any time before
  // the order has shipped — once it's on the way, cancelling in-app could
  // leave a courier carrying a parcel nobody will receive, so those cases
  // are routed to support instead of being silently auto-cancelled.
  const CANCELLABLE_BEFORE = ['payment_pending', 'pending_confirmation', 'confirmed', 'packed'];
  function canCancel(order){
    if (!order) return false;
    const status = displayStatus(order);
    return CANCELLABLE_BEFORE.includes(status);
  }
  // Cancellation charge: SM Mobile Deals keeps a fixed ₹1000 (override with
  // SITE_CONFIG.cancelCharge); the rest of what the customer ACTUALLY PAID
  // goes back within 7 days of cancellation.
  const REFUND_COMMISSION = (typeof SITE_CONFIG !== 'undefined' && Number.isFinite(SITE_CONFIG.cancelCharge)) ? SITE_CONFIG.cancelCharge : 1000;

  // Money really received for this order (not the order total): COD / Advance
  // orders only have their advance paid until the rest is settled.
  function amountPaid(order){
    const t = order.totals || {};
    if (order.paymentMethod === 'advance'){
      return (order.paymentStatus === 'confirmed' ? (t.advanceAmount || 0) : 0)
           + (order.balanceStatus === 'paid' ? (t.balanceAmount || 0) : 0);
    }
    if (order.paymentMethod === 'cod') return order.paymentStatus === 'confirmed' ? (t.advanceAmount || 0) : 0;
    return order.paymentStatus === 'confirmed' ? (t.total || 0) : 0;
  }
  function cancelQuote(order){
    const paid = amountPaid(order);
    const charge = Math.min(paid, REFUND_COMMISSION);
    return { paid, charge, refund: paid - charge };
  }
  // Write refund bookkeeping onto an order being cancelled.
  function applyRefund(order, charge){
    const paid = amountPaid(order);
    charge = Math.max(0, Math.min(paid, Number(charge) || 0));
    const refund = paid - charge;
    order.refundCommission = charge;
    order.refundAmount = refund;
    if (refund > 0){
      const due = new Date(); due.setDate(due.getDate() + 7);
      order.refundDueDate = due.toISOString();
      order.refundStatus = 'pending';
    } else { order.refundStatus = null; order.refundDueDate = null; }
    return { paid, charge, refund };
  }
  function refundNote(q){
    if (!q.paid) return 'No payment was taken, so there is no charge.';
    return q.refund > 0
      ? `Refund of ${Utils.formatINR(q.refund)} due within 7 days (${Utils.formatINR(q.charge)} cancellation charge deducted).`
      : `Cancellation charge of ${Utils.formatINR(q.charge)} applied — nothing left to refund.`;
  }

  // Customer cancels their own order.
  async function cancelOrder(orderId, userId){
    const order = byId(orderId);
    if (!order) return { ok:false, error:'Order not found.' };
    if (order.userId !== userId) return { ok:false, error:'This order does not belong to your account.' };
    if (!canCancel(order)) return { ok:false, error:'This order has already shipped — please contact support to cancel it.' };

    const q = applyRefund(order, REFUND_COMMISSION);
    order.orderStatus = 'cancelled';
    order.timeline.push({ status:'cancelled', at:new Date().toISOString(), note:refundNote(q) });
    order.updatedAt = new Date().toISOString();
    await DB.saveOrder(order);
    if (typeof Inbox !== 'undefined') Inbox.trackActivity('Order cancelled', `Order ${order.id} was cancelled by the customer (charge ${Utils.formatINR(q.charge)}, refund ${Utils.formatINR(q.refund)})`, 'pages/admin.html?tab=refunds');
    return { ok:true, order, quote:q };
  }

  // Admin declines / cancels an order on the customer's behalf. `charge` is
  // what is kept from the customer (0 = waive the cancellation charge).
  async function adminCancelOrder(orderId, { charge = 0, reason = '' } = {}){
    const order = byId(orderId);
    if (!order) return { ok:false, error:'Order not found.' };
    if (order.orderStatus === 'cancelled') return { ok:false, error:'Already cancelled.' };
    if (order.orderStatus === 'delivered') return { ok:false, error:'Delivered orders cannot be cancelled.' };
    const q = applyRefund(order, charge);
    order.orderStatus = 'cancelled';
    const note = (reason ? `Cancelled by store: ${reason}. ` : 'Cancelled by store. ') + refundNote(q);
    order.timeline.push({ status:'cancelled', at:new Date().toISOString(), note });
    order.updatedAt = new Date().toISOString();
    await DB.saveOrder(order);
    if (typeof Inbox !== 'undefined' && order.userId){
      Inbox.sendToCustomer(order.userId, 'Your order was cancelled', `Order #${order.id} was cancelled by the store${reason ? ' — ' + reason : ''}. ${refundNote(q)}`, `pages/tracking.html?order=${order.id}`);
    }
    return { ok:true, order, quote:q };
  }

  // Admin changes the charge on a cancellation that is still waiting for its refund.
  async function setRefundCharge(orderId, charge){
    const order = byId(orderId);
    if (!order || order.orderStatus !== 'cancelled') return { ok:false, error:'Order is not cancelled.' };
    if (order.refundStatus === 'sent') return { ok:false, error:'Refund already sent.' };
    const q = applyRefund(order, charge);
    order.timeline.push({ status:'refund_updated', at:new Date().toISOString(), note:'Cancellation charge changed. ' + refundNote(q) });
    order.updatedAt = new Date().toISOString();
    await DB.saveOrder(order);
    if (typeof Inbox !== 'undefined' && order.userId){
      Inbox.sendToCustomer(order.userId, 'Refund updated', `Order #${order.id}: ${refundNote(q)}`, `pages/tracking.html?order=${order.id}`);
    }
    return { ok:true, order, quote:q };
  }

  // Admin: orders currently owed a refund, oldest deadline first.
  function refundQueue(){
    return DB.getOrders()
      .filter(o => o.refundStatus === 'pending')
      .sort((a,b) => new Date(a.refundDueDate) - new Date(b.refundDueDate));
  }

  function daysLeft(order){
    if (!order.refundDueDate) return null;
    const ms = new Date(order.refundDueDate) - new Date();
    return Math.ceil(ms / (1000*60*60*24));
  }

  // Admin: mark a refund as actually sent to the customer (UPI/bank transfer
  // done outside the site — this just records it).
  async function markRefundSent(orderId){
    const order = byId(orderId);
    if (!order) return { ok:false };
    order.refundStatus = 'sent';
    order.timeline.push({ status:'refund_sent', at:new Date().toISOString(), note:`${Utils.formatINR(order.refundAmount)} refunded to customer.` });
    order.updatedAt = new Date().toISOString();
    await DB.saveOrder(order);
    return { ok:true, order };
  }

  // Re-fetch orders from Supabase (if configured) so status changes made by
  // the admin in another tab/session show up here too.
  async function refresh(){
    return DB.refreshOrders();
  }

  return { STATUS_META, TRACK_STEPS, displayStatus, forUser, byId, pendingConfirmationQueue, balanceConfirmationQueue, advanceStatus, canCancel, cancelOrder, cancelQuote, amountPaid, adminCancelOrder, setRefundCharge, refresh, REFUND_COMMISSION, refundQueue, daysLeft, markRefundSent, setTracking, buildTrackingUrl };
})();
