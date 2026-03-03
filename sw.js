self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  return self.clients.claim();
});

self.addEventListener('fetch', e => {
  // No caching — always network
});