/* tasmee-dashboard.js — Tasmee' stats dashboard (self-contained, no external deps) */
(function () {
  'use strict';

  /* ===== IndexedDB access (mirrors TasmeeStore schema) ===== */
  const DB_NAME = 'tasmeePro';
  const DB_VER = 1;

  function openDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('sessions')) {
          const s = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
          s.createIndex('date', 'date');
          s.createIndex('surah', 'surah');
        }
        if (!db.objectStoreNames.contains('mistakes')) {
          const m = db.createObjectStore('mistakes', { keyPath: 'id', autoIncrement: true });
          m.createIndex('type', 'type');
          m.createIndex('surah', 'surah');
          m.createIndex('key', 'key');
        }
        if (!db.objectStoreNames.contains('revisions')) {
          const r = db.createObjectStore('revisions', { keyPath: 'key' });
          r.createIndex('dueDate', 'dueDate');
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = () => reject(req.error);
    });
  }

  function reqP(r) {
    return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  }

  async function getAll(storeName) {
    const db = await openDB();
    return reqP(db.transaction(storeName, 'readonly').objectStore(storeName).getAll());
  }

  function dayKey(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  async function aggregate() {
    let sessions = [], mistakes = [];
    try { sessions = await getAll('sessions'); } catch (_) {}
    try { mistakes = await getAll('mistakes'); } catch (_) {}

    const totalSessions = sessions.length;
    const totalTimeSec = sessions.reduce((s, x) => s + (x.durationSec || 0), 0);
    const accs = sessions.map(s => s.accuracy).filter(a => typeof a === 'number');
    const avgAccuracy = accs.length ? accs.reduce((a, b) => a + b, 0) / accs.length : 0;

    const days = new Set(sessions.map(s => dayKey(s.date)));
    let streak = 0;
    const d = new Date();
    while (days.has(dayKey(d.getTime()))) { streak++; d.setDate(d.getDate() - 1); }

    const weekly = [];
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(); dt.setDate(dt.getDate() - i);
      const k = dayKey(dt.getTime());
      weekly.push({ day: k, count: sessions.filter(s => dayKey(s.date) === k).length });
    }

    const freq = {};
    mistakes.forEach(m => { if (m.word) freq[m.word] = (freq[m.word] || 0) + 1; });
    const weakWords = Object.keys(freq).map(w => ({ word: w, count: freq[w] }))
      .sort((a, b) => b.count - a.count).slice(0, 10);

    return { totalSessions, totalTimeSec, avgAccuracy, streak, weekly, weakWords, totalMistakes: mistakes.length };
  }

  async function getDueRevisions() {
    const all = await getAll('revisions');
    const t = Date.now();
    return all.filter(r => r.dueDate <= t).sort((a, b) => a.dueDate - b.dueDate);
  }

  /* ===== Surah name map (1–114) ===== */
  const SURAH_NAMES = [
    '', 'الفاتحة', 'البقرة', 'آل عمران', 'النساء', 'المائدة', 'الأنعام', 'الأعراف', 'الأنفال', 'التوبة',
    'يونس', 'هود', 'يوسف', 'الرعد', 'إبراهيم', 'الحجر', 'النحل', 'الإسراء', 'الكهف', 'مريم',
    'طه', 'الأنبياء', 'الحج', 'المؤمنون', 'النور', 'الفرقان', 'الشعراء', 'القصص', 'العنكبوت', 'الروم',
    'لقمان', 'السجدة', 'الأحزاب', 'سبأ', 'فاطر', 'يس', 'الصافات', 'ص', 'الزمر', 'غافر',
    'فصلت', 'الشورى', 'الزخرف', 'الدخان', 'الجاثية', 'الأحقاف', 'محمد', 'الفتح', 'الحجرات', 'ق',
    'الذاريات', 'الطور', 'النجم', 'القمر', 'الرحمن', 'الواقعة', 'الحديد', 'المجادلة', 'الحشر', 'الممتحنة',
    'الصف', 'الجمعة', 'المنافقون', 'التغابن', 'الطلاق', 'التحريم', 'الملك', 'القلم', 'الحاقة', 'المعارج',
    'نوح', 'الجن', 'المزمل', 'المدثر', 'القيامة', 'الإنسان', 'المرسلات', 'النبأ', 'النازعات', 'عبس',
    'التكوير', 'الانفطار', 'المطففين', 'الانشقاق', 'البروج', 'الطارق', 'الأعلى', 'الغاشية', 'الفجر', 'البلد',
    'الشمس', 'الليل', 'الضحى', 'الشرح', 'التين', 'العلق', 'القدر', 'البينة', 'الزلزلة', 'العاديات',
    'القارعة', 'التكاثر', 'العون', 'الحشر', 'الصرصر', 'العصر', 'الهمزة', 'الفيل', 'قريش', 'الماعون',
    'الكوثر', 'الكافرون', 'النصر', 'المسد', 'الإخلاص', 'الفلق', 'الناس'
  ];

  function getSurahName(n) { return SURAH_NAMES[n] || 'سورة ' + n; }

  /* ===== Helpers ===== */
  function $(id) { return document.getElementById(id); }

  function formatDuration(sec) {
    if (sec < 60) return Math.round(sec) + (window.t ? ' ' + t('tasmee_sec') : ' ث');
    if (sec < 3600) return Math.round(sec / 60) + (window.t ? ' ' + t('tasmee_min') : ' د');
    const h = Math.floor(sec / 3600);
    const m = Math.round((sec % 3600) / 60);
    return m > 0 ? h + (window.t ? ' ' + t('tasmee_hour') + ' ' : ' س ') + m + (window.t ? ' ' + t('tasmee_min') : ' د') : h + (window.t ? ' ' + t('tasmee_hour') : ' س');
  }

  function formatDate(ts) {
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 86400000 && d.getDate() === now.getDate()) return window.t ? t('tasmee_today') : 'اليوم';
    if (diff < 172800000) return window.t ? t('tasmee_yesterday') : 'أمس';
    return d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
  }

  function dayLabel(dateStr) {
    const d = new Date(dateStr);
    var keys = ['tasmee_day_sun', 'tasmee_day_mon', 'tasmee_day_tue', 'tasmee_day_wed', 'tasmee_day_thu', 'tasmee_day_fri', 'tasmee_day_sat'];
    var fallbacks = ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'];
    return window.t ? t(keys[d.getDay()]) : fallbacks[d.getDay()];
  }

  function animateValue(el, end, duration, suffix) {
    suffix = suffix || '';
    const startTime = performance.now();
    function tick(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(end * eased) + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ===== Draw weekly bar chart ===== */
  function drawWeeklyChart(weekly) {
    const canvas = $('weeklyChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    const W = rect.width;
    const H = 160;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);

    const maxCount = Math.max(...weekly.map(w => w.count), 1);
    const barWidth = Math.min(32, (W - 40) / 7 * 0.55);
    const gap = (W - 40 - barWidth * 7) / 6;
    const chartTop = 20;
    const chartBottom = H - 30;
    const chartHeight = chartBottom - chartTop;

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const barColor = isDark ? '#10b981' : '#059669';
    const barBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
    const textColor = isDark ? '#94A3B8' : '#64748B';

    ctx.clearRect(0, 0, W, H);

    weekly.forEach(function (day, i) {
      const x = 20 + i * (barWidth + gap);
      const barH = (day.count / maxCount) * chartHeight;
      const y = chartBottom - barH;

      ctx.fillStyle = barBg;
      ctx.beginPath();
      ctx.roundRect(x, chartTop, barWidth, chartHeight, 6);
      ctx.fill();

      if (day.count > 0) {
        ctx.fillStyle = barColor;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barH, [6, 6, 0, 0]);
        ctx.fill();

        ctx.fillStyle = textColor;
        ctx.font = '600 ' + (barWidth > 24 ? 11 : 10) + 'px Tajawal';
        ctx.textAlign = 'center';
        ctx.fillText(day.count, x + barWidth / 2, y - 6);
      }

      ctx.fillStyle = textColor;
      ctx.font = '500 11px Tajawal';
      ctx.textAlign = 'center';
      ctx.fillText(dayLabel(day.day), x + barWidth / 2, chartBottom + 16);
    });
  }

  /* ===== Render session history ===== */
  function renderHistory(sessions) {
    const list = $('historyList');
    const empty = $('emptyHistory');
    if (!sessions.length) {
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';

    var recent = sessions.slice().sort(function (a, b) { return b.date - a.date; }).slice(0, 20);
    var fragment = document.createDocumentFragment();

    recent.forEach(function (ses) {
      var card = document.createElement('div');
      card.className = 'session-card';

      var acc = typeof ses.accuracy === 'number' ? Math.round(ses.accuracy) : 0;
      var circumference = 2 * Math.PI * 18;
      var offset = circumference - (acc / 100) * circumference;
      var strokeColor = acc >= 80 ? '#10b981' : acc >= 50 ? '#f59e0b' : '#ef4444';

      card.innerHTML =
        '<div class="session-info">' +
          '<div class="session-surah">' + getSurahName(ses.surah || 0) + '</div>' +
          '<div class="session-meta">' +
            '<span>' + formatDate(ses.date) + '</span>' +
            '<span class="dot">·</span>' +
            '<span>' + formatDuration(ses.durationSec || 0) + '</span>' +
            (ses.fromAyah ? '<span class="dot">·</span><span>' + (window.t ? t('tasmee_ayah') + ' ' : 'آية ') + ses.fromAyah + (ses.toAyah && ses.toAyah !== ses.fromAyah ? '–' + ses.toAyah : '') + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="session-accuracy">' +
          '<div class="accuracy-ring">' +
            '<svg viewBox="0 0 44 44">' +
              '<circle class="track" cx="22" cy="22" r="18"/>' +
              '<circle class="fill-ring" cx="22" cy="22" r="18" stroke="' + strokeColor + '" stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '"/>' +
            '</svg>' +
            '<div class="accuracy-pct">' + acc + '%</div>' +
          '</div>' +
        '</div>';
      fragment.appendChild(card);
    });

    list.innerHTML = '';
    list.appendChild(fragment);
  }

  /* ===== Render weak words ===== */
  function renderWeakWords(words) {
    var section = $('weakSection');
    var grid = $('weakGrid');
    if (!words || !words.length) {
      if (section) section.style.display = 'none';
      return;
    }
    if (section) section.style.display = '';
    grid.innerHTML = '';
    words.forEach(function (w) {
      var tag = document.createElement('div');
      tag.className = 'weak-tag';
      tag.innerHTML = '<span>' + w.word + '</span><span class="weak-count">' + w.count + '</span>';
      grid.appendChild(tag);
    });
  }

  /* ===== Render mistake breakdown ===== */
  function renderMistakes(mistakes) {
    var total = mistakes.length;
    $('mistakeTotal').textContent = total ? total + (window.t ? ' ' + t('tasmee_mistakes') : ' خطأ') : (window.t ? t('tasmee_no_mistakes') : 'لا أخطاء');
    $('countMissing').textContent = '0';
    $('countWrong').textContent = '0';
    $('countExtra').textContent = '0';
    $('barMissing').style.width = '0%';
    $('barWrong').style.width = '0%';
    $('barExtra').style.width = '0%';

    if (!total) return;

    var missing = 0, wrong = 0, extra = 0;
    mistakes.forEach(function (m) {
      if (m.type === 'missing') missing++;
      else if (m.type === 'wrong') wrong++;
      else if (m.type === 'extra') extra++;
    });

    $('countMissing').textContent = missing;
    $('countWrong').textContent = wrong;
    $('countExtra').textContent = extra;

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        $('barMissing').style.width = (missing / total * 100) + '%';
        $('barWrong').style.width = (wrong / total * 100) + '%';
        $('barExtra').style.width = (extra / total * 100) + '%';
      });
    });
  }

  /* ===== Render due revisions ===== */
  function renderDueRevisions(due) {
    var section = $('reviewSection');
    if (!due || !due.length) {
      if (section) section.style.display = 'none';
      return;
    }
    if (section) section.style.display = '';
    // Number is set here; the trailing label is a separate data-i18n span that
    // I18n.applyTranslations() localizes — avoids any render/i18n race.
    var el = $('dueCount');
    if (el) el.textContent = due.length;
  }

  /* ===== Theme toggle ===== */
  window.toggleTheme = function () {
    var html = document.documentElement;
    var current = html.getAttribute('data-theme') || 'dark';
    var next = current === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeIcon(next);
    if (window._lastWeekly) drawWeeklyChart(window._lastWeekly);
  };

  function updateThemeIcon(theme) {
    var sun = $('themeSun');
    var moon = $('themeMoon');
    if (!sun || !moon) return;
    sun.style.display = theme === 'light' ? 'none' : 'block';
    moon.style.display = theme === 'light' ? 'block' : 'none';
  }

  /* ===== Mastery grid ===== */
  async function renderMasteryGrid() {
    var grid = $('masteryGrid');
    if (!grid) return;
    var allRevisions = await getAll('revisions');
    grid.innerHTML = '';
    for (var s = 1; s <= 114; s++) {
      var surahRevisions = allRevisions.filter(function (r) { return r.surah === s; });
      var avgLevel = 0;
      if (surahRevisions.length > 0) {
        avgLevel = surahRevisions.reduce(function (sum, r) { return sum + r.level; }, 0) / surahRevisions.length;
      }
      var cell = document.createElement('div');
      cell.className = 'mastery-cell l' + Math.min(5, Math.round(avgLevel));
      cell.title = getSurahName(s) + (window.t ? ' (' + t('tasmee_level') + ' ' : ' (مستوى ') + Math.round(avgLevel) + ')';
      grid.appendChild(cell);
    }
  }

  /* ===== INIT ===== */
  async function init() {
    var savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    if (!window.indexedDB) {
      $('loadingSkeleton').innerHTML =
        '<div class="empty-state" style="padding:60px 20px">' +
          '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.3">' +
            '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>' +
          '</svg>' +
          '<p>' + (window.t ? t('tasmee_not_supported') : 'التلمييع غير مدعوم في هذا المتصفح') + '</p>' +
          '<span>' + (window.t ? t('tasmee_use_chrome') : 'استخدم Chrome أو Edge للحصول على أفضل تجربة') + '</span>' +
        '</div>';
      return;
    }

    try {
      var results = await Promise.all([
        aggregate(),
        getAll('sessions'),
        getAll('mistakes'),
        getDueRevisions()
      ]);

      var agg = results[0];
      var sessions = results[1];
      var mistakes = results[2];
      var due = results[3];

      window._lastWeekly = agg.weekly;

      $('loadingSkeleton').style.display = 'none';
      $('dashContent').style.display = '';

      animateValue($('streakCount'), agg.streak, 800);
      if (agg.streak >= 7) {
        $('streakSub').textContent = window.t ? t('tasmee_streak_great') : 'ما شاء الله! استمر!';
      } else if (agg.streak >= 3) {
        $('streakSub').textContent = window.t ? t('tasmee_streak_good') : 'أحسنت! لا تكسر السلسلة';
      } else if (agg.streak > 0) {
        $('streakSub').textContent = window.t ? t('tasmee_streak_start') : 'بداية جيدة!';
      }

      animateValue($('totalSessions'), agg.totalSessions, 600);
      $('totalTime').textContent = formatDuration(agg.totalTimeSec);
      $('avgAccuracy').textContent = Math.round(agg.avgAccuracy) + '%';

      drawWeeklyChart(agg.weekly);
      renderMistakes(mistakes);
      renderWeakWords(agg.weakWords);
      renderHistory(sessions);
      renderDueRevisions(due);
      renderMasteryGrid();

    } catch (err) {
      console.error('Tasmee dashboard init error:', err);
      $('loadingSkeleton').innerHTML =
        '<div class="empty-state" style="padding:60px 20px">' +
          '<p>' + (window.t ? t('tasmee_load_error') : 'حدث خطأ أثناء تحميل البيانات') + '</p>' +
          '<span>' + (err.message || err) + '</span>' +
        '</div>';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 100); });
  } else {
    setTimeout(init, 100);
  }
})();
