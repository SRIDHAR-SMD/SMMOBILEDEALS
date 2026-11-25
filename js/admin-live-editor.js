/* ==========================================================================
   ADMIN LIVE PAGE EDITOR
   Pick any page -> it opens exactly like the live site. Move the mouse over
   anything (text, image, icon, button, link) -> it is highlighted. Click it ->
   the editor panel opens. Change it -> "Change" shows it instantly in the
   preview. "Publish" makes all changes live for every customer.
   Edits are stored per page in store_settings (key site_overrides_<page>)
   and applied on the customer pages by js/site-overrides.js.
   ========================================================================== */
(function () {
  'use strict';

  var PAGES = [
    ['index', 'Home page', 'index.html'], ['products', 'Products', 'pages/products.html'], ['product-details', 'Product details', 'pages/product-details.html'],
    ['about', 'About', 'pages/about.html'], ['contact', 'Contact', 'pages/contact.html'], ['service', 'Service', 'pages/service.html'],
    ['second-hand-mobiles', 'Second-hand mobiles', 'pages/second-hand-mobiles.html'], ['second-hand-laptops', 'Second-hand laptops', 'pages/second-hand-laptops.html'],
    ['compare', 'Compare', 'pages/compare.html'], ['cart', 'Cart', 'pages/cart.html'], ['wishlist', 'Wishlist', 'pages/wishlist.html'],
    ['checkout', 'Checkout', 'pages/checkout.html'], ['lucky-spin', 'Lucky spin', 'pages/lucky-spin.html'], ['recharge', 'Recharge', 'pages/recharge.html'],
    ['login', 'Login', 'pages/login.html'], ['register', 'Register', 'pages/register.html'], ['privacy', 'Privacy & Terms', 'pages/privacy.html'],
    ['404', '404 page', '404.html']
  ];
  var ICONS = ['fa-solid fa-star', 'fa-solid fa-heart', 'fa-solid fa-bolt', 'fa-solid fa-truck-fast', 'fa-solid fa-shield-halved', 'fa-solid fa-mobile-screen',
    'fa-solid fa-laptop', 'fa-solid fa-headphones', 'fa-solid fa-gift', 'fa-solid fa-phone', 'fa-brands fa-whatsapp', 'fa-brands fa-instagram', 'fa-solid fa-location-dot', 'fa-solid fa-tag'];

  var S = { page: PAGES[0], ops: [], history: [], sel: null, selPath: '', dirty: false, frame: null, hover: null, box: null };
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function toast(m, t) { try { Notify.toast(m, t || 'info'); } catch (e) {} }

  /* ---------------- UI ---------------- */
  function css() {
    if ($('le-css')) return;
    var s = document.createElement('style'); s.id = 'le-css';
    s.textContent =
      '.le-wrap{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:14px;align-items:start}' +
      '@media(max-width:1100px){.le-wrap{grid-template-columns:1fr}}' +
      '.le-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}' +
      '.le-bar select{min-width:190px}' +
      '.le-stagewrap{background:#e2e8f0;border:1px solid rgba(15,23,42,.2);border-radius:14px;padding:10px;overflow:auto;height:72vh;text-align:center}' +
      '#le-frame{border:0;background:#fff;border-radius:8px;height:100%;width:100%;box-shadow:0 6px 24px rgba(0,0,0,.18)}' +
      '.le-panel{background:#fff;border:1px solid rgba(15,23,42,.2);border-radius:14px;padding:14px;position:sticky;top:12px;max-height:78vh;overflow:auto;color:#0b1220}' +
      '.le-panel h4{margin:0 0 8px;font-size:15px}.le-panel label{display:block;font-size:12px;font-weight:700;margin:10px 0 4px;color:#334155}' +
      '.le-panel input[type=text],.le-panel textarea,.le-panel select{width:100%;padding:9px 10px;border-radius:9px;border:1px solid rgba(15,23,42,.3);background:#fff;color:#0b1220;font:inherit;font-size:13px}' +
      '.le-panel textarea{min-height:70px;resize:vertical}' +
      '.le-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}' +
      '.le-chip{padding:5px 9px;border:1px solid rgba(15,23,42,.25);border-radius:8px;background:#f8fafc;cursor:pointer;font-size:14px}' +
      '.le-muted{font-size:12px;color:#475569;line-height:1.5}' +
      '.le-tag{display:inline-block;background:#dbeafe;color:#1e40af;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700}' +
      '.le-list{margin:8px 0 0;padding:0;list-style:none;font-size:12px}' +
      '.le-list li{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid rgba(15,23,42,.1)}' +
      '.le-list button{border:0;background:none;color:#b91c1c;cursor:pointer;font-weight:700}';
    document.head.appendChild(s);
  }

  function buildTab() {
    if ($('le-frame')) return;
    // sidebar button (before the divider above Logout)
    var nav = document.querySelector('.admin-nav');
    if (nav && !nav.querySelector('[data-tab="live-editor"]')) {
      var b = document.createElement('button');
      b.setAttribute('data-tab', 'live-editor');
      b.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Live Page Editor';
      var anchor = nav.querySelector('[data-tab="site-content"]');
      anchor ? anchor.insertAdjacentElement('afterend', b) : nav.insertBefore(b, nav.querySelector('hr'));
    }
    // panel (placed beside the other tab panels)
    var any = document.querySelector('.tab-panel'); if (!any) return;
    var p = $('tab-live-editor');
    if (!p) { p = document.createElement('div'); p.className = 'tab-panel'; p.id = 'tab-live-editor'; any.parentElement.appendChild(p); }
    p.innerHTML =
      '<h3 style="font-family:var(--font-display);margin:0 0 4px;">Live Page Editor</h3>' +
      '<p class="le-muted" style="margin:0 0 12px">Pick a page. Move the mouse over anything &mdash; it gets a blue box. <b>Click</b> it to change text, image, icon, link, colour or hide it. Press <b>Change</b> to see it, then <b>Publish</b> to make it live for all customers.</p>' +
      '<div class="le-bar">' +
        '<select id="le-page" class="input"></select>' +
        '<select id="le-device" class="input" style="min-width:140px"><option value="100%">Computer</option><option value="820px">Tablet</option><option value="390px">Mobile</option></select>' +
        '<button type="button" class="btn btn-outline btn-sm" id="le-reload"><i class="fa-solid fa-rotate"></i> Reload</button>' +
        '<button type="button" class="btn btn-outline btn-sm" id="le-undo"><i class="fa-solid fa-rotate-left"></i> Undo</button>' +
        '<button type="button" class="btn btn-outline btn-sm" id="le-reset"><i class="fa-solid fa-eraser"></i> Reset page</button>' +
        '<button type="button" class="btn btn-primary btn-sm" id="le-publish"><i class="fa-solid fa-cloud-arrow-up"></i> Publish (go live)</button>' +
        '<span id="le-state" class="le-tag" style="display:none">Unpublished changes</span>' +
      '</div>' +
      '<div class="le-wrap"><div class="le-stagewrap"><iframe id="le-frame" name="smd-live-edit" title="Live page"></iframe></div>' +
      '<div class="le-panel" id="le-panel"></div></div>';
  }

  function panelEmpty() {
    $('le-panel').innerHTML = '<h4>Nothing selected</h4><p class="le-muted">Move the mouse over the page and click any text, image, icon or button.</p>' +
      '<h4 style="margin-top:16px">Changes on this page (<span id="le-count">' + S.ops.length + '</span>)</h4>' + changesList();
    bindChanges();
  }
  function changesList() {
    if (!S.ops.length) return '<p class="le-muted">No changes yet.</p>';
    return '<ul class="le-list">' + S.ops.map(function (o, i) {
      var what = [o.text != null && 'text', o.src && 'image', o.href && 'link', o.icon && 'icon', o.bg && 'background', o.st && 'style', o.hide && 'hidden'].filter(Boolean).join(', ');
      return '<li><span>' + esc(label(o.s)) + ' <span class="le-tag">' + esc(what) + '</span></span><button data-rm="' + i + '" type="button">Remove</button></li>';
    }).join('') + '</ul>';
  }
  function bindChanges() {
    document.querySelectorAll('#le-panel [data-rm]').forEach(function (b) {
      b.onclick = function () { removeOp(parseInt(b.getAttribute('data-rm'), 10)); };
    });
  }
  function label(sel) { var p = String(sel).split('>'); return p[p.length - 1].replace(/:nth-child\((\d+)\)/, ' #$1').slice(0, 40); }

  /* ---------------- iframe handling ---------------- */
  function doc() { try { return S.frame.contentDocument; } catch (e) { return null; } }

  function cssPath(el) {
    var d = el.ownerDocument, parts = [];
    while (el && el.nodeType === 1 && el !== d.documentElement) {
      if (el.id && /^[A-Za-z][\w-]*$/.test(el.id) && d.querySelectorAll('#' + el.id).length === 1) { parts.unshift('#' + el.id); break; }
      var i = 1, sib = el; while ((sib = sib.previousElementSibling)) i++;
      parts.unshift(el.tagName.toLowerCase() + ':nth-child(' + i + ')');
      el = el.parentElement;
    }
    return parts.join('>');
  }

  function drawBox(el) {
    var d = doc(); if (!d) return;
    if (!S.box || !S.box.isConnected) {
      S.box = d.createElement('div'); S.box.id = 'smd-le-box';
      S.box.style.cssText = 'position:absolute;pointer-events:none;z-index:2147483646;border:2px solid #2563eb;background:rgba(37,99,235,.12);border-radius:4px;transition:all .06s;display:none';
      d.body.appendChild(S.box);
    }
    if (!el) { S.box.style.display = 'none'; return; }
    var r = el.getBoundingClientRect(), w = d.defaultView;
    S.box.style.display = 'block';
    S.box.style.left = (r.left + w.scrollX) + 'px'; S.box.style.top = (r.top + w.scrollY) + 'px';
    S.box.style.width = r.width + 'px'; S.box.style.height = r.height + 'px';
  }

  function onFrameLoad() {
    var d = doc(); if (!d) { toast('Could not open this page for editing.', 'error'); return; }
    S.box = null; S.sel = null;
    // re-apply published + draft edits (page JS may render later)
    var reapply = function () { if (window.SiteOverrides) SiteOverrides.apply(d, S.ops); };
    reapply(); [500, 1500, 3500].forEach(function (ms) { setTimeout(reapply, ms); });

    var st = d.createElement('style'); st.textContent = '*{cursor:default !important}a,button{cursor:pointer !important}#smd-install-card,#smd-welcome,#page-loader{display:none !important}';
    d.head.appendChild(st);

    d.addEventListener('mouseover', function (e) { var t = e.target; if (t.id === 'smd-le-box') return; S.hover = t; drawBox(t); }, true);
    d.addEventListener('mouseleave', function () { drawBox(S.sel || null); }, true);
    d.addEventListener('scroll', function () { drawBox(S.sel); }, true);
    ['click', 'mousedown', 'mouseup', 'submit', 'touchend'].forEach(function (ev) {
      d.addEventListener(ev, function (e) {
        e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        if (ev === 'click') select(e.target);
      }, true);
    });
    panelEmpty();
  }

  function loadPage(path) {
    S.sel = null; panelEmpty();
    S.frame.src = '../' + path + (path.indexOf('?') > -1 ? '&' : '?') + 'smd_edit=1&t=' + Date.now();
  }

  /* ---------------- selection + inspector ---------------- */
  function rec(sel) {
    for (var i = 0; i < S.ops.length; i++) if (S.ops[i].s === sel) return S.ops[i];
    return null;
  }

  function select(el) {
    if (!el || el.id === 'smd-le-box' || el.tagName === 'HTML' || el.tagName === 'BODY') return;
    S.sel = el; S.selPath = cssPath(el); drawBox(el);
    var w = doc().defaultView, cs = w.getComputedStyle(el), tag = el.tagName.toLowerCase();
    var isImg = tag === 'img', isLink = tag === 'a' || !!el.closest('a'), linkEl = tag === 'a' ? el : el.closest('a');
    var isIcon = tag === 'i' && /fa-|bi-|icon/.test(el.className);
    var textNode = null; for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.nodeValue.trim()) { textNode = n; break; }
    var curText = textNode ? textNode.nodeValue.trim() : (!el.children.length ? (el.textContent || '').trim() : '');
    var hasBg = cs.backgroundImage && cs.backgroundImage !== 'none';
    var hex = function (c) { var m = String(c).match(/\d+(\.\d+)?/g); if (!m || m.length < 3) return '#000000'; return '#' + [0, 1, 2].map(function (i) { return ('0' + Math.round(+m[i]).toString(16)).slice(-2); }).join(''); };

    var h = '<h4>Edit &lt;' + esc(tag) + '&gt; <span class="le-tag">' + esc(label(S.selPath)) + '</span></h4>';
    if (textNode || !el.children.length) h += '<label>Text</label><textarea id="le-text">' + esc(curText) + '</textarea>';
    if (isImg) h += '<label>Image</label><div class="le-row"><input type="text" id="le-src" placeholder="Image URL" value="' + esc(el.getAttribute('src') || '') + '"></div><div class="le-row" style="margin-top:6px"><input type="file" id="le-file" accept="image/*"></div>';
    if (hasBg && !isImg) h += '<label>Background image</label><input type="text" id="le-bg" placeholder="Image URL (or upload below)"><div class="le-row" style="margin-top:6px"><input type="file" id="le-bgfile" accept="image/*"></div>';
    if (isLink && linkEl) h += '<label>Link (where it goes)</label><input type="text" id="le-href" value="' + esc(linkEl.getAttribute('href') || '') + '">';
    if (isIcon) h += '<label>Icon (Font Awesome class)</label><input type="text" id="le-icon" value="' + esc(el.className) + '"><div class="le-row" style="margin-top:6px">' +
      ICONS.map(function (c) { return '<span class="le-chip" data-ic="' + c + '"><i class="' + c + '"></i></span>'; }).join('') + '</div>';
    h += '<label>Text colour</label><div class="le-row"><input type="color" id="le-color" value="' + hex(cs.color) + '"><label style="margin:0"><input type="checkbox" id="le-color-on"> use</label></div>';
    h += '<label>Background colour</label><div class="le-row"><input type="color" id="le-bgc" value="' + hex(cs.backgroundColor) + '"><label style="margin:0"><input type="checkbox" id="le-bgc-on"> use</label></div>';
    h += '<label>Font size (px)</label><input type="text" id="le-fs" placeholder="' + Math.round(parseFloat(cs.fontSize)) + '"><label style="margin-top:8px"><input type="checkbox" id="le-bold"> Bold</label>';
    h += '<label><input type="checkbox" id="le-hide"> Hide this on the live site</label>';
    h += '<div class="le-row" style="margin-top:14px"><button type="button" class="btn btn-primary btn-sm" id="le-apply"><i class="fa-solid fa-check"></i> Change</button><button type="button" class="btn btn-outline btn-sm" id="le-clear">Deselect</button></div>';
    h += '<p class="le-muted" style="margin-top:8px">After <b>Change</b>, press <b>Publish</b> (top) to make it live.</p>';
    h += '<h4 style="margin-top:14px">Changes on this page (<span id="le-count">' + S.ops.length + '</span>)</h4>' + changesList();
    $('le-panel').innerHTML = h; bindChanges();

    // pre-fill from an existing record
    var r = rec(S.selPath);
    if (r) {
      if (r.st) { if (r.st.color) { $('le-color').value = r.st.color; $('le-color-on').checked = true; } if (r.st.backgroundColor) { $('le-bgc').value = r.st.backgroundColor; $('le-bgc-on').checked = true; } if (r.st.fontSize) $('le-fs').value = parseInt(r.st.fontSize, 10); if (r.st.fontWeight) $('le-bold').checked = true; }
      if (r.hide) $('le-hide').checked = true;
      if (r.bg && $('le-bg')) $('le-bg').value = r.bg;
    }
    document.querySelectorAll('#le-panel [data-ic]').forEach(function (c) { c.onclick = function () { $('le-icon').value = c.getAttribute('data-ic'); }; });
    $('le-clear').onclick = function () { S.sel = null; drawBox(null); panelEmpty(); };
    $('le-apply').onclick = function () { applyChange(textNode, linkEl, isImg, isIcon, hasBg && !isImg); };
  }

  /* ---------------- upload helper ---------------- */
  async function upload(file) {
    try { return await DB.uploadAsset('site-edits', file); }
    catch (e) { toast('Image upload failed: ' + (e && e.message || 'unknown'), 'error'); return null; }
  }

  async function applyChange(textNode, linkEl, isImg, isIcon, canBg) {
    var el = S.sel; if (!el) return;
    var before = JSON.stringify(S.ops), o = rec(S.selPath), isNew = !o;
    if (!o) o = { s: S.selPath };
    var v;
    if ((v = $('le-text')) && textNode !== undefined) {
      var orig = textNode ? textNode.nodeValue.trim() : (!el.children.length ? (el.textContent || '').trim() : '');
      if (v.value !== orig || o.text != null) o.text = v.value;
    }
    if (isImg) {
      var f = $('le-file') && $('le-file').files && $('le-file').files[0];
      if (f) { var u = await upload(f); if (u) o.src = u; }
      else if ($('le-src') && $('le-src').value.trim() && $('le-src').value.trim() !== (el.getAttribute('src') || '')) o.src = $('le-src').value.trim();
    }
    if (canBg) {
      var bf = $('le-bgfile') && $('le-bgfile').files && $('le-bgfile').files[0];
      if (bf) { var bu = await upload(bf); if (bu) o.bg = bu; }
      else if ($('le-bg') && $('le-bg').value.trim()) o.bg = $('le-bg').value.trim();
    }
    if (linkEl && $('le-href') && $('le-href').value.trim() !== (linkEl.getAttribute('href') || '')) {
      if (linkEl === el) o.href = $('le-href').value.trim();
      else { var lp = cssPath(linkEl), lr = rec(lp) || { s: lp }; lr.href = $('le-href').value.trim(); if (!rec(lp)) S.ops.push(lr); }
    }
    if (isIcon && $('le-icon') && $('le-icon').value.trim() && $('le-icon').value.trim() !== el.className) o.icon = $('le-icon').value.trim();
    var st = {};
    if ($('le-color-on').checked) st.color = $('le-color').value;
    if ($('le-bgc-on').checked) st.backgroundColor = $('le-bgc').value;
    var fs = parseInt($('le-fs').value, 10); if (fs > 0) st.fontSize = fs + 'px';
    if ($('le-bold').checked) st.fontWeight = '700';
    if (Object.keys(st).length) o.st = st; else delete o.st;
    if ($('le-hide').checked) o.hide = true; else if (o.hide) { o.hide = false; }

    var has = ['text', 'src', 'href', 'icon', 'bg', 'st', 'hide'].some(function (k) { return o[k] !== undefined && o[k] !== false && o[k] !== ''; }) || o.text === '';
    if (!has) { toast('Nothing changed.', 'info'); return; }
    if (isNew) S.ops.push(o);
    S.history.push(before);
    SiteOverrides.applyRecord(doc(), o);
    markDirty(true); drawBox(el);
    toast('Changed. Check the preview, then press Publish to make it live.', 'success');
    var c = $('le-count'); if (c) c.textContent = S.ops.length;
    select(el);
  }

  function removeOp(i) {
    S.history.push(JSON.stringify(S.ops));
    S.ops.splice(i, 1); markDirty(true);
    loadPage(S.page[2]);   // reload to show the original again (+ remaining edits)
  }

  function markDirty(v) { S.dirty = v; var t = $('le-state'); if (t) t.style.display = v ? 'inline-block' : 'none'; }

  /* ---------------- load / publish ---------------- */
  async function loadOps() {
    var key = S.page[0], list = null;
    try { list = await SiteOverrides.load(key); } catch (e) {}
    if (list === null) list = SiteOverrides.cacheGet(key) || [];
    S.ops = list; S.history = []; markDirty(false);
  }

  async function publish() {
    var key = S.page[0], json = JSON.stringify(S.ops);
    var b = $('le-publish'); b.disabled = true; b.innerHTML = '<i class="fa-solid fa-spinner spin"></i> Publishing…';
    try {
      var res = await Inbox.setSetting(SiteOverrides.PREFIX + key, json);
      if (res && res.ok) { SiteOverrides.cacheSet(key, S.ops); markDirty(false); toast('Published! Live for all customers on "' + S.page[1] + '".', 'success'); }
      else toast('Could not publish: ' + ((res && res.error) || 'connect Supabase first'), 'error');
    } catch (e) { toast('Could not publish: ' + (e && e.message), 'error'); }
    b.disabled = false; b.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Publish (go live)';
  }

  /* ---------------- init ---------------- */
  function init() {
    if (!document.querySelector('.admin-nav') || $('le-frame')) return;
    css(); buildTab();
    S.frame = $('le-frame'); if (!S.frame) return;
    var sel = $('le-page');
    sel.innerHTML = PAGES.map(function (p, i) { return '<option value="' + i + '">' + esc(p[1]) + '</option>'; }).join('');
    S.frame.addEventListener('load', onFrameLoad);

    var started = false;
    function start() { if (started) return; started = true; loadOps().then(function () { loadPage(S.page[2]); }); }

    sel.onchange = function () {
      if (S.dirty && !confirm('You have unpublished changes on this page. Leave without publishing?')) { sel.value = String(PAGES.indexOf(S.page)); return; }
      S.page = PAGES[parseInt(sel.value, 10)]; loadOps().then(function () { loadPage(S.page[2]); });
    };
    $('le-device').onchange = function () { S.frame.style.width = this.value; S.frame.style.margin = '0 auto'; S.frame.style.display = 'block'; };
    $('le-reload').onclick = function () { loadPage(S.page[2]); };
    $('le-publish').onclick = publish;
    $('le-undo').onclick = function () {
      if (!S.history.length) { toast('Nothing to undo.', 'info'); return; }
      S.ops = JSON.parse(S.history.pop()); markDirty(true); loadPage(S.page[2]);
    };
    $('le-reset').onclick = function () {
      if (!confirm('Remove ALL edits on "' + S.page[1] + '" and go back to the original page? (Press Publish afterwards to make it live.)')) return;
      S.history.push(JSON.stringify(S.ops)); S.ops = []; markDirty(true); loadPage(S.page[2]);
    };
    // load the page only when the tab is opened (keeps the dashboard fast)
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-tab="live-editor"]'); if (b) setTimeout(start, 50);
    });
    if (/[?&]tab=live-editor/.test(location.search)) setTimeout(start, 400);
  }

  function boot() { var n = 0, t = setInterval(function () { if (document.querySelector('.admin-nav') && document.querySelector('.tab-panel') && typeof SiteOverrides !== 'undefined') { clearInterval(t); init(); } else if (++n > 60) clearInterval(t); }, 250); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
