// js/notifications.js - FIXED v4.1
// Islamic Notification System — Local Mode with Push Support

const NotificationSystem = {

  // ========== CONFIG ==========
  config: {
    serverUrl: 'https://zad-push-server.solimananas2012.workers.dev',
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
    lastActive: null
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
    console.log('🔔 Initializing Notification System v4.2 (local-first)...');

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
    console.log('✅ Notification System ready');
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

      console.log('✅ SW attached, scope:', this.swRegistration.scope);
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

    let subscription = await this.swRegistration.pushManager.getSubscription();
    if (!subscription) {
      let vapidKey = this.config.vapidPublicKey;
      try {
        const vapidRes = await fetch(`${this.config.serverUrl}/vapidPublicKey`);
        const data = await vapidRes.json();
        if (data && data.key) vapidKey = data.key;
      } catch (e) { /* fall back to bundled key */ }

      subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidKey)
      });
    }

    this.state.subscribed = true;
    this.settings.pushEnabled = true;
    this.saveState();
    await this.uploadSchedule(subscription);
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
      if (result.success) console.log(`✅ Schedule uploaded to server (${schedule.length} events)`);
    } catch (e) {
      console.warn('⚠️ Schedule upload failed:', e.message);
    }
  },

  // Build absolute-time notification events for the next `days` days from the
  // user's coordinates + current settings. Returns [] if we can't compute prayers
  // (no location / adhan.js missing) — the server then has nothing to fire.
  buildSchedule(days = 7) {
    const events = [];
    const lat = localStorage.getItem('prayer_lat');
    const lng = localStorage.getItem('prayer_lng');
    const method = this.getAdhanMethod();
    if (!lat || !lng || !method || typeof adhan === 'undefined') return events;

    method.madhab = adhan.Madhab.Shafi;
    const coords = new adhan.Coordinates(parseFloat(lat), parseFloat(lng));
    const now = Date.now();
    const prayers = [
      ['fajr', 'الفجر'], ['dhuhr', 'الظهر'], ['asr', 'العصر'],
      ['maghrib', 'المغرب'], ['isha', 'العشاء']
    ];

    // local wall-clock HH:MM on a given day → absolute epoch ms (client is in user's tz)
    const localTs = (day, h, m) =>
      new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0).getTime();
    const inQuiet = (ts) => {
      const h = new Date(ts).getHours();
      return h >= this.config.quietHoursStart || h < this.config.quietHoursEnd;
    };

    for (let d = 0; d < days; d++) {
      const day = new Date(); day.setDate(day.getDate() + d); day.setHours(0, 0, 0, 0);
      const pt = new adhan.PrayerTimes(coords, day, method);

      if (this.settings.prayerTimes) {
        for (const [k, name] of prayers) {
          const t = pt[k];
          if (!t || isNaN(t.getTime())) continue;
          // Adhan (prayer time) — bypasses quiet hours so Fajr is never silenced
          events.push({
            tag: `prayer-${k}`,
            title: `🕌 حان وقت ${name}`,
            body: `الآن وقت صلاة ${name} — حي على الصلاة`,
            url: './index.html',
            ts: t.getTime()
          });
          // Pre-reminder — respects quiet hours
          if (this.settings.preReminders) {
            const preTs = t.getTime() - this.config.preReminderMinutes * 60000;
            if (!(this.settings.quietHours && inQuiet(preTs))) {
              events.push({
                tag: `pre-${k}`,
                title: `⏰ تذكير: ${name}`,
                body: `باقي ${this.config.preReminderMinutes} دقائق على أذان ${name}`,
                url: './index.html',
                ts: preTs
              });
            }
          }
        }
      }

      // Azkar / Kahf fire at fixed local times (respect quiet hours)
      const reminders = [];
      if (this.settings.azkarMorning) reminders.push({ ts: localTs(day, 6, 0),  tag: 'azkar-morning', title: '🌅 أذكار الصباح', body: 'اللهم بك أصبحنا — ابدأ يومك بالأذكار', url: './pages/azkar.html?type=morning' });
      if (this.settings.azkarEvening) reminders.push({ ts: localTs(day, 16, 0), tag: 'azkar-evening', title: '🌙 أذكار المساء', body: 'اللهم بك أمسينا — اختتم يومك بالأذكار', url: './pages/azkar.html?type=night' });
      if (this.settings.fridayKahf && day.getDay() === 5) reminders.push({ ts: localTs(day, 7, 0), tag: 'friday-kahf', title: '🕋 يوم الجمعة المبارك', body: 'لا تنسَ قراءة سورة الكهف اليوم', url: './pages/quran.html?surah=18' });
      for (const r of reminders) {
        if (this.settings.quietHours && inQuiet(r.ts)) continue;
        events.push(r);
      }
    }

    return events.filter(e => e.ts > now).sort((a, b) => a.ts - b.ts);
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
    console.log('📱 Local notification mode active');

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
        const { latitude: lat, longitude: lon } = pos.coords;
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
  getAdhanMethod() {
    if (typeof adhan === 'undefined') return null;
    const method = localStorage.getItem('calcMethod') || 'UAE';
    switch (method) {
      case 'UmmAlQura': return adhan.CalculationMethod.UmmAlQura();
      case 'Egypt':     return adhan.CalculationMethod.Egyptian();
      case 'Karachi':   return adhan.CalculationMethod.Karachi();
      case 'UAE':       return adhan.CalculationMethod.Dubai();
      default:          return adhan.CalculationMethod.MuslimWorldLeague();
    }
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
      console.log('✅ Prayer times calculated via adhan.js (coords)');
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
      const coords = new adhan.Coordinates(24.7136, 46.6753);
      const now = new Date();
      const pt = new adhan.PrayerTimes(coords, now, calcMethod);
      this.parseAdhanTimes(pt);
      console.log('✅ Prayer times calculated via adhan.js (city fallback)');
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
      if (Notification.permission !== 'granted') { console.log('🔕 Notification permission not granted'); this._lastError = 'permission_denied'; return false; }
    } else {
      if (!this.settings.enabled) { console.log('🔇 Notifications disabled in settings'); this._lastError = 'settings_disabled'; return false; }
      if (this.isQuietHours() && !options.forceQuiet) { console.log('🌙 Quiet hours active, notification blocked'); this._lastError = 'quiet_hours'; return false; }
      if (Notification.permission !== 'granted') { console.log('🔕 Notification permission not granted'); this._lastError = 'permission_denied'; return false; }
    }

    const notifOptions = {
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      vibrate: [200, 100, 200],
      tag: 'zad-muslim',
      renotify: true,
      data: { url: './index.html' },
      ...options
    };

    try {
      if (!this.swRegistration) {
        this.swRegistration = await navigator.serviceWorker.ready;
      }
      if (!this.swRegistration) throw new Error('لا يوجد Service Worker مسجل');
      await this.swRegistration.showNotification(title, notifOptions);
      console.log('🔔 Notification sent via SW:', title);
      return true;
    } catch (err) {
      console.warn('⚠️ SW notification failed, using Notification API:', err.message);
      try {
        const n = new Notification(title, notifOptions);
        console.log('🔔 Notification sent via Notification API:', title);
        setTimeout(() => n.close(), 5000);
        return true;
      } catch (e2) {
        console.error('❌ All notification methods failed:', e2);
        this._lastError = 'SW: ' + err.message + ' | API: ' + e2.message;
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

    // When subscribed to push, the server's cron owns prayer/azkar/Kahf delivery
    // (it works in the background too) — skip them locally to avoid duplicates.
    // Streak reminders stay local: the server can't know today's activity.
    const pushActive = this.state.subscribed && this.settings.pushEnabled;

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
      console.log(`🔧 Setting '${key}' → ${value}`);
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
