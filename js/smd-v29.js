/* ==========================================================================
   smd-v29.js — v29 patch layer (loaded after app.js on every page)
   - instant logout + header logout button
   - customer welcome popup after login (Accept & Continue)
   - admin alerts: login / product view / checkout / chatbot messages
   - chatbot: admin online/offline heartbeat ("Admin offline, message saved")
   - admin phone SMS-OTP gate (skips itself if the sms-otp function / SMS keys
     are not set up yet)
   - speed: lazy images
   Everything is wrapped in try/catch so a failure here can never break a page.
   ========================================================================== */
(function () {
  'use strict';

  var HEARTBEAT_KEY = 'admin_heartbeat';
  var ONLINE_WINDOW_MS = 75000;      // admin counts as online if pinged within 75s
  var SS = window.sessionStorage;

  function ss(k, v) {
    try { if (v === undefined) return SS.getItem(k); if (v === null) SS.removeItem(k); else SS.setItem(k, v); } catch (e) {}
    return null;
  }
  function root() { try { return (typeof ROOT_PREFIX === 'string') ? ROOT_PREFIX : ''; } catch (e) { return ''; } }
  function user() { try { return Auth.isLoggedIn() ? Auth.currentUser() : null; } catch (e) { return null; } }
  function isAdminUser(u) { return !!u && (u.role === 'admin' || u.id === 'admin'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function path() { return String(location.pathname); }
  function goHome() { location.href = root() + 'index.html'; }

  /* ---------- styles ---------- */
  var css = document.createElement('style');
  css.textContent =
    '.smd-ov{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(5,8,16,.78);backdrop-filter:blur(6px)}' +
    '.smd-ov.solid{background:var(--bg,#090909);backdrop-filter:none}' +
    '.smd-box{width:100%;max-width:420px;background:var(--surface,#16203a);color:var(--text,#f4f6fb);border:1px solid var(--border-soft,rgba(255,255,255,.18));border-radius:18px;padding:26px 22px;box-shadow:0 24px 60px rgba(0,0,0,.5);text-align:center;font-family:inherit}' +
    '.smd-box{background:#111a2e !important;color:#f4f6fb !important;text-shadow:none !important}' +
    '.smd-box h3{margin:10px 0 8px;font-size:20px;color:#ffffff !important;text-shadow:none !important}' +
    '.smd-box p,.smd-box small,.smd-box b,.smd-box span,.smd-box label{color:#dbe3f5 !important;text-shadow:none !important}' +
    '.smd-box p{margin:0 0 14px;font-size:14px;line-height:1.55}' +
    '.smd-box img.smd-av{width:64px;height:64px;object-fit:contain;border-radius:0}' +
    '.smd-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 22px;border-radius:12px;border:0;background:var(--accent,#4c77dd);color:#fff;font-weight:700;font-size:15px;cursor:pointer}' +
    '.smd-btn.ghost{background:transparent;border:1px solid rgba(255,255,255,.35);color:#fff !important}' +
    '.smd-btn{color:#fff !important}' +
    '.smd-in{width:100%;box-sizing:border-box;min-height:46px;margin:6px 0 10px;border-radius:12px;border:1px solid var(--border-soft,rgba(255,255,255,.25));background:#1d2a4a !important;color:#fff !important;font-size:22px;letter-spacing:8px;text-align:center}' +
    '.smd-err{min-height:18px;margin-bottom:8px;font-size:13px;color:#ff7a7a}' +
    '.smd-row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}' +
    '#smd-logout-btn{cursor:pointer}' +
    '.msg.bot.smd-offline{border-left:3px solid #f5a524}';
  document.head.appendChild(css);

  function overlay(inner, solid) {
    var ov = document.createElement('div');
    ov.className = 'smd-ov' + (solid ? ' solid' : '');
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<div class="smd-box">' + inner + '</div>';
    document.body.appendChild(ov);
    return ov;
  }

  /* ---------- 1. login / logout hooks ---------- */
  function wrap(obj, name, after) {
    try {
      var o = obj[name];
      if (typeof o !== 'function' || o.__v29) return;
      var w = async function () {
        var r = await o.apply(this, arguments);
        try { if (r && r.ok !== false) after(r); } catch (e) {}
        return r;
      };
      w.__v29 = true; obj[name] = w;
    } catch (e) {}
  }

  function onLoggedIn() {
    var u = user(); if (!u) return;
    ss('smd_login_track', '1');                       // alert is sent from the next page (login page navigates away fast)
    if (isAdminUser(u)) ss('smd_admin_sms_ok', null);
    else ss('smd_welcome_pending', '1');
  }

  function purgeSbTokens() {
    try {
      Object.keys(localStorage).forEach(function (k) { if (/^sb-.+-(auth-token|code-verifier)/.test(k)) localStorage.removeItem(k); });
      Object.keys(sessionStorage).forEach(function (k) { if (/^sb-.+-(auth-token|code-verifier)/.test(k)) sessionStorage.removeItem(k); });
    } catch (e) {}
  }

  function installAuthHooks() {
    if (typeof Auth === 'undefined') return;
    ['login', 'verifyLoginOtp', 'verifySignupOtp'].forEach(function (n) { wrap(Auth, n, function () { if (Auth.isLoggedIn()) onLoggedIn(); }); });

    // Instant logout: tell the admin (max 350 ms), drop the session locally at once, sign out of Supabase in the background.
    if (!Auth.logout.__v29) {
      var origLogout = Auth.logout;
      var fast = async function () {
        try {
          if (!/forgot-password/.test(path()) && typeof Inbox !== 'undefined') {
            await Promise.race([Inbox.trackActivity('Customer logged out', 'logged out', 'pages/admin.html?tab=customers'), new Promise(function (r) { setTimeout(r, 350); })]);
          }
        } catch (e) {}
        try { localStorage.removeItem(DB.KEYS.session); DB.clearCache(DB.KEYS.session); } catch (e) {}
        ss('smd_welcome_pending', null); ss('smd_admin_sms_ok', null); ss('smd_login_track', null);
        purgeSbTokens();                                   // remove the stored Supabase session RIGHT NOW (signOut is async and gets cut off by the page redirect)
        try { if (typeof supabaseClient !== 'undefined' && supabaseClient) supabaseClient.auth.signOut({ scope: 'local' }).catch(function () {}); } catch (e) {}
        purgeSbTokens();
        return { ok: true };
      };
      fast.__v29 = true; fast.__orig = origLogout;
      Auth.logout = fast;
    }
  }

  function installLogoutButton() {
    function place() {
      var bar = document.querySelector('.header-actions');
      var btn = document.getElementById('smd-logout-btn');
      if (!bar) return;
      if (!user()) { if (btn) btn.remove(); return; }
      if (btn) return;
      btn = document.createElement('button');
      btn.id = 'smd-logout-btn'; btn.className = 'icon-btn'; btn.type = 'button';
      btn.setAttribute('aria-label', 'Logout'); btn.title = 'Logout';
      btn.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i>';
      btn.addEventListener('click', async function () {
        btn.disabled = true;
        try { await Auth.logout(); } catch (e) {}
        goHome();
      });
      var menu = bar.querySelector('.mobile-menu-btn');
      bar.insertBefore(btn, menu || null);
    }
    place();
    var mo = new MutationObserver(function () { place(); });
    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { mo.disconnect(); setInterval(place, 3000); }, 8000);

    // Any existing logout control (profile page, drawer) goes through the fast handler too
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-logout],#logout-btn,.logout-btn,a[href$="#logout"]');
      if (!t || t.id === 'smd-logout-btn') return;
      e.preventDefault(); e.stopPropagation();
      Auth.logout().then(goHome, goHome);
    }, true);
  }

  /* ---------- 2. welcome popup ---------- */
  function showWelcome() {
    var u = user();
    if (!u || isAdminUser(u) || ss('smd_welcome_pending') !== '1' || document.getElementById('smd-welcome')) return;
    var name = esc((u.name || 'Customer').split(' ')[0]);
    var ov = overlay(
      '<img class="smd-av" src="' + root() + 'assets/logos/logo-dark.webp" alt="SM Mobile Deals">' +
      '<h3>Welcome, ' + name + '! 👋</h3>' +
      '<p>Naan SM Mobile Deals assistant. Mobiles, laptops, watches, accessories — offers, EMI, delivery (Coimbatore district 1-day) ellaathukkum chat-la kelunga.</p>' +
      '<p style="font-size:12.5px;opacity:.85">Continue panna, namma <a href="' + root() + 'pages/privacy.html" style="color:var(--accent,#7aa2ff)">Privacy &amp; Terms</a> accept pannureenga nu eduthukkuvom.</p>' +
      '<div class="smd-row"><button class="smd-btn" id="smd-welcome-ok" type="button">Accept &amp; Continue</button></div>');
    ov.id = 'smd-welcome';
    document.getElementById('smd-welcome-ok').addEventListener('click', function () {
      ss('smd_welcome_pending', null); ov.remove();
      if (/\/pages\/(login|register|forgot-password)/.test(path())) goHome();
    });
  }

  /* ---------- 3. admin alerts (login / product view / checkout) ---------- */
  function track(title, body) {
    try { if (typeof Inbox !== 'undefined') Inbox.trackActivity(title, body, 'pages/admin.html?tab=customers'); } catch (e) {}
  }
  function pageAlerts() {
    var u = user(); if (!u || isAdminUser(u)) return;
    if (ss('smd_login_track') === '1') { ss('smd_login_track', null); track('Customer logged in', 'logged in'); }
    if (/\/product-details\.html/.test(path())) {
      setTimeout(function () {
        var h = document.querySelector('h1');
        var n = (h && h.textContent || '').trim() || new URLSearchParams(location.search).get('id') || 'a product';
        track('Viewed a product', n.slice(0, 80));
      }, 1800);
    }
    if (/\/checkout\.html/.test(path())) track('Reached checkout', 'is on the checkout page');
  }

  /* ---------- 4. admin heartbeat + chatbot ---------- */
  function adminHeartbeat() {
    var u = user(); if (!isAdminUser(u) || typeof Inbox === 'undefined' || !DB.useSupabase()) return;
    function beat() { if (document.visibilityState === 'visible') Inbox.setSetting(HEARTBEAT_KEY, String(Date.now())); }
    beat(); setInterval(beat, 30000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') beat(); });
    window.addEventListener('pagehide', function () { try { Inbox.setSetting(HEARTBEAT_KEY, '0'); } catch (e) {} });
  }

  var onlineCache = { t: 0, v: false };
  async function adminOnline() {
    if (Date.now() - onlineCache.t < 20000) return onlineCache.v;
    var v = false;
    try { var raw = await Inbox.getSetting(HEARTBEAT_KEY); v = !!raw && (Date.now() - Number(raw)) < ONLINE_WINDOW_MS; } catch (e) {}
    onlineCache = { t: Date.now(), v: v }; return v;
  }

  var sentNotes = 0, lastOfflineMsg = 0;
  function installChatHook() {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      try {
        if (typeof Chatbot !== 'undefined' && typeof Chatbot.handleSend === 'function' && typeof Chatbot.respond === 'function') {
          clearInterval(iv);
          if (Chatbot.handleSend.__v29) return;
          var orig = Chatbot.handleSend;
          var w = function (text) {
            var r = orig.apply(this, arguments);
            try { chatNote(String(text == null ? '' : text)); } catch (e) {}
            return r;
          };
          w.__v29 = true; Chatbot.handleSend = w;
        }
      } catch (e) {}
      if (tries > 240) clearInterval(iv);
    }, 500);
  }
  async function chatNote(text) {
    text = text.trim(); var u = user();
    if (!text || !u || isAdminUser(u) || sentNotes >= 30) return;
    sentNotes++;
    Inbox.sendToAdmin('Chatbot message', (u.name || 'A customer') + ' (' + (u.email || '') + '): ' + text.slice(0, 300), 'pages/admin.html?customer=' + u.id);
    var online = await adminOnline();
    if (!online && Date.now() - lastOfflineMsg > 300000) {
      lastOfflineMsg = Date.now();
      setTimeout(function () {
        var body = document.getElementById('chat-body'); if (!body) return;
        var d = document.createElement('div'); d.className = 'msg bot smd-offline';
        d.textContent = 'Admin offline — ungal message save aayiduchu. Admin online vandhadum paarthu reply pannuvaanga.';
        body.appendChild(d); body.scrollTop = body.scrollHeight;
      }, 1400);
    }
  }

  /* ---------- 5. admin phone SMS-OTP gate ---------- */
  async function smsCall(body) {
    // FIX: never hang on "Checking..." — every step is time-capped (slow network = skip, never block the admin)
    var s = await Promise.race([supabaseClient.auth.getSession(), new Promise(function (r) { setTimeout(r, 2500, null); })]);
    var tok = s && s.data && s.data.session && s.data.session.access_token;
    if (!tok) return { ok: false, error: 'no_session', __status: 401 };
    var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var tmo = setTimeout(function () { try { ctl && ctl.abort(); } catch (e) {} }, 4000);
    try {
      var res = await fetch(SUPABASE_URL + '/functions/v1/sms-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok, 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify(body),
        signal: ctl ? ctl.signal : undefined
      });
      var j = {}; try { j = await res.json(); } catch (e) {}
      j.__status = res.status; return j;
    } catch (e) { return { ok: false, error: 'timeout', __status: 0 }; }
    finally { clearTimeout(tmo); }
  }

  var gateBusy = false;
  async function adminGate() {
    var u = user();
    if (!isAdminUser(u) || gateBusy || !DB.useSupabase() || typeof supabaseClient === 'undefined' || !supabaseClient) return;
    if (ss('smd_admin_sms_ok') === String(u.id)) return;
    gateBusy = true;
    var solid = /\/admin\.html/.test(path());
    var ov = overlay('<h3>Admin verification</h3><p>Checking…</p>', solid);
    function pass() { ss('smd_admin_sms_ok', String(u.id)); ov.remove(); gateBusy = false; }
    async function leave() { try { await Auth.logout(); } catch (e) {} ov.remove(); gateBusy = false; goHome(); }
    try {
      var r = await smsCall({ action: 'send' });
      if (r.skipped || r.__status === 404 || r.error === 'sms_not_configured') return pass();   // not set up yet -> skip step
      if (!r.ok && r.error !== 'rate_limited') { try{ console.warn('[admin SMS step skipped]', r.error, r.__status); }catch(e){} return pass(); } // SMS service down/not set up -> never block the admin
      if (!r.ok) {
        ov.querySelector('.smd-box').innerHTML = '<h3>Verification unavailable</h3><p>' + esc(r.error === 'rate_limited' ? 'Too many codes requested. Konjam neram kazhichu try pannunga.' : 'SMS code anuppa mudiyala. Marubadi try pannunga.') + (r.error ? ' <small style="opacity:.7">(error: ' + esc(String(r.error)) + (r.__status ? ', ' + r.__status : '') + ')</small>' : '') + '</p><div class="smd-row"><button class="smd-btn" id="smd-g-retry" type="button">Retry</button><button class="smd-btn ghost" id="smd-g-out" type="button">Logout</button></div>';
        document.getElementById('smd-g-retry').onclick = function () { ov.remove(); gateBusy = false; adminGate(); };
        document.getElementById('smd-g-out').onclick = leave; return;
      }
      ov.querySelector('.smd-box').innerHTML =
        '<h3>Admin phone verification</h3><p>6-digit code anuppirukken: <b>' + esc(r.masked || 'your admin phone') + '</b></p>' +
        '<input class="smd-in" id="smd-g-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="------">' +
        '<div class="smd-err" id="smd-g-err"></div>' +
        '<div class="smd-row"><button class="smd-btn" id="smd-g-ok" type="button">Verify</button><button class="smd-btn ghost" id="smd-g-resend" type="button">Resend</button><button class="smd-btn ghost" id="smd-g-out" type="button">Logout</button></div>';
      var inp = document.getElementById('smd-g-code'), err = document.getElementById('smd-g-err');
      inp.focus();
      async function verify() {
        var code = inp.value.replace(/\D/g, ''); if (code.length !== 6) { err.textContent = '6 digit code podunga.'; return; }
        document.getElementById('smd-g-ok').disabled = true;
        var v = await smsCall({ action: 'verify', code: code });
        document.getElementById('smd-g-ok').disabled = false;
        if (v.ok) return pass();
        if (v.error === 'too_many_attempts') { err.textContent = 'Too many wrong tries. Logging out…'; setTimeout(leave, 1200); return; }
        err.textContent = v.error === 'expired' ? 'Code expire aayiduchu. Resend pannunga.' : 'Thappa code. Marubadi try pannunga.';
      }
      document.getElementById('smd-g-ok').onclick = verify;
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') verify(); });
      document.getElementById('smd-g-out').onclick = leave;
      var rs = document.getElementById('smd-g-resend'), cool = 0;
      rs.onclick = async function () {
        if (Date.now() < cool) return; cool = Date.now() + 30000; rs.disabled = true; setTimeout(function () { rs.disabled = false; }, 30000);
        var x = await smsCall({ action: 'send' }); err.textContent = x.ok ? 'Puthu code anuppitten.' : 'Resend aagala.';
      };
    } catch (e) { pass(); }   // network/function problem must never lock the owner out of his own shop
  }

  /* ---------- 6. speed: lazy images ---------- */
  function lazyImages() {
    function fix(root_) {
      (root_.querySelectorAll ? root_.querySelectorAll('img:not([loading])') : []).forEach(function (im) {
        if (im.classList.contains('logo-img') || im.closest('header, .site-header, #smd-welcome')) return;
        im.loading = 'lazy'; im.decoding = 'async';
      });
    }
    fix(document);
    new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) { if (n.tagName === 'IMG' && !n.hasAttribute('loading') && !n.classList.contains('logo-img')) { n.loading = 'lazy'; n.decoding = 'async'; } else fix(n); } }); }); })
      .observe(document.body, { childList: true, subtree: true });
  }

  /* ---------- 7. top-bar logo: swaps (fade) between the dark and light SM logo every 5 seconds ---------- */
  function headerLogoCycle() {
    var tries = 0;
    function start() {
      var img = document.querySelector('header .logo-img, .site-header .logo-img');
      if (!img || typeof SITE_CONFIG === 'undefined' || !SITE_CONFIG.logo) { if (++tries < 30) setTimeout(start, 400); return; }
      var list = [SITE_CONFIG.logo.dark, SITE_CONFIG.logo.light].filter(Boolean).map(function (u) { return u.replace(/\.png$/, '.webp'); });
      if (list.length < 2) return;
      img.style.transition = 'opacity .4s ease';
      var i = 0;
      setInterval(function () {
        i = (i + 1) % list.length;
        img.style.opacity = '0';
        setTimeout(function () { img.src = root() + list[i]; img.style.opacity = '1'; }, 400);
      }, 5000);
    }
    start();
  }

  /* ---------- boot ---------- */
  function boot() {
    try { installAuthHooks(); } catch (e) {}
    try { installLogoutButton(); } catch (e) {}
    try { installChatHook(); } catch (e) {}
    try { lazyImages(); } catch (e) {}
    try { headerLogoCycle(); } catch (e) {}
    setTimeout(function () {                      // give Auth.init() a moment to restore the session
      try { showWelcome(); } catch (e) {}
      try { pageAlerts(); } catch (e) {}
      try { adminHeartbeat(); } catch (e) {}
      try { adminGate(); } catch (e) {}
    }, 700);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
