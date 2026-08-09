// BSTM Marketplace Service Worker
// Version 1.2.0

const CACHE_NAME = 'bstm-marketplace-v1.2';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './css/tailwind.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing BSTM Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        // Cache each resource independently so one flaky fetch (e.g. the
        // CDN on a bad connection) doesn't fail the entire install —
        // addAll() is all-or-nothing by spec, which is too fragile here.
        return Promise.allSettled(
          urlsToCache.map((url) =>
            cache.add(url).catch((err) => console.warn('[SW] Failed to cache', url, err))
          )
        );
      })
  );
  self.skipWaiting();
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating BSTM Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch Strategy: Network First, fallback to Cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response
        const responseToCache = response.clone();
        
        // Cache the fetched response
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        
        return response;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(event.request).then((response) => {
          if (response) {
            return response;
          }
          
          // If not in cache, return offline page
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});

// Background Sync for offline orders
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    console.log('[SW] Syncing offline orders...');
    event.waitUntil(syncOfflineOrders());
  }
});

async function syncOfflineOrders() {
  // TODO: Implement Supabase sync for offline orders
  console.log('[SW] Orders synced!');
}

// Push Notifications
self.addEventListener('push', (event) => {
  const data = event.data.json();
  console.log('[SW] Push received:', data);
  
  const options = {
    body: data.body || 'New update from BSTM Marketplace',
    vibrate: [200, 100, 200],
    tag: 'bstm-notification',
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'BSTM Marketplace', options)
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('./')
    );
  }
});
