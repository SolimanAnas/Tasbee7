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

  // Relative length of each surah (letters ÷ 10, from data/quran.json). Audio
  // size follows text length, so downloading in this order goes from the
  // short surahs to the long ones: progress moves quickly from the start
  // instead of sitting on Al-Baqarah first.
  var SURAH_LEN = [14,2610,1483,1618,1210,1268,1434,539,1102,758,780,730,355,353,286,777,664,656,391,540,504,530,444,572,387,561,480,593,430,348,217,157,572,359,323,305,387,306,485,509,337,353,359,148,207,266,241,251,153,152,155,133,145,148,168,174,254,204,196,156,97,78,81,109,121,110,136,129,114,97,98,113,88,105,70,110,84,80,79,58,45,35,77,47,48,28,32,40,60,36,27,34,18,12,18,31,13,42,18,19,18,14,9,16,12,10,13,6,11,10,10,7,9,10];

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
  // https links only (plus a local test server, which never ships in the data)
  var OK_URL = /^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/)/;
  function tracksOf(r) { return (host.tracksFor(r) || []).filter(function (t) { return t && OK_URL.test(t.url); }); }

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
  function surahOf(t) {
    if (t.number) return +t.number;
    var m = /^\s*(\d{1,3})\b/.exec(t.name || '');
    return m ? +m[1] : 0;
  }

  // Shortest surahs first; a list that isn't per surah keeps its own order.
  function downloadOrder(tracks) {
    var all = tracks.every(function (t) { var n = surahOf(t); return n >= 1 && n <= 114; });
    if (!all) return tracks.slice();
    return tracks.slice().sort(function (a, b) {
      return (SURAH_LEN[surahOf(a) - 1] - SURAH_LEN[surahOf(b) - 1]) || (surahOf(b) - surahOf(a));
    });
  }

  // One file. `item` tracks its progress for the per-surah bars:
  // { name, got, size }. Counting happens on the way into the cache.
  async function saveOne(cache, url, item) {
    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        item.got = 0;
        var res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) continue;
        var len = Number(res.headers.get('content-length')) || 0;
        item.size = len;
        var headers = { 'Content-Type': res.headers.get('content-type') || 'audio/mpeg' };
        if (len) headers['Content-Length'] = String(len);
        var body = res.body;
        if (body && typeof TransformStream !== 'undefined') {
          body = body.pipeThrough(new TransformStream({
            transform: function (chunk, ctl) { item.got += chunk.byteLength; schedulePaint(); ctl.enqueue(chunk); }
          }));
        }
        // Stored as a plain 200 under the URL the player uses (the host may
        // have redirected). put() rejects if the body is cut short.
        await cache.put(url, new Response(body, { status: 200, headers: headers }));
        return len || item.got || 1;
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
    var todo = downloadOrder(tracks.filter(function (t) { return !savedUrls.has(t.url); }));
    var prevBytes = (readJSON(INDEX_KEY)[r.id] || {}).bytes || 0;
    job = { id: r.id, index: index, total: tracks.length, done: tracks.length - todo.length, failed: 0, bytes: prevBytes,
            paused: false, quota: false, active: [] };
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) {}
    render(); notify();

    var cache = await caches.open(OFFLINE_CACHE);
    var next = 0;
    async function worker() {
      while (next < todo.length && !job.paused && !job.quota) {
        var t = todo[next++];
        var item = { name: t.originalName || t.name || '', got: 0, size: 0 };
        job.active.push(item);
        render();
        try {
          var got = await saveOne(cache, t.url, item);
          if (got) { savedUrls.add(t.url); job.done++; job.bytes += got; }
          else job.failed++;
        } catch (e) { job.quota = true; }
        job.active.splice(job.active.indexOf(item), 1);
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

  // Overall progress, 0…1: bytes against the size estimate when there is one
  // (in-flight files included), otherwise files done.
  function progressOf(r) {
    var c = countSaved(r);
    if (!(job && job.id === r.id)) return c.total ? c.saved / c.total : 0;
    var est = readJSON(SIZE_KEY)[r.id];
    var inflight = job.active.reduce(function (a, it) { return a + it.got; }, 0);
    if (est) return Math.min(0.999, (job.bytes + inflight) / est);
    return job.total ? job.done / job.total : 0;
  }

  function overallText(r) {
    var est = readJSON(SIZE_KEY)[r.id];
    var inflight = job.active.reduce(function (a, it) { return a + it.got; }, 0);
    var got = fmtBytes(job.bytes + inflight);
    return est
      ? T('offl_progress_of', { done: job.done, total: job.total, size: got, total_size: fmtBytes(est) }, '{done} من {total} · {size} من {total_size}')
      : T('offl_progress', { done: job.done, total: job.total, size: got }, '{done} من {total} · {size}');
  }

  function activeRowsHtml() {
    return job.active.map(function (it) {
      var pct = it.size ? Math.min(100, Math.round(it.got / it.size * 100)) : 0;
      return '<div class="offl-file"><div class="offl-file-top"><span class="offl-file-name">' + esc(it.name) +
        '</span><span class="offl-file-pct">' + pct + '%</span></div>' +
        '<div class="offl-file-bar"><i style="width:' + pct + '%"></i></div></div>';
    }).join('');
  }

  // Byte-level updates repaint only the progress parts, a few times a second.
  var paintTimer = null;
  function schedulePaint() {
    if (paintTimer) return;
    paintTimer = setTimeout(function () { paintTimer = null; paint(); notify(); }, 250);
  }
  function paint() {
    if (!job || !host) return;
    var i = targetIndex != null ? targetIndex : host.currentIndex();
    var r = reciter(i);
    if (!r || r.id !== job.id) return;
    var pct = Math.round(progressOf(r) * 100);
    var fill = $('offlOverallFill'), text = $('offlOverallText'), files = $('offlFiles'), bar = $('offlOverallBar');
    if (fill) fill.style.width = pct + '%';
    if (bar) bar.setAttribute('aria-valuenow', String(pct));
    if (text) text.textContent = overallText(r);
    if (files) files.innerHTML = activeRowsHtml();
  }

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
    if (running) status = overallText(r);
    else if (complete) status = T('offl_complete', null, 'محفوظ للاستماع دون اتصال');
    else if (c.saved > 0) status = T('offl_paused', { done: c.saved, total: c.total }, 'متوقف · {done} من {total}');
    else status = '';

    var pct = Math.round(progressOf(r) * 100);
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
        (c.saved > 0 || running ? '<div class="offl-bar" id="offlOverallBar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><i id="offlOverallFill" style="width:' + pct + '%"></i></div>' : '') +
        (status ? '<div class="offl-status" id="offlOverallText">' + esc(status) + '</div>' : '') +
        (running ? '<div class="offl-files" id="offlFiles">' + activeRowsHtml() + '</div>' : '') +
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
    if (job && job.id === r.id) return overallText(r);
    var c = countSaved(r);
    if (c.total && c.saved >= c.total) return T('offl_complete', null, 'محفوظ للاستماع دون اتصال');
    if (c.saved) return T('offl_paused', { done: c.saved, total: c.total }, 'متوقف · {done} من {total}');
    return T('offl_row_sub', null, 'احفظ تلاوة كاملة للاستماع دون اتصال');
  }

  // For the card on the player: { state: idle | running | partial | done, pct, text }
  function cardState(index) {
    if (!host) return { state: 'idle', pct: 0, text: '' };
    var r = reciter(index);
    if (!r) return { state: 'idle', pct: 0, text: '' };
    var c = countSaved(r);
    if (job && job.id === r.id) return { state: 'running', pct: Math.round(progressOf(r) * 100), text: overallText(r) };
    if (c.total && c.saved >= c.total) return { state: 'done', pct: 100, text: T('offl_complete', null, 'محفوظ للاستماع دون اتصال') };
    if (c.saved) return { state: 'partial', pct: Math.round(c.saved / c.total * 100), text: T('offl_paused', { done: c.saved, total: c.total }, 'متوقف · {done} من {total}') };
    return { state: 'idle', pct: 0, text: T('offl_title', null, 'تحميل المصحف كاملاً') };
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
    init: init, openSheet: openSheet, render: render, summary: summary, cardState: cardState,
    isSaved: isSaved, isReciterSaved: isReciterSaved,
    _cacheName: OFFLINE_CACHE
  };
})();
