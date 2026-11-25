const WT_IC={
phone:`<svg viewBox="0 0 64 64"><defs><linearGradient id="wp1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4b5d8a"/><stop offset="1" stop-color="#101a36"/></linearGradient><linearGradient id="wp2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5ea0ff"/><stop offset="1" stop-color="#7b5cff"/></linearGradient></defs><rect x="19" y="4" width="26" height="56" rx="6" fill="url(#wp1)"/><rect x="21.5" y="7" width="21" height="50" rx="4" fill="url(#wp2)"/><rect x="28" y="8.5" width="8" height="2.4" rx="1.2" fill="#0b1226"/><circle cx="32" cy="52" r="1.4" fill="#fff" opacity=".6"/><path d="M21.5 20 42.5 12v8L21.5 28z" fill="#fff" opacity=".12"/></svg>`,
laptop:`<svg viewBox="0 0 64 64"><defs><linearGradient id="wl1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4668"/><stop offset="1" stop-color="#151d36"/></linearGradient><linearGradient id="wl2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34d0b6"/><stop offset="1" stop-color="#3b82f6"/></linearGradient></defs><rect x="10" y="13" width="44" height="29" rx="3" fill="url(#wl1)"/><rect x="12.5" y="15.5" width="39" height="24" rx="1.5" fill="url(#wl2)"/><path d="M5 45h54l-3 5H8z" fill="#aab4cf"/><rect x="26" y="45" width="12" height="1.8" rx=".9" fill="#7a86a6"/></svg>`,
watch:`<svg viewBox="0 0 64 64"><defs><linearGradient id="ww1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#55627f"/><stop offset="1" stop-color="#1a233f"/></linearGradient></defs><rect x="22" y="2" width="20" height="14" rx="3" fill="#2a3556"/><rect x="22" y="48" width="20" height="14" rx="3" fill="#2a3556"/><rect x="15" y="14" width="34" height="36" rx="9" fill="url(#ww1)"/><rect x="18" y="17" width="28" height="30" rx="7" fill="#0b1226"/><circle cx="32" cy="32" r="9.5" fill="none" stroke="#34d399" stroke-width="2.4"/><path d="M32 26v6l4 2.5" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"/><rect x="49" y="26" width="3" height="7" rx="1.5" fill="#7a86a6"/></svg>`,
audio:`<svg viewBox="0 0 64 64"><defs><linearGradient id="wa1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8a5c"/><stop offset="1" stop-color="#e0245e"/></linearGradient></defs><path d="M12 38V32a20 20 0 0 1 40 0v6" fill="none" stroke="#2a3556" stroke-width="5" stroke-linecap="round"/><rect x="8" y="34" width="12" height="20" rx="6" fill="url(#wa1)"/><rect x="44" y="34" width="12" height="20" rx="6" fill="url(#wa1)"/><rect x="11" y="38" width="3" height="10" rx="1.5" fill="#fff" opacity=".35"/><rect x="47" y="38" width="3" height="10" rx="1.5" fill="#fff" opacity=".35"/></svg>`
};
const Walkthrough=(()=>{const i=[{key:"browse",ms:6e3,label:"Browse the catalog",caption:"Over 2,000 mobiles, laptops, watches and accessories.",scene:()=>`
        <div class="wt-screen">
          <div class="wt-searchbar"><i class="fa-solid fa-magnifying-glass"></i><span class="wt-typing" data-type="iPhone 15"></span></div>
          <div class="wt-grid">
            ${[["phone","Mobiles"],["laptop","Laptops"],["watch","Watches"],["audio","Audio"]].map((s,t)=>`<div class="wt-tile wt-pop" style="animation-delay:${(t+1)*.14}s"><div class="wt-tile-img">${WT_IC[s[0]]}</div><div class="wt-tile-name">${s[1]}</div></div>`).join("")}
          </div>
        </div>`},{key:"product",ms:6e3,label:"Open a product",caption:"Full specs, real photos, and the exact charger that model needs.",scene:()=>`
        <div class="wt-screen">
          <div class="wt-hero-img wt-pop">${WT_IC.phone}</div>
          <div class="wt-pname wt-pop" style="animation-delay:.1s">iPhone 15 \u00B7 128GB</div>
          <div class="wt-price wt-pop" style="animation-delay:.2s">\u20B964,900</div>
          <div class="wt-chiprow">
            ${["128GB",'6.1" OLED',"20W"].map((s,t)=>`<span class="wt-chip wt-pop" style="animation-delay:${.3+t*.1}s">${s}</span>`).join("")}
          </div>
        </div>`},{key:"cart",ms:5500,label:"Add to cart",caption:"Cart and wishlist stay saved on your account.",scene:()=>`
        <div class="wt-screen wt-center">
          <div class="wt-cart-icon"><i class="fa-solid fa-cart-shopping"></i><span class="wt-cart-badge">1</span></div>
          <div class="wt-line wt-w60" style="margin-top:18px;"></div>
          <div class="wt-btn wt-pop" style="animation-delay:.4s">Proceed to checkout</div>
        </div>`},{key:"address",ms:6e3,label:"Enter delivery details",caption:"Pincode decides your delivery speed and whether COD is available.",scene:()=>`
        <div class="wt-screen">
          <div class="wt-field wt-pop"><span>Name</span></div>
          <div class="wt-field wt-pop" style="animation-delay:.12s"><span>Address</span></div>
          <div class="wt-field wt-pop" style="animation-delay:.24s"><span class="wt-typing" data-type="641001"></span></div>
          <div class="wt-note wt-pop" style="animation-delay:.9s"><i class="fa-solid fa-truck-fast"></i> Coimbatore district \u2014 1-day delivery</div>
        </div>`},{key:"pay",ms:6500,label:"Pay by UPI",caption:"Scan with GPay, PhonePe or Paytm \u2014 then upload the screenshot.",scene:()=>`
        <div class="wt-screen wt-center">
          <div class="wt-qr wt-pop">
            ${Array.from({length:36}).map((s,t)=>`<i style="animation-delay:${t%9*.05}s;${[0,1,2,9,10,11,18,19,20,6,7,8,15,16,17,27,28,29,33,34,35,24,25,26].includes(t)?"opacity:1":"opacity:.25"}"></i>`).join("")}
          </div>
          <div class="wt-line wt-w50" style="margin-top:14px;"></div>
          <div class="wt-upi-row">
            ${[["GPay","#4285F4"],["PhonePe","#5F259F"],["Paytm","#00BAF2"]].map((s,t)=>`<span class="wt-chip wt-pop" style="animation-delay:${.3+t*.12}s"><i class="wt-brand" style="background:${s[1]}"></i>${s[0]}</span>`).join("")}
          </div>
        </div>`},{key:"verify",ms:5500,label:"We verify your payment",caption:"Our team checks the screenshot against the bank record.",scene:()=>`
        <div class="wt-screen wt-center">
          <div class="wt-spinner"></div>
          <div class="wt-line wt-w60" style="margin-top:20px;"></div>
          <div class="wt-line wt-w40" style="margin-top:8px;"></div>
        </div>`},{key:"ok",ms:6500,label:"Payment confirmed",status:"ok",caption:"Green means the money reached us and your order is placed.",scene:()=>`
        <div class="wt-screen wt-center wt-status wt-status-ok">
          <div class="wt-mark wt-mark-ok">
            <svg viewBox="0 0 52 52"><circle class="wt-mark-ring" cx="26" cy="26" r="23"/><path class="wt-mark-path" d="M15 27 l8 8 l15 -16"/></svg>
          </div>
          <div class="wt-status-title">Order Confirmed</div>
          <div class="wt-status-sub">Payment received \xB7 packing starts today</div>
        </div>`},{key:"wait",ms:6500,label:"Awaiting confirmation",status:"wait",caption:"Amber means we are still checking \u2014 if it cannot be confirmed, the money goes back to the same account.",scene:()=>`
        <div class="wt-screen wt-center wt-status wt-status-wait">
          <div class="wt-mark wt-mark-wait"><i class="fa-solid fa-hourglass-half"></i></div>
          <div class="wt-status-title">Waiting for order confirmation</div>
          <div class="wt-status-sub">Or your money is refunded to the same account</div>
        </div>`},{key:"fail",ms:6500,label:"Payment failed",status:"fail",caption:"Red means nothing was charged \u2014 you can simply try again.",scene:()=>`
        <div class="wt-screen wt-center wt-status wt-status-fail">
          <div class="wt-mark wt-mark-fail">
            <svg viewBox="0 0 52 52"><circle class="wt-mark-ring" cx="26" cy="26" r="23"/><path class="wt-mark-path" d="M17 17 l18 18"/><path class="wt-mark-path wt-mark-path-2" d="M35 17 l-18 18"/></svg>
          </div>
          <div class="wt-status-title">Payment Failed</div>
          <div class="wt-status-sub">Nothing was charged \u2014 try again</div>
        </div>`}],l=i.reduce((s,t)=>s+t.ms,0);function k(){return`
      <div class="wt-root" id="wt-root">
        <div class="wt-head">
          <span class="wt-eyebrow">How it works</span>
          <span class="wt-clock" id="wt-clock"></span>
        </div>

        <div class="wt-phone">
          <div class="wt-notch"></div>
          <div class="wt-viewport" id="wt-viewport"></div>
        </div>

        <div class="wt-caption" id="wt-caption"></div>

        <div class="wt-dots" id="wt-dots">
          ${i.map((s,t)=>`<button class="wt-dot" data-i="${t}" aria-label="${s.label}"></button>`).join("")}
        </div>

        <div class="wt-progress"><div class="wt-progress-bar" id="wt-progress-bar"></div></div>

        <div class="wt-legend">
          <span><i class="wt-key wt-key-ok"></i> Confirmed</span>
          <span><i class="wt-key wt-key-wait"></i> Awaiting / refund</span>
          <span><i class="wt-key wt-key-fail"></i> Failed</span>
        </div>
      </div>`}function b(s){s.querySelectorAll("[data-type]").forEach(t=>{const d=t.dataset.type;t.textContent="";let o=0;const r=setInterval(()=>{t.textContent=d.slice(0,++o),o>=d.length&&clearInterval(r)},90);t._typer=r})}function P(s){if(!s)return;s.innerHTML=k();const t=s.querySelector("#wt-viewport"),d=s.querySelector("#wt-caption"),o=s.querySelector("#wt-clock"),r=s.querySelector("#wt-progress-bar"),f=Array.from(s.querySelectorAll(".wt-dot"));let c=0,m=null,w=null,g=0,p=0;function y(a){c=a;const e=i[a];t.innerHTML=e.scene(),t.className="wt-viewport wt-enter"+(e.status?" wt-vp-"+e.status:""),t.offsetWidth,t.classList.remove("wt-enter"),t.offsetWidth,t.classList.add("wt-enter"),d.innerHTML=`<strong>${e.label}</strong><span>${e.caption}</span>`,f.forEach((n,h)=>n.classList.toggle("active",h===a)),b(t)}function v(){clearTimeout(m),g=performance.now(),m=setTimeout(()=>{p=i.slice(0,c+1).reduce((e,n)=>e+n.ms,0)%l;const a=(c+1)%i.length;a===0&&(p=0),y(a),v()},i[c].ms)}function u(){const a=performance.now()-g,e=p+Math.min(a,i[c].ms),n=Math.min(100,e/l*100);r.style.width=n+"%",o.textContent=`${Math.round(e/1e3)}s / ${Math.round(l/1e3)}s`,w=requestAnimationFrame(u)}f.forEach(a=>a.addEventListener("click",()=>{const e=Number(a.dataset.i);p=i.slice(0,e).reduce((n,h)=>n+h.ms,0),y(e),v()})),document.addEventListener("visibilitychange",()=>{document.hidden?(clearTimeout(m),cancelAnimationFrame(w)):(v(),w=requestAnimationFrame(u))}),y(0),v(),w=requestAnimationFrame(u)}return{mount:P,STEPS:i,TOTAL_MS:l}})();
