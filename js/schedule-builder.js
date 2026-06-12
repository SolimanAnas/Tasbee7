/* schedule-builder.js — pure schedule construction, shared by the page
 * (js/notifications.js) and the service worker (sw.js periodicsync).
 *
 * Classic script: defines a single global `buildNotificationSchedule(ctx, days)`.
 * Requires the `adhan` global (data/adhan.js) and js/prayer-service.js first.
 *
 * ctx = {
 *   settings: { enabled, prayerTimes, preReminders, azkarMorning,
 *               azkarEvening, fridayKahf, quietHours },
 *   lat, lng,                  // numbers
 *   calcMethod,                // 'UmmAlQura' | 'Egypt' | 'Karachi' | 'UAE' | other→MWL
 *   quietHoursStart, quietHoursEnd, preReminderMinutes
 * }
 *
 * Returns future events [{tag, title, body, url, ts}] sorted by ts; [] when
 * disabled or anything needed is missing (server then has nothing to fire).
 */
(function (global) {
  'use strict';

  function buildNotificationSchedule(ctx, days) {
    days = days || 7;
    const events = [];
    if (!ctx || !ctx.settings || !ctx.settings.enabled) return events;
    const lat = parseFloat(ctx.lat), lng = parseFloat(ctx.lng);
    if (!isFinite(lat) || !isFinite(lng) || typeof adhan === 'undefined') return events;

    const settings = ctx.settings;
    const method = PrayerService.method(ctx.calcMethod); // madhab included
    const coords = new adhan.Coordinates(lat, lng);
    const now = Date.now();
    const prayers = [
      ['fajr', 'الفجر'], ['dhuhr', 'الظهر'], ['asr', 'العصر'],
      ['maghrib', 'المغرب'], ['isha', 'العشاء']
    ];

    // local wall-clock HH:MM on a given day → absolute epoch ms (runs in user's tz)
    const localTs = (day, h, m) =>
      new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0).getTime();
    const inQuiet = (ts) => {
      const h = new Date(ts).getHours();
      return h >= ctx.quietHoursStart || h < ctx.quietHoursEnd;
    };

    for (let d = 0; d < days; d++) {
      const day = new Date(); day.setDate(day.getDate() + d); day.setHours(0, 0, 0, 0);
      const pt = new adhan.PrayerTimes(coords, day, method);

      if (settings.prayerTimes) {
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
          if (settings.preReminders) {
            const preTs = t.getTime() - ctx.preReminderMinutes * 60000;
            if (!(settings.quietHours && inQuiet(preTs))) {
              events.push({
                tag: `pre-${k}`,
                title: `⏰ تذكير: ${name}`,
                body: `باقي ${ctx.preReminderMinutes} دقائق على أذان ${name}`,
                url: './index.html',
                ts: preTs
              });
            }
          }
        }
      }

      // Azkar / Kahf fire at fixed local times (respect quiet hours)
      const reminders = [];
      if (settings.azkarMorning) reminders.push({ ts: localTs(day, 6, 0),  tag: 'azkar-morning', title: '🌅 أذكار الصباح', body: 'اللهم بك أصبحنا — ابدأ يومك بالأذكار', url: './pages/azkar.html?type=morning' });
      if (settings.azkarEvening) reminders.push({ ts: localTs(day, 16, 0), tag: 'azkar-evening', title: '🌙 أذكار المساء', body: 'اللهم بك أمسينا — اختتم يومك بالأذكار', url: './pages/azkar.html?type=night' });
      if (settings.fridayKahf && day.getDay() === 5) reminders.push({ ts: localTs(day, 7, 0), tag: 'friday-kahf', title: '🕋 يوم الجمعة المبارك', body: 'لا تنسَ قراءة سورة الكهف اليوم', url: './pages/quran.html?surah=18' });
      for (const r of reminders) {
        if (settings.quietHours && inQuiet(r.ts)) continue;
        events.push(r);
      }
    }

    return events.filter(e => e.ts > now).sort((a, b) => a.ts - b.ts);
  }

  global.buildNotificationSchedule = buildNotificationSchedule;
})(typeof self !== 'undefined' ? self : this);
