const CACHE_NAME = "zad-muslim-v1";

/* Install */
self.addEventListener("install", event => {
  self.skipWaiting();
});

/* Activate */
self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

/* Network First */
self.addEventListener("fetch", event => {

  event.respondWith(

    fetch(event.request)
      .then(networkResponse => {

        const responseClone = networkResponse.clone();

        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });

        return networkResponse;

      })
      .catch(() => {

        return caches.match(event.request);

      })

  );

});