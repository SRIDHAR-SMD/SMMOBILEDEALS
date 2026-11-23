const AdminUI=(()=>{function c(){const t=Analytics.summary(),e=Orders.pendingConfirmationQueue().length+Orders.balanceConfirmationQueue().length;return[{label:"Confirmed Revenue",value:Utils.formatINR(t.revenue),icon:"fa-sack-dollar",color:"var(--success)"},{label:"Total Orders",value:t.orderCount,icon:"fa-receipt",color:"var(--accent-2)"},{label:"Pending Payments",value:e,icon:"fa-hourglass-half",color:"var(--pending)"},{label:"Products Listed",value:DB.getProducts().length,icon:"fa-boxes-stacked",color:"var(--deal)"}].map(a=>`
      <div class="card" style="padding:20px;">
        <div class="flex items-center justify-between" style="margin-bottom:10px;">
          <span class="text-faint" style="font-size:12.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;">${a.label}</span>
          <i class="fa-solid ${a.icon}" style="color:${a.color};font-size:18px;"></i>
        </div>
        <div style="font-family:var(--font-display);font-size:26px;font-weight:700;">${a.value}</div>
      </div>`).join("")}function d(t){var e;return`
    <div class="card" style="padding:18px;display:grid;grid-template-columns:100px 1fr auto;gap:16px;align-items:center;" data-order="${t.id}">
      <img src="${t.screenshot||""}" alt="Payment screenshot" style="width:100px;height:100px;object-fit:cover;border-radius:10px;border:1px solid var(--border-soft);cursor:pointer;" onclick="AdminUI.previewImage('${t.id}')">
      <div>
        <div style="font-family:var(--font-mono);font-weight:700;">${t.id}</div>
        <div class="text-dim" style="font-size:13px;">${Utils.escapeHtml(t.address.name)} \xB7 ${Utils.escapeHtml(t.address.phone)}</div>
        <div class="text-faint" style="font-size:12.5px;">${t.items.length} item(s) \xB7 screenshot should show <span class="text-deal" style="font-family:var(--font-mono);">${Utils.formatINR((e=t.amountDueNow)!=null?e:t.totals.total)}</span>${t.paymentMethod==="cod"?' <span class="badge badge-pending" style="margin-left:4px;">COD advance</span>':""}</div>
      </div>
      <div class="flex gap-8">
        <button class="btn btn-primary btn-sm" onclick="AdminUI.confirmPayment('${t.id}')"><i class="fa-solid fa-check"></i> Confirm</button>
        <button class="btn btn-outline btn-sm" onclick="AdminUI.reject('${t.id}')"><i class="fa-solid fa-xmark"></i> Reject</button>
      </div>
    </div>`}function r(t){return`
    <div class="card" style="padding:18px;display:grid;grid-template-columns:100px 1fr auto;gap:16px;align-items:center;" data-order="${t.id}">
      <img src="${t.balanceScreenshot||""}" alt="Balance payment screenshot" style="width:100px;height:100px;object-fit:cover;border-radius:10px;border:1px solid var(--border-soft);cursor:pointer;" onclick="ImageViewer.open('${t.balanceScreenshot||""}', 'Balance Payment Screenshot \u2014 Order ${t.id}')">
      <div>
        <div style="font-family:var(--font-mono);font-weight:700;">${t.id} <span class="badge badge-accent" style="margin-left:4px;">Balance</span></div>
        <div class="text-dim" style="font-size:13px;">${Utils.escapeHtml(t.address.name)} \xB7 ${Utils.escapeHtml(t.address.phone)}</div>
        <div class="text-faint" style="font-size:12.5px;">Balance should show <span class="text-deal" style="font-family:var(--font-mono);">${Utils.formatINR(t.totals.balanceAmount)}</span> \u2014 confirming now decides same-day vs next-day dispatch (6 PM cutoff).</div>
      </div>
      <div class="flex gap-8">
        <button class="btn btn-primary btn-sm" onclick="AdminUI.confirmBalance('${t.id}')"><i class="fa-solid fa-check"></i> Confirm</button>
        <button class="btn btn-outline btn-sm" onclick="AdminUI.rejectBalance('${t.id}')"><i class="fa-solid fa-xmark"></i> Reject</button>
      </div>
    </div>`}async function l(t){await Payment.confirmPayment(t),Notify.toast(`Order ${t} confirmed. Customer will now see "Order Confirmed".`,"success"),document.dispatchEvent(new CustomEvent("admin:refresh"))}async function m(t){var n;const e=await Payment.confirmBalance(t);Notify.toast(`Balance confirmed for ${t}. ${((n=e.order)==null?void 0:n.dispatchNote)||""}`,"success"),document.dispatchEvent(new CustomEvent("admin:refresh"))}async function f(t){const e=window.prompt("Reason for rejecting this balance payment (shown to the customer):","Screenshot amount did not match the balance due.");e!==null&&(await Payment.rejectBalance(t,e),Notify.toast(`Balance payment rejected for ${t}.`,"info"),document.dispatchEvent(new CustomEvent("admin:refresh")))}async function u(t){const e=window.prompt("Reason for rejecting this payment (shown to customer):","Screenshot did not match the order amount.");e!==null&&(await Payment.rejectPayment(t,e),Notify.toast(`Order ${t} marked as payment rejected.`,"warn"),document.dispatchEvent(new CustomEvent("admin:refresh")))}function p(t){const e=Orders.byId(t);!e||!e.screenshot||ImageViewer.open(e.screenshot,`Payment Screenshot \u2014 Order ${e.id}`)}function v(t){const e=t.images&&t.images.length||(t.imageUrl?1:0),n=t.videos&&t.videos.length||(t.videoUrl?1:0),a=t.images&&t.images[0]||t.imageUrl?`<img src="${Utils.assetSrc(t.images&&t.images[0]||t.imageUrl)}" style="width:36px;height:36px;object-fit:cover;border-radius:8px;">`:`<img src="${Utils.deviceImage(t.type,t.color)}" style="width:36px;height:36px;object-fit:contain;opacity:.5;">`;let s;return e&&n?s=`<span class="badge badge-success">${e} photo${e>1?"s":""} + ${n} video${n>1?"s":""}</span>`:e?s=`<span class="badge badge-success">${e} photo${e>1?"s":""}</span>`:n?s=`<span class="badge badge-accent">${n} video${n>1?"s":""} only</span>`:s='<span class="badge badge-pending">No media</span>',`
    <tr data-id="${t.id}" data-hasmedia="${e||n?"1":"0"}">
      <td>${a}</td>
      <td>${Utils.escapeHtml(t.name)}<div class="text-faint" style="font-size:11.5px;">${Utils.escapeHtml(t.brand)} \xB7 ${Utils.escapeHtml(String(t.category).replace(/-/g," "))}</div></td>
      <td>${s}</td>
      <td style="font-family:var(--font-mono);">${Utils.formatINR(t.price)}</td>
      <td>${t.stock}</td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="AdminUI.editProduct('${t.id}')" title="Edit product"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-ghost btn-sm" onclick="AdminUI.deleteProduct('${t.id}')" title="Delete product" style="color:var(--danger);"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`}async function y(t){window.confirm("Remove this product from the catalog?")&&(await DB.deleteProduct(t),Notify.toast("Product removed.","success"),document.dispatchEvent(new CustomEvent("admin:refresh")))}function g(t){document.dispatchEvent(new CustomEvent("admin:edit-product",{detail:{id:t}}))}function b(t){var a;const e=Orders.STATUS_META[Orders.displayStatus(t)],n=t.courier?((a=SITE_CONFIG.couriers[t.courier])==null?void 0:a.name)||t.courier:null;return`
    <tr>
      <td style="font-family:var(--font-mono);">${t.id}</td>
      <td>${Utils.escapeHtml(t.address.name)}</td>
      <td style="font-family:var(--font-mono);">${Utils.formatINR(t.totals.total)}</td>
      <td><span class="badge ${e.badge}"><i class="fa-solid ${e.icon}"></i> ${e.label}</span>${n?`<div class="text-faint" style="font-size:11px;margin-top:3px;">${n} \xB7 ${Utils.escapeHtml(t.trackingNumber)}</div>`:""}</td>
      <td>
        ${t.screenshot?`<button class="btn btn-ghost btn-sm" onclick="AdminUI.previewImage('${t.id}')" title="View payment screenshot"><i class="fa-solid fa-image"></i></button>`:""}
        <a class="btn btn-ghost btn-sm" href="invoice.html?order=${t.id}" title="Generate / view bill"><i class="fa-solid fa-file-invoice"></i></a>
        <button class="btn btn-ghost btn-sm" onclick="AdminUI.promptTracking('${t.id}')" title="${t.trackingNumber?"Update tracking":"Add tracking"}"><i class="fa-solid fa-truck-fast"></i></button>
        <select class="input" style="padding:6px 10px;font-size:12.5px;" onchange="AdminUI.setStatus('${t.id}', this.value)">
          ${Orders.TRACK_STEPS.map(s=>`<option value="${s}" ${t.orderStatus===s?"selected":""}>${Orders.STATUS_META[s].label}</option>`).join("")}
        </select>
      </td>
    </tr>`}async function h(t){const e=Object.entries(SITE_CONFIG.couriers).map(([C,k],U)=>`${U+1}. ${k.name}`).join(`
`),n=prompt(`Which courier?
${e}

Enter the number:`);if(!n)return;const s=Object.keys(SITE_CONFIG.couriers)[parseInt(n,10)-1];if(!s){Notify.toast("Not a valid choice.","error");return}const i=prompt("Paste the tracking number/barcode, or the full tracking link:");if(!i||!i.trim())return;const o=await Orders.setTracking(t,s,i);if(!o.ok){Notify.toast(o.error||"Could not save tracking.","error");return}Notify.toast("Tracking saved \u2014 customer notified with the live link.","success"),document.dispatchEvent(new CustomEvent("admin:refresh"))}async function $(t,e){await Orders.advanceStatus(t,e),Notify.toast(`Order ${t} updated to "${Orders.STATUS_META[e].label}".`,"success"),document.dispatchEvent(new CustomEvent("admin:refresh"))}function x(t){const e=Orders.daysLeft(t),n=e!==null&&e<0;return`
    <div class="card" style="padding:18px;display:grid;grid-template-columns:1fr auto;gap:16px;align-items:center;" data-order="${t.id}">
      <div>
        <div style="font-family:var(--font-mono);font-weight:700;">${t.id}</div>
        <div class="text-dim" style="font-size:13px;">${Utils.escapeHtml(t.address.name)} \xB7 ${Utils.escapeHtml(t.address.phone)}</div>
        <div class="text-faint" style="font-size:12.5px;">Refund <b style="color:var(--accent-2);font-family:var(--font-mono);">${Utils.formatINR(t.refundAmount)}</b> \xB7 \u20B9${t.refundCommission} commission kept \xB7 <span style="color:${n?"var(--danger)":"var(--text-faint)"};">${n?"Overdue by "+Math.abs(e)+" day(s)":e+" day(s) left"}</span></div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="AdminUI.markRefundSent('${t.id}')"><i class="fa-solid fa-money-bill-transfer"></i> Mark refund sent</button>
    </div>`}async function w(t){await Orders.markRefundSent(t),Notify.toast(`Refund for ${t} marked as sent.`,"success"),document.dispatchEvent(new CustomEvent("admin:refresh"))}return{statsHTML:c,pendingPaymentCard:d,balancePaymentCard:r,confirmPayment:l,confirmBalance:m,rejectBalance:f,reject:u,previewImage:p,productRow:v,deleteProduct:y,editProduct:g,orderRow:b,setStatus:$,refundCard:x,markRefundSent:w,promptTracking:h}})();
