/* ==========================================================================
   SITE OVERRIDES — applies the edits an admin made in "Live Page Editor".
   - Edits are stored per page in Supabase table store_settings:
        key   = "site_overrides_<page>"   (e.g. site_overrides_index)
        value = JSON array of edit records
   - A record: { s:"css selector", text?, src?, href?, icon?, bg?, st?:{color,backgroundColor,fontSize,fontWeight}, hide? }
   - Public read / admin write (existing RLS policy on store_settings).
   - The last published edits are cached in localStorage so the page paints
     with the edits instantly, then refreshed from the database.
   - The same apply() is used by the admin editor for its live preview.
   ========================================================================== */
(function () {
  'use strict';

  var PREFIX = 'site_overrides_';

  function pageKey(path) {
    path = (path || location.pathname || '/').toLowerCase();
    if (path === '/' || /\/index\.html?$/.test(path)) return 'index';
    var m = path.match(/\/([a-z0-9-]+)\.html?$/);
    if (m) return m[1];
    if (/\/404/.test(path)) return '404';
    return 'index';
  }

  /* ---------- apply one record to a document ---------- */
  function ownTextNode(el) {
    for (var n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3 && n.nodeValue.trim()) return n;
    }
    return null;
  }
  function applyRecord(doc, r) {
    var el;
    try { el = doc.querySelector(r.s); } catch (e) { return false; }
    if (!el) return false;

    if (typeof r.text === 'string') {
      var tn = ownTextNode(el);
      if (tn) {
        var lead = (tn.nodeValue.match(/^\s*/) || [''])[0], tail = (tn.nodeValue.match(/\s*$/) || [''])[0];
        tn.nodeValue = lead + r.text + tail;
      } else if (!el.children.length) {
        el.textContent = r.text;
      } else {
        el.insertBefore(doc.createTextNode(r.text), el.firstChild);
      }
    }
    if (typeof r.src === 'string' && r.src) {
      if (el.tagName === 'IMG') {
        el.removeAttribute('srcset'); el.removeAttribute('loading');
        el.setAttribute('src', r.src);
        var pic = el.parentElement;
        if (pic && pic.tagName === 'PICTURE') pic.querySelectorAll('source').forEach(function (s) { s.remove(); });
      } else if (el.tagName === 'VIDEO' || el.tagName === 'SOURCE' || el.tagName === 'IFRAME') {
        el.setAttribute('src', r.src);
      }
    }
    if (typeof r.href === 'string' && r.href && el.tagName === 'A') el.setAttribute('href', r.href);
    if (typeof r.icon === 'string' && r.icon) el.className = r.icon;
    if (typeof r.bg === 'string' && r.bg) {
      el.style.setProperty('background-image', "url('" + r.bg.replace(/'/g, '%27') + "')", 'important');
      el.style.setProperty('background-size', 'cover', 'important');
      el.style.setProperty('background-position', 'center', 'important');
    }
    if (r.st) {
      var map = { color: 'color', backgroundColor: 'background-color', fontSize: 'font-size', fontWeight: 'font-weight' };
      Object.keys(map).forEach(function (k) {
        if (r.st[k]) el.style.setProperty(map[k], r.st[k], 'important');
      });
    }
    if (r.hide) el.style.setProperty('display', 'none', 'important');
    else if (r.hide === false) el.style.removeProperty('display');
    return true;
  }

  function apply(doc, list) {
    if (!doc || !list || !list.length) return 0;
    var n = 0;
    list.forEach(function (r) { if (r && r.s && applyRecord(doc, r)) n++; });
    return n;
  }

  /* ---------- load from DB (REST, no SDK needed) ---------- */
  function fetchRemote(key) {
    if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_ANON_KEY === 'undefined' || !/^http/.test(SUPABASE_URL)) return Promise.resolve(null);
    return fetch(SUPABASE_URL + '/rest/v1/store_settings?key=eq.' + encodeURIComponent(PREFIX + key) + '&select=value', {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY }
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) {
        if (!rows) return null;
        if (!rows.length) return [];
        try { var v = JSON.parse(rows[0].value); return Array.isArray(v) ? v : []; } catch (e) { return []; }
      }).catch(function () { return null; });
  }
  function cacheGet(key) { try { var v = JSON.parse(localStorage.getItem('smd_ov_' + key)); return Array.isArray(v) ? v : null; } catch (e) { return null; } }
  function cacheSet(key, list) { try { localStorage.setItem('smd_ov_' + key, JSON.stringify(list)); } catch (e) {} }

  /* ---------- auto-run on customer pages ---------- */
  function isStaffPage() { return /\/(admin|admin-login|sri-login)(\.html)?$/i.test(location.pathname); }

  function run() {
    if (isStaffPage()) return;
    var key = pageKey(), current = cacheGet(key) || [], timers = [];
    function applyAll() { apply(document, current); }

    // dynamic content (product cards, header/footer mounted by JS) appears a bit later - re-apply a few times
    function schedule() {
      applyAll();
      [400, 1200, 2800, 6000].forEach(function (ms) { timers.push(setTimeout(applyAll, ms)); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule); else schedule();

    fetchRemote(key).then(function (remote) {
      if (remote === null) return;           // offline / DB error -> keep cached edits
      current = remote; cacheSet(key, remote);
      applyAll(); setTimeout(applyAll, 800); setTimeout(applyAll, 2500);
    });
  }

  window.SiteOverrides = {
    pageKey: pageKey, apply: apply, applyRecord: applyRecord,
    load: fetchRemote, cacheGet: cacheGet, cacheSet: cacheSet, PREFIX: PREFIX
  };
  run();
})();
