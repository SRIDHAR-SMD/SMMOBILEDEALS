/* Install-app button: dark logo + "Application" in the header (left of the bell).
   Installable browsers -> real install prompt. iOS / others -> short how-to popup. Hidden once installed. */
(function(){
  if (window.__smdInstallBtn) return; window.__smdInstallBtn = true;
  var root = (typeof ROOT_PREFIX !== 'undefined' ? ROOT_PREFIX : '');
  function installed(){ try{ return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }catch(e){ return false; } }
  if (installed()) return;

  var css = document.createElement('style');
  css.textContent = '.smd-app-btn{display:inline-flex;align-items:center;gap:8px;height:42px;padding:0 14px 0 6px;border-radius:999px;border:1px solid rgba(255,255,255,.25);background:rgba(10,14,26,.78);color:#fff;font:700 14px/1 inherit;font-family:inherit;cursor:pointer;white-space:nowrap;transition:transform .15s,background .15s}'
    + '.smd-app-btn:hover{background:rgba(56,104,217,.9);transform:translateY(-1px)}'
    + '.smd-app-btn img{width:30px;height:30px;border-radius:50%;object-fit:cover;background:#000;flex:none}'
    + '@media(max-width:900px){.smd-app-btn span{display:none}.smd-app-btn{padding:0 6px}}';
  document.head.appendChild(css);

  function modal(){
    var old = document.getElementById('smd-app-help'); if (old) old.remove();
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    var steps = ios
      ? '<li>Safari-la <b>Share</b> button (square + arrow) click pannunga</li><li><b>Add to Home Screen</b> select pannunga</li><li><b>Add</b> click pannunga</li>'
      : '<li>Chrome / Edge menu (&#8942;) open pannunga</li><li><b>Install app</b> / <b>Add to Home screen</b> select pannunga</li><li><b>Install</b> click pannunga</li>';
    var d = document.createElement('div'); d.id = 'smd-app-help';
    d.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px';
    d.innerHTML = '<div style="width:100%;max-width:360px;background:#10162a;color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:18px;padding:22px"><div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><img src="' + root + 'assets/logos/logo-dark.png" alt="" style="width:40px;height:40px;border-radius:50%;background:#000"><h3 style="margin:0;font-size:18px">Install Dealora App</h3></div><ol style="margin:0 0 16px 18px;padding:0;line-height:1.7;font-size:14px">' + steps + '</ol><button type="button" style="width:100%;padding:10px;border-radius:10px;border:0;background:#3868d9;color:#fff;font-weight:700;cursor:pointer">OK</button></div>';
    d.addEventListener('mousedown', function(e){ if (e.target === d) d.remove(); });
    d.querySelector('button').onclick = function(){ d.remove(); };
    document.body.appendChild(d);
  }

  async function onClick(){
    var ev = window.__smdInstallEvt;
    if (ev){
      try{ ev.prompt(); var r = await ev.userChoice; if (r && r.outcome === 'accepted'){ window.__smdInstallEvt = null; var b = document.getElementById('smd-app-btn'); if (b) b.remove(); } }catch(e){ modal(); }
    } else modal();
  }

  function place(){
    if (installed()) return;
    var host = document.querySelector('.header-actions');
    if (!host || document.getElementById('smd-app-btn')) return;
    var b = document.createElement('button');
    b.id = 'smd-app-btn'; b.type = 'button'; b.className = 'smd-app-btn'; b.title = 'Install the Dealora app';
    b.innerHTML = '<img src="' + root + 'assets/logos/logo-dark.png" alt=""><span>Application</span>';
    b.addEventListener('click', onClick);
    host.insertBefore(b, host.firstChild);
  }
  place();
  new MutationObserver(place).observe(document.documentElement, { childList:true, subtree:true });
  window.addEventListener('smd-installed', function(){ var b = document.getElementById('smd-app-btn'); if (b) b.remove(); });
})();
