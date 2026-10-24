/**
 * offline-download.js — unified "Download for offline" controller.
 *
 * Caches the whole app (app shell + every page + dependent files + the full
 * hadith books) into the single service-worker cache so it all works offline.
 *
 * IMPORTANT: the download runs ENTIRELY IN THE PAGE via the CacheStorage API —
 * it does NOT depend on the service worker answering postMessage. That message
 * path was unreliable in the real world: right after an app update (or inside a
 * wrapped PWA / TWA on Android) the *controlling* SW can be an older build with
 * no message handler, so the request got no reply and the progress bar never
 * moved. Reading + writing the cache directly from the page avoids that class of
 * bug entirely and behaves identically in desktop Chrome, mobile Chrome, and a
 * PWABuilder/TWA webview.
 *
 * The asset list + cache name are read straight from the deployed sw.js, so
 * sw.js stays the single source of truth (no duplicated, drift-prone lists).
 *
 * Shared by index.html and pages/*.html. The host page must provide these
 * element IDs (any it omits is simply skipped):
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
    offline_error: 'تعذّر التحميل. تحقق من الاتصال ثم حاول مرة أخرى.'
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
  var manifestCache = null; // { cacheName, urls } — parsed once from sw.js

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

  // Locate the deployed sw.js from the SW registration scope (works regardless
  // of how deep the current page is), falling back to a path relative to the
  // page. Returns null only when service workers are entirely unavailable.
  async function swScriptUrl() {
    if (!('serviceWorker' in navigator)) return null;
    try {
      var reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        var w = reg.active || reg.waiting || reg.installing;
        if (w && w.scriptURL) return w.scriptURL;
        if (reg.scope) return new URL('sw.js', reg.scope).href;
      }
    } catch (_) {}
    // No registration yet: guess based on page location (index at root, or a
    // page under /pages/). Both resolve to the same sw.js at the app root.
    try { return new URL(/\/pages\//.test(location.pathname) ? '../sw.js' : './sw.js', location.href).href; }
    catch (_) { return null; }
  }

  // Read the full offline manifest (cache name + absolute asset URLs) straight
  // from sw.js so there is a single source of truth. Cached after first parse.
  async function loadManifest() {
    if (manifestCache) return manifestCache;
    var swUrl = await swScriptUrl();
    if (!swUrl) return null;
    var res;
    try { res = await fetch(swUrl, { cache: 'no-cache' }); }
    catch (_) { return null; }
    if (!res || !res.ok) return null;
    var txt = await res.text();

    var cacheName = (txt.match(/CACHE_NAME\s*=\s*["']([^"']+)["']/) || [])[1] || 'zad-muslim-offline';
    var base = new URL(swUrl, location.href);
    var seen = {};
    var urls = [];
    ['STATIC_ASSETS', 'OPTIONAL_ASSETS'].forEach(function (name) {
      var block = txt.match(new RegExp('(?:const|let|var)\\s+' + name + '\\s*=\\s*\\[([\\s\\S]*?)\\];'));
      if (!block) return;
      var strs = block[1].match(/["'](\.\/[^"']*)["']/g) || [];
      strs.forEach(function (s) {
        var rel = s.slice(1, -1);
        var abs = new URL(rel, base).href;
        if (!seen[abs]) { seen[abs] = 1; urls.push(abs); }
      });
    });
    if (!urls.length) return null;
    manifestCache = { cacheName: cacheName, urls: urls };
    return manifestCache;
  }

  async function refresh() {
    var statusEl = $('offlineStatusText');
    if (!statusEl) return;
    showStorage();
    var btn = $('offlineDownloadBtn');
    if (!('caches' in window)) { statusEl.textContent = T('offline_status_unavailable'); setDot('none'); return; }
    statusEl.textContent = '…';

    var mf = await loadManifest();
    if (!mf) { statusEl.textContent = T('offline_status_unavailable'); setDot('none'); return; }

    try {
      var cache = await caches.open(mf.cacheName);
      var matches = await Promise.all(mf.urls.map(function (u) {
        return cache.match(u).then(function (m) { return m || cache.match(u, { ignoreSearch: true }); });
      }));
      var cached = matches.filter(Boolean).length;
      var total = mf.urls.length;

      if (cached >= total) {
        statusEl.textContent = T('offline_status_complete');
        setDot('ok');
        if (btn && !downloading) { btn.textContent = T('offline_redownload'); btn.classList.add('is-done'); }
      } else if (cached > 0) {
        statusEl.textContent = cached + ' / ' + total;
        setDot('partial');
        if (btn) btn.classList.remove('is-done');
      } else {
        statusEl.textContent = T('offline_status_none');
        setDot('none');
        if (btn) btn.classList.remove('is-done');
      }
    } catch (_) {
      statusEl.textContent = T('offline_status_unavailable');
      setDot('none');
    }
  }

  async function start() {
    if (downloading) return;
    var statusEl = $('offlineStatusText');
    var btn = $('offlineDownloadBtn');
    var wrap = $('offlineProgressWrap');
    var fill = $('offlineProgressFill');
    var pctEl = $('offlineProgressPct');
    var ptext = $('offlineProgressText');

    if (!('caches' in window)) { if (statusEl) statusEl.textContent = T('offline_status_unavailable'); return; }

    var mf = await loadManifest();
    if (!mf) { if (statusEl) statusEl.textContent = T('offline_error'); return; }

    downloading = true;
    // Keep this cache from being evicted under storage pressure (Window context).
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (_) {}

    if (btn) { btn.disabled = true; btn.classList.remove('is-done'); }
    if (wrap) wrap.style.display = 'block';
    if (fill) fill.style.width = '0%';
    if (pctEl) pctEl.textContent = '0%';
    if (ptext) ptext.textContent = '';
    if (statusEl) statusEl.textContent = T('offline_downloading');
    setDot('partial');

    var total = mf.urls.length;
    var done = 0, failed = 0, bytes = 0;

    function render() {
      var p = total ? Math.round(done / total * 100) : 0;
      if (fill) fill.style.width = p + '%';
      if (pctEl) pctEl.textContent = p + '%';
      if (ptext) ptext.textContent = done + ' / ' + total + (bytes ? ' · ' + fmtBytes(bytes) : '');
    }
    render();

    try {
      var cache = await caches.open(mf.cacheName);
      for (var i = 0; i < mf.urls.length; i++) {
        var url = mf.urls[i];
        try {
          // Reuse an already-cached copy (the SW precached most on install) so
          // we only actually download what's missing (mainly the hadith books).
          var res = await cache.match(url);
          if (!res) {
            res = await fetch(url, { cache: 'no-cache' });
            if (res && res.ok) { await cache.put(url, res.clone()); }
            else { failed++; res = null; }
          }
          if (res) {
            var len = Number(res.headers.get('content-length'));
            if (!isNaN(len) && len > 0) bytes += len;
          }
        } catch (_) { failed++; }
        done++;
        render();
      }
    } catch (e) {
      downloading = false;
      if (btn) btn.disabled = false;
      if (wrap) wrap.style.display = 'none';
      if (statusEl) statusEl.textContent = T('offline_error');
      setDot('none');
      return;
    }

    downloading = false;
    if (fill) fill.style.width = '100%';
    if (pctEl) pctEl.textContent = '100%';
    if (ptext) ptext.textContent = failed ? (T('offline_done') + ' — ' + failed + ' ✗') : T('offline_done');
    if (btn) { btn.disabled = false; btn.textContent = T('offline_redownload'); btn.classList.add('is-done'); }
    if (statusEl) statusEl.textContent = T('offline_status_complete');
    setDot('ok');
    showStorage();
    setTimeout(function () { if (wrap) wrap.style.display = 'none'; if (fill) fill.style.width = '0%'; }, 3500);
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

  window.OfflineDownload = { open: open, close: close, start: start, refresh: refresh };
})();
