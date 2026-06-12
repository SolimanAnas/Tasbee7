/* toast.js — shared, self-contained snackbar. No page CSS or markup needed:
 * creates its own element on first use.
 *
 *   Toast.show('تم الحفظ');
 *   Toast.show('تعذر التحميل', { error: true, duration: 4000 });
 *
 * Classic script, defines global Toast. New code should use this instead of
 * adding another per-page showToast (8 copies existed when this was written).
 */
(function (global) {
  'use strict';

  let el = null, timer = null;

  function ensure() {
    if (el && el.isConnected) return el;
    el = document.createElement('div');
    el.id = 'app-toast';
    el.setAttribute('dir', 'rtl');
    el.style.cssText =
      'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(16px);' +
      'background:rgba(15,23,42,.93);color:#f8fafc;padding:10px 18px;border-radius:12px;' +
      "font-family:'Tajawal',sans-serif;font-size:14px;z-index:99999;opacity:0;" +
      'transition:opacity .25s ease,transform .25s ease;pointer-events:none;' +
      'max-width:80vw;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.35)';
    document.body.appendChild(el);
    return el;
  }

  function show(msg, opts) {
    opts = opts || {};
    const t = ensure();
    t.textContent = msg;
    t.style.background = opts.error ? 'rgba(159,18,57,.95)' : 'rgba(15,23,42,.93)';
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(timer);
    timer = setTimeout(hide, opts.duration || 3000);
  }

  function hide() {
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(16px)';
  }

  global.Toast = { show, hide };
})(typeof self !== 'undefined' ? self : this);
