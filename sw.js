const CACHE_NAME = "zad-muslim-v1";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/quran.html",
  "/audio.html",
  "/radio.html",
  "/azkar.html",
  "/masbaha.html",
  "/manifest.json"
];

/* INSTALL */
self.addEventListener("install", event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

/* ACTIVATE */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );

  return self.clients.claim();
});

/* FETCH */
self.addEventListener("fetch", event => {

  const req = event.request;

  /* Ignore non-GET */
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  /* Do NOT cache audio streams */
  if (
    url.hostname.includes("mp3quran") ||
    url.hostname.includes("archive.org") ||
    url.pathname.endsWith(".mp3") ||
    url.pathname.endsWith(".m3u8")
  ) {
    event.respondWith(fetch(req));
    return;
  }

  /* HTML → Network First */
  if (req.headers.get("accept").includes("text/html")) {

    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );

    return;
  }

  /* Static files → Cache First */
  event.respondWith(
    caches.match(req).then(cacheRes => {
      return (
        cacheRes ||
        fetch(req).then(networkRes => {
          const copy = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return networkRes;
        })
      );
    })
  );

});