/* 404 / offline page — real delivery reels player.
   FIX: SITE_CONFIG is declared with `const` in config.js, so it is NOT a property of
   `window` (window.SITE_CONFIG was undefined -> list empty -> "reels coming soon").
   Read the global binding directly instead. */
(function () {
  var cfg = {};
  try { if (typeof SITE_CONFIG !== 'undefined') cfg = SITE_CONFIG; } catch (e) {}
  if ((!cfg || !cfg.instagramReels) && window.SITE_CONFIG) cfg = window.SITE_CONFIG;

  var raw = (cfg.deliveryReels && cfg.deliveryReels.length ? cfg.deliveryReels : (cfg.instagramReels || []));
  var ids = raw.map(function (u) { var m = String(u).match(/instagram\.com\/reels?\/([A-Za-z0-9_-]+)/); return m ? m[1] : null; }).filter(Boolean);

  var stage = document.getElementById('op-stage'), msg = document.getElementById('op-msg'), count = document.getElementById('op-count');
  if (!stage) return;
  var i = 0, timer = null;

  function watchLink(id) {
    return '<a href="https://www.instagram.com/reel/' + id + '/" target="_blank" rel="noopener" ' +
      'style="display:inline-block;margin-top:6px;font-size:12.5px;font-weight:700;color:inherit;opacity:.85">\u25B6 Watch this reel on Instagram</a>';
  }

  function show() {
    clearTimeout(timer);
    if (!ids.length) { stage.innerHTML = '<div class="op-off">\uD83C\uDFAC<br>Delivery reels coming soon</div>'; return; }
    if (!navigator.onLine) {
      stage.innerHTML = '<div class="op-off">\uD83D\uDCE1<br><b>You\'re offline</b><br>Reels will play automatically when you\'re back online.</div>';
      msg.textContent = 'Waiting for connection\u2026'; return;
    }
    var id = ids[i];
    stage.innerHTML = '<iframe src="https://www.instagram.com/reel/' + id + '/embed/" title="Delivery reel" frameborder="0" scrolling="no" ' +
      'allowfullscreen allowtransparency="true" loading="eager" referrerpolicy="strict-origin-when-cross-origin" ' +
      'allow="autoplay; encrypted-media; picture-in-picture; clipboard-write; fullscreen"></iframe>';
    count.textContent = (i + 1) + ' / ' + ids.length;
    msg.innerHTML = 'Real deliveries from our customers<br>' + watchLink(id);
    timer = setTimeout(function () { step(1); }, 15000);
  }
  function step(n) { i = (i + n + ids.length) % ids.length; show(); }

  var p = document.getElementById('op-prev'), n = document.getElementById('op-next'), r = document.getElementById('op-retry');
  if (p) p.onclick = function () { step(-1); };
  if (n) n.onclick = function () { step(1); };
  if (r) r.onclick = function () { location.reload(); };
  window.addEventListener('online', show);
  window.addEventListener('offline', show);
  show();
})();
