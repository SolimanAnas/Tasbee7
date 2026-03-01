const CACHE_NAME = 'masbaha-v4'; // change version to force update

const ASSETS = [
  './',
  './index.html',
  './azkar.html',
  './azkar.js',
  './azkar.json',
  './manifest.json',
  './icon.png'
];

// 1️⃣ Install Event
self.addEventListener('install', (e) => {
  self.skipWaiting();

  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// 2️⃣ Activate Event
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );

  return self.clients.claim();
});

// 3️⃣ Fetch Event (offline-first strategy)
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});