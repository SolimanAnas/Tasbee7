// js/notifications.js - FIXED v4.1
// Islamic Notification System — Local Mode with Push Support

// Verbose logging only when the user opts in: localStorage.setItem('debug', '1').
// warn/error always pass through.
const dlog = (() => {
  let on = false;
  try { on = localStorage.getItem('debug') === '1'; } catch (e) {}
  return on ? console.log.bind(console) : () => {};
})();

const NotificationSystem = {

  // ========== CONFIG ==========
  config: {
    serverUrl: 'https://zad-push-server.solimananas2012.workers.dev',
    // Offline fallback only — the authoritative key is fetched from
    // GET /vapidPublicKey at subscribe time and validated (see getVapidKey).
    vapidPublicKey: 'BFBoJ96GEU6t_hIBX_MaWHQRTSdChk2yA78dDNcQuNyXfiL2gFVnyRsrZW5d1kO5aEY2oCkafBQHX7kRU3tS1Y',
    quietHoursStart: 23,
    quietHoursEnd: 5,
    preReminderMinutes: 10
  },

  // ========== SUPPORT CHECK ==========
  get isSupported() {
    return ('Notification' in window) && ('serviceWorker' in navigator);
  },

  // ========== SETTINGS ==========
  settings: {
    enabled: true,
    prayerTimes: true,
    azkarMorning: true,
    azkarEvening: true,
    fridayKahf: true,
    preReminders: true,
    quietHours: true,
    autoLocation: true,
    streakReminders: true,   // FIX: was missing — caused toggle in notifications.html to break
    pushEnabled: false
  },

  // ========== STATE ==========
  state: {
    userId: null,
    subscribed: false,
    triggers: {},
    streak: 0,
    lastActive: null,
    lastScheduleUpload: 0,  // last successful /subscribe upload (epoch ms)
    lastScheduleCount: 0    // events the server holds from that upload
  },

  // Default prayer times (fallback when no location available)
  defaultTimes: {
    fajr:    { hour: 5,  minute: 0,  name: 'الفجر'  },
    dhuhr:   { hour: 12, minute: 30, name: 'الظهر'  },
    asr:     { hour: 15, minute: 30, name: 'العصر'  },
    maghrib: { hour: 18, minute: 30, name: 'المغرب' },
    isha:    { hour: 20, minute: 0,  name: 'العشاء' }
  },

  // FIX: DO NOT spread defaultTimes here — 'this' is undefined in object literals.
  // prayerTimes is initialized inside init() instead.
  prayerTimes: null,
  swRegistration: null,
  checkInterval: null,

  // ========== INIT ==========
  // Local-first: the device computes prayer times (adhan.js) and shows
  // notifications via the Service Worker on a schedule. This works offline and
  // needs no server. Web-push is layered on top as a *best-effort* subscription
  // so the server can deliver admin/broadcast messages — it never replaces the
  // local scheduler and never fires per-event self-broadcasts.
  async init() {
    dlog('🔔 Initializing Notification System v4.2 (local-first)...');

    // FIX: Initialize prayerTimes here where 'this' is valid
    if (!this.prayerTimes) {
      this.prayerTimes = { ...this.defaultTimes };
    }

    if (!this.isSupported) {
      console.warn('⚠️ Notifications not supported in this browser');
      return;
    }

    this.generateUserId();
    this.loadState();

    // FIX: Attach to existing SW instead of re-registering (index.html already registers)
    await this.attachServiceWorker();

    // Local scheduling is the source of truth — always compute times + run checks.
    await this.initLocalMode();

    // Best-effort push subscription (additive; for server/admin broadcasts only).
    if (this.config.serverUrl && this.swRegistration && Notification.permission === 'granted') {
      this.subscribeToPush().catch(err => console.warn('⚠️ Push subscribe skipped:', err.message));
    }

    this.updateStreak();
    dlog('✅ Notification System ready');

    // Let UI pages (notifications.html) re-render once async init has real
    // data — they run their first render before prayer times are computed.
    try { window.dispatchEvent(new CustomEvent('notifications:ready')); } catch (e) {}
  },

  // ========== SERVICE WORKER ==========
  // FIX: Don't register a new SW. Reuse the existing registration from index.html.
  async attachServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      // Reuse existing registration if present
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length > 0) {
        this.swRegistration = registrations[0];
      } else {
        // Register only if no SW exists yet (e.g., notifications.html opened directly)
        this.swRegistration = await navigator.serviceWorker.register(
          new URL('../sw.js', window.location.href).href
        );
      }

      // Wait for SW to be active and controlling
      await navigator.serviceWorker.ready;

      // Authoritative subscription state (clears a stale `true` if the user revoked it,
      // which would otherwise make the local scheduler wrongly defer to the server).
      const existingSub = await this.swRegistration.pushManager.getSubscription();
      this.state.subscribed = !!existingSub;

      dlog('✅ SW attached, scope:', this.swRegistration.scope);
    } catch (err) {
      console.error('❌ SW attachment failed:', err);
      this.swRegistration = null;
    }
  },

  // ========== PUSH SUBSCRIPTION + SERVER SCHEDULE ==========
  // Subscribes this device and uploads a precomputed ~7-day notification schedule
  // so the server's cron can deliver prayer/azkar notifications even when the app
  // is fully closed. The server does no prayer-time math — it just fires what we
  // send it at the right moment (see server/cloudflare.js dispatchDue).
  async subscribeToPush() {
    if (!this.swRegistration) throw new Error('no service worker');

    const vapidKey = await this.getVapidKey();
    if (!vapidKey) throw new Error('no usable VAPID key (server unreachable, bundled fallback invalid)');
    const vapidKeyBytes = this.urlBase64ToUint8Array(vapidKey);

    let subscription = await this.swRegistration.pushManager.getSubscription();

    // A subscription bound to a different VAPID key is dead weight: the push
    // service rejects everything the server signs (403). Resubscribe cleanly.
    if (subscription && subscription.options && subscription.options.applicationServerKey) {
      const current = new Uint8Array(subscription.options.applicationServerKey);
      const matches = current.length === vapidKeyBytes.length &&
        current.every((b, i) => b === vapidKeyBytes[i]);
      if (!matches) {
        console.warn('⚠️ Existing push subscription uses a stale VAPID key — resubscribing');
        await subscription.unsubscribe().catch(() => {});
        subscription = null;
      }
    }

    if (!subscription) {
      subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKeyBytes
      });
    }

    this.state.subscribed = true;
    this.settings.pushEnabled = true;
    this.saveState();
    await this.uploadSchedule(subscription);
  },

  // Server key first (authoritative — it's the one the worker signs with),
  // bundled key as offline fallback. Either way the key must be a valid
  // uncompressed P-256 point (65 bytes, 0x04 prefix) or subscribe() throws.
  async getVapidKey() {
    try {
      const res = await fetch(`${this.config.serverUrl}/vapidPublicKey`);
      const data = await res.json();
      if (data && this.isValidVapidKey(data.key)) return data.key;
    } catch (e) { /* offline / server down — try the bundled key */ }
    return this.isValidVapidKey(this.config.vapidPublicKey) ? this.config.vapidPublicKey : null;
  },

  isValidVapidKey(key) {
    if (typeof key !== 'string' || !key) return false;
    try {
      const bytes = this.urlBase64ToUint8Array(key);
      return bytes.length === 65 && bytes[0] === 0x04;
    } catch (e) {
      return false;
    }
  },

  // Push the current device's subscription + freshly built schedule to the server.
  // Safe to call anytime: no-op when there's no server / SW / active subscription.
  async uploadSchedule(subscription) {
    if (!this.config.serverUrl || !this.swRegistration) return;
    subscription = subscription || await this.swRegistration.pushManager.getSubscription();
    if (!subscription) return;

    const schedule = this.buildSchedule(7);
    try {
      const res = await fetch(`${this.config.serverUrl}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription,
          userId: this.state.userId,
          tzOffset: new Date().getTimezoneOffset(),
          schedule
        })
      });
      const result = await res.json().catch(() => ({}));
      if (result.success) {
        // Record what the server now holds — checkAndNotify only defers to the
        // server while this is fresh and non-empty (see serverScheduleActive).
        this.state.lastScheduleUpload = Date.now();
        this.state.lastScheduleCount = schedule.length;
        this.saveState();
        // Let the SW refresh this schedule from periodicsync while the app is closed.
        await this.persistScheduleContext();
        await this.registerPeriodicSync();
        dlog(`✅ Schedule uploaded to server (${schedule.length} events)`);
      }
    } catch (e) {
      console.warn('⚠️ Schedule upload failed:', e.message);
    }
  },

  // True while the server holds a usable schedule for this device: the last
  // upload succeeded, contained events, and hasn't outlived its 7-day horizon.
  // If this is false the local scheduler must keep firing — otherwise a failed
  // or empty upload silences notifications entirely.
  serverScheduleActive() {
    const SCHEDULE_HORIZON_MS = 7 * 24 * 3600 * 1000;
    return (this.state.lastScheduleCount || 0) > 0 &&
           (Date.now() - (this.state.lastScheduleUpload || 0)) < SCHEDULE_HORIZON_MS;
  },

  // Snapshot of everything the schedule builder needs. Also persisted to the
  // push-ctx cache so the service worker can rebuild the schedule from
  // periodicsync while the app is closed (localStorage is page-only).
  scheduleContext() {
    return {
      settings: this.settings,
      lat: localStorage.getItem('prayer_lat'),
      lng: localStorage.getItem('prayer_lng'),
      calcMethod: localStorage.getItem('calcMethod') || 'UAE',
      quietHoursStart: this.config.quietHoursStart,
      quietHoursEnd: this.config.quietHoursEnd,
      preReminderMinutes: this.config.preReminderMinutes,
      serverUrl: this.config.serverUrl,
      userId: this.state.userId
    };
  },

  // Build absolute-time notification events for the next `days` days.
  // Delegates to the shared builder (js/schedule-builder.js) — the same code
  // the service worker runs on periodicsync. Returns [] if we can't compute
  // prayers (no location / adhan.js missing) — the server then has nothing to fire.
  buildSchedule(days = 7) {
    if (typeof buildNotificationSchedule !== 'function') return [];
    return buildNotificationSchedule(this.scheduleContext(), days);
  },

  // Persist the schedule context where the SW can read it (Cache API is the
  // only storage both contexts share without IDB ceremony).
  async persistScheduleContext() {
    try {
      const cache = await caches.open('push-ctx-v1');
      await cache.put('./__push-ctx', new Response(
        JSON.stringify(this.scheduleContext()),
        { headers: { 'Content-Type': 'application/json' } }
      ));
    } catch (e) { /* cache unavailable — periodicsync refresh just won't run */ }
  },

  // Ask the browser to wake the SW ~daily so it can re-upload a fresh 7-day
  // schedule even if the user never opens the app (closes the "pushes stop
  // after 7 days" gap). Chromium-only; silently unsupported elsewhere.
  async registerPeriodicSync() {
    try {
      if (!this.swRegistration || !('periodicSync' in this.swRegistration)) return;
      const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (status.state !== 'granted') return;
      await this.swRegistration.periodicSync.register('refresh-push-schedule', {
        minInterval: 24 * 60 * 60 * 1000
      });
      dlog('🔄 Periodic schedule refresh registered');
    } catch (e) { /* permission API or registration unsupported — fine */ }
  },

  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const output = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
    return output;
  },

  // ========== LOCAL MODE ==========
  async initLocalMode() {
    dlog('📱 Local notification mode active');

    // Request permission only if not yet decided (avoid double prompts)
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }

    await this.initAutoPrayerTimes();
    this._timesDate = new Date().toDateString(); // times are fresh for today; skip the first-tick recompute
    this.scheduleChecks();
  },

  // ========== PRAYER TIMES ==========
  async initAutoPrayerTimes() {
    // FIX: First try lat/lng already stored by index.html (prayer_lat, prayer_lng)
    const storedLat = localStorage.getItem('prayer_lat');
    const storedLng = localStorage.getItem('prayer_lng');

    if (storedLat && storedLng) {
      await this.fetchPrayerTimesByCoords(parseFloat(storedLat), parseFloat(storedLng));
      return;
    }

    // Try geolocation if autoLocation is enabled
    if (this.settings.autoLocation && navigator.geolocation) {
      try {
        const pos = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 6000 })
        );
        // Round to ~1 km: plenty for prayer times, much less of a fingerprint
        const lat = +pos.coords.latitude.toFixed(2);
        const lon = +pos.coords.longitude.toFixed(2);
        localStorage.setItem('prayer_lat', lat);
        localStorage.setItem('prayer_lng', lon);
        await this.fetchPrayerTimesByCoords(lat, lon);
        return;
      } catch (e) {
        console.warn('⚠️ Geolocation failed:', e.message);
      }
    }

    // Final fallback: cached city, or Cairo/Egypt
    const city = localStorage.getItem('userCity') || 'Cairo';
    const country = localStorage.getItem('userCountry') || 'Egypt';
    await this.fetchPrayerTimesByCity(city, country);
  },

  // Use adhan.js library (same as index.html) for consistent prayer times
  // Single source of truth for the calculation method: js/prayer-service.js
  // (madhab already set there).
  getAdhanMethod() {
    if (typeof adhan === 'undefined' || typeof PrayerService === 'undefined') return null;
    return PrayerService.method();
  },

  async fetchPrayerTimesByCoords(lat, lng) {
    try {
      const calcMethod = this.getAdhanMethod();
      if (!calcMethod) throw new Error('adhan.js not loaded');
      calcMethod.madhab = adhan.Madhab.Shafi;
      const coords = new adhan.Coordinates(lat, lng);
      const now = new Date();
      const pt = new adhan.PrayerTimes(coords, now, calcMethod);
      this.parseAdhanTimes(pt);
      dlog('✅ Prayer times calculated via adhan.js (coords)');
    } catch (err) {
      console.warn('⚠️ fetchPrayerTimesByCoords failed:', err.message);
      const saved = localStorage.getItem('prayerTimes');
      if (saved) {
        try { this.prayerTimes = { ...this.defaultTimes, ...JSON.parse(saved) }; } catch (e) {}
      }
    }
  },

  async fetchPrayerTimesByCity(city, country) {
    try {
      const calcMethod = this.getAdhanMethod();
      if (!calcMethod) throw new Error('adhan.js not loaded');
      calcMethod.madhab = adhan.Madhab.Shafi;
      // Look the city up in the bundled cities database when available;
      // otherwise fall back to Cairo (matches the declared default city).
      const known = (typeof cityCoordinatesMap !== 'undefined' && cityCoordinatesMap[city]) || null;
      const coords = known
        ? new adhan.Coordinates(known.lat, known.lng)
        : new adhan.Coordinates(30.0444, 31.2357);
      const now = new Date();
      const pt = new adhan.PrayerTimes(coords, now, calcMethod);
      this.parseAdhanTimes(pt);
      dlog(`✅ Prayer times calculated via adhan.js (${known ? 'city: ' + city : 'Cairo fallback'})`);
    } catch (err) {
      console.warn('⚠️ fetchPrayerTimesByCity failed:', err.message);
    }
  },

  async fetchPrayerTimes(city, country) {
    await this.fetchPrayerTimesByCity(city, country);
  },

  parseAdhanTimes(pt) {
    this.prayerTimes = {
      fajr:    { hour: pt.fajr.getHours(),    minute: pt.fajr.getMinutes(),    name: 'الفجر' },
      dhuhr:   { hour: pt.dhuhr.getHours(),   minute: pt.dhuhr.getMinutes(),   name: 'الظهر' },
      asr:     { hour: pt.asr.getHours(),     minute: pt.asr.getMinutes(),     name: 'العصر' },
      maghrib: { hour: pt.maghrib.getHours(), minute: pt.maghrib.getMinutes(), name: 'المغرب' },
      isha:    { hour: pt.isha.getHours(),    minute: pt.isha.getMinutes(),    name: 'العشاء' }
    };
    localStorage.setItem('prayerTimes', JSON.stringify(this.prayerTimes));
  },

  // ========== STATE ==========
  // Settings schema version — bumped to auto-fix corrupted localStorage from older buggy versions
  SETTINGS_VERSION: 2,

  generateUserId() {
    let id = localStorage.getItem('notificationUserId');
    if (!id) {
      id = 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
      localStorage.setItem('notificationUserId', id);
    }
    this.state.userId = id;
  },

  loadState() {
    try {
      const savedSettings = localStorage.getItem('notificationSettings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        // Version 1 (no _version field) may have corrupted enabled=false
        // Reset to true so scheduled notifications work again
        if (!parsed._version) {
          parsed.enabled = true;
          parsed._version = this.SETTINGS_VERSION;
        }
        this.settings = { ...this.settings, ...parsed };
      }

      const savedTimes = localStorage.getItem('prayerTimes');
      if (savedTimes) {
        this.prayerTimes = { ...this.defaultTimes, ...JSON.parse(savedTimes) };
      }

      const savedState = localStorage.getItem('notificationState');
      if (savedState) {
        this.state = { ...this.state, ...JSON.parse(savedState) };
      }
    } catch (e) {
      console.warn('⚠️ Failed to load state, starting fresh:', e);
    }
  },

  saveState() {
    const settingsToSave = { ...this.settings, _version: this.SETTINGS_VERSION };
    localStorage.setItem('notificationSettings', JSON.stringify(settingsToSave));
    localStorage.setItem('notificationState', JSON.stringify(this.state));
  },

  // ========== SHOW NOTIFICATION ==========
  async showNotification(title, options = {}) {
    this._lastError = null;

    if (options.forceEnable) {
      if (Notification.permission !== 'granted') { dlog('🔕 Notification permission not granted'); this._lastError = 'permission_denied'; return false; }
    } else {
      if (!this.settings.enabled) { dlog('🔇 Notifications disabled in settings'); this._lastError = 'settings_disabled'; return false; }
      if (this.isQuietHours() && !options.forceQuiet) { dlog('🌙 Quiet hours active, notification blocked'); this._lastError = 'quiet_hours'; return false; }
      if (Notification.permission !== 'granted') { dlog('🔕 Notification permission not granted'); this._lastError = 'permission_denied'; return false; }
    }

    // Only use fields supported by both SW showNotification and Notification constructor
    const notifOptions = {
      body: options.body || '',
      icon: options.icon || './icons/icon-192.png',
      tag: options.tag || 'zad-muslim',
      data: options.data || { url: './index.html' },
      vibrate: options.vibrate || [200, 100, 200],
    };

    let swError = null;

    try {
      const reg = this.swRegistration || await navigator.serviceWorker.ready;
      if (!reg) throw new Error('لا يوجد Service Worker مسجل');
      this.swRegistration = reg;

      // Wait for an active, activated worker. `navigator.serviceWorker.ready`
      // guarantees this eventually, but there can be a brief race where the
      // registration exists with no active worker yet. Retry a few times
      // before giving up.
      for (let attempt = 0; attempt < 30; attempt++) {
        if (reg.active && reg.active.state === 'activated') break;
        await new Promise(r => setTimeout(r, 100));
      }

      if (reg.active) {
        await reg.showNotification(title, notifOptions);
        dlog('🔔 Notification sent via SW:', title);
        return true;
      }
      throw new Error('لا يوجد Service Worker نشط');
    } catch (err) {
      swError = err.message;
      console.warn('⚠️ SW notification failed:', err.message);

      // Fallback: use the Notification constructor with only the subset of
      // properties it actually supports.  Properties like badge, renotify,
      // actions, and vibrate are SW-only — passing them to new Notification()
      // throws "Illegal constructor" in some browser contexts.
      try {
        const safeOptions = { body: notifOptions.body, icon: notifOptions.icon };
        const n = new Notification(title, safeOptions);
        dlog('🔔 Notification sent via Notification API:', title);
        setTimeout(() => n.close(), 5000);
        return true;
      } catch (e2) {
        console.error('❌ All notification methods failed:', e2);
        this._lastError = swError;
        return false;
      }
    }
  },

  // ========== QUIET HOURS ==========
  isQuietHours() {
    if (!this.settings.quietHours) return false;
    const h = new Date().getHours();
    return h >= this.config.quietHoursStart || h < this.config.quietHoursEnd;
  },

  // ========== CONTEXT HELPERS ==========
  getContext() {
    const now = new Date();
    const h = now.getHours();
    return {
      isFriday:  now.getDay() === 5,
      isRamadan: now.getMonth() === 3 || now.getMonth() === 4,
      isMorning: h >= 4 && h < 8,
      isEvening: h >= 15 && h < 18
    };
  },

  // ========== TRIGGER ENGINE ==========
  shouldTrigger(key) {
    return this.state.triggers[key] !== new Date().toDateString();
  },

  markTriggered(key) {
    this.state.triggers[key] = new Date().toDateString();
    this.saveState();
  },

  // ========== SCHEDULING ==========
  // How many minutes after a scheduled moment we'll still fire it. The check
  // runs every 30s, so a small grace window absorbs ticks that land slightly
  // late or brief device sleeps — without re-firing prayers from earlier today.
  GRACE_MINUTES: 2,

  scheduleChecks() {
    if (this.checkInterval) clearInterval(this.checkInterval);
    this.checkInterval = setInterval(() => this.checkAndNotify(), 30000); // every 30s
    this.checkAndNotify(); // run immediately on init
  },

  // True when `currentTime` is within [start, start + GRACE] minutes.
  _withinWindow(currentTime, start) {
    return currentTime >= start && currentTime <= start + this.GRACE_MINUTES;
  },

  async checkAndNotify() {
    if (!this.settings.enabled) return;

    const now = new Date();
    const today = now.toDateString();

    // Recompute prayer times when the day rolls over (e.g. app left open overnight).
    if (this._timesDate !== today) {
      this._timesDate = today;
      await this.refreshPrayerTimes();
    }

    const currentTime = now.getHours() * 60 + now.getMinutes();
    const ctx = this.getContext();

    // When subscribed to push AND the server actually holds a fresh schedule,
    // the server's cron owns prayer/azkar/Kahf delivery (it works in the
    // background too) — skip them locally to avoid duplicates. If the upload
    // failed or expired, local delivery takes over. Streak reminders always
    // stay local: the server can't know today's activity.
    const pushActive = this.state.subscribed && this.settings.pushEnabled && this.serverScheduleActive();

    // Prayer time notifications
    if (!pushActive && this.settings.prayerTimes) {
      this.checkPrayerTimes(currentTime);
    }

    // Morning azkar reminder (4–8 AM)
    if (!pushActive && this.settings.azkarMorning && ctx.isMorning && this.shouldTrigger('azkar-morning')) {
      this.showNotification('🌅 أذكار الصباح', {
        body: 'اللهم بك أصبحنا — ابدأ يومك بالأذكار',
        tag: 'azkar-morning',
        data: { url: './pages/azkar.html?type=morning', type: 'azkar' }
      });
      this.markTriggered('azkar-morning');
    }

    // Evening azkar reminder (3–6 PM)
    if (!pushActive && this.settings.azkarEvening && ctx.isEvening && this.shouldTrigger('azkar-evening')) {
      this.showNotification('🌙 أذكار المساء', {
        body: 'اللهم بك أمسينا — اختتم يومك بالأذكار',
        tag: 'azkar-evening',
        data: { url: './pages/azkar.html?type=night', type: 'azkar' }
      });
      this.markTriggered('azkar-evening');
    }

    // Friday Kahf reminder (6–10 AM on Friday)
    if (!pushActive && this.settings.fridayKahf && ctx.isFriday &&
        now.getHours() >= 6 && now.getHours() < 10 &&
        this.shouldTrigger('friday-kahf')) {
      this.showNotification('🕋 يوم الجمعة المبارك', {
        body: 'لا تنسَ قراءة سورة الكهف اليوم',
        tag: 'friday-kahf',
        data: { url: './pages/quran.html?surah=18', type: 'kahf' }
      });
      this.markTriggered('friday-kahf');
    }

    // Streak reminder (after 8 PM if not active today)
    if (this.settings.streakReminders &&
        now.getHours() >= 20 &&
        this.state.lastActive !== today &&
        this.shouldTrigger('streak-reminder')) {
      this.showNotification('🔥 حافظ على استمراريتك!', {
        body: `لديك ${this.state.streak} يوم متتالي — لا تكسر السلسلة`,
        tag: 'streak-reminder',
        data: { url: './index.html', type: 'default' }
      });
      this.markTriggered('streak-reminder');
    }
  },

  checkPrayerTimes(currentTime) {
    if (!this.prayerTimes) return;
    for (const [key, prayer] of Object.entries(this.prayerTimes)) {
      const prayerMin = prayer.hour * 60 + prayer.minute;

      // Pre-prayer reminder
      if (this.settings.preReminders &&
          this._withinWindow(currentTime, prayerMin - this.config.preReminderMinutes) &&
          this.shouldTrigger(`pre-${key}`)) {
        this.showNotification(`⏰ تذكير: ${prayer.name}`, {
          body: `باقي ${this.config.preReminderMinutes} دقائق على أذان ${prayer.name}`,
          tag: `pre-${key}`,
          data: { url: './index.html', type: 'prayer' }
        });
        this.markTriggered(`pre-${key}`);
      }

      // Prayer time notification — bypasses quiet hours so the adhan (incl. Fajr) is never silenced
      if (this._withinWindow(currentTime, prayerMin) && this.shouldTrigger(key)) {
        this.showNotification(`🕌 حان وقت ${prayer.name}`, {
          body: `الآن وقت صلاة ${prayer.name} — حي على الصلاة`,
          tag: `prayer-${key}`,
          forceQuiet: true,
          data: { url: './index.html', type: 'prayer' }
        });
        this.markTriggered(key);
      }
    }
  },

  // ========== STREAK ==========
  updateStreak() {
    const today = new Date().toDateString();
    if (this.state.lastActive === today) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (this.state.lastActive === yesterday.toDateString()) {
      this.state.streak = (this.state.streak || 0) + 1;
    } else {
      this.state.streak = this.state.lastActive ? 1 : (this.state.streak || 1);
    }

    this.state.lastActive = today;
    this.saveState();
  },

  // ========== PUBLIC API ==========
  toggleSetting(key, value) {
    if (key in this.settings) {
      this.settings[key] = value;
      this.saveState();
      dlog(`🔧 Setting '${key}' → ${value}`);
      // Settings change what should be pushed — refresh the server's schedule.
      this.uploadSchedule();
    }
  },

  // FIX: Prefer prayer_lat/prayer_lng (index.html coords) over city names
  async refreshPrayerTimes() {
    const lat = localStorage.getItem('prayer_lat');
    const lng = localStorage.getItem('prayer_lng');

    if (lat && lng) {
      await this.fetchPrayerTimesByCoords(parseFloat(lat), parseFloat(lng));
    } else {
      const city = localStorage.getItem('userCity') || 'Cairo';
      const country = localStorage.getItem('userCountry') || 'Egypt';
      await this.fetchPrayerTimesByCity(city, country);
    }
    // New times/location → re-upload the schedule so background push stays accurate.
    this.uploadSchedule();
  },

  // ========== DEBUG ==========
  async checkStatus() {
    const status = {
      supported:    this.isSupported,
      permission:   Notification.permission,
      swRegistered: !!this.swRegistration,
      subscribed:   this.state.subscribed,
      pushEnabled:  this.settings.pushEnabled,
      prayerTimes:  this.prayerTimes,
      settings:     this.settings,
      streak:       this.state.streak,
      coords:       {
        lat: localStorage.getItem('prayer_lat'),
        lng: localStorage.getItem('prayer_lng')
      }
    };
    console.table(status);
    return status;
  },

  // Local test only — never hits the server's broadcast endpoint (which would
  // notify every subscribed device, not just this one).
  testPush() {
    return this.showNotification('🧪 اختبار الإشعارات', {
      body: 'نظام الإشعارات يعمل بكفاءة! ✅',
      tag: 'test',
      forceEnable: true,
      forceQuiet: true,
      data: { url: './index.html', type: 'test' }
    });
  }
};

// ========== AUTO INIT ==========
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => NotificationSystem.init());
} else {
  NotificationSystem.init();
}

// ========== DEBUG CONSOLE API ==========
window.NotificationDebug = {
  status:   () => NotificationSystem.checkStatus(),
  test:     () => NotificationSystem.testPush(),
  times:    () => NotificationSystem.prayerTimes,
  settings: () => NotificationSystem.settings,
  state:    () => NotificationSystem.state
};
