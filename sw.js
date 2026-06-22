const CACHE_NAME = "zad-muslim-v64"; // v64: hijri date fix (English uses Islamic month names)
const AUDIO_CACHE = "audio-cache-v1";
const PUSH_CTX_CACHE = "push-ctx-v1"; // schedule context written by js/notifications.js

// adhan + the shared schedule builder so periodicsync can rebuild the 7-day
// push schedule while the app is closed (same code the page runs).
importScripts("./data/adhan.js", "./js/prayer-service.js", "./js/schedule-builder.js");

// Recitation files are ~1–10 MB each; 120 entries keeps the cache roughly
// under ~500 MB worst-case instead of growing forever.
const AUDIO_CACHE_MAX_ENTRIES = 120;

async function trimAudioCache(cache) {
  const keys = await cache.keys(); // insertion order → oldest first
  for (let i = 0; i < keys.length - AUDIO_CACHE_MAX_ENTRIES; i++) {
    await cache.delete(keys[i]);
  }
}

const STATIC_ASSETS = [
  // ===== App Shell (HTML) =====
  "./",
  "./index.html",
  "./404.html",
  "./pages/quran.html",
  "./pages/quran-text.html",
  "./pages/audio.html",
  "./pages/radio.html",
  "./pages/azkar.html",
  "./pages/masbaha.html",
  "./pages/hisn.html",
  "./pages/duaa.html",
  "./pages/hadith.html",
  "./pages/qibla.html",
  "./pages/notifications.html",
  "./pages/takrar.html",
  "./pages/howto.html",
  "./pages/about.html",
  "./pages/tasmee-dashboard.html",
  "./pages/tasmee-review.html",
  "./pages/hadith-viewer.html",
  "./pages/salah.html",
  "./pages/sleeping.html",

  // ===== Config =====
  "./manifest.json",

  // ===== Styles =====
  "./css/style.css",
  "./css/svg-theme.css",
  "./js/svg-injector.js",
  "./css/quran-v4.css",
  "./css/tasmee.css",
  "./css/tasmee-pro-v2.css",
  "./css/_masbaha.css",

  // ===== Core JS =====
  "./data/cities.js",
  "./data/adhan.js",
  "./js/quran-structure.js",
  "./js/native-init.js",
  "./js/notifications.js",
  "./js/schedule-builder.js",
  "./js/prayer-service.js",
  "./js/theme-manager.js",
  "./js/toast.js",
  "./js/plugins/capacitor-core.js",
  "./js/plugins/capacitor-shim.js",
  "./js/plugins/local-notifications.js",
  "./js/quran-common.js",
  "./js/tasmee-engine.js",
  "./js/tasmee-matcher.js",
  "./js/tasmee-store.js",
  "./js/juz-map.js",
  "./js/masbaha.js",
  "./js/medina2.data.js",
  "./js/quran-app.js",
  "./js/quranpages.data.js",
  "./js/radio-stations.js",
  "./js/surah-map.js",
  "./js/tarteel-worker.js",

  // ===== i18n engine + locale dictionaries =====
  "./js/i18n.js",
  "./js/i18n/names.js",
  "./js/i18n/ar.js",
  "./js/i18n/en.js",
  "./js/i18n/tr.js",
  "./js/i18n/ckb.js",
  "./js/i18n/ur.js",

  // ===== Extracted Quran modules =====
  "./js/quran/state.js",
  "./js/quran/navigation.js",
  "./js/quran/highlights.js",
  "./js/quran/audio.js",
  "./js/quran/audio-cache.js",
  "./js/quran/tafsir.js",
  "./js/quran/settings.js",
  "./js/quran/ui.js",
  "./js/quran/search.js",
  "./js/quran/download.js",
  "./js/quran/init.js",
  "./js/quran/tasmee.js",
  "./js/quran/tasmee-pro-v2.js",
  "./js/quran/tasmee-dashboard.js",
  "./js/quran/tasmee-review.js",
  "./js/quran/local-search.js",
  "./js/quran/ui-extras.js",

  // ===== Offline Quran text (word-by-word Tasmee) =====
  "./data/quran.json",
  "./data/vocab.json",

  // ===== Fonts =====
  "./fonts/Tajawal.ttf",
  "./fonts/Tajawal-Bold.ttf",
  "./fonts/Scheherazade.ttf",
  "./fonts/uthmani-colored.ttf",
  "./fonts/UthmanicHafs_V20.ttf",
  "./fonts/UthmanicHafs.otf",
  "./fonts/Amiri.ttf",
  "./fonts/almushaf.ttf",
  "./fonts/qortoba.ttf",
  "./fonts/naskh.otf",
  "./fonts/me_quran.ttf",
  "./fonts/basmalah.ttf",

  // ===== Assets =====
  "./assets/audio.json",
  "./assets/azkar.json",
  "./assets/husn.pdf",
  "./assets/duaa-01.json",
  "./assets/duaa-02.json",
  "./assets/duaa-03.json",
  "./assets/duaa-04.json",
  "./assets/duaa-05.json",
  "./assets/part1.json",
  "./assets/part2.json",
  "./assets/part3.json",
  "./assets/part4.json",
  "./assets/part5.json",

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
  "./images/Background-dark.webp",
  "./images/Background-light.webp",
  "./images/background-sepia.webp",

  // ===== Hadith book thumbnails =====
  "./assets/thumbnails/6/ImamBukhari1.webp",
  "./assets/thumbnails/6/ImamMuslim1.webp",
  "./assets/thumbnails/6/Abu Dawwod.webp",
  "./assets/thumbnails/6/Imam_al-Trimdhi.webp",
  "./assets/thumbnails/6/Nasa'ie.webp",
  "./assets/thumbnails/6/Ibn majah.webp",
  "./assets/thumbnails/others/رياض الصالحين.webp",
  "./assets/thumbnails/others/بلوغ المرام.webp",
  "./assets/thumbnails/others/مشكاة المصابيح2.webp",
  "./assets/thumbnails/others/الادب المفرد2.webp",
  "./assets/thumbnails/others/الشمائل المحمدية.webp",
  "./assets/thumbnails/others/متن الأربعون النووية2.webp",
  "./assets/thumbnails/others/الأربعون القدسية.webp",

  // ===== Quran page images =====
  "./img/text-container.png",
  "./img/text-container_txt.png",
  "./img/frame.png",
  "./img/Sura_border.svg",
  "./img/Basmala.svg",

  // ===== SVG Icons =====
  "./img/SVG/activity.svg",
  "./img/SVG/alert-triangle.svg",
  "./img/SVG/arrow-left.svg",
  "./img/SVG/arrow-right.svg",
  "./img/SVG/at-sign.svg",
  "./img/SVG/award.svg",
  "./img/SVG/azkar.svg",
  "./img/SVG/bar-chart.svg",
  "./img/SVG/battery.svg",
  "./img/SVG/bell.svg",
  "./img/SVG/book-open.svg",
  "./img/SVG/book.svg",
  "./img/SVG/bookmark.svg",
  "./img/SVG/calendar-check.svg",
  "./img/SVG/calendar-minus.svg",
  "./img/SVG/calendar-plus.svg",
  "./img/SVG/calendar-x.svg",
  "./img/SVG/calendar.svg",
  "./img/SVG/camera.svg",
  "./img/SVG/check-circle.svg",
  "./img/SVG/check-double.svg",
  "./img/SVG/check-square.svg",
  "./img/SVG/check.svg",
  "./img/SVG/chevron-down.svg",
  "./img/SVG/chevron-left.svg",
  "./img/SVG/chevron-right.svg",
  "./img/SVG/circle-filled.svg",
  "./img/SVG/circle.svg",
  "./img/SVG/clock-countdown.svg",
  "./img/SVG/clock.svg",
  "./img/SVG/close.svg",
  "./img/SVG/cloud.svg",
  "./img/SVG/code.svg",
  "./img/SVG/coffee.svg",
  "./img/SVG/compass-rose.svg",
  "./img/SVG/compass.svg",
  "./img/SVG/copy.svg",
  "./img/SVG/download.svg",
  "./img/SVG/downloads.svg",
  "./img/SVG/edit.svg",
  "./img/SVG/external-link.svg",
  "./img/SVG/file-text.svg",
  "./img/SVG/filter.svg",
  "./img/SVG/flag.svg",
  "./img/SVG/folder.svg",
  "./img/SVG/gauge.svg",
  "./img/SVG/globe.svg",
  "./img/SVG/grid.svg",
  "./img/SVG/hadith.svg",
  "./img/SVG/hard-drive.svg",
  "./img/SVG/hash.svg",
  "./img/SVG/headphones.svg",
  "./img/SVG/heart.svg",
  "./img/SVG/history.svg",
  "./img/SVG/home.svg",
  "./img/SVG/image.svg",
  "./img/SVG/info.svg",
  "./img/SVG/key.svg",
  "./img/SVG/layers.svg",
  "./img/SVG/lightbulb.svg",
  "./img/SVG/link.svg",
  "./img/SVG/list-checks.svg",
  "./img/SVG/list.svg",
  "./img/SVG/location.svg",
  "./img/SVG/lock.svg",
  "./img/SVG/map-pin.svg",
  "./img/SVG/menu.svg",
  "./img/SVG/message-circle.svg",
  "./img/SVG/mic.svg",
  "./img/SVG/minus.svg",
  "./img/SVG/monitor.svg",
  "./img/SVG/moon.svg",
  "./img/SVG/more-vertical.svg",
  "./img/SVG/music.svg",
  "./img/SVG/note.svg",
  "./img/SVG/palette.svg",
  "./img/SVG/pause.svg",
  "./img/SVG/pen.svg",
  "./img/SVG/pin.svg",
  "./img/SVG/play.svg",
  "./img/SVG/plus.svg",
  "./img/SVG/prayer.svg",
  "./img/SVG/printer.svg",
  "./img/SVG/quran.svg",
  "./img/SVG/radio.svg",
  "./img/SVG/refresh.svg",
  "./img/SVG/repeat-1.svg",
  "./img/SVG/repeat.svg",
  "./img/SVG/save-db.svg",
  "./img/SVG/save.svg",
  "./img/SVG/scissors.svg",
  "./img/SVG/search.svg",
  "./img/SVG/send.svg",
  "./img/SVG/settings.svg",
  "./img/SVG/share.svg",
  "./img/SVG/shield.svg",
  "./img/SVG/skip-back.svg",
  "./img/SVG/skip-forward.svg",
  "./img/SVG/sliders.svg",
  "./img/SVG/smartphone.svg",
  "./img/SVG/sort.svg",
  "./img/SVG/square.svg",
  "./img/SVG/star.svg",
  "./img/SVG/sun.svg",
  "./img/SVG/target.svg",
  "./img/SVG/tasbih.svg",
  "./img/SVG/terminal.svg",
  "./img/SVG/text.svg",
  "./img/SVG/trash.svg",
  "./img/SVG/trending-up.svg",
  "./img/SVG/user.svg",
  "./img/SVG/volume-x.svg",
  "./img/SVG/volume.svg",
  "./img/SVG/wifi-off.svg",
  "./img/SVG/wifi.svg",
  "./img/SVG/x.svg",
  "./img/SVG/zap.svg"
];

const DEEP_LINKS = {
  prayer: "./pages/quran.html",
  azkar: "./pages/azkar.html",
  kahf: "./pages/quran.html?surah=18",
  masbaha: "./pages/masbaha.html",
  hisn: "./pages/hisn.html",
  radio: "./pages/radio.html",
  default: "./index.html"
};

// ===== Install: cache static assets =====
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

// ===== Activate: clean old caches =====
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME && key !== AUDIO_CACHE && key !== PUSH_CTX_CACHE && !key.startsWith("quran-offline") && !key.startsWith("quran-pages"))
          .map(key => caches.delete(key))
      )
    )
  );
  console.log("✅ SW activated");
  return self.clients.claim();
});

// ===== Fetch handler =====
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // --- Audio files: cache-first with audio-cache-v1 ---
  if (url.pathname.endsWith(".mp3") ||
      url.hostname.includes("mp3quran") ||
      url.hostname.includes("archive.org")) {
    event.respondWith(
      caches.open(AUDIO_CACHE).then(async cache => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const response = await fetch(req);
          if (response && response.ok) {
            event.waitUntil(
              cache.put(req, response.clone()).then(() => trimAudioCache(cache)).catch(() => {})
            );
          }
          return response;
        } catch (_) {
          return new Response("", { status: 503 });
        }
      })
    );
    return;
  }

  // --- API calls: network-first, no caching (let client handle) ---
  if (url.hostname.includes("api.alquran.cloud") ||
      url.pathname.endsWith(".m3u8") ||
      url.pathname.endsWith(".onnx")) {
    return;
  }

  // --- HTML pages: stale-while-revalidate ---
  if (req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(req);
        const networkFetch = fetch(req).then(res => {
          if (res && res.ok) {
            cache.put(req, res.clone());
          }
          return res;
        }).catch(() => cached);

        // Return cached immediately if available, update in background
        if (cached) {
          fetch(req).then(res => {
            if (res && res.ok) cache.put(req, res);
          }).catch(() => {});
          return cached;
        }
        return networkFetch;
      })
    );
    return;
  }

  // --- Static assets: cache-first, network fallback ---
  event.respondWith(
    caches.match(req).then(cacheRes => cacheRes ||
      fetch(req).then(networkRes => {
        if (networkRes && networkRes.status === 200 && networkRes.type === "basic") {
          const copy = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return networkRes;
      }).catch(() => new Response("Offline", { status: 503, statusText: "Service Unavailable", headers: { "Content-Type": "text/plain" } }))
    )
  );
});

// ===== Periodic schedule refresh =====
// Wakes ~daily (Chromium, installed PWAs) to re-upload a fresh 7-day schedule
// from the context the page persisted — so pushes keep flowing even if the
// user doesn't open the app past the schedule horizon.
self.addEventListener("periodicsync", event => {
  if (event.tag === "refresh-push-schedule") {
    event.waitUntil(refreshPushSchedule());
  }
});

async function refreshPushSchedule() {
  try {
    const cache = await caches.open(PUSH_CTX_CACHE);
    const res = await cache.match("./__push-ctx");
    if (!res) return;
    const ctx = await res.json();
    if (!ctx || !ctx.serverUrl) return;

    const subscription = await self.registration.pushManager.getSubscription();
    if (!subscription) return;

    const schedule = (typeof buildNotificationSchedule === "function")
      ? buildNotificationSchedule(ctx, 7) : [];
    if (!schedule.length) return; // disabled or no location — nothing to refresh

    await fetch(`${ctx.serverUrl}/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription,
        userId: ctx.userId,
        tzOffset: new Date().getTimezoneOffset(),
        schedule
      })
    });
    console.log(`🔄 periodicsync: schedule refreshed (${schedule.length} events)`);
  } catch (e) {
    console.warn("periodicsync refresh failed:", e.message);
  }
}

// ===== Push notification receive =====
self.addEventListener("push", event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "🔔 Zad Al-Muslim", body: "تذكير جديد" };
  }

  const notificationData = data.data || {};
  const targetUrl = notificationData.url || DEEP_LINKS[notificationData.type] || DEEP_LINKS.default;

  // Contextual primary action — the schedule tags double as the type
  // (prayer-fajr, pre-asr, azkar-morning, friday-kahf, …).
  const type = notificationData.type || data.tag || "default";
  let openTitle = "فتح";
  if (type.startsWith("azkar")) openTitle = "📿 اقرأ الأذكار";
  else if (type.startsWith("prayer") || type.startsWith("pre-")) openTitle = "🕌 مواقيت الصلاة";
  else if (type.includes("kahf")) openTitle = "📖 اقرأ سورة الكهف";

  const options = {
    body: data.body || "زاد المسلم",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    vibrate: [200, 100, 200],
    tag: data.tag || "zad-muslim",
    renotify: true,
    data: {
      url: targetUrl,
      type: type
    },
    actions: [
      { action: "open", title: openTitle },
      { action: "dismiss", title: "إغلاق" }
    ]
  };

  console.log("📨 Push received:", data.title);
  event.waitUntil(
    self.registration.showNotification(data.title || "🔔 Zad Al-Muslim", options)
  );
});

// ===== Notification click handler =====
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

console.log("✅ Service Worker v55 loaded");
