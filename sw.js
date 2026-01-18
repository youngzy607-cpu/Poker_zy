const CACHE_NAME = 'poker-solo-v3.4.0';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './js/main.js',
  './js/game.js',
  './js/game_online.js',
  './js/ui.js',
  './js/player.js',
  './js/card.js',
  './js/evaluator.js',
  './js/audio.js',
  './js/network.js',
  './js/data.js',
  './js/achievements.js',
  './icons/icon-192.svg',
  './icons/icon-512.svg'
];

// Install Event: Cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching all assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
  // Force activation immediately
  self.skipWaiting();
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[Service Worker] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  // Claim clients immediately
  event.waitUntil(self.clients.claim());
});

// Fetch Event: Network first, fall back to cache
// Strategy: Network First (for fresh logic) -> Cache (offline support)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Check if we received a valid response
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, responseToCache);
          });

        return response;
      })
      .catch(() => {
        // If network fails, return from cache
        return caches.match(event.request);
      })
  );
});