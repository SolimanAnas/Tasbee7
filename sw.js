const CACHE_NAME = "zad-muslim-v100"; // v100: all pages load Tajawal + Amiri from bundled fonts via css/fonts.css (no Google Fonts); v99: azkar.html loads Amiri from the bundled fonts/Amiri.ttf (was Google-Fonts-only, fell back to a system font); v98: video maker self-heals a stale cached script (multi-picture switch did nothing with old video-maker.js); v97: video maker multi-picture slideshow (pan/zoom per picture, crossfades on ayah changes); v96: new dark-theme background (images/Background-dark.webp, now used by index.html too); v95: audio island drag-to-dismiss (drop on the bottom ✕ to stop and hide the floating player); v94: video maker "✦ Popular" quick-pick sheet (js/popular-ayat.js); v93: video maker exports a regular fast-start MP4 (MediaRecorder fragmented MP4 showed ~3 s in galleries/WhatsApp); v92: video maker redesign (numbered step cards, searchable surah/reciter sheets, steppers, switches, full-screen preview, Scheherazade canvas font, share caption); v91: ayah video maker (pages/video-maker.html — canvas + MediaRecorder status clips); v90: offline download runs in the page via CacheStorage (fixes wrapped PWA/TWA where the SW message path failed), keeps sw.js as single source for assets + cache name; v89: radio station selector card restored below the player (no pill), page padding trimmed so it still fits without scrolling; v88: radio player fits one screen (art scales with height, stations pill), tap art to pause motion, station title no longer overwritten by late i18n; v87: Sharjah radio via audio-only AAC (itworkscdn) with HLS fallbacks, per-station stream candidates, itworkscdn streams bypass the SW; v86: radio.html UX overhaul (categories, auto-reconnect with host fallback, prev/next, sleep timer, continuous host) + 10 wrong station streams fixed; live radio streams bypass the SW; v85: continuous audio — pages open in a frame over audio.html with a floating island player (js/continuous-player.js), setting in audio.html + index.html; v84: audio.html UX (no silent skip on load/offline, inline error + retry, buffering ring, rich searchable lists, lock-screen seek) + 40 dead audio links fixed/removed in audio-01.json; v83: hadith-viewer RTL swipe (finger → right = next chapter, like duaa/hisn), hadith search ignores invisible RLM marks, viewer shows full result count + "show more", hadith.html scrolls results into view; v82: qibla tilt-compensated heading (back-camera bearing when upright), ignore relative-only orientation, calibration "done" no longer exits the page (BackClose.swap); v81: takrar unit labels strip the basmala + quote the opening, readable selected rows; v80: takrar settings sheet, first-open preferences, ayah-opening unit labels, language button; v79: takrar redesign (player dock, 46 reciters, infinite range loop) + new i18n keys; v78: let GitHub release audio bypass the SW (range requests via SW broke seeking); v77: Minshawi new murattal tracks moved to GitHub release + clean track names; v76: harden offline modal — reply timeouts + graceful recovery when an old SW still controls after update; v75: drop ?v= cache-buster from audio pages, strip dead CSS; v74: unified offline-download.js controller; v73: precache quran-v2 + audio/radio JSONs, hadith books on-demand, ZAD_CACHE_ALL handler
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
  "./pages/quran_v2.html",
  "./pages/quran-v2.html",
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
  "./pages/privacy.html",
  "./pages/tasmee-dashboard.html",
  "./pages/tasmee-review.html",
  "./pages/hadith-viewer.html",
  "./pages/salah.html",
  "./pages/sleeping.html",
  "./pages/audio-download.html",
  "./pages/audio2.html",
  "./pages/audio3.html",
  "./pages/radio2.html",
  "./pages/video.html",
  "./pages/video-maker.html",

  // ===== Config =====
  "./manifest.json",

  // ===== Styles =====
  "./css/style.css",
  "./css/svg-theme.css",
  "./css/fonts.css",
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
  "./js/back-close.js",
  "./js/continuous-player.js",
  "./js/sw-update.js",
  "./js/offline-download.js",
  "./js/pwa-install.js",
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
  "./js/reciters.js",
  "./js/video-maker.js",
  "./js/mp4-faststart.js",
  "./js/popular-ayat.js",
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
  "./js/quran/tasmee-pro-v3.js",
  "./js/quran/tasmee-dashboard.js",
  "./js/quran/tasmee-review.js",
  "./js/quran/local-search.js",
  "./js/quran/ui-extras.js",

  // ===== Offline Quran text (word-by-word Tasmee) =====
  "./data/quran.json",
  "./data/vocab.json",
  "./json/medina2_coords.json",

  // ===== Audio / radio track indexes (small JSON — needed by audio & radio pages) =====
  "./json/audio-01.json",
  "./json/audio-02.json",
  "./json/radio-01.json",

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
  "./assets/hisn_complete.json",
  "./assets/salah.json",
  "./assets/sleeping-zikr.json",
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
  "./assets/hadith/Index-translated.json",
  "./assets/hadith/rand-hadith.json",

  // ===== Icons (incl. every size/purpose referenced by manifest.json) =====
  "./icons/icon-192.png",
  "./icons/icon_512.png",
  "./icons/icon-512-maskable.png",
  "./icons/icon_1024.png",
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
  "./images/album.png",

  // ===== PWA install / splash screenshots (manifest.json) =====
  "./poster.webp",
  "./poster-wide.webp",

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
  "./img/SVG/books.svg",
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
  "./img/SVG/x-circle.svg",
  "./img/SVG/zap.svg"
];

// ===== Optional heavy content (NOT precached on install) =====
// The full hadith books total ~58 MB. Forcing every visitor to download that
// on first load would make the SW install slow and waste storage for users who
// never open the hadith section. Instead they are fetched on demand — either
// lazily when a book is first opened (the fetch handler caches them), or in bulk
// via the "Download for offline" modal in index.html (ZAD_CACHE_ALL message).
const OPTIONAL_ASSETS = [
  "./assets/hadith/bukhari.json",
  "./assets/hadith/muslim.json",
  "./assets/hadith/abudawud.json",
  "./assets/hadith/tirmidhi.json",
  "./assets/hadith/nasai.json",
  "./assets/hadith/ibnmajah.json",
  "./assets/hadith/riyad_assalihin.json",
  "./assets/hadith/bulugh_almaram.json",
  "./assets/hadith/mishkat_almasabih.json",
  "./assets/hadith/aladab_almufrad.json",
  "./assets/hadith/shamail_muhammadiyah.json",
  "./assets/hadith/nawawi40.json",
  "./assets/hadith/qudsi40.json"
];

// Everything the "Download for offline" modal pulls: the full app shell plus the
// heavy books. Kept here so sw.js stays the single source of truth for what a
// complete offline install contains.
const FULL_OFFLINE_ASSETS = STATIC_ASSETS.concat(OPTIONAL_ASSETS);

// ===== Cross-origin runtime dependencies =====
// The app pulls a few libraries and web-fonts from CDNs. These can't be
// listed in STATIC_ASSETS the same way (opaque/cors), and the previous
// fetch handler only cached same-origin ("basic") responses — so anything
// from these hosts silently failed offline. We now cache them at runtime
// (cache-first) so every important page works fully offline after one visit.
const CACHEABLE_CDN_HOSTS = [
  "fonts.googleapis.com",   // @font-face CSS (Tajawal / Amiri)
  "fonts.gstatic.com",      // the actual font files referenced by that CSS
  "cdnjs.cloudflare.com",   // sql.js (offline Quran / tafsir / mushaf DBs)
  "cdn.jsdelivr.net"        // hls.js (radio player)
];

function isCacheableCrossOrigin(url) {
  return CACHEABLE_CDN_HOSTS.some(h => url.hostname === h || url.hostname.endsWith("." + h));
}

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
        keys.filter(key => key !== CACHE_NAME && key !== AUDIO_CACHE && key !== PUSH_CTX_CACHE && !key.startsWith("quran-offline") && !key.startsWith("quran-pages") && !key.startsWith("quran-mushaf") && !key.startsWith("tarteel-model"))
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

  // --- GitHub release audio: leave to the browser ---
  // Release downloads redirect to short-lived signed URLs on the asset hosts,
  // and the browser then sends range requests to those directly. Answered from
  // the SW they come back opaque (so never cached) and seeking breaks playback.
  if ((url.hostname === "github.com" && url.pathname.includes("/releases/download/")) ||
      url.hostname === "release-assets.githubusercontent.com" ||
      url.hostname === "objects.githubusercontent.com") {
    return;
  }

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
  // Live radio streams never end and can't be cached: let the browser talk to
  // the stream hosts directly instead of piping them through the SW.
  if (url.hostname === "qurango.net" || url.hostname.endsWith(".qurango.net") ||
      url.hostname.endsWith(".itworkscdn.net") ||
      url.hostname === "quran-stream-proxy.solimananas2012.workers.dev") {
    return;
  }

  if (url.hostname.includes("api.alquran.cloud") ||
      url.pathname.endsWith(".m3u8") ||
      url.pathname.endsWith(".onnx")) {
    return;
  }

  // --- HTML pages: stale-while-revalidate ---
  if (req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        // Exact match first, then ignoring the query string — notification
        // deep links like "pages/azkar.html?type=morning" would otherwise
        // miss the cache offline even though the page itself is precached.
        let cached = await cache.match(req);
        if (!cached) cached = await cache.match(req, { ignoreSearch: true });

        if (cached) {
          // Serve the cached copy immediately; revalidate in the background
          // with a single fetch (previously this path issued two).
          event.waitUntil(
            fetch(req).then(res => { if (res && res.ok) cache.put(req, res); }).catch(() => {})
          );
          return cached;
        }

        try {
          const res = await fetch(req);
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        } catch (e) {
          // Fully offline with nothing cached for this URL — show the
          // styled offline/404 page instead of a bare browser error.
          return (await cache.match("./404.html")) ||
            new Response("Offline", { status: 503, statusText: "Service Unavailable", headers: { "Content-Type": "text/plain" } });
        }
      })
    );
    return;
  }

  // --- Static assets: cache-first, network fallback ---
  event.respondWith(
    // Exact match first, then ignore the query string. Some pages request
    // assets with a cache-busting suffix (e.g. json/audio-01.json?v=169…),
    // which would otherwise never match the precached copy and would fail
    // hard when offline.
    caches.match(req).then(exact => exact || caches.match(req, { ignoreSearch: true }))
      .then(cacheRes => cacheRes ||
      fetch(req).then(networkRes => {
        // Cache same-origin assets (basic) AND the allow-listed CDN/font
        // hosts. CDN <script>/<link>/font requests are no-cors, so they come
        // back "opaque" (status 0) — cache those too so the app's libraries
        // and web-fonts survive going offline after the first visit.
        const cacheable = networkRes && (
          (networkRes.status === 200 && networkRes.type === "basic") ||
          (isCacheableCrossOrigin(url) && (networkRes.ok || networkRes.type === "opaque")));
        if (cacheable) {
          const copy = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return networkRes;
      }).catch(() => new Response("Offline", { status: 503, statusText: "Service Unavailable", headers: { "Content-Type": "text/plain" } }))
    )
  );
});

// ===== Bulk offline download (driven by the modal in index.html) =====
// The page opens a MessageChannel and posts { type: "ZAD_CACHE_ALL" } (or
// "ZAD_CACHE_STATUS"). Progress and completion are reported back on the same
// port so the UI can render a live progress bar. Doing the fetching here keeps
// the full asset list in one place (sw.js) and lets downloads continue briefly
// even while the user navigates between the app's pages.
self.addEventListener("message", event => {
  const msg = event.data || {};
  const reply = m => {
    if (event.ports && event.ports[0]) event.ports[0].postMessage(m);
  };

  if (msg.type === "ZAD_CACHE_STATUS") {
    event.waitUntil(reportCacheStatus(reply));
    return;
  }

  if (msg.type === "ZAD_CACHE_ALL") {
    event.waitUntil(cacheAllOffline(reply));
    return;
  }

  // Legacy hook kept for any caller still asking the SW to activate immediately.
  if (msg.type === "SKIP_WAITING") self.skipWaiting();
});

async function reportCacheStatus(reply) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const results = await Promise.all(
      FULL_OFFLINE_ASSETS.map(async url => {
        const m = (await cache.match(url)) || (await cache.match(url, { ignoreSearch: true }));
        return m ? 1 : 0;
      })
    );
    const cached = results.reduce((a, b) => a + b, 0);
    reply({ type: "ZAD_CACHE_STATUS_RESULT", cached, total: FULL_OFFLINE_ASSETS.length });
  } catch (e) {
    reply({ type: "ZAD_CACHE_STATUS_RESULT", cached: 0, total: FULL_OFFLINE_ASSETS.length, error: e.message });
  }
}

async function cacheAllOffline(reply) {
  const cache = await caches.open(CACHE_NAME);
  const assets = FULL_OFFLINE_ASSETS;
  const total = assets.length;
  let done = 0;
  let failed = 0;
  let bytes = 0;

  reply({ type: "ZAD_CACHE_PROGRESS", done, total, failed, bytes });

  for (const url of assets) {
    try {
      // Reuse an already-cached copy instead of re-downloading it.
      let res = await cache.match(url);
      if (!res) {
        res = await fetch(url, { cache: "no-cache" });
        if (res && res.ok) {
          await cache.put(url, res.clone());
        } else {
          failed++;
        }
      }
      if (res) {
        const len = Number(res.headers.get("content-length"));
        if (!Number.isNaN(len) && len > 0) bytes += len;
      }
    } catch (_) {
      failed++;
    }
    done++;
    reply({ type: "ZAD_CACHE_PROGRESS", done, total, failed, bytes, url });
  }

  // Note: storage persistence must be requested from the page (Window context),
  // which the modal does before starting — StorageManager.persist() is not
  // available inside a service worker.
  reply({ type: "ZAD_CACHE_DONE", done, total, failed, bytes });
}

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

console.log("✅ Service Worker " + CACHE_NAME + " loaded");
