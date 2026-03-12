/* GI28 Service Worker v1.0 */
const CACHE_NAME = 'gi28-v1';
const OFFLINE_URL = '/offline.html';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/cart.js',
  '/payment.js',
  '/services.json',
  '/coupon.json',
  '/cart/index.html',
  '/manifest.json',
  '/offline.html'
];

/* Install */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_ASSETS.map(url => new Request(url, { cache: 'reload' })));
    }).then(() => self.skipWaiting())
  );
});

/* Activate */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* Fetch — Network first, cache fallback */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip cross-origin requests except fonts/CDN
  if (url.origin !== location.origin) {
    if (!url.hostname.includes('fonts.') && !url.hostname.includes('cdnjs.')) return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.destination === 'document') {
            return caches.match(OFFLINE_URL);
          }
        })
      )
  );
});

/* Background sync placeholder */
self.addEventListener('sync', event => {
  if (event.tag === 'order-sync') {
    event.waitUntil(syncOrders());
  }
});

async function syncOrders() {
  // Placeholder for background order sync
  const db = await openOrdersDB();
  // Sync pending orders when back online
}
