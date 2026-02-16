const CACHE_NAME = 'masbaha-v3'; // تغيير الرقم يجبر الهاتف على التحديث
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.png'
];

// 1. Install Event: تحميل الملفات للكاش
self.addEventListener('install', (e) => {
  // هذا السطر مهم جداً: يجبر المتصفح على تفعيل الخدمة الجديدة فوراً
  self.skipWaiting(); 
  
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// 2. Activate Event: تنظيف الكاش القديم
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  // السيطرة على الصفحة فوراً بدون إعادة تحميل
  return self.clients.claim(); 
});

// 3. Fetch Event: تشغيل التطبيق أوفلاين
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      // إذا وجد الملف في الكاش يرجعه، وإلا يطلبه من الإنترنت
      return response || fetch(e.request);
    })
  );
});
