/* Customer Activity — (1) logs what logged-in customers do (products viewed, searches, chatbot / contact /
   service messages, cart, wishlist, checkout, login, logout + which device) into Supabase table
   `customer_activity`; (2) adds a "Customer Activity" tab to the admin panel to read it.
   Needs supabase/customer-activity.sql to be run once. Admin / staff actions are never logged. */
(function () {
  'use strict';
  var TABLE = 'customer_activity';
  function root() { try { return (typeof ROOT_PREFIX === 'string') ? ROOT_PREFIX : ''; } catch (e) { return ''; } }
  function path() { return String(location.pathname); }
  function sb() { try { return (typeof supabaseClient !== 'undefined' && supabaseClient && DB.useSupabase()) ? supabaseClient : null; } catch (e) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {} return null; }
  function me() { try { return Auth.isLoggedIn() ? Auth.currentUser() : null; } catch (e) { return null; } }
  function isStaff(u) { return !u || u.role === 'admin' || u.role === 'staff' || u.id === 'admin' || /^(gateway|local)/i.test(String(u.id)); }

  /* ---------- device ---------- */
  function device() {
    var ua = navigator.userAgent || '', plat = 'Other', model = '', br = 'Browser';
    if (/Android/i.test(ua)) { plat = 'Android'; var m = ua.match(/Android [\d.]+; ([^;)]+)/); if (m) model = m[1].replace(/ Build.*/, '').trim(); }
    else if (/iPhone|iPod/i.test(ua)) { plat = 'iPhone'; model = 'iPhone'; }
    else if (/iPad/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) { plat = 'iPad'; model = 'iPad'; }
    else if (/Windows/i.test(ua)) plat = 'Windows';
    else if (/Mac OS/i.test(ua)) plat = 'Mac';
    else if (/Linux|CrOS/i.test(ua)) plat = 'Linux';
    var wv = /; wv\)/.test(ua) || /Version\/[\d.]+ Chrome/.test(ua) && /Android/.test(ua);
    if (/EdgA?\//.test(ua)) br = 'Edge'; else if (/SamsungBrowser/.test(ua)) br = 'Samsung Browser'; else if (/OPR\//.test(ua)) br = 'Opera';
    else if (/Firefox|FxiOS/.test(ua)) br = 'Firefox'; else if (/CriOS|Chrome/.test(ua)) br = 'Chrome'; else if (/Safari/.test(ua)) br = 'Safari';
    var app = false;
    try { app = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true || /[?&]source=(pwa|apk|twa)/.test(location.search) || (document.referrer || '').indexOf('android-app://') === 0 || wv; } catch (e) {}
    return { platform: plat, browser: br, app: !!app, label: (model || plat) + ' · ' + br + (app ? ' (App)' : '') + ' · ' + screen.width + 'x' + screen.height };
  }

  /* ---------- logging ---------- */
  var warned = false;
  function log(kind, o) {
    try {
      var u = me(), c = sb(); if (!c || isStaff(u)) return Promise.resolve();
      o = o || {}; var d = device();
      var row = { user_id: u.id, user_name: u.name || '', user_email: u.email || '', user_phone: u.phone || '', kind: kind,
        product_id: o.product_id || null, product_name: o.product_name || null, product_brand: o.product_brand || null,
        product_price: o.product_price != null ? Number(o.product_price) : null, category: o.category || null,
        detail: o.detail ? String(o.detail).slice(0, 600) : null, device: d.label, platform: d.platform, browser: d.browser, is_app: d.app,
        page: path().replace(/^.*\//, '') };
      return Promise.resolve(c.from(TABLE).insert(row)).then(function (r) { if (r && r.error && !warned) { warned = true; console.warn('[activity] not saved (run supabase/customer-activity.sql):', r.error.message); } }).catch(function () {});
    } catch (e) { return Promise.resolve(); }
  }
  function prodInfo(id) {
    try { var p = DB.getProduct(id); if (p) return { product_id: p.id, product_name: p.name, product_brand: p.brand, product_price: p.price, category: p.category }; } catch (e) {}
    return { product_id: id, product_name: String(id) };
  }
  function once(key, ms) { var k = 'smd_act_' + key, t = Number(ss(k) || 0); if (t && Date.now() - t < ms) return false; ss(k, String(Date.now())); return true; }

  function customerSide() {
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}   /* ask browser not to wipe the saved login */
    /* product views */
    if (/\/product-details\.html/.test(path())) {
      var id = new URLSearchParams(location.search).get('id'), tries = 0;
      (function go() {
        var u = me(); if (isStaff(u) && tries < 6) { tries++; return setTimeout(go, 700); }
        if (isStaff(u) || !id) return;
        var p = null; try { p = DB.getProduct(id); } catch (e) {}
        if (!p && tries < 6) { tries++; return setTimeout(go, 700); }
        if (once('view_' + id, 30 * 60 * 1000)) log('view', prodInfo(id));
      })();
    }
    if (/\/checkout\.html/.test(path())) setTimeout(function () { if (once('checkout', 10 * 60 * 1000)) log('checkout', { detail: 'Reached checkout. Cart: ' + cartText() }); }, 1500);
    /* searches (header box + products page box) */
    var st = null;
    document.addEventListener('input', function (e) {
      var t = e.target; if (!t || !(t.id === 'header-search-input' || t.id === 'f-keyword')) return;
      clearTimeout(st); st = setTimeout(function () { var q = (t.value || '').trim(); if (q.length >= 2 && ss('smd_act_lastq') !== q) { ss('smd_act_lastq', q); log('search', { detail: q }); } }, 1500);
    }, true);
    /* contact form + service appointment (requirements) */
    document.addEventListener('submit', function (e) {
      var f = e.target; if (!f || !f.id) return;
      try {
        if (f.id === 'contact-form') log('message', { detail: 'Contact form: ' + (f.elements.message && f.elements.message.value) });
        if (f.id === 'svc-form') log('service', { detail: '[' + (f.elements.deviceType && f.elements.deviceType.value) + '] ' + (f.elements.issue && f.elements.issue.value) });
      } catch (x) {}
    }, true);
    setTimeout(hooks, 900); setTimeout(hooks, 2500); setTimeout(hooks, 6000);
  }
  function cartText() { try { return Cart.detailed().map(function (i) { return (i.product ? i.product.name : i.id) + ' x' + (i.qty || 1); }).join(', ').slice(0, 300); } catch (e) { return ''; } }
  function wrap(o, n, fn) {
    try { if (!o || typeof o[n] !== 'function' || o[n].__act) return; var orig = o[n]; var w = function () { try { fn.apply(null, arguments); } catch (e) {} return orig.apply(this, arguments); }; w.__act = true; o[n] = w; } catch (e) {}
  }
  function hooks() {
    try { if (typeof Chatbot !== 'undefined') wrap(Chatbot, 'handleSend', function (t) { t = String(t || '').trim(); if (t) log('chat', { detail: t }); }); } catch (e) {}
    try { if (typeof Cart !== 'undefined') wrap(Cart, 'add', function (id) { log('cart', prodInfo(id)); }); } catch (e) {}
    try { if (typeof Wishlist !== 'undefined') wrap(Wishlist, 'toggle', function (id) { var had = false; try { had = Wishlist.has(id); } catch (e) {} if (!had) log('wishlist', prodInfo(id)); }); } catch (e) {}
    try {
      if (typeof Auth !== 'undefined' && Auth.logout && !Auth.logout.__actw) {
        var orig = Auth.logout;
        var w = async function () { try { await Promise.race([log('logout', { detail: 'Customer pressed Logout' }), new Promise(function (r) { setTimeout(r, 600); })]); } catch (e) {} return orig.apply(this, arguments); };
        w.__actw = true; w.__v29 = orig.__v29; w.__orig = orig.__orig; Auth.logout = w;
      }
    } catch (e) {}
    try {
      if (typeof Inbox !== 'undefined' && Inbox.trackActivity && !Inbox.trackActivity.__actw) {   /* put the device into the existing bell alert too */
        var ot = Inbox.trackActivity, dv = device().label;
        var tw = function (title, body, link) { return ot.call(this, title, (body || '') + (/logged (in|out)/i.test(title + ' ' + body) ? ' — device: ' + dv : ''), link); };
        tw.__actw = true; Inbox.trackActivity = tw;
      }
    } catch (e) {}
  }
  var loginDone = false;
  function loginLog() {
    var u = me(); if (isStaff(u) || loginDone) return; loginDone = true;
    if (ss('smd_act_login') === String(u.id)) return; ss('smd_act_login', String(u.id));
    log('login', { detail: 'Logged in / opened the site' });
  }

  /* ---------- admin panel tab ---------- */
  var ICON = { view: ['👁️', 'Viewed product'], search: ['🔎', 'Searched'], chat: ['🤖', 'Chatbot message'], message: ['✉️', 'Contact message'], service: ['🛠️', 'Service request'], cart: ['🛒', 'Added to cart'], wishlist: ['❤️', 'Added to wishlist'], checkout: ['💳', 'Checkout'], login: ['🟢', 'Logged in'], logout: ['🔴', 'Logged out'] };
  var rows = [], lastSeen = Number((function () { try { return localStorage.getItem('smd_act_seen'); } catch (e) { return 0; } })() || 0);
  function ago(t) { var s = Math.max(1, (Date.now() - new Date(t).getTime()) / 1000); if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400) return Math.floor(s / 3600) + ' hr ago'; return new Date(t).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' ' + new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); }
  function plink(r) { return r.product_id ? '<a href="' + root() + 'pages/product-details.html?id=' + encodeURIComponent(r.product_id) + '" target="_blank" style="color:var(--accent-2,#7aa2ff);font-weight:600;">' + esc(r.product_name || r.product_id) + '</a>' : esc(r.product_name || ''); }
  function line(r) {
    var k = r.kind;
    if (k === 'view' || k === 'cart' || k === 'wishlist') return plink(r) + (r.product_price ? ' <span class="text-faint">₹' + Number(r.product_price).toLocaleString('en-IN') + '</span>' : '');
    return esc(r.detail || '');
  }
  function adminSide() {
    var nav = document.querySelector('.admin-nav'); var after = document.querySelector('.admin-nav button[data-tab="customers"]');
    var host = document.getElementById('tab-customers'); if (!nav || !after || !host || document.getElementById('tab-customer-activity')) return;
    var btn = document.createElement('button'); btn.setAttribute('data-tab', 'customer-activity');
    btn.innerHTML = '<i class="fa-solid fa-chart-line"></i> Customer Activity <span id="ca-badge" style="display:none;margin-left:6px;background:#ef4444;color:#fff;border-radius:99px;padding:1px 7px;font-size:11px;"></span>';
    after.parentNode.insertBefore(btn, after.nextSibling);
    var panel = document.createElement('div'); panel.className = 'tab-panel'; panel.id = 'tab-customer-activity';
    panel.innerHTML =
      '<h3 style="font-family:var(--font-display);margin:0 0 6px;">Customer Activity</h3>' +
      '<p class="text-dim" style="font-size:13.5px;margin:0 0 14px;">Logged-in customers: which products they viewed, what they searched, chatbot / contact / service messages, cart, wishlist, login &amp; logout with device.</p>' +
      '<div class="flex gap-12" style="flex-wrap:wrap;margin-bottom:14px;">' +
      '<select class="input" id="ca-range" style="max-width:170px;"><option value="1">Today</option><option value="7" selected>Last 7 days</option><option value="30">Last 30 days</option><option value="0">All</option></select>' +
      '<select class="input" id="ca-kind" style="max-width:190px;"><option value="">All activity</option><option value="view">Product views</option><option value="search">Searches</option><option value="chat">Chatbot messages</option><option value="message">Contact messages</option><option value="service">Service requests</option><option value="cart">Cart</option><option value="wishlist">Wishlist</option><option value="checkout">Checkout</option><option value="login">Logins</option><option value="logout">Logouts</option></select>' +
      '<input class="input" id="ca-q" placeholder="Search customer / product / text…" style="flex:1;min-width:200px;">' +
      '<button class="btn btn-outline" id="ca-refresh"><i class="fa-solid fa-rotate"></i> Refresh</button></div>' +
      '<div id="ca-tiles" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:16px;"></div>' +
      '<div class="card" style="padding:16px;margin-bottom:16px;"><h4 style="margin:0 0 10px;">🔥 Most viewed products</h4><div id="ca-top"></div></div>' +
      '<div class="card" style="padding:16px;margin-bottom:16px;overflow-x:auto;"><h4 style="margin:0 0 10px;">Customers</h4><div id="ca-cust"></div></div>' +
      '<div class="card" style="padding:16px;"><h4 style="margin:0 0 10px;">Live feed</h4><div id="ca-feed"></div></div>' +
      '<div id="ca-modal" style="display:none;position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.6);padding:16px;overflow:auto;"><div class="card" style="max-width:760px;margin:20px auto;padding:20px;position:relative;"><button type="button" id="ca-x" class="btn btn-ghost btn-sm" style="position:absolute;right:10px;top:10px;">✕</button><div id="ca-detail"></div></div></div>';
    host.parentNode.appendChild(panel);
    btn.addEventListener('click', function () {
      document.querySelectorAll('.admin-nav button[data-tab]').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active'); panel.classList.add('active'); load(true);
    });
    ['ca-range', 'ca-kind'].forEach(function (i) { document.getElementById(i).addEventListener('change', function () { load(false); }); });
    document.getElementById('ca-q').addEventListener('input', render);
    document.getElementById('ca-refresh').addEventListener('click', function () { load(false); });
    document.getElementById('ca-x').addEventListener('click', function () { document.getElementById('ca-modal').style.display = 'none'; });
    document.getElementById('ca-cust').addEventListener('click', function (e) { var b = e.target.closest('[data-uid]'); if (b) detail(b.dataset.uid); });
    badgePoll(); setInterval(badgePoll, 30000);
    setInterval(function () { if (panel.classList.contains('active') && document.visibilityState === 'visible') load(false); }, 30000);
    try { if (new URLSearchParams(location.search).get('tab') === 'customer-activity') btn.click(); } catch (e) {}
  }
  async function badgePoll() {
    var c = sb(); if (!c) return;
    try {
      var r = await c.from(TABLE).select('id', { count: 'exact', head: true }).gt('created_at', new Date(lastSeen || Date.now() - 864e5).toISOString()).neq('kind', 'logout');
      var b = document.getElementById('ca-badge'), n = r && r.count || 0;
      if (b) { b.textContent = n > 99 ? '99+' : n; b.style.display = n ? 'inline-block' : 'none'; }
    } catch (e) {}
  }
  async function load(markSeen) {
    var c = sb(), tiles = document.getElementById('ca-tiles'); if (!c || !tiles) return;
    var days = Number(document.getElementById('ca-range').value);
    var q = c.from(TABLE).select('*').order('created_at', { ascending: false }).limit(3000);
    if (days) { var d = new Date(); if (days === 1) d.setHours(0, 0, 0, 0); else d = new Date(Date.now() - days * 864e5); q = q.gte('created_at', d.toISOString()); }
    var r = await q;
    if (r.error) { tiles.innerHTML = '<p class="text-dim">Data load aagala: ' + esc(r.error.message) + '<br>supabase/customer-activity.sql-ai Supabase SQL Editor-la oru thadava run pannunga.</p>'; return; }
    rows = r.data || []; render();
    if (markSeen) { setTimeout(function () { lastSeen = Date.now(); try { localStorage.setItem('smd_act_seen', String(lastSeen)); } catch (e) {} var b = document.getElementById('ca-badge'); if (b) b.style.display = 'none'; }, 4000); }
  }
  function filtered() {
    var k = document.getElementById('ca-kind').value, s = document.getElementById('ca-q').value.trim().toLowerCase();
    return rows.filter(function (r) { return (!k || r.kind === k) && (!s || [r.user_name, r.user_email, r.user_phone, r.product_name, r.product_brand, r.detail, r.device].join(' ').toLowerCase().indexOf(s) > -1); });
  }
  function render() {
    var list = filtered(), seen = lastSeen;
    var custs = {}, prods = {};
    list.forEach(function (r) {
      var c = custs[r.user_id] || (custs[r.user_id] = { id: r.user_id, name: r.user_name, email: r.user_email, phone: r.user_phone, last: r.created_at, device: r.device, view: 0, search: 0, msg: 0, cart: 0, online: null });
      if (r.kind === 'view') c.view++; else if (r.kind === 'search') c.search++; else if (/chat|message|service/.test(r.kind)) c.msg++; else if (/cart|wishlist/.test(r.kind)) c.cart++;
      if (r.kind === 'view' && r.product_id) { var p = prods[r.product_id] || (prods[r.product_id] = { id: r.product_id, name: r.product_name, v: 0, u: {}, last: r.created_at, r: r }); p.v++; p.u[r.user_id] = 1; }
    });
    var cs = Object.keys(custs).map(function (k) { return custs[k]; }).sort(function (a, b) { return new Date(b.last) - new Date(a.last); });
    var ps = Object.keys(prods).map(function (k) { return prods[k]; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 8);
    var cnt = function (re) { return list.filter(function (r) { return re.test(r.kind); }).length; };
    var tile = function (n, l) { return '<div class="card" style="padding:12px;text-align:center;"><div style="font-size:22px;font-weight:800;">' + n + '</div><div class="text-faint" style="font-size:12px;">' + l + '</div></div>'; };
    document.getElementById('ca-tiles').innerHTML = tile(cs.length, 'Customers') + tile(cnt(/^view$/), 'Product views') + tile(cnt(/^search$/), 'Searches') + tile(cnt(/^(chat|message|service)$/), 'Messages / requirements') + tile(cnt(/^(cart|wishlist)$/), 'Cart / wishlist');
    document.getElementById('ca-top').innerHTML = ps.length ? ps.map(function (p, i) {
      return '<div style="display:flex;gap:10px;align-items:center;padding:8px 6px;border-bottom:1px solid var(--border-soft);"><b style="width:22px;">' + (i === 0 ? '🔥' : (i + 1)) + '</b><div style="flex:1;">' + plink(p.r) + '</div><span class="badge badge-accent">' + p.v + ' views</span><span class="text-faint" style="font-size:12px;">' + Object.keys(p.u).length + ' customer(s) · ' + ago(p.last) + '</span></div>';
    }).join('') : '<p class="text-faint">No product views in this range.</p>';
    document.getElementById('ca-cust').innerHTML = cs.length ? '<table style="width:100%;border-collapse:collapse;font-size:13px;"><tr class="text-faint" style="text-align:left;"><th style="padding:6px;">Customer</th><th>Last active</th><th>Device</th><th>Views</th><th>Searches</th><th>Messages</th><th>Cart</th><th></th></tr>' + cs.map(function (c) {
      return '<tr style="border-top:1px solid var(--border-soft);"><td style="padding:8px 6px;"><b>' + esc(c.name || 'Customer') + '</b><br><span class="text-faint" style="font-size:11.5px;">' + esc(c.email) + (c.phone ? ' · ' + esc(c.phone) : '') + '</span></td><td>' + ago(c.last) + '</td><td style="font-size:12px;">' + esc(c.device || '') + '</td><td>' + c.view + '</td><td>' + c.search + '</td><td>' + c.msg + '</td><td>' + c.cart + '</td><td><button class="btn btn-outline btn-sm" data-uid="' + esc(c.id) + '">Details</button></td></tr>';
    }).join('') + '</table>' : '<p class="text-faint">No customer activity yet.</p>';
    document.getElementById('ca-feed').innerHTML = list.slice(0, 60).map(function (r) {
      var ic = ICON[r.kind] || ['•', r.kind], isNew = new Date(r.created_at).getTime() > seen;
      return '<div style="display:flex;gap:10px;padding:9px 8px;border-bottom:1px solid var(--border-soft);' + (isNew ? 'background:rgba(76,141,255,.12);border-radius:8px;' : '') + '"><span style="font-size:18px;">' + ic[0] + '</span><div style="flex:1;min-width:0;"><div style="font-size:13px;"><b>' + esc(r.user_name || 'Customer') + '</b> <span class="text-faint">' + ic[1] + '</span>' + (isNew ? ' <span class="badge badge-deal" style="font-size:10px;">NEW</span>' : '') + '</div><div style="font-size:13.5px;word-break:break-word;">' + line(r) + '</div><div class="text-faint" style="font-size:11.5px;">' + esc(r.device || '') + '</div></div><span class="text-faint" style="font-size:12px;white-space:nowrap;">' + ago(r.created_at) + '</span></div>';
    }).join('') || '<p class="text-faint">Nothing to show.</p>';
  }
  function detail(uid) {
    var list = rows.filter(function (r) { return r.user_id === uid; }); if (!list.length) return;
    var f = list[0], sec = function (title, re, fn) { var x = list.filter(function (r) { return re.test(r.kind); }); return x.length ? '<h4 style="margin:16px 0 6px;">' + title + ' (' + x.length + ')</h4>' + x.slice(0, 80).map(function (r) { return '<div style="display:flex;gap:10px;padding:6px 0;border-bottom:1px solid var(--border-soft);font-size:13.5px;"><span style="flex:1;word-break:break-word;">' + fn(r) + '</span><span class="text-faint" style="font-size:12px;white-space:nowrap;">' + ago(r.created_at) + '</span></div>'; }).join('') : ''; };
    var devs = {}; list.forEach(function (r) { if (r.device) devs[r.device] = 1; });
    document.getElementById('ca-detail').innerHTML = '<h3 style="margin:0;">' + esc(f.user_name || 'Customer') + '</h3><div class="text-faint" style="font-size:13px;">' + esc(f.user_email) + (f.user_phone ? ' · ' + esc(f.user_phone) : '') + '</div><div style="font-size:12.5px;margin-top:6px;">Devices: ' + Object.keys(devs).map(esc).join(' | ') + '</div>' +
      sec('👁️ Products viewed', /^view$/, line) + sec('🔎 Searched for', /^search$/, line) + sec('🤖 Chatbot messages', /^chat$/, line) + sec('✉️ Contact messages', /^message$/, line) + sec('🛠️ Service requests', /^service$/, line) +
      sec('🛒 Cart / wishlist', /^(cart|wishlist)$/, function (r) { return (r.kind === 'cart' ? '🛒 ' : '❤️ ') + line(r); }) + sec('💳 Checkout', /^checkout$/, line) +
      sec('🔐 Logins / logouts', /^(login|logout)$/, function (r) { return (r.kind === 'login' ? '🟢 Logged in' : '🔴 Logged out') + ' — ' + esc(r.device || ''); });
    document.getElementById('ca-modal').style.display = 'block';
  }

  function boot() {
    if (/\/admin\.html/.test(path())) { setTimeout(adminSide, 900); setTimeout(adminSide, 2500); return; }
    if (/admin|sri-login|master/.test(path())) return;
    customerSide();
    setTimeout(loginLog, 1200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.CustomerActivity = { log: log, device: device };
})();
