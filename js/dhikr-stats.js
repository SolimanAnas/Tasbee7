/* =========================================================================
   dhikr-stats.js — daily dhikr history + the weekly "share my week" card

   The app only kept today's counters (masbaha_today / azkar_today /
   khatma_today, reset each day by the page that writes them). This keeps a
   dated log by snapshotting those counters — they only grow during a day,
   so the log stores the highest value seen — plus per-dhikr masbaha taps:

     localStorage.dhikr_log = { 'YYYY-MM-DD': { m, a, q, d: { dhikrId: n } } }
       m = tasbeeh (masbaha taps), a = adhkar read, q = Quran pages

   Writers call DhikrStats.sync() after bumping their *_today counter; the
   masbaha calls DhikrStats.tap(id, name) instead. DhikrStats.share() opens
   the weekly stats card in ShareCard (js/share-card.js).
   ========================================================================= */
(function () {
  'use strict';

  const LOG_KEY = 'dhikr_log';
  const NAMES_KEY = 'dhikr_names';
  const KEEP_DAYS = 400;
  const GOLD = '#e6c068';
  const SOURCES = { m: 'masbaha', a: 'azkar', q: 'khatma' };
  const VERSE = 'وَالذَّاكِرِينَ اللَّهَ كَثِيرًا وَالذَّاكِرَاتِ أَعَدَّ اللَّهُ لَهُم مَّغْفِرَةً وَأَجْرًا عَظِيمًا';

  // Built-in copies (the SW serves js/i18n/*.js cache-first; see share-card.js).
  const FALLBACK = {
    ar: {
      ds_title: 'أذكاري هذا الأسبوع', ds_week_tasbih: 'تسبيحة هذا الأسبوع', ds_streak: 'أيام متتالية',
      ds_azkar: 'أذكار مقروءة', ds_pages: 'صفحة قرآن', ds_top: 'الأكثر تكرارًا: {name} ({n})',
      ds_lifetime: 'المجموع منذ البداية: {n} تسبيحة', ds_today: 'اليوم', ds_share: 'مشاركة إنجاز الأسبوع',
    },
    en: {
      ds_title: 'My dhikr this week', ds_week_tasbih: 'tasbeeh this week', ds_streak: 'day streak',
      ds_azkar: 'adhkar read', ds_pages: 'Quran pages', ds_top: 'Most repeated: {name} ({n})',
      ds_lifetime: 'All-time total: {n} tasbeeh', ds_today: 'Today', ds_share: 'Share my week',
    },
  };
  const lang = () => (window.I18n ? I18n.getLang() : 'ar');
  const isRtl = () => ['ar', 'ckb', 'ur'].includes(lang());
  function tr(k, p) {
    let s = window.t ? window.t(k, p) : k;
    if (s === k) {
      s = (FALLBACK[lang()] || (isRtl() ? FALLBACK.ar : FALLBACK.en))[k] || FALLBACK.en[k] || k;
      if (p) Object.keys(p).forEach(n => { s = s.replace(new RegExp('\\{' + n + '\\}', 'g'), p[n]); });
    }
    return s;
  }
  const fmt = n => Math.round(n).toLocaleString('en-US');

  // ---------- storage ----------
  function read(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { return {}; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* full / private mode */ }
  }
  function dayKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function daysAgo(n) { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d; }

  function prune(log) {
    const cutoff = dayKey(daysAgo(KEEP_DAYS));
    Object.keys(log).forEach(k => { if (k < cutoff) delete log[k]; });
  }

  // Snapshot today's counters into the log (only ever raises a day's value).
  function sync() {
    const log = read(LOG_KEY);
    const today = new Date().toDateString();
    const e = log[dayKey(new Date())] || (log[dayKey(new Date())] = {});
    for (const [f, k] of Object.entries(SOURCES)) {
      let v = 0;
      try {
        if (localStorage.getItem(k + '_last_date') === today) v = parseInt(localStorage.getItem(k + '_today') || '0', 10) || 0;
      } catch (err) { /* storage blocked */ }
      if (v > (e[f] || 0)) e[f] = v;
    }
    prune(log);
    write(LOG_KEY, log);
    return log;
  }

  // One masbaha tap on dhikr `id` (call after masbaha_today was bumped).
  function tap(id, name) {
    const log = sync();
    const e = log[dayKey(new Date())];
    e.d = e.d || {};
    e.d[id] = (e.d[id] || 0) + 1;
    write(LOG_KEY, log);
    if (name) {
      const names = read(NAMES_KEY);
      if (names[id] !== name) { names[id] = name; write(NAMES_KEY, names); }
    }
  }

  // ---------- summary ----------
  function summary() {
    const log = sync();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = daysAgo(i);
      const e = log[dayKey(d)] || {};
      days.push({ date: d, m: e.m || 0, a: e.a || 0, q: e.q || 0, d: e.d || {} });
    }
    const week = { m: 0, a: 0, q: 0 };
    const perDhikr = {};
    days.forEach(x => {
      week.m += x.m; week.a += x.a; week.q += x.q;
      Object.entries(x.d).forEach(([id, n]) => { perDhikr[id] = (perDhikr[id] || 0) + n; });
    });
    const topId = Object.keys(perDhikr).sort((p, q) => perDhikr[q] - perDhikr[p])[0];
    const names = read(NAMES_KEY);

    // Streak from the log, counted back from today (or yesterday if today is
    // still empty). The home page keeps its own streak counter from before
    // this log existed — use whichever is longer.
    const active = k => { const e = log[k]; return !!e && ((e.m || 0) + (e.a || 0) + (e.q || 0)) > 0; };
    let i = active(dayKey(daysAgo(0))) ? 0 : 1, streak = 0;
    while (active(dayKey(daysAgo(i)))) { streak++; i++; }
    let home = 0;
    try {
      const last = localStorage.getItem('streak_last_date');
      const n = parseInt(localStorage.getItem('streakDays') || '0', 10) || 0;
      if (last === daysAgo(0).toDateString()) home = n;
      else if (last === daysAgo(1).toDateString()) home = n + (active(dayKey(daysAgo(0))) ? 1 : 0);
    } catch (e) { /* ignore */ }

    let lifetime = 0;
    try { lifetime = parseInt(localStorage.getItem('grand_total') || '0', 10) || 0; } catch (e) { /* ignore */ }
    return {
      days, week, streak: Math.max(streak, home), lifetime,
      top: topId ? { name: names[topId] || topId, n: perDhikr[topId] } : null,
    };
  }

  // ---------- card ----------
  function weekdayLabels(days) {
    const loc = { ar: 'ar', ckb: 'ckb', ur: 'ur', tr: 'tr', en: 'en' }[lang()] || 'ar';
    let f;
    try { f = new Intl.DateTimeFormat(loc, { weekday: 'short' }); } catch (e) { f = new Intl.DateTimeFormat('ar', { weekday: 'short' }); }
    return days.map((x, i) => (i === days.length - 1 ? tr('ds_today') : f.format(x.date)));
  }

  // Fixed vertical rhythm (in units of the card width) with the bar chart
  // taking the leftover height, capped — the block is centred in the panel.
  function drawStats(S, c, box, anim) {
    const { x, w, h, base } = box;
    const rtl = isRtl();
    const cx = x + w / 2;
    const chartH = Math.max(base * 0.1, Math.min(base * 0.45, h - base * 0.42));
    const y = box.y + Math.max(0, (h - (base * 0.42 + chartH)) / 2);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.direction = rtl ? 'rtl' : 'ltr';
    c.shadowColor = 'rgba(0,0,0,0.45)';
    c.shadowBlur = 8;

    // 1. weekly tasbeeh total (counts up in videos)
    c.fillStyle = GOLD;
    c.font = '700 ' + (base * 0.085) + 'px Tajawal';
    c.fillText(fmt(S.week.m * anim), cx, y + base * 0.07);
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.font = (base * 0.03) + 'px Tajawal';
    c.fillText(tr('ds_week_tasbih'), cx, y + base * 0.13);

    // 2. seven-day bar chart (oldest day on the reading-start side)
    const labels = weekdayLabels(S.days);
    const max = Math.max(1, ...S.days.map(d => d.m));
    const chartTop = y + base * 0.19, chartBottom = chartTop + chartH;
    const slot = (w * 0.86) / 7, bw = slot * 0.52;
    const left = x + w * 0.07;
    S.days.forEach((d, i) => {
      const col = rtl ? 6 - i : i;
      const bx = left + col * slot + (slot - bw) / 2;
      const grow = Math.max(0, Math.min(1, anim * 1.6 - i * 0.08));
      const full = d.m ? Math.max(base * 0.012, chartH * d.m / max) : base * 0.008;
      const bh = full * grow;
      const isToday = i === 6;
      c.shadowBlur = 0;
      c.fillStyle = d.m ? (isToday ? GOLD : 'rgba(230,192,104,0.55)') : 'rgba(255,255,255,0.18)';
      c.beginPath();
      if (c.roundRect) c.roundRect(bx, chartBottom - bh, bw, bh, Math.min(bw / 2, base * 0.012)); else c.rect(bx, chartBottom - bh, bw, bh);
      c.fill();
      if (d.m && grow > 0.95) {
        c.fillStyle = 'rgba(255,255,255,0.9)';
        c.font = (base * 0.022) + 'px Tajawal';
        c.fillText(fmt(d.m), bx + bw / 2, chartBottom - bh - base * 0.018);
      }
      c.fillStyle = isToday ? GOLD : 'rgba(255,255,255,0.7)';
      c.font = (isToday ? '700 ' : '') + (base * 0.022) + 'px Tajawal';
      c.fillText(labels[i], bx + bw / 2, chartBottom + base * 0.027);
    });
    c.shadowBlur = 8;

    // 3. streak / adhkar / Quran pages tiles
    const tiles = [
      [S.streak, tr('ds_streak')],
      [S.week.a, tr('ds_azkar')],
      [S.week.q, tr('ds_pages')],
    ];
    const ty = chartBottom + base * 0.055, th = base * 0.09, tw = w * 0.27, tgap = w * 0.03;
    const tx0 = cx - (tw * 3 + tgap * 2) / 2;
    tiles.forEach(([val, label], i) => {
      const col = rtl ? 2 - i : i;
      const tx = tx0 + col * (tw + tgap);
      c.shadowBlur = 0;
      c.fillStyle = 'rgba(255,255,255,0.07)';
      c.strokeStyle = 'rgba(230,192,104,0.25)';
      c.lineWidth = 2;
      c.beginPath();
      if (c.roundRect) c.roundRect(tx, ty, tw, th, base * 0.02); else c.rect(tx, ty, tw, th);
      c.fill();
      c.stroke();
      c.fillStyle = '#fff';
      c.font = '700 ' + (base * 0.042) + 'px Tajawal';
      c.fillText(fmt(val * anim), tx + tw / 2, ty + th * 0.37);
      c.fillStyle = 'rgba(255,255,255,0.72)';
      let ls = base * 0.022;
      c.font = ls + 'px Tajawal';
      while (c.measureText(label).width > tw * 0.92 && ls > base * 0.016) { ls *= 0.93; c.font = ls + 'px Tajawal'; }
      c.fillText(label, tx + tw / 2, ty + th * 0.76);
    });

    // 4. most-repeated dhikr, or the verse when nothing was tapped this week
    c.globalAlpha *= Math.min(1, Math.max(0, anim * 2 - 1));
    let line, family;
    if (S.top) {
      // LRM keeps the count after an Arabic name inside a left-to-right sentence
      line = tr('ds_top', { name: S.top.name + (rtl ? '' : '\u200E'), n: fmt(S.top.n) });
      family = rtl ? 'Amiri' : 'Tajawal';
      c.direction = rtl ? 'rtl' : 'ltr';          // UI direction; the Arabic name is its own RTL run
    } else {
      line = '\uFD3F' + VERSE + '\uFD3E';
      family = 'Amiri';
      c.direction = 'rtl';
    }
    let fs = base * 0.032;
    c.fillStyle = 'rgba(255,255,255,0.92)';
    c.font = fs + 'px ' + family;
    while (c.measureText(line).width > w * 0.9 && fs > base * 0.02) { fs *= 0.94; c.font = fs + 'px ' + family; }
    c.fillText(line, cx, ty + th + base * 0.045);
  }

  function share() {
    if (!window.ShareCard) return;
    const S = summary();
    ShareCard.open({
      title: tr('ds_title'),
      source: S.lifetime ? tr('ds_lifetime', { n: fmt(S.lifetime) }) : '',
      custom: { seconds: 6, draw: (c, box, anim) => drawStats(S, c, box, anim) },
    });
  }

  window.DhikrStats = { sync, tap, summary, share };
})();
