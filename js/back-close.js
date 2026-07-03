/**
 * BackClose — makes the Android/TWA system back button close the topmost open
 * modal / bottom-sheet instead of leaving the page.
 *
 * In a TWA the system back button follows browser history, so without this,
 * pressing back with a sheet open exits the page entirely.
 *
 * Wiring pattern (per modal):
 *   function openX()  { ...show UI...; if (window.BackClose) BackClose.opened(closeX); }
 *   function closeX() { if (window.BackClose) BackClose.closed(); ...hide UI...; }
 *
 * How it works: opened() pushes a history sentinel and remembers the close
 * callback. A real back press pops the sentinel (popstate) and we invoke the
 * callback. A UI-initiated close calls closed(), which consumes the sentinel
 * via history.back() while suppressing our own popstate handling. closed() is
 * a no-op when the stack is empty, so close functions stay safe to call from
 * the popstate path itself (the entry was already popped by then).
 *
 * index.html has its own exit-confirmation popstate trap and must NOT load
 * this module — it already closes sheets on back.
 */
(function () {
  'use strict';
  const stack = [];   // close callbacks, innermost modal last
  let suppress = 0;   // popstates we caused ourselves via history.back()

  window.addEventListener('popstate', function () {
    if (suppress > 0) { suppress--; return; }
    const close = stack.pop();
    if (close) { try { close(); } catch (e) { /* keep history consistent */ } }
  });

  window.BackClose = {
    /** Call right after showing a modal/sheet. closeFn must hide that UI. */
    opened: function (closeFn) {
      stack.push(closeFn);
      try { history.pushState({ backClose: stack.length }, ''); } catch (e) { stack.pop(); }
    },
    /** Call at the START of a UI-initiated close (button/backdrop tap). */
    closed: function () {
      if (!stack.length) return;
      stack.pop();
      suppress++;
      history.back();
    }
  };
})();
