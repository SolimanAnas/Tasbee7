/**
 * sw-update.js — tells the user when a new app version has finished
 * installing in the background, since sw.js applies updates via
 * skipWaiting()/clients.claim() with no other signal to the page.
 *
 * Works no matter which page/script actually called
 * navigator.serviceWorker.register() — it looks up the existing
 * registration for the current scope rather than registering itself.
 *
 * Classic script, no dependencies (safe to load before or without i18n.js).
 */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;

  function t(key, fallback) {
    try { return (window.I18n && window.I18n.t) ? window.I18n.t(key) : fallback; }
    catch { return fallback; }
  }

  function showBanner() {
    if (document.getElementById('sw-update-banner')) return;

    const style = document.createElement('style');
    style.textContent =
      '#sw-update-banner{position:fixed;left:12px;right:12px;' +
      'bottom:calc(12px + env(safe-area-inset-bottom));z-index:100000;' +
      "display:flex;align-items:center;gap:12px;justify-content:space-between;" +
      "font-family:'Tajawal',sans-serif;font-size:14px;color:#f8fafc;" +
      'background:rgba(15,23,42,.97);border:1px solid rgba(255,255,255,.12);' +
      'border-radius:14px;padding:12px 14px;box-shadow:0 8px 30px rgba(0,0,0,.4);' +
      'max-width:480px;margin:0 auto;transform:translateY(120%);' +
      'transition:transform .3s cubic-bezier(.22,1,.36,1);}' +
      '#sw-update-banner.open{transform:translateY(0);}' +
      '#sw-update-banner button{flex:0 0 auto;border:none;border-radius:10px;' +
      "padding:8px 14px;font-family:inherit;font-size:13px;font-weight:700;" +
      'cursor:pointer;}' +
      '#sw-update-reload{background:#10b981;color:#04231a;}' +
      '#sw-update-dismiss{background:transparent;color:#cbd5e1;}';
    document.head.appendChild(style);

    const el = document.createElement('div');
    el.id = 'sw-update-banner';
    el.setAttribute('dir', 'rtl');
    el.innerHTML =
      '<span>' + escapeHTML(t('sw_update_available', 'نسخة جديدة متاحة')) + '</span>' +
      '<span style="display:flex;gap:8px;">' +
      '<button id="sw-update-dismiss" type="button">' + escapeHTML(t('sw_update_dismiss', 'لاحقاً')) + '</button>' +
      '<button id="sw-update-reload" type="button">' + escapeHTML(t('sw_update_reload', 'تحديث')) + '</button>' +
      '</span>';
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('open'));

    document.getElementById('sw-update-reload').addEventListener('click', () => window.location.reload());
    document.getElementById('sw-update-dismiss').addEventListener('click', () => {
      el.classList.remove('open');
      setTimeout(() => el.remove(), 320);
    });
  }

  function escapeHTML(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function watch(reg) {
    if (!reg) return;
    // An update already finished installing and is just waiting to activate.
    if (reg.waiting && navigator.serviceWorker.controller) { showBanner(); return; }

    function trackInstalling(worker) {
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        // 'installed' + an existing controller means this is an UPDATE, not
        // the first-ever install (which also passes through 'installed' but
        // has no controller yet).
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          showBanner();
        }
      });
    }
    trackInstalling(reg.installing);
    reg.addEventListener('updatefound', () => trackInstalling(reg.installing));
  }

  navigator.serviceWorker.getRegistration().then(watch).catch(() => {});
})();
