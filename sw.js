const CACHE_NAME = "zad-muslim-v3"; // تم رفع الإصدار

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
  "./manifest.json",
  "./css/style.css",
  "./js/quran-common.js",
  "./data/cities.js",
  "./data/adhan.js",
  "./assets/azkar.json",
  "./assets/azan.mp3"
];

/* INSTALL */
self.addEventListener("install", event => {
  self.skipWaiting(); // تفعيل السيرفيس وركر الجديد فوراً

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("Caching static assets...");
      
      // استخدام { cache: 'no-store' } يمنع المتصفح من تسليم نسخ قديمة من كاش المتصفح العادي
      // ويجبره على تحميل النسخ الأحدث من السيرفر مباشرة لتخزينها في السيرفيس وركر
      return Promise.all(
        STATIC_ASSETS.map(url => {
          return fetch(url, { cache: 'no-store' })
            .then(response => {
              if (!response.ok) throw new Error(`Failed to fetch ${url}`);
              return cache.put(url, response);
            })
            .catch(err => console.error(`تحذير: فشل تخزين ${url}`, err));
        })
      );
    })
  );
});

/* ACTIVATE */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          // ⚠️ استثناء كاش الصور والملفات الصوتية المحملة أوفلاين
          .filter(key => key !== CACHE_NAME && !key.startsWith("quran-offline"))
          .map(key => caches.delete(key))
      )
    )
  );

  return self.clients.claim(); // السيطرة على الصفحات المفتوحة فوراً
});

/* FETCH */
self.addEventListener("fetch", event => {
  const req = event.request;

  /* Ignore non-GET */
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  /* تجاهل البث الإذاعي والملفات الصوتية لعدم تكييشها في الكاش الأساسي */
  if (
    url.hostname.includes("mp3quran") ||
    url.hostname.includes("archive.org") ||
    url.hostname.includes("radiojar") ||
    url.pathname.endsWith(".mp3") ||
    url.pathname.endsWith(".m3u8")
  ) {
    return;
  }

  /* 1. HTML → Network First (لجلب التحديثات فوراً) */
  // استخدمنا req.mode === 'navigate' كشرط أكثر دقة لالتقاط تنقلات الصفحات
  if (req.mode === "navigate" || req.headers.get("accept").includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return res;
        })
        .catch(() => {
          // في حال انقطاع الإنترنت، جلب الصفحة المكيشة
          return caches.match(req).then(cachedRes => {
            return cachedRes || caches.match("./index.html"); 
          });
        })
    );
    return;
  }

  /* 2. Static files → Stale-While-Revalidate (السر في التحديثات السلسة) */
  event.respondWith(
    caches.match(req).then(cachedRes => {
      // إطلاق طلب جلب صامت في الخلفية لتحديث الملفات في الكاش
      const fetchPromise = fetch(req).then(networkRes => {
        if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
          const copy = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return networkRes;
      }).catch(err => console.log("Offline fetch fallback:", req.url));

      // إذا كان الملف موجوداً في الكاش، اعرضه فوراً (أداء صاروخي)
      // في نفس الوقت، سيتم تحديث الكاش في الخلفية عبر fetchPromise للمرة القادمة
      return cachedRes || fetchPromise;
    })
  );
});
