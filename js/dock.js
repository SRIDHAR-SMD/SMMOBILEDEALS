/* SM Dock — single chatbot button on EVERY page. Hover (desktop) / tap (phone) => GPS, Admin chat, AI assistant + location status. */
(function(){
  if (window.__smdDock) return; window.__smdDock = true;
  var ICON_AI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>';
  var ICON_ADMIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>';
  var bypass = false, closeTimer = null;

  function isCustomer(){ try{ return Auth.isLoggedIn() && !Auth.hasPanelAccess(); }catch(e){ return false; } }
  function isPanel(){ try{ return Auth.hasPanelAccess(); }catch(e){ return false; } }
  function loginUrl(){ return (typeof ROOT_PREFIX !== 'undefined' ? ROOT_PREFIX : '') + 'pages/login.html'; }
  function toast(m, t){ try{ Notify.toast(m, t || 'info'); }catch(e){} }

  function build(){
    var fab = document.getElementById('ai-fab');
    if (!fab || document.getElementById('smd-dock')) return !!document.getElementById('smd-dock');
    var dock = document.createElement('div'); dock.id = 'smd-dock';
    var items = document.createElement('div'); items.className = 'smd-dock-items';
    dock.appendChild(items); document.body.appendChild(dock); dock.appendChild(fab);

    function open(){ clearTimeout(closeTimer); dock.classList.add('open'); }
    function close(){ clearTimeout(closeTimer); closeTimer = setTimeout(function(){ dock.classList.remove('open'); }, 300); }
    dock.addEventListener('mouseenter', open);
    dock.addEventListener('mouseleave', close);
    document.addEventListener('click', function(e){ if (!dock.contains(e.target)) dock.classList.remove('open'); });

    // Touch phones have no hover: first tap on the chatbot button opens the dock.
    fab.addEventListener('click', function(e){
      if (bypass) return;
      if (window.matchMedia && matchMedia('(hover:none)').matches){
        e.stopImmediatePropagation(); e.preventDefault(); dock.classList.toggle('open');
      }
    }, true);

    function openChat(mode){
      try{ window.SMD_CHAT_MODE = mode; localStorage.setItem('smd_chat_mode', mode); }catch(e){}
      var syncMode = function(){ var b = document.querySelector('#chat-panel .chat-mode button[data-mode="' + mode + '"]'); if (b) b.click(); };
      var panel = document.getElementById('chat-panel');
      if (panel && panel.classList.contains('open')) return syncMode();
      bypass = true; try{ fab.click(); }finally{ bypass = false; }
      [500, 1200, 2200].forEach(function(ms){ setTimeout(syncMode, ms); });
    }
    function wrap(el, cls){
      var row = document.createElement('div'); row.className = 'smd-row ' + cls;
      row.appendChild(el);
      var pl = document.createElement('span'); pl.className = 'smd-row-plus'; pl.textContent = '+'; row.appendChild(pl);
      return row;
    }
    function mk(cls, icon, label, fn){
      var b = document.createElement('button'); b.type = 'button'; b.className = 'smd-dock-btn ' + cls;
      b.setAttribute('aria-label', label); b.innerHTML = icon; b.addEventListener('click', fn);
      var row = wrap(b, cls.replace('d-', 'r-')); items.appendChild(row); return b;
    }
    mk('d-ai', ICON_AI, 'AI Assistant', function(){ openChat('ai'); dock.classList.remove('open'); });
    var adminBtn = mk('d-admin', ICON_ADMIN, 'Chat with Admin', function(){
      if (!isCustomer()){ toast('Admin-kitta pesa mudhal login pannunga', 'warn'); setTimeout(function(){ location.href = loginUrl(); }, 900); return; }
      openChat('admin'); dock.classList.remove('open');
    });
    function syncAdminBtn(){ adminBtn.parentNode.style.display = isPanel() ? 'none' : ''; }
    syncAdminBtn(); setInterval(syncAdminBtn, 3000);

    // Move the existing GPS toggle + "Location sharing" badge (created by other scripts) into the dock.
    function adopt(){
      var g = document.getElementById('gps-toggle');
      if (g && !(g.parentNode && g.parentNode.classList.contains('smd-row'))) items.appendChild(wrap(g, 'r-gps'));
      var geo = document.getElementById('geo-badge');
      if (geo && geo.parentNode !== items) items.appendChild(geo);
    }
    adopt();
    if (window.MutationObserver) new MutationObserver(adopt).observe(document.body, { childList: true });
    return true;
  }

  function start(){
    if (build()) return;
    var tries = 0, t = setInterval(function(){ if (build() || ++tries > 60) clearInterval(t); }, 250);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
