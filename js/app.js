/* ==========================================================================
   APP — bootstraps every page: waits for DB.init() + Auth.init() (which
   pull from Supabase when configured), then mounts header/footer, theme,
   AI widget, etc. Every page calls:

       App.boot('activeKey').then(() => { ...page's own render code... });

   so page-specific rendering always runs AFTER product/session data is
   ready — whether that data came from Supabase or the local fallback.
   ========================================================================== */

/* keep the browser's install prompt so the header "Application" button can use it */
try{ window.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); window.__smdInstallEvt = e; window.dispatchEvent(new Event('smd-installable')); }); window.addEventListener('appinstalled', function(){ window.__smdInstallEvt = null; window.dispatchEvent(new Event('smd-installed')); }); }catch(e){}

const App = (() => {
  // ---------------------------------------------------------------------
  // ERROR WATCHDOG — a static site has no server process watching pages
  // when nobody's on them, so true 24/7 monitoring without a visitor isn't
  // possible here. What IS real: the moment ANY visitor's browser hits a
  // JS error, a broken image, or a failed request on ANY page, this fires
  // immediately and notifies the admin (via the existing Inbox bell) with
  // the exact page, error, and time — no need to wait for someone to
  // report it. Rate-limited per browser session so one broken image loop
  // can't flood the admin inbox.
  // ---------------------------------------------------------------------
  function initErrorWatchdog(){
    if (typeof Inbox === 'undefined' || !DB.useSupabase()) return; // nothing to notify into
    if (location.protocol === 'file:') return; // opened locally — prefetch/links always fail, skip watchdog
    const SESSION_KEY = 'smd_watchdog_sent';
    const MAX_PER_SESSION = 5;
    let sent = 0;
    try{ sent = Number(sessionStorage.getItem(SESSION_KEY) || 0); }catch(e){}
    const seen = new Set();

    function report(kind, detail){
      if (sent >= MAX_PER_SESSION) return;
      const key = kind + '::' + detail.slice(0, 120);
      if (seen.has(key)) return; // same error repeating on this page — only report once
      seen.add(key);
      sent++;
      try{ sessionStorage.setItem(SESSION_KEY, String(sent)); }catch(e){}
      const page = window.location.pathname.split('/').pop() || 'home';
      Inbox.sendToAdmin(
        `Site error detected — ${page}`,
        `${kind}: ${detail}\nPage: ${window.location.href}\nTime: ${new Date().toLocaleString()}`,
        window.location.pathname.includes('admin') ? undefined : window.location.pathname
      ).catch(() => {});
    }

    window.addEventListener('error', (e) => {
      // Broken image / script / css load — target is the failed element, no e.message.
      if (e.target && e.target !== window && e.target.tagName){
        const tag = e.target.tagName.toLowerCase();
        if (tag === 'link' && (e.target.rel === 'prefetch' || e.target.rel === 'preload')) return; // speculative, not a real broken link
        const src = e.target.src || e.target.href || '';
        if (src) report('Broken ' + tag, src);
        return;
      }
      // Real JS runtime error. Skip noisy, non-actionable browser/extension noise.
      const msg = e.message || '';
      if (!msg || msg === 'Script error.' || /ResizeObserver loop/i.test(msg)) return;
      report('JavaScript error', `${msg} (${e.filename || 'unknown file'}:${e.lineno || '?'})`);
    }, true); // capture phase — required to catch resource load errors, which don't bubble

    window.addEventListener('unhandledrejection', (e) => {
      const reason = e.reason && (e.reason.message || String(e.reason));
      if (reason) report('Unhandled promise rejection', reason);
    });
  }

  function mountAIWidget(){
    if (document.getElementById('ai-fab')) return;
    const fab = document.createElement('button');
    fab.id = 'ai-fab';
    fab.className = 'ai-fab';
    fab.setAttribute('aria-label','AI Shopping Assistant');
    fab.innerHTML = `${UI.ICONS.headset('')}<span class="fab-badge"></span>`;
    document.body.appendChild(fab);
    // Dock: the chatbot button is the only visible control; GPS / Admin chat / AI assistant appear on hover.
    try{
      const _root = (typeof ROOT_PREFIX !== 'undefined' ? ROOT_PREFIX : '');
      if (!document.getElementById('smd-dock-css')){ const l = document.createElement('link'); l.id = 'smd-dock-css'; l.rel = 'stylesheet'; l.href = _root + 'css/dock.css'; document.head.appendChild(l); }
      loadScript(_root + 'js/dock.js').catch(() => {});
    }catch(e){ console.warn('[dock]', e && e.message); }
    // The assistant (chatbot.js, ~40 KB) is only fetched when someone reaches for the button.
    // Placeholder so inline buttons elsewhere (e.g. the homepage "AI assistant" card) that call
    // Chatbot.toggle() work before chatbot.js has loaded; the real Chatbot replaces it once loaded.
    if (typeof Chatbot === 'undefined') window.Chatbot = { toggle: () => fab.click() };
    let ready = null;
    const load = () => ready || (ready = (async () => {
      const base = (typeof ROOT_PREFIX !== 'undefined' ? ROOT_PREFIX : '') + 'js/';
      const need = [];
      if (typeof Pincode === 'undefined') need.push('pincode.js');
      if (typeof Payment === 'undefined') need.push('payment.js');
      for (const f of need) await loadScript(base + f);   // small helpers the assistant calls
      await loadScript(base + 'chatbot.js');
      document.body.appendChild(Chatbot.panelElement());
    })().catch(err => { ready = null; throw err; }));
    ['pointerenter','touchstart','focus'].forEach(ev => fab.addEventListener(ev, () => { load().catch(() => {}); }, { once:true, passive:true }));
    fab.addEventListener('click', async () => {
      try{ await load(); Chatbot.toggle(); }
      catch(err){ Notify.toast('The assistant could not load — check your connection and try again.', 'error'); }
    });
  }

  // Loads a script once; resolves when it has executed.
  const scriptJobs = {};
  function loadScript(src){
    if (scriptJobs[src]) return scriptJobs[src];
    return scriptJobs[src] = new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src; el.onload = resolve; el.onerror = () => { delete scriptJobs[src]; reject(new Error('could not load ' + src)); };
      document.head.appendChild(el);
    });
  }

  function registerSW(){
    // Skip the service worker entirely on localhost/127.0.0.1 (Live Server,
    // dev builds). It caches css/js "cache-first" and the CACHE_NAME never
    // changes during active editing, so every edit kept getting served
    // stale from the SW cache and only a hard refresh (which browsers use
    // to bypass the SW) showed the real file — that's why every change
    // needed Ctrl+Shift+R. Real deployments (a real domain) still get the
    // offline PWA caching as before.
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1'){
      // A service worker from an earlier visit may already be installed and
      // controlling this page — just skipping re-registration above isn't
      // enough to stop it. Unregister it so this fix takes effect on the
      // very next load instead of needing a manual DevTools cache clear.
      if ('serviceWorker' in navigator){
        navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
      }
      return;
    }
    if ('serviceWorker' in navigator){
      const swPath = (typeof ROOT_PREFIX !== 'undefined' ? ROOT_PREFIX : '') + 'service-worker.js';
      navigator.serviceWorker.register(swPath).catch(() => {});
    }
  }

  // Start downloading a page the moment the finger/mouse is over its link,
  // so by the time the click lands the HTML is already in the browser cache.
  function initPrefetch(){
    try{
      const c = navigator.connection;
      if (c && (c.saveData || /2g/.test(c.effectiveType || ''))) return;
    }catch(e){}
    const seen = new Set();
    const warm = (e) => {
      const a = e.target && e.target.closest && e.target.closest('a[href]');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      let u; try{ u = new URL(a.href, window.location.href); }catch(err){ return; }
      if (u.origin !== window.location.origin || !/\.html$/.test(u.pathname)) return;
      if (u.href === window.location.href || seen.has(u.href)) return;
      seen.add(u.href);
      const l = document.createElement('link');
      l.rel = 'prefetch'; l.as = 'document'; l.href = u.href;
      document.head.appendChild(l);
    };
    document.addEventListener('mouseover', warm, { passive:true });
    document.addEventListener('touchstart', warm, { passive:true });
  }

  async function boot(activeKey){
    registerSW();
    initErrorWatchdog();
    try{ loadScript((typeof ROOT_PREFIX !== 'undefined' ? ROOT_PREFIX : '') + 'js/scroll-guard.js').catch(() => {}); }catch(e){}
    try{ loadScript((typeof ROOT_PREFIX !== 'undefined' ? ROOT_PREFIX : '') + 'js/install-app.js').catch(() => {}); }catch(e){}
    // Auth.init() MUST finish before DB.init() fires its Supabase queries.
    // orders are RLS-protected ("auth.uid() = user_id"), so if DB.init()'s
    // orders refresh runs while the Supabase client still has no restored
    // session, that query comes back empty and overwrites the local cache —
    // wiping out an order the customer just placed a second ago (seen as
    // "Order not found" right after checkout, on the very next page load).
    // Running them in sequence instead of Promise.all costs a few ms but
    // guarantees the session is attached before any RLS-gated read happens.
    // Both are capped so a slow/blocked network can never leave a page stuck on
    // "Loading..." — after the cap the page renders with whatever is cached.
    const cap = (p, ms) => Promise.race([p, new Promise(res => setTimeout(res, ms))]);
    // FIX (black screen between pages): header/footer used to appear only AFTER the
    // network calls below finished, so every page change showed an empty black page
    // for 1-6 seconds. The session is cached in localStorage, so on normal pages we
    // mount header/footer + theme immediately and let the data load in the background.
    // Admin pages keep the old order (they must wait for the fresh admin role).
    let mounted = false;
    if (!/admin/.test((window.location.pathname || '').toLowerCase())){
      try{ UI.mount(activeKey); Theme.init(); mounted = true; }catch(e){ console.warn('[boot] early mount:', e && e.message); }
    }
    try{ await cap(Auth.init(), 3500); }catch(e){ console.warn('[boot] auth init:', e && e.message); }
    try{ await cap(DB.init(), 5000); }catch(e){ console.warn('[boot] db init:', e && e.message); } // pulls from Supabase if configured, else local fallback (fast)
    if (!mounted){ UI.mount(activeKey); Theme.init(); }
    else { try{ UI.refreshFooterAccount(); }catch(e){} } // footer was mounted before Auth.init: re-sync the Account column (username + 3 links)
    mountAIWidget();
    Loader.initReveal();
    UI.updateCounts();
    initPrefetch();
    DB.logEvent('page_view', { page: activeKey || document.title });
    if (!Auth.isAdmin()) DB.pingVisit(window.location.pathname);
    document.querySelectorAll('main').forEach(el => el.classList.add('page-enter'));
    if (typeof Reminders !== 'undefined') Reminders.init();
    // Consent-based live location (customers only) — geo.js is loaded on demand.
    try{
      const cu = Auth.currentUser();
      if (cu && cu.id !== 'admin' && cu.role !== 'admin' && cu.role !== 'staff'){
        if (typeof Geo === 'undefined') await loadScript((typeof ROOT_PREFIX !== 'undefined' ? ROOT_PREFIX : '') + 'js/geo.js');
        if (typeof Geo !== 'undefined') Geo.liveInit();
      }
    }catch(e){ console.warn('[Geo] live init skipped:', e && e.message); }
  }

  return { boot };
})();
