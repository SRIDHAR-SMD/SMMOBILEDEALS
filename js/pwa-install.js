/* ==========================================================================
   SM Mobile Deals — "Install App" (PWA) helper
   Two separate apps from one website:
     1) CUSTOMER app  -> offered on the HOMEPAGE only (white / light theme)
     2) ADMIN & STAFF app -> offered ONLY inside the dashboard, ONLY after an
        admin/staff login (its own manifest + amber "ADMIN" icon). The admin
        manifest is not even linked until the panel login is confirmed, so
        customers never see an install option for it.

   Works on: Android (Chrome/Edge/Samsung), Windows & Mac (Chrome/Edge),
   iPhone/iPad (Safari "Add to Home Screen"), Mac Safari ("Add to Dock").
   Browsers ALWAYS ask the person to confirm an install, so an app can never
   be installed silently — this script shows our "Install" card first and the
   browser then shows its own Allow/Install dialog.
   ========================================================================== */
(function () {
  'use strict';

  if (window.top !== window.self) return;   // never inside the admin live-editor preview frame
  var ROOT = (typeof ROOT_PREFIX !== 'undefined' && ROOT_PREFIX) ? ROOT_PREFIX : '';
  var IS_ADMIN_PAGE = /\/pages\/admin\.html$/i.test(location.pathname);
  var SNOOZE_KEY = IS_ADMIN_PAGE ? 'smd_pwa_snooze_admin' : 'smd_pwa_snooze_customer';
  var SNOOZE_MS = 3 * 24 * 60 * 60 * 1000; // ask again after 3 days
  var deferred = null;                       // beforeinstallprompt event

  /* ---------- helpers ---------- */
  function ls(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {}
    return null;
  }
  function isStandalone() {
    try {
      return (window.matchMedia && (matchMedia('(display-mode: standalone)').matches ||
              matchMedia('(display-mode: window-controls-overlay)').matches ||
              matchMedia('(display-mode: minimal-ui)').matches)) || window.navigator.standalone === true;
    } catch (e) { return false; }
  }
  var UA = navigator.userAgent || '';
  var IS_IOS = /iphone|ipad|ipod/i.test(UA) || (/Macintosh/i.test(UA) && navigator.maxTouchPoints > 1);
  var IS_SAFARI = /safari/i.test(UA) && !/chrome|crios|fxios|edg|opr|android/i.test(UA);
  var IS_MAC_SAFARI = !IS_IOS && /Macintosh/i.test(UA) && IS_SAFARI;
  var IS_FIREFOX_DESKTOP = /firefox/i.test(UA) && !/android/i.test(UA);

  function snoozed() {
    var t = parseInt(ls(SNOOZE_KEY) || '0', 10);
    return t && (Date.now() - t) < SNOOZE_MS;
  }
  function snooze() { ls(SNOOZE_KEY, String(Date.now())); }

  function canInstallManually() { return IS_IOS || IS_MAC_SAFARI; }   // no prompt API, show steps
  function isInstallable() { return !!deferred || canInstallManually(); }

  function addHead(tag, attrs) {
    var el = document.createElement(tag);
    Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    document.head.appendChild(el);
    return el;
  }

  /* ---------- customer app: installed copy opens in the white/light theme once ---------- */
  if (!IS_ADMIN_PAGE && isStandalone() && !ls('smd_pwa_light_applied')) {
    ls('smd_pwa_light_applied', '1');
    ls('smd_theme', 'light');
    document.documentElement.setAttribute('data-theme', 'light');
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', '#ffffff');
  }

  /* ---------- capture the browser's install event as early as possible ---------- */
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    document.dispatchEvent(new CustomEvent('smd:installable'));
  });
  window.addEventListener('appinstalled', function () {
    deferred = null;
    removeCard();
    var b = document.getElementById('admin-install-app'); if (b) b.remove();
    try { Notify.toast('App installed successfully', 'success'); } catch (e) {}
  });

  /* ---------- UI: install card ---------- */
  function removeCard() { var c = document.getElementById('smd-install-card'); if (c) c.remove(); }

  function css() {
    if (document.getElementById('smd-install-css')) return;
    var s = document.createElement('style'); s.id = 'smd-install-css';
    s.textContent =
      '#smd-install-card{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:2147483000;max-width:440px;margin:0 auto;' +
      'background:#fff !important;color:#0b1220 !important;border:1px solid #e3e8f0;border-radius:18px;box-shadow:0 18px 50px rgba(0,0,0,.28);padding:16px;display:flex;gap:14px;align-items:flex-start;' +
      'font-family:Inter,"Plus Jakarta Sans",system-ui,sans-serif;animation:smdIn .35s ease}' +
      '#smd-install-card.admin{background:#0c111c !important;color:#fff !important;border-color:#2a3550}' +
      '#smd-install-card img{width:52px;height:52px;border-radius:12px;flex:none}' +
      '#smd-install-card h4{margin:0 0 3px;font-size:15px;font-weight:700;color:#0b1220 !important}' +
      '#smd-install-card p,#smd-install-card li,#smd-install-card b{color:#0b1220 !important;opacity:1}' +
      '#smd-install-card.admin h4,#smd-install-card.admin p,#smd-install-card.admin li,#smd-install-card.admin b{color:#fff !important}' +
      '#smd-install-card p{margin:0 0 10px;font-size:12.5px;line-height:1.45;opacity:.8}' +
      '#smd-install-card ol{margin:0 0 10px 18px;padding:0;font-size:12.5px;line-height:1.55}' +
      '#smd-install-card .row{display:flex;gap:8px;flex-wrap:wrap}' +
      '#smd-install-card button{border:0;border-radius:10px;padding:9px 16px;font-size:13px;font-weight:700;cursor:pointer;touch-action:manipulation}' +
      '#smd-install-card .go{background:#1d6bff !important;color:#fff !important;border:0 !important;opacity:1 !important}' +
      '#smd-install-card.admin .go{background:#f59e0b !important;color:#0c111c !important}' +
      '#smd-install-card .no{background:transparent !important;color:#0b1220 !important;opacity:.75}' +
      '#smd-install-card.admin .no{color:#fff !important}' +
      '#smd-install-card .x{position:absolute;top:6px;right:8px;background:none !important;color:#0b1220 !important;opacity:.55;font-size:16px;padding:4px 8px}' +
      '@keyframes smdIn{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}' +
      '#admin-install-app{color:#f59e0b !important}' +
      '#smd-header-install{display:inline-flex;align-items:center;justify-content:center;flex:none;width:42px;height:42px;padding:0;border-radius:10px;border:1px solid var(--border-soft,#cbd5e1);' +
      'background:#0b1220;cursor:pointer;touch-action:manipulation;overflow:hidden}' +
      '#smd-header-install img{width:100%;height:100%;object-fit:cover;display:block;border-radius:9px}' +
      '#smd-header-install:hover{border-color:#1d6bff;box-shadow:0 0 0 2px rgba(29,107,255,.35)}';
    document.head.appendChild(s);
  }

  function steps() {
    if (IS_IOS) {
      return '<ol><li>Tap the <b>Share</b> button <span style="font-size:15px">&#x2B06;&#xFE0E;</span> (bottom bar, or top-right on iPad)</li>' +
             '<li>Scroll and tap <b>Add to Home Screen</b></li><li>Tap <b>Add</b></li></ol>' +
             (IS_SAFARI ? '' : '<p>Tip: if you do not see it, open this page in <b>Safari</b>.</p>');
    }
    if (IS_MAC_SAFARI) {
      return '<ol><li>In Safari, click <b>File</b> (or the Share button)</li><li>Choose <b>Add to Dock&hellip;</b></li><li>Click <b>Add</b></li></ol>';
    }
    return '';
  }

  function showCard(opts) {
    css(); removeCard();
    var admin = !!opts.admin;
    var icon = ROOT + 'assets/icons/' + (admin ? 'admin-icon-192.png' : 'icon-192.png');
    var fromGoogle = /(^|\.)google\.[a-z.]+/i.test((function(){ try { return new URL(document.referrer).hostname; } catch (e) { return ''; } })());
    var title = admin ? 'Install SM Admin &amp; Staff app'
              : (opts.welcome ? 'Welcome to SM Mobile Deals! &#128075;' : 'Install SM Mobile Deals app');
    var text = admin ? 'Open the dashboard like a real app on this phone or computer - one tap, no browser bar.'
             : (opts.welcome
                 ? (fromGoogle ? 'Thanks for finding us on Google! ' : '') + 'Get the <b>SM Mobile Deals app</b> for faster shopping, latest offers and 1-day delivery updates - free, no Play Store needed.'
                 : 'Shop faster. Get the app on your phone or computer - works like a normal app.');
    var manual = !deferred && canInstallManually();
    var unsupported = !deferred && !manual;
    var body = manual ? steps() : (unsupported
      ? '<p>This browser cannot install apps. Please open this site in <b>Chrome</b> or <b>Edge</b> to install.</p>' : '<p>' + text + '</p>');
    var c = document.createElement('div');
    c.id = 'smd-install-card'; c.className = admin ? 'admin' : '';
    c.setAttribute('role', 'dialog'); c.setAttribute('aria-label', 'Install app');
    c.innerHTML = '<button class="x" aria-label="Close">&times;</button><img alt="" src="' + icon + '">' +
      '<div><h4>' + title + '</h4>' + body + '<div class="row">' +
      (deferred ? '<button class="go">Install</button>' : '') +
      '<button class="no">' + ((manual || unsupported) ? 'Got it' : 'Not now') + '</button></div></div>';
    document.body.appendChild(c);

    c.querySelector('.x').onclick = c.querySelector('.no').onclick = function () { snooze(); removeCard(); };
    var go = c.querySelector('.go');
    if (go) go.onclick = function () {
      if (!deferred) return;
      var ev = deferred; deferred = null; removeCard();
      try {
        ev.prompt();                         // browser shows its own "Install / Allow" dialog
        ev.userChoice.then(function (r) { if (!r || r.outcome !== 'accepted') snooze(); });
      } catch (e) { snooze(); }
    };
  }

  function openInstall(admin) {
    if (isStandalone()) return;
    showCard({ admin: admin });
  }
  window.SMDInstall = { open: function () { openInstall(IS_ADMIN_PAGE); }, installable: isInstallable };

  /* any element with data-install-app opens the install card */
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-install-app]');
    if (t) { e.preventDefault(); openInstall(IS_ADMIN_PAGE); }
  });

  /* ---------- CUSTOMER (every customer page: guest or logged-in) ---------- */
  var IS_HOME = /\/(index\.html)?$/i.test(location.pathname);

  // "Install App" button right next to the top search bar (customer app only)
  function mountHeaderButton() {
    var tries = 0;
    var t = setInterval(function () {
      if (++tries > 60) return clearInterval(t);                       // ~30 s
      var bar = document.querySelector('.header-search');
      if (!bar || typeof Auth === 'undefined') return;                  // header / auth not ready yet
      clearInterval(t);
      if (isStandalone() || isPanelUser()) return;                      // already the app, or admin/staff -> no customer button
      if (document.getElementById('smd-header-install')) return;
      css();
      var b = document.createElement('button');
      b.id = 'smd-header-install'; b.type = 'button'; b.setAttribute('data-install-app', '');
      b.setAttribute('aria-label', 'Install SM Mobile Deals app'); b.title = 'Install SM Mobile Deals app';
      b.innerHTML = '<img alt="" src="' + ROOT + 'assets/icons/icon-192.png">';
      bar.insertAdjacentElement('afterend', b);
    }, 500);
  }

  function initCustomer() {
    if (isStandalone()) return;
    mountHeaderButton();
    if (!IS_HOME) return;                                  // welcome card: homepage only
    var shown = false, SS = 'smd_pwa_welcome_shown';
    function maybe() {
      if (shown || snoozed() || isStandalone() || isPanelUser()) return;
      if (!isInstallable()) return;
      try { if (sessionStorage.getItem(SS)) return; sessionStorage.setItem(SS, '1'); } catch (e) {}
      shown = true; showCard({ admin: false, welcome: true });   // welcome message + app suggestion
    }
    setTimeout(maybe, 2500);
    document.addEventListener('smd:installable', function () { setTimeout(maybe, 800); });
  }

  /* ---------- ADMIN / STAFF (dashboard only, after login) ---------- */
  function isPanelUser() {
    try {
      var u = (typeof Auth !== 'undefined' && Auth.currentUser) ? Auth.currentUser() : null;
      return !!u && (u.role === 'admin' || u.role === 'staff' || u.id === 'admin' || u.id === 'staff');
    } catch (e) { return false; }
  }

  function initAdmin() {
    var tries = 0, done = false;
    var timer = setInterval(function () {
      if (done) return clearInterval(timer);
      if (++tries > 40) return clearInterval(timer);       // give up after ~20 s
      if (!isPanelUser()) return;
      done = true; clearInterval(timer);
      activateAdminApp();
    }, 500);
  }

  function activateAdminApp() {
    // 1) switch this page to the ADMIN app identity (separate from the customer app)
    if (!document.querySelector('link[rel="manifest"]')) {
      addHead('link', { rel: 'manifest', href: ROOT + 'manifest-admin.json' });
    }
    addHead('link', { rel: 'apple-touch-icon', href: ROOT + 'assets/icons/admin-apple-touch-icon.png' });
    var tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.setAttribute('content', '#0c111c');
    addHead('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
    addHead('meta', { name: 'mobile-web-app-capable', content: 'yes' });
    addHead('meta', { name: 'apple-mobile-web-app-title', content: 'SM Admin' });
    addHead('meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' });

    if (isStandalone()) return;                            // already running as the installed app

    // 2) "Install App" button in the dashboard sidebar
    function addButton() {
      var nav = document.querySelector('.admin-nav');
      if (!nav || document.getElementById('admin-install-app')) return !!nav;
      var b = document.createElement('button');
      b.id = 'admin-install-app'; b.type = 'button'; b.setAttribute('data-install-app', '');
      b.innerHTML = '<i class="fa-solid fa-download"></i> Install App';
      var hr = nav.querySelector('hr');
      hr ? nav.insertBefore(b, hr) : nav.appendChild(b);
      return true;
    }
    var n = 0, t = setInterval(function () { if (addButton() || ++n > 20) clearInterval(t); }, 500);

    // 3) one-time friendly card when the browser says it is installable
    var shown = false;
    function maybe() {
      if (shown || snoozed() || isStandalone() || !isInstallable()) return;
      shown = true; showCard({ admin: true });
    }
    setTimeout(maybe, 3500);
    document.addEventListener('smd:installable', function () { setTimeout(maybe, 1200); });
  }

  /* ---------- start ---------- */
  function start() { IS_ADMIN_PAGE ? initAdmin() : initCustomer(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
