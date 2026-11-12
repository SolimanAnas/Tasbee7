/**
 * audio-offline.js — "Download the full mushaf" for pages/audio.html.
 *
 * Saves every surah of one recitation in the app's own storage so it plays
 * with no connection, through the normal player. Files are fetched from the
 * same links the player streams (mp3quran / way2quran, both send CORS
 * headers) and stored in their own cache, OFFLINE_CACHE:
 *   • sw.js serves audio from any cache, with byte ranges, so the player
 *     needs no changes to play a saved surah;
 *   • sw.js never trims or deletes this cache (unlike the 120-file cache of
 *     recently played audio).
 * Each file is stored only when it arrived whole (a cut-off download makes
 * cache.put fail), so a saved surah is always complete.
 *
 * Downloads run while the page is open (it stays open under the continuous
 * player). After an interruption the next run skips what is already saved.
 *
 * The page provides the data through AudioOffline.init({...}); everything
 * else (sheet, progress, storage list) lives here. Classic script.
 */
(function () {
  'use strict';

  var OFFLINE_CACHE = 'quran-audio-offline-v1';
  var INDEX_KEY = 'audioOfflineIndex';   // { reciterId: { name, saved, total, bytes, updated } }
  var SIZE_KEY = 'audioOfflineSizes';    // { reciterId: bytes } — remembered size estimates
  var CONCURRENCY = 3;

  var host = null;            // { reciters(), tracksFor(r), nameOf(r), currentIndex(), onChange() }
  var savedUrls = new Set();  // every URL saved for offline listening
  var job = null;             // the running download: { id, total, done, failed, bytes, paused, quota }
  var targetIndex = null;     // reciter shown in the sheet

  // ---------- helpers ----------
  function T(key, params, fallback) {
    var s = null;
    try { if (window.I18n && typeof window.I18n.t === 'function') s = window.I18n.t(key, params || {}); } catch (e) { s = null; }
    if (!s || s === key) {
      s = fallback || key;
      Object.keys(params || {}).forEach(function (k) { s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), params[k]); });
    }
    return s;
  }
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtBytes(n) {
    if (!(n > 0)) return '0 MB';
    if (n < 1073741824) return Math.max(1, Math.round(n / 1048576)) + ' MB';
    return (n / 1073741824).toFixed(1) + ' GB';
  }
  function readJSON(key) { try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { return {}; } }
  function writeJSON(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  function reciter(i) { return host.reciters()[i]; }
  function tracksOf(r) { return (host.tracksFor(r) || []).filter(function (t) { return t && /^https:\/\//.test(t.url); }); }

  // On mobile data? (Android Chrome reports the connection type; elsewhere unknown.)
  function onMobileData() {
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!c) return null;
    if (c.type === 'cellular') return true;
    if (c.type === 'wifi' || c.type === 'ethernet') return false;
    return null;
  }

  // ---------- storage ----------
  async function loadSaved() {
    if (!('caches' in window)) return;
    try {
      var cache = await caches.open(OFFLINE_CACHE);
      var keys = await cache.keys();
      savedUrls = new Set(keys.map(function (k) { return k.url; }));
    } catch (e) {}
  }

  function countSaved(r) {
    var tracks = tracksOf(r);
    var n = 0;
    tracks.forEach(function (t) { if (savedUrls.has(t.url)) n++; });
    return { saved: n, total: tracks.length };
  }

  function updateIndex(r, extra) {
    var idx = readJSON(INDEX_KEY);
    var c = countSaved(r);
    if (c.saved === 0) { delete idx[r.id]; }
    else {
      var prev = idx[r.id] || {};
      idx[r.id] = { name: r.name, saved: c.saved, total: c.total, bytes: (extra && extra.bytes != null) ? extra.bytes : (prev.bytes || 0), updated: Date.now() };
    }
    writeJSON(INDEX_KEY, idx);
  }

  async function freeSpace() {
    try {
      if (!navigator.storage || !navigator.storage.estimate) return null;
      var e = await navigator.storage.estimate();
      return (e.quota && e.usage != null) ? Math.max(0, e.quota - e.usage) : null;
    } catch (e) { return null; }
  }

  // Total size of a recitation, from the size each file reports (HEAD). Kept
  // for next time; never blocks the download.
  var sizing = {};
  async function estimateSize(r) {
    var sizes = readJSON(SIZE_KEY);
    if (sizes[r.id]) return sizes[r.id];
    if (sizing[r.id]) return sizing[r.id];
    var tracks = tracksOf(r);
    sizing[r.id] = (async function () {
      var total = 0, known = 0, next = 0;
      async function worker() {
        while (next < tracks.length) {
          var t = tracks[next++];
          try {
            var res = await fetch(t.url, { method: 'HEAD', cache: 'no-store' });
            var len = Number(res.headers.get('content-length'));
            if (res.ok && len > 0) { total += len; known++; }
          } catch (e) {}
        }
      }
      var ws = []; for (var i = 0; i < 8; i++) ws.push(worker());
      await Promise.all(ws);
      if (!known) return null;
      var est = Math.round(total * tracks.length / known);   // scale up for the few that didn't answer
      var s = readJSON(SIZE_KEY); s[r.id] = est; writeJSON(SIZE_KEY, s);
      return est;
    })();
    var v = await sizing[r.id];
    delete sizing[r.id];
    return v;
  }

  // ---------- download ----------
  async function saveOne(cache, url) {
    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        var res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) continue;
        var len = Number(res.headers.get('content-length')) || 0;
        var headers = { 'Content-Type': res.headers.get('content-type') || 'audio/mpeg' };
        if (len) headers['Content-Length'] = String(len);
        // Stored as a plain 200 under the URL the player uses (the host may
        // have redirected). put() rejects if the body is cut short.
        await cache.put(url, new Response(res.body, { status: 200, headers: headers }));
        return len || 1;
      } catch (e) {
        if (e && e.name === 'QuotaExceededError') throw e;
      }
    }
    return 0;
  }

  async function start(index) {
    if (job || !('caches' in window)) return;
    var r = reciter(index);
    var tracks = tracksOf(r);
    var todo = tracks.filter(function (t) { return !savedUrls.has(t.url); });
    var prevBytes = (readJSON(INDEX_KEY)[r.id] || {}).bytes || 0;
    job = { id: r.id, index: index, total: tracks.length, done: tracks.length - todo.length, failed: 0, bytes: prevBytes, paused: false, quota: false };
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) {}
    render(); notify();

    var cache = await caches.open(OFFLINE_CACHE);
    var next = 0;
    async function worker() {
      while (next < todo.length && !job.paused && !job.quota) {
        var t = todo[next++];
        try {
          var got = await saveOne(cache, t.url);
          if (got) { savedUrls.add(t.url); job.done++; job.bytes += got; }
          else job.failed++;
        } catch (e) { job.quota = true; }
        render(); notify();
      }
    }
    var ws = []; for (var i = 0; i < CONCURRENCY; i++) ws.push(worker());
    await Promise.all(ws);

    var finished = job;
    job = null;
    lastResult = finished;   // shown in the sheet: failures, full disk
    updateIndex(r, { bytes: finished.bytes });
    render(); notify();
    if (!finished.paused && !finished.quota && finished.done >= finished.total && typeof window.showToast === 'function') {
      window.showToast(T('offl_complete', null, 'محفوظ للاستماع دون اتصال') + ' · ' + host.nameOf(r), 3500);
    }
  }
  var lastResult = null;

  function pause() { if (job) job.paused = true; }

  async function remove(index) {
    var r = reciter(index);
    if (job && job.id === r.id) return;
    var ok = window.confirm(T('offl_delete_confirm', { name: host.nameOf(r) }, 'حذف تلاوة {name} من الجهاز؟'));
    if (!ok) return;
    try {
      var cache = await caches.open(OFFLINE_CACHE);
      await Promise.all(tracksOf(r).map(function (t) { savedUrls.delete(t.url); return cache.delete(t.url); }));
    } catch (e) {}
    updateIndex(r);
    if (lastResult && lastResult.id === r.id) lastResult = null;
    render(); notify();
  }

  // ---------- UI ----------
  function notify() { try { if (host && host.onChange) host.onChange(); } catch (e) {} }

  async function render() {
    var body = $('offlineBody');
    if (!body || !host) return;
    var i = targetIndex != null ? targetIndex : host.currentIndex();
    var r = reciter(i);
    if (!r) return;
    var c = countSaved(r);
    var running = job && job.id === r.id;
    var otherRunning = job && job.id !== r.id;
    var complete = c.total > 0 && c.saved >= c.total;
    var sizes = readJSON(SIZE_KEY);
    var size = sizes[r.id];
    var mobile = onMobileData();

    var status;
    if (running) status = T('offl_progress', { done: job.done, total: job.total, size: fmtBytes(job.bytes) }, '{done} من {total} · {size}');
    else if (complete) status = T('offl_complete', null, 'محفوظ للاستماع دون اتصال');
    else if (c.saved > 0) status = T('offl_paused', { done: c.saved, total: c.total }, 'متوقف · {done} من {total}');
    else status = '';

    var pct = c.total ? Math.round(((running ? job.done : c.saved) / c.total) * 100) : 0;
    var note = '';
    if (!complete && !running) {
      if (mobile === true) note = '<div class="offl-note warn">' + esc(T('offl_mobile', { size: size ? fmtBytes(size) : '…' }, 'أنت على بيانات الجوال. سيستهلك التحميل نحو {size} من باقتك.')) + '</div>';
      else if (mobile === null) note = '<div class="offl-note">' + esc(T('offl_wifi_hint', null, 'يُفضّل الاتصال بشبكة Wi-Fi')) + '</div>';
    }
    var err = '';
    if (!running && lastResult && lastResult.id === r.id) {
      if (lastResult.quota) err = '<div class="offl-note warn">' + esc(T('offl_no_space', null, 'لا توجد مساحة كافية على الجهاز')) + '</div>';
      else if (lastResult.failed) err = '<div class="offl-note warn">' + esc(T('offl_failed', { n: lastResult.failed }, 'تعذّر تحميل {n} — تحقق من الاتصال ثم تابع')) + '</div>';
    }

    var primary;
    if (running) primary = '<button type="button" class="offl-btn" data-act="pause">' + esc(T('offl_pause', null, 'إيقاف مؤقت')) + '</button>';
    else if (complete) primary = '';
    else if (otherRunning) primary = '<button type="button" class="offl-btn" disabled>' + esc(T('offl_start', null, 'تحميل')) + '</button>';
    else if (c.saved > 0) primary = '<button type="button" class="offl-btn" data-act="start">' + esc(T('offl_resume', null, 'متابعة التحميل')) + '</button>';
    else primary = '<button type="button" class="offl-btn" data-act="start">' + esc(mobile === true ? T('offl_start_mobile', null, 'تحميل على بيانات الجوال') : T('offl_start', null, 'تحميل')) + '</button>';
    var del = (c.saved > 0 && !running) ? '<button type="button" class="offl-btn ghost" data-act="delete">' + esc(T('offl_delete', null, 'حذف')) + '</button>' : '';

    var free = await freeSpace();
    var meta = T('offl_surahs', { n: c.total }, '{n} سورة') + ' · ' + (size ? T('offl_size', { size: fmtBytes(size) }, 'نحو {size}') : T('offl_size_calc', null, 'جاري حساب الحجم…'));

    var html =
      '<div class="offl-card' + (complete ? ' is-done' : '') + '">' +
        '<div class="offl-head">' +
          (r.photo ? '<img class="offl-photo" src="../' + esc(r.photo) + '" alt="" onerror="this.style.display=\'none\'">' : '') +
          '<div class="offl-who"><div class="offl-name">' + esc(host.nameOf(r)) + '</div><div class="offl-meta">' + esc(meta) + '</div></div>' +
          (complete ? '<span class="offl-check" aria-hidden="true"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></span>' : '') +
        '</div>' +
        (c.saved > 0 || running ? '<div class="offl-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><i style="width:' + pct + '%"></i></div>' : '') +
        (status ? '<div class="offl-status">' + esc(status) + '</div>' : '') +
        note + err +
        ((primary || del) ? '<div class="offl-actions">' + primary + del + '</div>' : '') +
        (running ? '<div class="offl-hint">' + esc(T('offl_keep_open', null, 'يستمر التحميل ما دامت هذه الصفحة مفتوحة')) + '</div>' : '') +
        (free != null && !complete ? '<div class="offl-hint">' + esc(T('offl_free', { size: fmtBytes(free) }, 'المساحة المتاحة: {size}')) + '</div>' : '') +
      '</div>';

    // saved recitations
    var idx = readJSON(INDEX_KEY);
    var rows = '';
    host.reciters().forEach(function (rr, ri) {
      var e = idx[rr.id];
      if (!e || !e.saved) return;
      rows += '<div class="offl-row' + (ri === i ? ' current' : '') + '">' +
        '<button type="button" class="offl-row-main" data-act="show" data-i="' + ri + '">' +
          '<span class="offl-row-name">' + esc(host.nameOf(rr)) + '</span>' +
          '<span class="offl-row-sub">' + esc(e.saved + ' / ' + e.total + (e.bytes ? ' · ' + fmtBytes(e.bytes) : '')) + '</span>' +
        '</button>' +
        '<button type="button" class="offl-row-del" data-act="delete" data-i="' + ri + '" aria-label="' + esc(T('offl_delete', null, 'حذف')) + '">' +
          '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>' +
        '</button></div>';
    });
    html += '<div class="settings-section"><div class="settings-section-label">' + esc(T('offl_saved_title', null, 'المصاحف المحفوظة')) + '</div>' +
      (rows || '<div class="offl-empty">' + esc(T('offl_none_saved', null, 'لا توجد تلاوات محفوظة بعد')) + '</div>') + '</div>';
    body.innerHTML = html;

    if (!size && !sizing[r.id]) estimateSize(r).then(function (v) { if (v) render(); });
  }

  function onClick(e) {
    var b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    var act = b.getAttribute('data-act');
    var i = b.hasAttribute('data-i') ? +b.getAttribute('data-i') : (targetIndex != null ? targetIndex : host.currentIndex());
    if (act === 'start') start(i);
    else if (act === 'pause') pause();
    else if (act === 'delete') remove(i);
    else if (act === 'show') { targetIndex = i; render(); }
  }

  function openSheet(index) {
    if (!host) return;   // track lists not loaded yet
    targetIndex = index != null ? index : host.currentIndex();
    lastResult = (lastResult && lastResult.id === (reciter(targetIndex) || {}).id) ? lastResult : null;
    render();
    if (typeof window.openSheet === 'function') window.openSheet('offlineSheet', true);
  }

  // One line for the settings row of the current reciter.
  function summary(index) {
    if (!host) return '';
    var r = reciter(index);
    if (!r) return '';
    if (job && job.id === r.id) return T('offl_progress', { done: job.done, total: job.total, size: fmtBytes(job.bytes) }, '{done} من {total} · {size}');
    var c = countSaved(r);
    if (c.total && c.saved >= c.total) return T('offl_complete', null, 'محفوظ للاستماع دون اتصال');
    if (c.saved) return T('offl_paused', { done: c.saved, total: c.total }, 'متوقف · {done} من {total}');
    return T('offl_row_sub', null, 'احفظ تلاوة كاملة للاستماع دون اتصال');
  }

  function isSaved(url) { return savedUrls.has(url); }
  function isReciterSaved(r) { if (!host) return false; var c = countSaved(r); return c.total > 0 && c.saved >= c.total; }

  async function init(opts) {
    host = opts;
    await loadSaved();
    var body = $('offlineBody');
    if (body) body.addEventListener('click', onClick);
    window.addEventListener('beforeunload', function (e) {
      if (job && !job.paused) { e.preventDefault(); e.returnValue = ''; }
    });
    window.AudioOffline.ready = true;
    notify();
  }

  window.AudioOffline = {
    init: init, openSheet: openSheet, render: render, summary: summary,
    isSaved: isSaved, isReciterSaved: isReciterSaved,
    _cacheName: OFFLINE_CACHE
  };
})();
