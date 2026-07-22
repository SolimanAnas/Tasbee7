/**
 * offline-download.js — unified "Download for offline" controller.
 *
 * Drives the service worker's ZAD_CACHE_ALL / ZAD_CACHE_STATUS handlers over a
 * MessageChannel so the whole app (app shell + every page + dependent files +
 * the full hadith books) is cached into the single SW cache (zad-muslim-vNN).
 *
 * Shared by index.html and pages/*.html so there is ONE offline mechanism and
 * ONE cache — no per-page duplicate asset lists that drift out of sync, and no
 * separate "zad-offline-v1" cache.
 *
 * The host page must provide these element IDs (any it omits is simply skipped):
 *   offlineModal            — the .modal-overlay wrapper (toggled with .active)
 *   offlineDot              — small status dot (gets .ok / .partial)
 *   offlineStatusText       — status label text
 *   offlineProgressWrap     — progress container (shown while downloading)
 *   offlineProgressFill     — the bar fill (width % is set)
 *   offlineProgressPct      — "42%" text
 *   offlineProgressText     — "120 / 294 · 30.1 MB" text
 *   offlineDownloadBtn      — the primary action button
 *   offlineStorage          — storage-usage line (optional)
 *
 * Localized via window.I18n when present (index.html); falls back to Arabic
 * strings otherwise (pages/quran-text.html is Arabic-only). Classic script,
 * no dependencies, safe to load anywhere.
 */
(function () {
  'use strict';

  // Arabic fallbacks — used when i18n is absent or a key is missing.
  var FALLBACK = {
    offline_status_complete: 'محمّل بالكامل ✓',
    offline_status_none: 'لم يتم التحميل بعد',
    offline_status_unavailable: 'غير متاح على هذا المتصفح',
    offline_redownload: 'إعادة التحميل والتحديث',
    offline_download_all: 'تحميل كل شيء للعمل بدون إنترنت',
    offline_done: 'تم التحميل بنجاح',
    offline_downloading: 'جاري التحميل…',
    offline_storage_used: 'المساحة المستخدمة: {used}',
    offline_needs_reopen: 'يتم تحديث التطبيق. أعد فتحه ثم حاول مرة أخرى.'
  };

  function T(key, params) {
    var str = null;
    try {
      if (window.I18n && typeof window.I18n.t === 'function') str = window.I18n.t(key, params || {});
    } catch (_) { str = null; }
    // i18n.t() returns the key itself when it has no translation — treat that
    // as "missing" and fall back to our Arabic copy so we never show a raw key.
    if (!str || str === key) {
      str = FALLBACK[key] || key;
      if (params) {
        Object.keys(params).forEach(function (k) {
          str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), params[k]);
        });
      }
    }
    return str;
  }

  function $(id) { return document.getElementById(id); }

  var downloading = false;

  // Resolve the service worker to talk to. Prefer a waiting/new worker (it has
  // the latest ZAD_CACHE_* handlers) over the current controller, which right
  // after an update may still be the OLD build that has no message handler.
  // Never hangs: if nothing is ready within 5s (e.g. a WebView where the SW
  // never takes control), resolves null so the UI can report "unavailable"
  // instead of spinning forever.
  function swActive() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);

    var pick = navigator.serviceWorker.getRegistration()
      .then(function (reg) {
        if (!reg) {
          // No registration yet — resolve via ready (the page registers on load).
          return navigator.serviceWorker.ready.then(function (r) { return r.active; });
        }
        // waiting = new build installed & ready; installing may not be ready to
        // receive messages, so fall back to active/controller for those.
        return reg.waiting || reg.active || navigator.serviceWorker.controller ||
          navigator.serviceWorker.ready.then(function (r) { return r.active; });
      })
      .catch(function () { return navigator.serviceWorker.controller || null; });

    var timeout = new Promise(function (res) { setTimeout(function () { res(null); }, 5000); });
    return Promise.race([pick, timeout]);
  }

  // Post a message to the SW over a MessageChannel and forward every reply to
  // onMessage. If the FIRST reply doesn't arrive within firstMs, onTimeout fires
  // once — this is how we detect a stale/old controlling SW (no handler) or a
  // WebView with no working SW, instead of hanging the UI. After the first
  // reply the watchdog uses nextMs (larger) so a slow single-file fetch during a
  // long download never trips it.
  function postToSW(sw, message, onMessage, onTimeout, firstMs, nextMs) {
    var settled = false, seen = false;
    var timer = setTimeout(fail, firstMs || 7000);
    var ch = new MessageChannel();
    function fail() {
      if (settled) return;
      settled = true;
      try { ch.port1.onmessage = null; } catch (_) {}
      onTimeout && onTimeout();
    }
    ch.port1.onmessage = function (e) {
      if (settled) return;
      seen = true;
      clearTimeout(timer);
      timer = setTimeout(fail, nextMs || 60000); // generous between-message window
      onMessage(e.data || {});
    };
    try {
      sw.postMessage(message, [ch.port2]);
    } catch (_) {
      clearTimeout(timer);
      fail();
    }
  }

  function fmtBytes(n) {
    if (!n || n < 0) return '0 MB';
    if (n < 1048576) return (n / 1024).toFixed(0) + ' KB';
    if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB';
    return (n / 1073741824).toFixed(2) + ' GB';
  }

  function setDot(state) { // 'ok' | 'partial' | 'none'
    var dot = $('offlineDot');
    if (!dot) return;
    dot.classList.remove('ok', 'partial');
    if (state === 'ok' || state === 'partial') dot.classList.add(state);
  }

  async function showStorage() {
    var el = $('offlineStorage');
    if (!el || !navigator.storage || !navigator.storage.estimate) return;
    try {
      var est = await navigator.storage.estimate();
      var used = fmtBytes(est.usage) + (est.quota ? ' / ' + fmtBytes(est.quota) : '');
      el.textContent = T('offline_storage_used', { used: used });
    } catch (_) {}
  }

  // Nudge the browser to activate a freshly-installed SW, so the next attempt
  // reaches a worker that actually has the ZAD_CACHE_* handlers.
  function nudgeUpdate() {
    try {
      navigator.serviceWorker.getRegistration().then(function (reg) {
        if (!reg) return;
        if (reg.waiting) { try { reg.waiting.postMessage({ type: 'SKIP_WAITING' }); } catch (_) {} }
        reg.update();
      });
    } catch (_) {}
  }

  async function refresh() {
    var statusEl = $('offlineStatusText');
    if (!statusEl) return;
    showStorage();
    var btn = $('offlineDownloadBtn');
    var sw = await swActive();
    if (!sw) { statusEl.textContent = T('offline_status_unavailable'); setDot('none'); return; }
    statusEl.textContent = '…';

    postToSW(sw, { type: 'ZAD_CACHE_STATUS' }, function (d) {
      if (d.type !== 'ZAD_CACHE_STATUS_RESULT') return;
      if (d.total > 0 && d.cached >= d.total) {
        statusEl.textContent = T('offline_status_complete');
        setDot('ok');
        if (btn && !downloading) { btn.textContent = T('offline_redownload'); btn.classList.add('is-done'); }
      } else if (d.cached > 0) {
        statusEl.textContent = d.cached + ' / ' + d.total;
        setDot('partial');
        if (btn) btn.classList.remove('is-done');
      } else {
        statusEl.textContent = T('offline_status_none');
        setDot('none');
        if (btn) btn.classList.remove('is-done');
      }
    }, function () {
      // No reply → the controlling SW is likely mid-update (old build still in
      // charge). Show a neutral dash, keep the button usable, and hasten the
      // new worker so a retry (or controllerchange) succeeds.
      statusEl.textContent = '—';
      setDot('none');
      nudgeUpdate();
    }, 6000);
  }

  async function start() {
    if (downloading) return;
    var statusEl = $('offlineStatusText');
    var sw = await swActive();
    if (!sw) { if (statusEl) statusEl.textContent = T('offline_status_unavailable'); return; }

    downloading = true;
    // Keep this cache from being evicted under storage pressure. Must run in the
    // page (Window) context — StorageManager.persist() is unavailable in the SW.
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (_) {}

    var btn = $('offlineDownloadBtn');
    var wrap = $('offlineProgressWrap');
    var fill = $('offlineProgressFill');
    var pctEl = $('offlineProgressPct');
    var ptext = $('offlineProgressText');
    if (btn) { btn.disabled = true; btn.classList.remove('is-done'); }
    if (wrap) wrap.style.display = 'block';
    if (fill) fill.style.width = '0%';
    if (pctEl) pctEl.textContent = '0%';
    if (ptext) ptext.textContent = '';
    if (statusEl) statusEl.textContent = T('offline_downloading');
    setDot('partial');

    postToSW(sw, { type: 'ZAD_CACHE_ALL' }, function (d) {
      if (d.type === 'ZAD_CACHE_PROGRESS') {
        var p = d.total ? Math.round(d.done / d.total * 100) : 0;
        if (fill) fill.style.width = p + '%';
        if (pctEl) pctEl.textContent = p + '%';
        if (ptext) ptext.textContent = d.done + ' / ' + d.total + (d.bytes ? ' · ' + fmtBytes(d.bytes) : '');
      } else if (d.type === 'ZAD_CACHE_DONE') {
        if (fill) fill.style.width = '100%';
        if (pctEl) pctEl.textContent = '100%';
        if (ptext) ptext.textContent = d.failed ? (T('offline_done') + ' — ' + d.failed + ' ✗') : T('offline_done');
        downloading = false;
        if (btn) { btn.disabled = false; btn.textContent = T('offline_redownload'); btn.classList.add('is-done'); }
        if (statusEl) statusEl.textContent = T('offline_status_complete');
        setDot('ok');
        showStorage();
        setTimeout(function () { if (wrap) wrap.style.display = 'none'; if (fill) fill.style.width = '0%'; }, 3500);
      }
    }, function () {
      // No reply from the SW — almost always because an old build is still the
      // active controller right after an update (it has no ZAD_CACHE_ALL
      // handler). Recover gracefully instead of hanging: re-enable, tell the
      // user to reopen, and hasten the new worker.
      downloading = false;
      if (btn) btn.disabled = false;
      if (wrap) wrap.style.display = 'none';
      if (statusEl) statusEl.textContent = T('offline_needs_reopen');
      setDot('none');
      nudgeUpdate();
    }, 8000);
  }

  function open() {
    var m = $('offlineModal');
    if (!m) return;
    m.classList.add('active');
    refresh();
  }
  function close() {
    var m = $('offlineModal');
    if (m) m.classList.remove('active');
  }

  // When a new service worker takes control (e.g. the updated build finished
  // activating after the app was reopened), re-sync the modal so a status that
  // was stuck on "—" / "reopen" recovers automatically without user action.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      var m = $('offlineModal');
      if (m && m.classList.contains('active') && !downloading) refresh();
    });
  }

  window.OfflineDownload = { open: open, close: close, start: start, refresh: refresh };
})();
