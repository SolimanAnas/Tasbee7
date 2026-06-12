/* theme-manager.js — single source of truth for the app-wide theme.
 *
 * Canonical storage: localStorage 'themeMode' ∈ 'dark' | 'light' | 'sepia'.
 * Migrates the legacy per-page keys on first load (appThemeIndex, appThemeIdx,
 * appTheme) so an old choice carries over, then keeps everything on themeMode —
 * the user's theme finally follows them across pages.
 *
 * Classic script, defines global ThemeManager:
 *   ThemeManager.init({ attrAlias })  apply stored theme now (call early to avoid FOUC)
 *   ThemeManager.get()                canonical current value
 *   ThemeManager.set(mode)            persist + apply + dispatch 'themechange'
 *   ThemeManager.cycle()              dark → light → sepia → dark
 *
 * attrAlias maps canonical → page CSS value for pages whose stylesheets predate
 * the canon (e.g. azkar's [data-theme="warm"]): { sepia: 'warm' }.
 * Page-specific chrome (icons, dots, meta color) belongs in a 'themechange'
 * listener — the manager also refreshes <meta name="theme-color"> from the
 * page's --meta CSS variable when one is defined.
 */
(function (global) {
  'use strict';

  const KEY = 'themeMode';
  const THEMES = ['dark', 'light', 'sepia'];
  const LEGACY_INDEX_KEYS = ['appThemeIndex', 'appThemeIdx']; // numeric index into ['dark','light','sepia']
  const LEGACY_NAME_KEYS = ['appTheme'];                      // string value

  let alias = {};

  function normalize(mode) {
    if (THEMES.includes(mode)) return mode;
    return mode === 'warm' ? 'sepia' : 'light';
  }

  function migrate() {
    try {
      if (localStorage.getItem(KEY)) return;
      for (const k of LEGACY_NAME_KEYS) {
        const v = localStorage.getItem(k);
        if (v) { localStorage.setItem(KEY, normalize(v)); return; }
      }
      for (const k of LEGACY_INDEX_KEYS) {
        const v = parseInt(localStorage.getItem(k), 10);
        if (!isNaN(v) && THEMES[v]) { localStorage.setItem(KEY, THEMES[v]); return; }
      }
    } catch (e) { /* storage unavailable */ }
  }

  function get() {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored) return normalize(stored);
    } catch (e) {}
    // Same first-visit behavior as index.html: follow the system preference.
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (e) { return 'dark'; }
  }

  function apply(mode) {
    const attr = alias[mode] || mode;
    document.documentElement.setAttribute('data-theme', attr);
    if (document.body) document.body.setAttribute('data-theme', attr);
    // Refresh the browser chrome color from the page's CSS if it defines --meta.
    const metaEl = document.querySelector('meta[name="theme-color"]');
    if (metaEl) {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--meta').trim()
        || (document.body && getComputedStyle(document.body).getPropertyValue('--meta').trim());
      if (v) metaEl.setAttribute('content', v);
    }
    try { window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: mode } })); } catch (e) {}
  }

  function set(mode) {
    mode = normalize(mode);
    try { localStorage.setItem(KEY, mode); } catch (e) {}
    apply(mode);
  }

  function cycle() {
    set(THEMES[(THEMES.indexOf(get()) + 1) % THEMES.length]);
  }

  function init(opts) {
    alias = (opts && opts.attrAlias) || {};
    migrate();
    apply(get());
  }

  global.ThemeManager = { init, get, set, cycle, THEMES };
})(typeof self !== 'undefined' ? self : this);
