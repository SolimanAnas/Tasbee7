// js/notifications.js - FIXED v4.0
// Islamic Notification System — Local Mode with Push Support

const NotificationSystem = {

  // ========== CONFIG ==========
  config: {
    serverUrl: '',              // Set to your push server URL to enable push mode
    quietHoursStart: 23,
    quietHoursEnd: 5,
    preReminderMinutes: 10,
    apiEndpoint: 'https://api.aladhan.com/v1/timings'
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
  async init() {
    console.log('🔔 Initializing Notification System v4.0...');

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

    if (this.config.serverUrl) {
      await this.initPushMode();
    } else {
      await this.initLocalMode();
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
        this.swRegistration = await navigator.serviceWorker.register('sw.js');
      }

      // Wait for SW to be active and controlling
      await navigator.serviceWorker.ready;

      // Check for existing push subscription
      const existingSub = await this.swRegistration.pushManager.getSubscription();
      if (existingSub) {
        this.state.subscribed = true;
      }

      console.log('✅ SW attached, scope:', this.swRegistration.scope);
    } catch (err) {
      console.error('❌ SW attachment failed:', err);
      this.swRegistration = null;
    }
  },

  // ========== PUSH SERVER MODE ==========
  async initPushMode() {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        await this.initLocalMode();
        return;
      }

      if (!this.swRegistration) {
        await this.initLocalMode();
        return;
      }

      const vapidRes = await fetch(`${this.config.serverUrl}/vapidPublicKey`);
      const { key: vapidKey } = await vapidRes.json();

      const subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidKey)
      });

      const res = await fetch(`${this.config.serverUrl}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription, userId: this.state.userId })
      });

      const result = await res.json();
      if (result.success) {
        this.state.subscribed = true;
        this.settings.pushEnabled = true;
        this.saveState();
        console.log('✅ Push server subscribed');
        await this.fetchServerPrayerTimes();
      } else {
        await this.initLocalMode();
      }
    } catch (err) {
      console.warn('⚠️ Push server unavailable, falling back to local mode:', err.message);
      await this.initLocalMode();
    }
  },

  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const output = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
    return output;
  },

  async fetchServerPrayerTimes() {
    try {
      const city = localStorage.getItem('userCity') || 'Cairo';
      const country = localStorage.getItem('userCountry') || 'Egypt';
      const res = await fetch(
        `${this.config.serverUrl}/prayerTimes?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`
      );
      const data = await res.json();
      if (data.times) {
        this.parsePrayerTimings(data.times);
        console.log('✅ Server prayer times loaded');
      }
    } catch (err) {
      console.warn('⚠️ Server prayer times failed:', err.message);
    }
  },

  // ========== LOCAL MODE ==========
  async initLocalMode() {
    console.log('📱 Local notification mode active');

    // Request permission only if not yet decided (avoid double prompts)
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }

    await this.initAutoPrayerTimes();
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

  // AlAdhan API method codes
  getCalcMethodCode() {
    const map = { MWL: 3, UmmAlQura: 4, Egypt: 5, Karachi: 1 };
    return map[localStorage.getItem('calcMethod') || 'MWL'] || 3;
  },

  // FIX: New method — fetch by coordinates (aligns with index.html GPS flow)
  async fetchPrayerTimesByCoords(lat, lng) {
    try {
      const today = new Date();
      const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
      const method = this.getCalcMethodCode();

      const url = `${this.config.apiEndpoint}/${dateStr}?latitude=${lat}&longitude=${lng}&method=${method}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.data && data.data.timings) {
        this.parsePrayerTimings(data.data.timings);
        console.log('✅ Prayer times fetched by coordinates');
      }
    } catch (err) {
      console.warn('⚠️ fetchPrayerTimesByCoords failed:', err.message);
      // Fall back to cached times
      const saved = localStorage.getItem('prayerTimes');
      if (saved) {
        try { this.prayerTimes = { ...this.defaultTimes, ...JSON.parse(saved) }; } catch (e) {}
      }
    }
  },

  async fetchPrayerTimesByCity(city, country) {
    try {
      const today = new Date();
      const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
      const method = this.getCalcMethodCode();

      const url = `https://api.aladhan.com/v1/timingsByCity/${dateStr}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=${method}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.data && data.data.timings) {
        this.parsePrayerTimings(data.data.timings);
        console.log('✅ Prayer times fetched by city:', city);
      }
    } catch (err) {
      console.warn('⚠️ fetchPrayerTimesByCity failed:', err.message);
    }
  },

  // Kept for backward compatibility
  async fetchPrayerTimes(city, country) {
    await this.fetchPrayerTimesByCity(city, country);
  },

  parsePrayerTimings(timings) {
    this.prayerTimes = {
      fajr:    this.parseTime(timings.Fajr,    'الفجر'),
      dhuhr:   this.parseTime(timings.Dhuhr,   'الظهر'),
      asr:     this.parseTime(timings.Asr,     'العصر'),
      maghrib: this.parseTime(timings.Maghrib, 'المغرب'),
      isha:    this.parseTime(timings.Isha,    'العشاء')
    };
    localStorage.setItem('prayerTimes', JSON.stringify(this.prayerTimes));
  },

  // FIX: AlAdhan sometimes returns "05:12 (+03)" — strip timezone offset
  parseTime(timeStr, name) {
    if (!timeStr) return { hour: 0, minute: 0, name };
    const clean = timeStr.split(' ')[0];
    const [h, m] = clean.split(':').map(Number);
    return { hour: h || 0, minute: m || 0, name };
  },

  // ========== STATE ==========
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
        this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
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
    localStorage.setItem('notificationSettings', JSON.stringify(this.settings));
    localStorage.setItem('notificationState', JSON.stringify(this.state));
  },

  // ========== SHOW NOTIFICATION ==========
  async showNotification(title, options = {}) {
    if (!this.settings.enabled) return;
    if (this.isQuietHours() && !options.forceQuiet) return;
    if (Notification.permission !== 'granted') return;

    const notifOptions = {
      // FIX: Corrected icon path — was './icons/' (plural), correct is './icon/'
      icon: './icon/icon-192.png',
      badge: './icon/icon-192.png',
      vibrate: [200, 100, 200],
      tag: 'zad-muslim',
      renotify: true,
      data: { url: './index.html' },
      ...options
    };

    try {
      // FIX: Recover swRegistration if null (e.g., opened on notifications.html directly)
      if (!this.swRegistration) {
        this.swRegistration = await navigator.serviceWorker.ready;
      }
      await this.swRegistration.showNotification(title, notifOptions);
    } catch (err) {
      // FIX: Graceful fallback to Notification constructor when SW is unavailable
      console.warn('⚠️ SW notification failed, using Notification API:', err.message);
      try {
        new Notification(title, notifOptions);
      } catch (e2) {
        console.error('❌ All notification methods failed:', e2);
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
  scheduleChecks() {
    if (this.checkInterval) clearInterval(this.checkInterval);
    this.checkInterval = setInterval(() => this.checkAndNotify(), 30000); // every 30s
    this.checkAndNotify(); // run immediately on init
  },

  checkAndNotify() {
    if (!this.settings.enabled) return;
    if (this.settings.pushEnabled) return; // server handles it

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const ctx = this.getContext();

    // Prayer time notifications
    if (this.settings.prayerTimes) {
      this.checkPrayerTimes(currentTime);
    }

    // Morning azkar reminder (4–8 AM)
    if (this.settings.azkarMorning && ctx.isMorning && this.shouldTrigger('azkar-morning')) {
      this.showNotification('🌅 أذكار الصباح', {
        body: 'اللهم بك أصبحنا — ابدأ يومك بالأذكار',
        tag: 'azkar-morning',
        data: { url: './azkar.html?type=morning', type: 'azkar' }
      });
      this.markTriggered('azkar-morning');
    }

    // Evening azkar reminder (3–6 PM)
    if (this.settings.azkarEvening && ctx.isEvening && this.shouldTrigger('azkar-evening')) {
      this.showNotification('🌙 أذكار المساء', {
        body: 'اللهم بك أمسينا — اختتم يومك بالأذكار',
        tag: 'azkar-evening',
        data: { url: './azkar.html?type=night', type: 'azkar' }
      });
      this.markTriggered('azkar-evening');
    }

    // Friday Kahf reminder (6–10 AM on Friday)
    if (this.settings.fridayKahf && ctx.isFriday &&
        now.getHours() >= 6 && now.getHours() < 10 &&
        this.shouldTrigger('friday-kahf')) {
      this.showNotification('🕋 يوم الجمعة المبارك', {
        body: 'لا تنسَ قراءة سورة الكهف اليوم',
        tag: 'friday-kahf',
        data: { url: './quran.html?surah=18', type: 'kahf' }
      });
      this.markTriggered('friday-kahf');
    }

    // Streak reminder (after 8 PM if not active today)
    if (this.settings.streakReminders &&
        now.getHours() >= 20 &&
        this.state.lastActive !== now.toDateString() &&
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
          currentTime === (prayerMin - this.config.preReminderMinutes) &&
          this.shouldTrigger(`pre-${key}`)) {
        this.showNotification(`⏰ تذكير: ${prayer.name}`, {
          body: `باقي ${this.config.preReminderMinutes} دقائق على أذان ${prayer.name}`,
          tag: `pre-${key}`,
          data: { url: './index.html', type: 'prayer' }
        });
        this.markTriggered(`pre-${key}`);
      }

      // Prayer time notification
      if (currentTime === prayerMin && this.shouldTrigger(key)) {
        this.showNotification(`🕌 حان وقت ${prayer.name}`, {
          body: `الآن وقت صلاة ${prayer.name} — حي على الصلاة`,
          tag: `prayer-${key}`,
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

  testPush() {
    return this.showNotification('🧪 اختبار الإشعارات', {
      body: 'نظام الإشعارات يعمل بكفاءة! ✅',
      tag: 'test',
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
