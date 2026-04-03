const CACHE_NAME = "zad-muslim-v2"; // تم رفع الإصدار لتحديث الكاش القديم

// استخدمنا المسارات النسبية (./) لتعمل بشكل مثالي على GitHub Pages وأي استضافة
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
  // أضف هنا أي ملفات أخرى أساسية مثل صور الخلفيات أو الأيقونات إذا أردت عملها أوفلاين
];

/* INSTALL */
self.addEventListener("install", event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("Caching static assets...");
      // نستخدم catch لضمان أنه إذا فشل ملف واحد (مثل صورة محذوفة) لا يفشل الـ SW بالكامل
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.error("تحذير: بعض الملفات في STATIC_ASSETS غير موجودة", err);
      });
    })
  );
});

/* ACTIVATE */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          // ⚠️ خطوة حرجة: استثنينا كاش "quran-offline-v1" لمنع حذفه!
          .filter(key => key !== CACHE_NAME && !key.startsWith("quran-offline"))
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

  /* Do NOT cache radio/audio streams in the main static cache */
  if (
    url.hostname.includes("mp3quran") ||
    url.hostname.includes("archive.org") ||
    url.hostname.includes("radiojar") ||
    url.pathname.endsWith(".mp3") ||
    url.pathname.endsWith(".m3u8")
  ) {
    // نترك المتصفح يتعامل معها، أو كاش المصحف المخصص سيلتقطها إن كانت محملة
    return;
  }

  /* HTML → Network First (لجلب التحديثات فوراً، مع العودة للكاش في حال انقطاع النت) */
  if (req.headers.get("accept").includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return res;
        })
        .catch(() => {
          // إذا انقطع الإنترنت، حاول جلب الصفحة من الكاش
          return caches.match(req).then(cachedRes => {
            // إذا لم يجد الصفحة (مثلاً فتح رابط خاطئ)، قم بتحويله للصفحة الرئيسية أوفلاين
            return cachedRes || caches.match("./index.html"); 
          });
        })
    );
    return;
  }

  /* Static files → Cache First (لتحميل أسرع وتوفير البيانات) */
  event.respondWith(
    caches.match(req).then(cacheRes => {
      return (
        cacheRes ||
        fetch(req).then(networkRes => {
          // نتأكد من أن الاستجابة صالحة قبل حفظها في الكاش لتجنب حفظ صفحات الخطأ
          if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
            const copy = networkRes.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          }
          return networkRes;
        }).catch(err => console.log("Offline fetch fallback:", req.url))
      );
    })
  );

});
