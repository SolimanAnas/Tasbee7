const CACHE_NAME = "zad-muslim-v10"; // expanded static assets

const STATIC_ASSETS = [
  // ===== App Shell (HTML) =====
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
  "./howto.html",
  "./about.html",

  // ===== Config =====
  "./manifest.json",

  // ===== Styles =====
  "./css/style.css",

  // ===== Core JS =====
  "./data/cities.js",
  "./data/adhan.js",
  "./js/native-init.js",
  "./js/notifications.js",
  "./js/plugins/capacitor-core.js",
  "./js/plugins/capacitor-shim.js",
  "./js/plugins/local-notifications.js",
  "./js/quran-common.js",

  // ===== Fonts =====
  "./fonts/Tajawal-Bold.ttf",
  "./fonts/Scheherazade.ttf",
  "./fonts/uthmani-colored.ttf",
  "./fonts/UthmanicHafs_V20.ttf",
  "./fonts/Amiri.ttf",
  "./fonts/almushaf.ttf",

  // ===== Icons =====
  "./icons/icon-192.png",
  "./icons/icon_512.png",
  "./icons/duaa.png",
  "./icons/duaa.svg",
  "./icons/settings.svg",
  "./icons/masbaha.png",
  "./icons/masbaha.svg",
  "./icons/radio.png",
  "./icons/radio.svg",
  "./icons/qibla.svg",

  // ===== Background images =====
  "./images/Background-dark.png",
  "./images/Background-light.png",

  // ===== Quran page images =====
  "./img/text-container.png",
  "./img/text-container_txt.png",
  "./img/frame.png",
  "./img/Sura_border.svg",
  "./img/Basmala.svg"
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
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
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
  const fullTargetUrl = new URL(targetUrl, self.location.href).href;
  
  console.log("👆 Notification clicked, opening:", fullTargetUrl);
  
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      const targetPath = new URL(fullTargetUrl).pathname;
      for (const client of clientList) {
        const clientPath = new URL(client.url).pathname;
        if (clientPath === targetPath) {
          client.navigate(fullTargetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(fullTargetUrl);
    })
  );
});

console.log("✅ Service Worker v10 loaded");