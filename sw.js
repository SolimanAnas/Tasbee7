const CACHE_NAME = "zad-muslim-v7"; // bumped for notifications.js v4.0 fix

// تأكد من أن المسارات في STATIC_ASSETS مطابقة تماماً للموجود في مجلدات مشروعك.
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
  "./js/quran-common.js",
  "./icon/icon-192.png", // تم التوحيد مع مسار index.html
  "./icon/icon-512.png", // تم التوحيد
  "./icon/duaa.png",
  "./icon/settings.svg"
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

// ⚠️ التعديل الجوهري: تحميل الملفات واحداً تلو الآخر. 
// إذا استخدمنا `cache.addAll` وفشل ملف واحد (مثلاً أيقونة غير موجودة)، سيفشل الكاش بالكامل.
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      console.log("📦 Caching assets one by one...");
      for (let asset of STATIC_ASSETS) {
        try {
          const response = await fetch(asset);
          if (response.ok) {
            await cache.put(asset, response);
          } else {
            console.warn(`⚠️ Failed to cache: ${asset} (Status: ${response.status})`);
          }
        } catch (err) {
          console.error(`🚨 Network error while caching: ${asset}`, err);
        }
      }
      console.log("✅ Caching process completed.");
    })
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME && !key.startsWith("quran-offline") && !key.startsWith("quran-pages"))
          .map(key => caches.delete(key))
      )
    )
  );
  console.log("✅ SW activated");
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
        // ⚠️ تم إصلاح الـ Syntax Error (الأقواس) وتمت إضافة ignoreSearch للروابط العميقة أوفلاين
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
      }).catch(err => console.log("📡 Offline fallback for:", req.url))
    )
  );
});

// Push notification receive
self.addEventListener("push", event => {
  let data = {};
  
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "🔔 Zad Al-Muslim", body: "تذكير جديد" };
  }
  
  const notificationData = data.data || {};
  const targetUrl = notificationData.url || DEEP_LINKS[notificationData.type] || DEEP_LINKS.default;
  
  const options = {
    body: data.body || "زاد المسلم",
    icon: "./icon/icon-192.png", // تم التوحيد مع مسار index.html
    badge: "./icon/icon-192.png",
    vibrate: [200, 100, 200],
    tag: data.tag || "zad-muslim",
    renotify: true,
    data: { 
      url: targetUrl,
      type: notificationData.type || "default"
    },
    actions: [
      { action: "open", title: "فتح" },
      { action: "dismiss", title: "إغلاق" }
    ]
  };

  console.log("📨 Push received:", data.title);
  
  event.waitUntil(
    self.registration.showNotification(data.title || "🔔 Zad Al-Muslim", options)
  );
});

// Notification click handler
self.addEventListener("notificationclick", event => {
  event.notification.close();
  
  if (event.action === "dismiss") return;
  
  const targetUrl = event.notification.data?.url || DEEP_LINKS.default;
  const fullTargetUrl = new URL(targetUrl, self.location.origin).href;
  
  console.log("👆 Notification clicked, opening:", fullTargetUrl);
  
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      // Check if already open
      for (const client of clientList) {
        if (client.url === fullTargetUrl || client.url.includes(targetUrl.replace('./', ''))) {
          return client.focus();
        }
      }
      // Open new
      return clients.openWindow(fullTargetUrl);
    })
  );
});

console.log("✅ Service Worker v7 loaded");