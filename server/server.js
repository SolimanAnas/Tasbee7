const express = require('express');
const webpush = require('web-push');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

// ========== VAPID KEYS - Generate your own using: web-push generate-vapid-keys ==========
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-Qkvfcap7gAQfZoJ3I6bZZJ1NjK6NmtbU9bL7-Jhj2L6QLF4M7dR2z9AA';
const VAPID_PRIVATE_KEY = 'UUx4XxX5QF8h_C5s_X8s_X8s_X8s_X8s_X8s_X8s_X8s';

webpush.setVapidDetails(
  'mailto:your-email@example.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// ========== DATABASE (In-memory for demo) ==========
const subscriptions = new Map(); // userId -> subscription
const userSettings = new Map();   // userId -> settings

// ========== PRAYER TIMES API ==========
const PRAYER_API = 'https://api.aladhan.com/v1/timingsByCity';
const PRAYER_API_BY_GPS = 'https://api.aladhan.com/v1/timings';

async function getPrayerTimes(city = 'Cairo', country = 'Egypt') {
  try {
    const today = new Date();
    const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
    
    const response = await fetch(`${PRAYER_API}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&date=${dateStr}`);
    const data = await response.json();
    
    if (data.data) {
      const timings = data.data.timings;
      return {
        fajr: timings.Fajr,
        dhuhr: timings.Dhuhr,
        asr: timings.Asr,
        maghrib: timings.Maghrib,
        isha: timings.Isha,
        sunrise: timings.Sunrise,
        sunset: timings.Sunset
      };
    }
    return null;
  } catch (err) {
    console.error('Prayer API error:', err);
    return null;
  }
}

async function getPrayerTimesByGPS(lat, lon) {
  try {
    const today = new Date();
    const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;
    
    const response = await fetch(`${PRAYER_API_BY_GPS}?latitude=${lat}&longitude=${lon}&date=${dateStr}`);
    const data = await response.json();
    
    if (data.data) {
      const timings = data.data.timings;
      return {
        fajr: timings.Fajr,
        dhuhr: timings.Dhuhr,
        asr: timings.Asr,
        maghrib: timings.Maghrib,
        isha: timings.Isha,
        sunrise: timings.Sunrise,
        sunset: timings.Sunset
      };
    }
    return null;
  } catch (err) {
    console.error('Prayer API error:', err);
    return null;
  }
}

// ========== PARSE TIME ==========
function parseTime(timeStr) {
  if (!timeStr) return { hour: 0, minute: 0 };
  const [hour, minute] = timeStr.split(':').map(Number);
  return { hour: minute ? hour : 0, minute: minute || 0 };
}

// ========== NOTIFICATION TEMPLATES ==========
const notificationTemplates = {
  prayer: (name, minsLeft = 0) => ({
    title: `🕌 ${name}`,
    body: minsLeft > 0 
      ? `باقي ${minsLeft} دقائق على ${name} - prepare now`
      : `حان الآن وقت ${name} - 快去礼拜`,
    tag: `prayer-${name}`,
    url: './quran.html'
  }),
  
  azkarMorning: {
    title: '🌅 أذكّار الصباح',
    body: 'اللهم بك أصبحنا،蒲团 الصباح - ابدأ يومك بالاذكار',
    tag: 'azkar-morning',
    url: './azkar.html'
  },
  
  azkarEvening: {
    title: '🌙 أذكّار المساء',
    body: 'اللهم بك أمسينا،蒲团 المساء - اختتم يومك بالاذكار',
    tag: 'azkar-evening',
    url: './azkar.html'
  },
  
  fridayKahf: {
    title: '🕋 يوم الجمعة',
    body: 'تذكير: اقرا سورة الكهف اليوم لتنال blessing الليلة',
    tag: 'friday-kahf',
    url: './quran.html?surah=18'
  },
  
  suhoor: {
    title: '🌙 السحور',
    body: 'باقي وقت للسحور قبل الفجر - لا تفوّت البركة',
    tag: 'suhoor',
    url: './azkar.html'
  },
  
  iftar: {
    title: '🍽️ الافطار',
    body: 'حان وقت الافطار - 快 فتح صيامكم',
    tag: 'iftar',
    url: './azkar.html'
  },
  
  streak: (days) => ({
    title: `🔥 ${days} أيام متواصلة!`,
    body: 'استمر保持了 💪',
    tag: 'streak',
    url: './azkar.html'
  })
};

// ========== SCHEDULER ==========
let schedulerInterval = null;
let lastTriggered = {};

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [hour, minute] = timeStr.split(':').map(Number);
  return hour * 60 + (minute || 0);
}

function startScheduler() {
  if (schedulerInterval) clearInterval(schedulerInterval);
  
  // Check every minute
  schedulerInterval = setInterval(async () => {
    await checkAndSendNotifications();
  }, 60000);
  
  // Initial check
  checkAndSendNotifications();
  console.log('✅ Scheduler started');
}

async function checkAndSendNotifications() {
  const now = new Date();
  const today = now.toDateString();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const day = now.getDay(); // 0 = Sunday
  const hour = now.getHours();
  
  // Get prayer times (cached or fresh)
  let prayerTimes = globalPrayerTimes;
  if (!prayerTimes) {
    prayerTimes = await getPrayerTimes();
    globalPrayerTimes = prayerTimes;
  }
  
  if (!prayerTimes) return;
  
  const triggers = [];
  
  // Check prayer times
  for (const [key, timeStr] of Object.entries(prayerTimes)) {
    if (['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].includes(key)) {
      const prayerTime = parseTimeToMinutes(timeStr);
      const preTime = prayerTime - 10;
      const triggerKey = `${key}-${today}`;
      
      // Pre-reminder (10 min before)
      if (currentMinutes === preTime && !lastTriggered[`pre-${key}-${today}`]) {
        triggers.push({
          type: 'prayer',
          name: key,
          minsLeft: 10,
          template: notificationTemplates.prayer(key, 10)
        });
        lastTriggered[`pre-${key}-${today}`] = true;
      }
      
      // Main prayer time
      if (currentMinutes === prayerTime && !lastTriggered[triggerKey]) {
        triggers.push({
          type: 'prayer',
          name: key,
          minsLeft: 0,
          template: notificationTemplates.prayer(key, 0)
        });
        lastTriggered[triggerKey] = true;
      }
    }
  }
  
  // Azkar morning (between 4-8 AM)
  if (hour >= 4 && hour < 8 && !lastTriggered[`azkar-morning-${today}`]) {
    triggers.push({ type: 'azkar-morning', template: notificationTemplates.azkarMorning });
    lastTriggered[`azkar-morning-${today}`] = true;
  }
  
  // Azkar evening (between 3-6 PM)
  if (hour >= 15 && hour < 18 && !lastTriggered[`azkar-evening-${today}`]) {
    triggers.push({ type: 'azkar-evening', template: notificationTemplates.azkarEvening });
    lastTriggered[`azkar-evening-${today}`] = true;
  }
  
  // Friday - Surah Al-Kahf (between 6-10 AM)
  if (day === 5 && hour >= 6 && hour < 10 && !lastTriggered[`friday-kahf-${today}`]) {
    triggers.push({ type: 'friday-kahf', template: notificationTemplates.fridayKahf });
    lastTriggered[`friday-kahf-${today}`] = true;
  }
  
  // Send all triggered notifications
  for (const trigger of triggers) {
    await sendToAllSubscribers(trigger.template);
  }
}

// Global prayer times cache
let globalPrayerTimes = null;

// Cache prayer times every hour
setInterval(() => {
  globalPrayerTimes = null; // Force refresh
}, 3600000);

// ========== SEND NOTIFICATIONS ==========
async function sendToAllSubscribers(payload) {
  const keys = Array.from(subscriptions.keys());
  
  for (const userId of keys) {
    const sub = subscriptions.get(userId);
    if (!sub) continue;
    
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
      console.log(`📤 Sent: ${payload.title}`);
    } catch (err) {
      console.error(`❌ Failed for user ${userId}:`, err.message);
      if (err.statusCode === 410) {
        subscriptions.delete(userId); // Remove expired
      }
    }
  }
}

async function sendToSubscriber(subscription, payload) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.error('Push error:', err.message);
    return false;
  }
}

// ========== API ROUTES ==========

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', subscribers: subscriptions.size });
});

// Get VAPID public key for frontend
app.get('/vapidPublicKey', (req, res) => {
  res.json({ key: VAPID_PUBLIC_KEY });
});

// Subscribe endpoint
app.post('/subscribe', (req, res) => {
  const { subscription, userId } = req.body;
  
  if (!subscription || !userId) {
    return res.status(400).json({ error: 'Missing subscription or userId' });
  }
  
  subscriptions.set(userId, subscription);
  console.log(`✅ User subscribed: ${userId}`);
  
  res.json({ success: true });
});

// Unsubscribe endpoint
app.post('/unsubscribe', (req, res) => {
  const { userId } = req.body;
  
  if (userId) {
    subscriptions.delete(userId);
    console.log(`❌ User unsubscribed: ${userId}`);
  }
  
  res.json({ success: true });
});

// Update user settings
app.post('/settings', (req, res) => {
  const { userId, settings } = req.body;
  
  if (userId && settings) {
    userSettings.set(userId, settings);
    console.log(`⚙️ Settings updated: ${userId}`);
  }
  
  res.json({ success: true });
});

// Get prayer times
app.get('/prayerTimes', async (req, res) => {
  const { city, country, lat, lon } = req.query;
  
  let times;
  if (lat && lon) {
    times = await getPrayerTimesByGPS(parseFloat(lat), parseFloat(lon));
  } else if (city && country) {
    times = await getPrayerTimes(city, country);
  } else {
    times = await getPrayerTimes();
  }
  
  res.json({ times });
});

// Send test notification
app.post('/test', async (req, res) => {
  const { userId } = req.body;
  const payload = {
    title: '🧪 اختبار',
    body: 'نظام الإشعارات يعمل بشكل صحيح! ✅',
    tag: 'test',
    url: './index.html'
  };
  
  if (userId) {
    const sub = subscriptions.get(userId);
    if (sub) {
      await sendToSubscriber(sub, payload);
      return res.json({ success: true, message: 'Sent to user' });
    }
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Send to all
  await sendToAllSubscribers(payload);
  res.json({ success: true, message: 'Sent to all subscribers' });
});

// Broadcast notification
app.post('/broadcast', async (req, res) => {
  const { title, body, tag, url } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: 'Missing title' });
  }
  
  const payload = { title, body, tag, url };
  await sendToAllSubscribers(payload);
  
  res.json({ success: true, sent: subscriptions.size });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Push server running on port ${PORT}`);
  startScheduler();
});