/* Install-app card — ADMIN & STAFF DASHBOARD ONLY (never shown to customers).
   - Loaded only on admin pages; renders only when Auth.hasPanelAccess() is true.
   - Chrome / Edge / Android / Windows / Mac / Linux: click -> Allow/Not now popup -> Allow runs the real
     browser install automatically (the browser's own permission dialog appears for the final OK).
   - iOS / Safari (no auto-install allowed by Apple): shows the Share -> Add to Home Screen steps.
   - Hidden once installed (standalone mode). */
(function(){
  if (window.__smdInstallBtn) return; window.__smdInstallBtn = true;
  if (!/admin/i.test(location.pathname)) return;
  var root = (typeof ROOT_PREFIX !== 'undefined' ? ROOT_PREFIX : '');
  function installed(){ try{ return window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: window-controls-overlay)').matches || window.navigator.standalone === true; }catch(e){ return false; } }
  function logo(){
    var light = document.documentElement.getAttribute('data-theme') === 'light';
    var L = (typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG.logo) || {};
    return root + (light ? (L.dark || 'assets/logos/logo-dark.png') : (L.light || 'assets/logos/logo-light.png'));
  }
  function syncLogo(){ document.querySelectorAll('.smd-app-logo').forEach(function(i){ i.src = logo(); }); }
  try{ new MutationObserver(syncLogo).observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] }); }catch(e){}
  function allowed(){ try{ return typeof Auth !== 'undefined' && Auth.hasPanelAccess && Auth.hasPanelAccess(); }catch(e){ return false; } }
  if (installed()) return;

  var css = document.createElement('style');
  css.textContent = '#smd-app-card{display:flex;align-items:center;gap:12px;padding:12px 14px;margin-top:12px;border-radius:14px;border:1px solid var(--border-soft,#e5e7eb);background:var(--surface,#fff);color:var(--text,#111);cursor:pointer;text-align:left;width:100%;font:inherit;transition:transform .15s,box-shadow .15s}'
    + '#smd-app-card:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(0,0,0,.12)}'
    + '#smd-app-card img{width:38px;height:38px;border-radius:10px;flex:none;object-fit:cover}'
    + '#smd-app-card b{display:block;font-size:14px}#smd-app-card small{display:block;font-size:12px;opacity:.7;margin-top:2px}'
    + '@media(max-width:900px){#smd-app-card{width:auto;flex:none;margin:0}}'
    + '#smd-app-help{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px}'
    + '#smd-app-help .box{width:100%;max-width:380px;background:var(--bg-elevated,#fff);color:var(--text,#111);border:1px solid var(--border-soft,#ddd);border-radius:18px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.35)}'
    + '#smd-app-help .row{display:flex;gap:10px;margin-top:16px}'
    + '#smd-app-help button{flex:1;padding:11px;border-radius:10px;font-weight:700;cursor:pointer;border:1px solid var(--border-soft,#d1d5db);background:var(--surface-2,#f3f4f6);color:var(--text,#111)}'
    + '#smd-app-help button.go{background:#2563eb;border-color:#2563eb;color:#fff}';
  document.head.appendChild(css);

  function close(){ var o = document.getElementById('smd-app-help'); if (o) o.remove(); }
  function dialog(html){
    close(); var d = document.createElement('div'); d.id = 'smd-app-help';
    d.innerHTML = '<div class="box"><div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><img class="smd-app-logo" src="' + logo() + '" alt="" style="width:42px;height:42px;border-radius:10px;object-fit:cover"><h3 style="margin:0;font-size:18px">Install SM Admin App</h3></div>' + html + '</div>';
    d.addEventListener('mousedown', function(e){ if (e.target === d) close(); });
    document.body.appendChild(d); return d;
  }
  function steps(){
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var li = ios
      ? '<li>Safari-la <b>Share</b> button (square + arrow) click pannunga</li><li><b>Add to Home Screen</b> select pannunga</li><li><b>Add</b> click pannunga</li>'
      : '<li>Browser menu (&#8942;) open pannunga</li><li><b>Install app</b> / <b>Add to Home screen</b> select pannunga</li><li><b>Install</b> click pannunga</li>';
    var d = dialog('<ol style="margin:0 0 4px 18px;padding:0;line-height:1.7;font-size:14px">' + li + '</ol><div class="row"><button class="go" type="button">OK</button></div>');
    d.querySelector('.go').onclick = close;
  }
  function ask(){
    var ev = window.__smdInstallEvt;
    if (!ev){ steps(); return; }
    var d = dialog('<p style="margin:0;font-size:14px;line-height:1.6">Indha device-la <b>SM Admin App</b> install panna <b>Allow</b> kudunga. Allow panna automatic-ah download &amp; install aagum.</p><div class="row"><button type="button" class="no">Not now</button><button type="button" class="go">Allow</button></div>');
    d.querySelector('.no').onclick = close;
    d.querySelector('.go').onclick = async function(){
      close();
      try{
        ev.prompt(); var r = await ev.userChoice;
        if (r && r.outcome === 'accepted'){ window.__smdInstallEvt = null; remove(); }
      }catch(e){ steps(); }
    };
  }
  function remove(){ var b = document.getElementById('smd-app-card'); if (b) b.remove(); }

  function place(){
    if (installed()) { remove(); return; }
    if (!allowed()) { remove(); return; }
    if (document.getElementById('smd-app-card')) return;
    var host = document.querySelector('.admin-sidebar');
    if (!host) return;
    var b = document.createElement('button');
    b.id = 'smd-app-card'; b.type = 'button'; b.title = 'Install the SM Admin app';
    b.innerHTML = '<img class="smd-app-logo" src="' + logo() + '" alt=""><span><b>Install App</b><small>Admin &amp; Staff dashboard</small></span>';
    b.addEventListener('click', ask);
    host.appendChild(b);
  }
  place();
  var n = 0, t = setInterval(function(){ place(); if (++n > 40) clearInterval(t); }, 750);
  new MutationObserver(place).observe(document.documentElement, { childList:true, subtree:true });
  window.addEventListener('smd-installed', remove);
})();
