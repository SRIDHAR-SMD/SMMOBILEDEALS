/* Fast, smooth page-to-page navigation (target: next page visible in ~0.5s).
   - prefetches a page the moment the cursor/finger is on its link (and the footer/nav links when idle)
   - quick 0.12s fade-out on click, 0.1s fade-in on arrival, so the move feels smooth, never a blink
   - back/forward cache friendly; ctrl/middle click, new tab, downloads and #anchors are untouched */
(function(){
  var done=Object.create(null), reduce=false;
  try{reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){}
  /* No fade-out / fade-in: they flashed the page black while the next page was loading. */
  function ok(a){
    if(!a||!a.href||a.target==='_blank'||a.hasAttribute('download'))return false;
    var u;try{u=new URL(a.href,location.href)}catch(e){return false}
    if(u.origin!==location.origin&&location.protocol!=='file:')return false;
    if(location.protocol==='file:'&&u.protocol!=='file:')return false;
    if(u.pathname===location.pathname&&u.search===location.search)return false;   // same page / #anchor
    if(!/\.html?$|\/$/.test(u.pathname))return false;
    return u;
  }
  function prefetch(a){
    var u=ok(a);if(!u||done[u.href])return;done[u.href]=1;
    var l=document.createElement('link');l.rel='prefetch';l.href=u.href;l.as='document';document.head.appendChild(l);
  }
  ['mouseover','touchstart','focusin'].forEach(function(ev){
    document.addEventListener(ev,function(e){var a=e.target.closest&&e.target.closest('a');if(a)prefetch(a)},{passive:true,capture:true});
  });
  var idle=window.requestIdleCallback||function(f){setTimeout(f,1200)};
  window.addEventListener('load',function(){idle(function(){
    var n=0;document.querySelectorAll('.main-nav a, .site-footer a').forEach(function(a){if(n++<12)prefetch(a)});
  })});
  document.addEventListener('click',function(e){
    if(e.defaultPrevented||e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||reduce)return;
    var a=e.target.closest&&e.target.closest('a');var u=ok(a);if(!u||a.getAttribute('href').charAt(0)==='#')return;
    e.preventDefault();
    location.href=u.href;   // go immediately - the old page stays visible until the new one paints
  });
  window.addEventListener('pageshow',function(e){if(e.persisted)document.documentElement.classList.remove('smd-leaving')});
})();
