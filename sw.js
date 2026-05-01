const CACHE_NAME = "zad-muslim-v5"; // تم رفع الإصدار لتحديث الكاش القديم

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./quran.html",
  "./quran-text.html",
  "./audio.html",
  "./radio.html",
  "./azkar.html",
  "./masbaha.html",
  "./hisn.html",
  "./duaa.html",
  "./hadith.html",
  "./qibla.html",
  "./notifications.html",
  "./manifest.json",
  "./css/style.css",
  "./js/notifications.js",
  "./js/quran-common.js"
];

const DEEP_LINKS = {
  prayer: "./quran.html",
  azkar: "./azkar.html",
  kahf: "./quran.html?surah=18",
  masbaha: "./masbaha.html",
  hisn: "./hisn.html",
  radio: "./radio.html",
  default: "./index.html"
};

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.error("Cache warning:", err);
      });
    })
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME && !key.startsWith("quran-offline"))
          .map(key => caches.delete(key))
      )
    )
  );
  return self.clients.claim();
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  if (url.hostname.includes("mp3quran") || url.hostname.includes("archive.org") ||
      url.hostname.includes("radiojar") || url.pathname.endsWith(".mp3") ||
      url.pathname.endsWith(".m3u8")) {
    return;
  }

  if (req.headers.get("accept").includes("text/html")) {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        return res;
      }).catch(() => {
        // تم إضافة الأقواس الناقصة وخاصية ignoreSearch لضمان عمل الروابط العميقة أوفلاين
        return caches.match(req, { ignoreSearch: true }).then(cachedRes => 
          cachedRes || caches.match("./index.html", { ignoreSearch: true })
        );
      })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cacheRes => cacheRes ||
      fetch(req).then(networkRes => {
        if (networkRes && networkRes.status === 200 && networkRes.type === "basic") {
          const copy = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return networkRes;
      }).catch(err => console.log("Offline:", req.url))
    )
  );
});

self.addEventListener("push", event => {
  const data = event.data ? event.data.json() : {};
  
  const options = {
    body: data.body || "زاد المسلم - تذكير",
    icon: "./img/icon-192.png", // تأكد من المسار حسب مجلداتك
    badge: "./img/icon-96.png",
    vibrate: [200, 100, 200],
    tag: data.tag || "zad-muslim",
    renotify: true,
    data: { 
      url: data.url || DEEP_LINKS[data.type] || DEEP_LINKS.default,
      type: data.type || "default"
    },
    actions: [
      { action: "open", title: "فتح" },
      { action: "dismiss", title: "إغلاق" }
    ]
  };

  event.waitUntil(self.registration.showNotification(data.title || "🔔 Zad Al-Muslim", options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  
  if (event.action === "dismiss") return;
  
  const targetUrl = event.notification.data?.url || DEEP_LINKS.default;
  // تحويل الرابط إلى رابط كامل لسهولة العثور على التبويبة المفتوحة
  const fullTargetUrl = new URL(targetUrl, self.location.origin).href;
  
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === fullTargetUrl || client.url.includes(targetUrl.replace('./', ''))) {
          return client.focus();
        }
      }
      return clients.openWindow(fullTargetUrl);
    })
  );
});