/**
 * net-status.js — the offline layer every page shares.
 *
 *  1. Registers the service worker. Only a handful of pages used to do it, so
 *     someone who entered the app on any other page (a shared link, a search
 *     result, a home-screen shortcut) got no offline cache at all.
 *  2. Shows a short notice when the connection drops, and another when it
 *     comes back, so a failed stream or search isn't mistaken for a broken app.
 *
 * Classic script, no dependencies; safe to load anywhere, with or without
 * i18n.js.
 */
(function () {
  'use strict';

  // ---- 1. service worker ----------------------------------------------------
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    var register = function () {
      navigator.serviceWorker.getRegistration().then(function (reg) {
        if (reg) return; // already registered by this or an earlier page
        // sw.js sits at the app root: next to index.html, one level above pages/.
        var swUrl = /\/pages\/[^/]*$/.test(location.pathname) ? '../sw.js' : './sw.js';
        return navigator.serviceWorker.register(swUrl);
      }).catch(function () {});
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register);
  }

  // ---- 2. connection notice -------------------------------------------------
  // Pages framed by the continuous player would each show their own copy.
  if (window.top !== window.self) return;

  var TEXT = {
    ar:  ['لا يوجد اتصال — المحتوى المحفوظ يعمل كالمعتاد', 'عاد الاتصال بالإنترنت'],
    en:  ['You are offline — saved content still works', 'Back online'],
    tr:  ['Çevrimdışısınız — kayıtlı içerik çalışmaya devam ediyor', 'Bağlantı geri geldi'],
    ckb: ['پەیوەندی ئینتەرنێت نییە — ناوەڕۆکی پاشەکەوتکراو کار دەکات', 'پەیوەندی ئینتەرنێت گەڕایەوە'],
    ur:  ['آپ آف لائن ہیں — محفوظ شدہ مواد کام کرتا رہے گا', 'انٹرنیٹ کنکشن بحال ہو گیا']
  };
  var SEEN_KEY = 'zad_offline_notice_shown';

  function lang() {
    try {
      if (window.I18n && typeof window.I18n.getLang === 'function') return window.I18n.getLang();
      return localStorage.getItem('zad_lang') || document.documentElement.lang || 'ar';
    } catch (_) { return 'ar'; }
  }

  function text(offline) {
    var key = offline ? 'net_offline' : 'net_online';
    try {
      if (window.I18n && typeof window.I18n.t === 'function') {
        var s = window.I18n.t(key);
        if (s && s !== key) return s;
      }
    } catch (_) {}
    return (TEXT[lang()] || TEXT.ar)[offline ? 0 : 1];
  }

  var el = null, timer = null;

  function ensure() {
    if (el && el.isConnected) return el;
    var style = document.createElement('style');
    style.textContent =
      '#net-status{position:fixed;top:calc(10px + env(safe-area-inset-top));left:0;right:0;' +
      'margin:0 auto;width:fit-content;box-sizing:border-box;text-align:center;' +
      'z-index:100001;display:flex;align-items:center;gap:8px;max-width:min(92vw,440px);' +
      "font-family:'Tajawal',sans-serif;font-size:13.5px;font-weight:700;line-height:1.5;" +
      'color:#f8fafc;background:rgba(30,41,59,.96);border:1px solid rgba(255,255,255,.14);' +
      'border-radius:18px;padding:8px 16px;box-shadow:0 8px 28px rgba(0,0,0,.35);' +
      'pointer-events:none;opacity:0;transform:translateY(-140%);' +
      'transition:transform .3s cubic-bezier(.22,1,.36,1),opacity .3s ease;}' +
      '#net-status.open{opacity:1;transform:translateY(0);}' +
      '#net-status.online{background:rgba(6,95,70,.97);}' +
      '#net-status i{flex:0 0 auto;width:8px;height:8px;border-radius:50%;background:#f59e0b;}' +
      '#net-status.online i{background:#34d399;}' +
      '@media (prefers-reduced-motion:reduce){#net-status{transition:opacity .2s ease;}}';
    document.head.appendChild(style);

    el = document.createElement('div');
    el.id = 'net-status';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.appendChild(document.createElement('i'));
    el.appendChild(document.createElement('span'));
    document.body.appendChild(el);
    return el;
  }

  function show(offline) {
    if (!document.body) return;
    var n = ensure();
    var l = lang();
    n.setAttribute('dir', l === 'en' || l === 'tr' ? 'ltr' : 'rtl');
    n.lastChild.textContent = text(offline);
    n.classList.toggle('online', !offline);
    // Next frame, so the entry transition runs on first use too.
    requestAnimationFrame(function () { n.classList.add('open'); });
    clearTimeout(timer);
    timer = setTimeout(function () { n.classList.remove('open'); }, offline ? 4500 : 2500);
  }

  function flag(v) {
    try {
      if (v) sessionStorage.setItem(SEEN_KEY, '1');
      else sessionStorage.removeItem(SEEN_KEY);
    } catch (_) {}
  }
  function flagged() {
    try { return sessionStorage.getItem(SEEN_KEY) === '1'; } catch (_) { return false; }
  }

  window.addEventListener('offline', function () { flag(true); show(true); });
  window.addEventListener('online', function () { flag(false); show(false); });

  // Opened while already offline: say so once per visit, not on every page.
  function initial() {
    if (navigator.onLine === false && !flagged()) { flag(true); show(true); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initial);
  else initial();
})();
