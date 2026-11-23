/**
 * tap-a11y.js — makes tappable elements that are not real buttons usable
 * without a touch screen and announced by screen readers.
 *
 * Many controls in the app are <div>/<span> elements with an onclick
 * attribute. A finger can use them; a keyboard, a switch device or a screen
 * reader cannot. For each such element this script:
 *   • gives it role="button" (role="switch" plus aria-checked for toggle
 *     switches) and a place in the tab order;
 *   • lets Enter and Space activate it, like a button;
 *   • names unnamed toggle switches after the text of their row.
 *
 * A tappable area that contains other controls is left as it is (a button
 * inside a button is announced badly).
 * Elements whose onclick only guards a backdrop or stops propagation
 * ("event.target === this", "stopPropagation") are left alone: they are not
 * controls. Runs on load and again when the page adds new elements.
 *
 * Classic script, no dependencies.
 */
(function () {
  'use strict';

  var NATIVE = 'a[href],button,input,select,textarea,summary,label,option';
  var NOT_A_CONTROL = /event\.target\s*={2,3}\s*this|^event\.stopPropagation\(\);?$/;

  function isSwitch(el) {
    return el.classList.contains('switch') && !el.querySelector('input');
  }

  function switchOn(el) {
    return el.classList.contains('active') || el.classList.contains('on') || el.classList.contains('checked');
  }

  function rowLabel(el) {
    var row = el.parentElement;
    for (var i = 0; row && i < 3; i++, row = row.parentElement) {
      var text = '';
      for (var c = row.firstElementChild; c; c = c.nextElementSibling) {
        if (c === el || c.contains(el)) continue;
        text += ' ' + (c.innerText || c.textContent || '');
      }
      text = text.replace(/\s+/g, ' ').trim();
      if (text) return text.split(/(?<=[.!؟?])\s|\n/)[0].slice(0, 80);
    }
    return '';
  }

  function onKey(e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
      e.preventDefault();
      e.currentTarget.click();
    }
  }

  var switchObserver = typeof MutationObserver !== 'undefined' ? new MutationObserver(function (records) {
    records.forEach(function (r) { r.target.setAttribute('aria-checked', String(switchOn(r.target))); });
  }) : null;

  function enhance(el) {
    if (el.dataset.tapA11y) return;
    if (el.matches(NATIVE)) return;
    if (el.classList.contains('switch') && el.querySelector('input')) return;   // a styled checkbox: already accessible
    var handler = el.getAttribute('onclick');
    if (handler && NOT_A_CONTROL.test(handler.trim())) return;
    el.dataset.tapA11y = '1';
    // A tappable area that holds its own buttons (e.g. the dhikr card with its
    // A−/A+ buttons) must not become a button itself: nested controls confuse
    // screen readers. Its inner controls and a separate counter stay usable.
    if (!isSwitch(el) && el.querySelector('a[href],button,input,select,textarea,[onclick],[role="button"]')) return;

    if (isSwitch(el)) {
      if (!el.hasAttribute('role')) el.setAttribute('role', 'switch');
      el.setAttribute('aria-checked', String(switchOn(el)));
      if (switchObserver) switchObserver.observe(el, { attributes: true, attributeFilter: ['class'] });
      if (!el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')) {
        var label = rowLabel(el);
        if (label) el.setAttribute('aria-label', label);
      }
    } else if (!el.hasAttribute('role')) {
      el.setAttribute('role', 'button');
    }
    if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
    el.addEventListener('keydown', onKey);
  }

  function scan(root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('[onclick], .switch').forEach(enhance);
  }

  function start() {
    scan(document);
    if (typeof MutationObserver === 'undefined') return;
    var pending = false;
    new MutationObserver(function () {
      if (pending) return;
      pending = true;
      (window.requestAnimationFrame || setTimeout)(function () { pending = false; scan(document); });
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
