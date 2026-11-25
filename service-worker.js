/* ==========================================================================
   SERVICE WORKER — basic offline caching (app shell) for PWA support.
   Bump CACHE_NAME whenever assets change so old caches get cleaned up.
   ========================================================================== */

const CACHE_NAME = 'smd-cache-v78';

// Heavy / rarely-needed files (catalog-seed.js, chatbot.js, admin.js, ...) are NOT precached — they load on demand.
const APP_SHELL = [
  '/index.html',
  '/offline.html',
  '/js/offline-player.js',
  '/manifest.json',
  '/css/variables.css',
  '/css/components.css',
  '/css/style.css',
  '/css/dark-mode.css',
  '/css/animations.css',
  '/css/responsive.css',
  '/css/color-fix.css',
  '/css/final-fix.css',
  '/css/dock.css',
  '/css/ultrawide.css',
  '/js/config.js',
  '/js/webp-manifest.js',
  '/js/utils.js',
  '/js/data.js',
  '/js/auth.js',
  '/js/cart.js',
  '/js/notifications.js',
  '/js/theme.js',
  '/js/loader.js',
  '/js/search.js',
  '/js/orders.js',
  '/js/payment.js',
  '/js/ui.js',
  '/js/fast-nav.js',
  '/js/auto-specs.js',
  '/js/app.js',
  '/js/dock.js',
  '/js/scroll-guard.js',
  '/js/smd-v29.js',
  '/js/pwa-install.js',
  '/js/site-overrides.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Same-origin only. Cross-origin requests (Supabase REST/Auth/Storage, CDNs)
// MUST go straight to the network — the old handler cached them cache-first,
// which could serve stale orders/products/sessions forever.
//  - HTML pages: network-first (always latest), cache only as offline fallback
//  - css/js/images: stale-while-revalidate (instant from cache, refreshed in
//    the background so new deploys show up on the next load)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate'){
    event.respondWith(
      fetch(req).catch(() => caches.match(req).then((r) => r || caches.match('/offline.html')))
    );
    return;
  }

  // css/js: network-first (cache only as offline fallback) so new deploys apply on the first reload
  if (/\.(css|js)$/.test(url.pathname)){
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok){ const copy = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {}); }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.ok){
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
