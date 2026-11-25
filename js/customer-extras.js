/* ==========================================================================
   CUSTOMER EXTRAS (loaded on every customer page from js/app.js)

   1. DESKTOP VIEW option (useful inside the customer APK / phone browser)
      - Toggle in the footer + in the mobile menu (drawer).
      - Choice is remembered (localStorage "smd_desktop_view") on every page.
   2. LOGGED-IN customers
      - Login / Register links + buttons are hidden everywhere.
      - A "Logout" option is shown instead (footer Account list, mobile menu,
        home page hero buttons). The header logout icon already exists.
      - Opening login.html / register.html while logged in goes straight to the
        profile page (admin / staff -> admin page) instead of showing the form.
   ========================================================================== */
(function () {
  'use strict';
  if (window.__smdCustomerExtras) return;
  window.__smdCustomerExtras = true;

  var KEY = 'smd_desktop_view';
  var DESKTOP_WIDTH = 1280;

  function root() { return (typeof ROOT_PREFIX !== 'undefined' ? ROOT_PREFIX : ''); }
  function path() { return String(location.pathname || '').toLowerCase(); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }

  /* ------------------------------------------------------------------
     1. DESKTOP VIEW
     ------------------------------------------------------------------ */
  function isDesktop() { return lsGet(KEY) === '1'; }

  function applyViewport() {
    var meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      (document.head || document.documentElement).appendChild(meta);
    }
    meta.setAttribute('content', isDesktop()
      ? 'width=' + DESKTOP_WIDTH + ', minimum-scale=0.1, maximum-scale=5, user-scalable=yes'
      : 'width=device-width, initial-scale=1.0');
    try { document.documentElement.classList.toggle('smd-desktop-view', isDesktop()); } catch (e) {}
  }

  function toggleDesktop() {
    lsSet(KEY, isDesktop() ? null : '1');
    applyViewport();
    refreshToggleLabels();
    // Some WebViews only re-read the viewport on reload
    setTimeout(function () { location.reload(); }, 120);
  }

  function toggleLabel() { return isDesktop() ? '\uD83D\uDCF1 Mobile view' : '\uD83D\uDDA5\uFE0F Desktop view'; }

  function refreshToggleLabels() {
    var list = document.querySelectorAll('.smd-desk-toggle');
    for (var i = 0; i < list.length; i++) list[i].textContent = toggleLabel();
  }

  function makeToggle(tag, cls) {
    var el = document.createElement(tag);
    el.className = 'smd-desk-toggle ' + (cls || '');
    el.textContent = toggleLabel();
    if (tag === 'a') el.href = '#desktop-view'; else el.type = 'button';
    el.addEventListener('click', function (e) { e.preventDefault(); toggleDesktop(); });
    return el;
  }

  function placeToggles() {
    // footer
    var fb = document.querySelector('footer .footer-bottom');
    if (fb && !fb.querySelector('.smd-desk-toggle')) fb.appendChild(makeToggle('button', 'smd-desk-pill'));
    // mobile menu
    var panel = document.querySelector('#mobile-drawer .panel');
    if (panel && !panel.querySelector('.smd-desk-toggle')) {
      var a = makeToggle('a', '');
      var social = panel.querySelector('.social-row');
      panel.insertBefore(a, social || null);
    }
  }

  /* ------------------------------------------------------------------
     2. LOGIN STATE -> hide Login/Register, show Logout
     ------------------------------------------------------------------ */
  function loggedIn() {
    try { return typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn(); } catch (e) { return false; }
  }

  function doLogout(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    var go = function () { location.href = root() + 'index.html'; };
    try { Auth.logout().then(go, go); } catch (err) { go(); }
  }

  function makeLogout(tag, cls, html) {
    var el = document.createElement(tag);
    el.className = 'smd-logout-link ' + (cls || '');
    el.setAttribute('data-logout', '1');
    el.innerHTML = html;
    if (tag === 'a') el.href = '#logout'; else el.type = 'button';
    el.addEventListener('click', doLogout);
    return el;
  }

  var AUTH_LINK = 'a[href$="login.html"],a[href$="register.html"]';

  function syncAuthUI() {
    var on = loggedIn();
    var i, list;

    // Login / Register links (header, footer, hero, anywhere) -> hidden when logged in
    list = document.querySelectorAll(AUTH_LINK);
    for (i = 0; i < list.length; i++) {
      var a = list[i];
      // never touch links inside the login/register/forgot forms themselves
      if (a.closest && a.closest('form, .auth-split')) continue;
      var host = (a.parentElement && a.parentElement.tagName === 'LI') ? a.parentElement : a;
      if (on) {
        if (a.getAttribute('aria-label') === 'Notifications') continue; // bell icon keeps working
        host.style.setProperty('display', 'none', 'important');
        host.setAttribute('data-smd-hidden', '1');
      } else if (host.getAttribute('data-smd-hidden') === '1') {
        host.style.removeProperty('display');
        host.removeAttribute('data-smd-hidden');
      }
    }

    // remove injected logout controls when logged out
    var outs = document.querySelectorAll('.smd-logout-link');
    if (!on) { for (i = 0; i < outs.length; i++) outs[i].remove(); return; }

    // footer -> Account list
    var fl = document.getElementById('foot-acc-list');
    if (fl && !fl.querySelector('.smd-logout-link')) {
      var li = document.createElement('li');
      li.appendChild(makeLogout('a', '', 'Logout'));
      fl.appendChild(li);
    }

    // mobile menu
    var panel = document.querySelector('#mobile-drawer .panel');
    if (panel && !panel.querySelector('.smd-logout-link')) {
      var social = panel.querySelector('.social-row');
      panel.insertBefore(makeLogout('a', '', '<i class="fa-solid fa-right-from-bracket"></i> Logout'), social || null);
    }

    // home page hero buttons (replace Login + Register)
    var cta = document.querySelector('.hero-cta');
    if (cta && !cta.querySelector('.smd-logout-link') && cta.querySelector('.hero-auth-btn')) {
      cta.appendChild(makeLogout('button', 'btn btn-outline btn-lg', '<i class="fa-solid fa-right-from-bracket"></i> Logout'));
    }
  }

  /* Logged-in user opens login.html / register.html -> send to profile / admin */
  function guardAuthPages() {
    if (!/\/(login|register)\.html$/.test(path())) return;
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      if (loggedIn()) {
        clearInterval(timer);
        var u = null;
        try { u = Auth.currentUser(); } catch (e) {}
        var panel = u && (u.role === 'admin' || u.role === 'staff');
        location.replace(root() + 'pages/' + (panel ? 'admin.html' : 'profile.html'));
      } else if (tries > 30) {
        clearInterval(timer);
      }
    }, 200);
  }

  /* ------------------------------------------------------------------
     styles
     ------------------------------------------------------------------ */
  function addStyles() {
    if (document.getElementById('smd-extras-css')) return;
    var st = document.createElement('style');
    st.id = 'smd-extras-css';
    st.textContent =
      '.smd-desk-pill{background:transparent;border:1px solid rgba(255,255,255,.4);border-radius:999px;padding:6px 14px;font-size:12.5px;font-weight:600;cursor:pointer;color:#fff;font-family:inherit}' +
      '.smd-desk-pill:hover{background:rgba(255,255,255,.16)}' +
      '.mobile-drawer a.smd-desk-toggle,.mobile-drawer a.smd-logout-link{display:block}' +
      '.site-footer .smd-logout-link{cursor:pointer}';
    (document.head || document.documentElement).appendChild(st);
  }

  /* ------------------------------------------------------------------
     boot
     ------------------------------------------------------------------ */
  applyViewport(); // as early as possible

  function run() {
    addStyles();
    try { placeToggles(); } catch (e) {}
    try { syncAuthUI(); } catch (e) {}
  }

  function start() {
    run();
    guardAuthPages();
    var pending = false;
    var mo = new MutationObserver(function () {
      if (pending) return;
      pending = true;
      (window.requestAnimationFrame || setTimeout)(function () { pending = false; run(); });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    // header/footer are mounted by App.boot and the session is restored by Auth.init: keep in sync
    setInterval(run, 2500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
