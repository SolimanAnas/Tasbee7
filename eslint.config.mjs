// Pragmatic ESLint setup for a classic-script (non-module) codebase:
// correctness rules only — no style nits. Inline <script> in HTML is out of
// scope until P2-2 extracts it.
import js from '@eslint/js';

// Globals the classic scripts share across files (each defines or consumes
// some of these on window/self).
const appGlobals = {
  // vendor
  adhan: 'readonly', Capacitor: 'readonly', Hls: 'readonly', initSqlJs: 'readonly', ort: 'readonly',
  // app modules (classic-script globals)
  NotificationSystem: 'writable', ThemeManager: 'readonly', PrayerService: 'readonly',
  Toast: 'readonly', I18n: 'readonly', AudioCache: 'readonly', TasmeeEngine: 'readonly',
  TasmeeMatcher: 'readonly', TasmeeStore: 'readonly', buildNotificationSchedule: 'readonly',
  cityCoordinatesMap: 'readonly', t: 'readonly', RADIO_STATIONS: 'readonly',
};

const browserGlobals = {
  window: 'readonly', document: 'readonly', navigator: 'readonly', localStorage: 'readonly',
  sessionStorage: 'readonly', fetch: 'readonly', caches: 'readonly', indexedDB: 'readonly',
  console: 'readonly', setTimeout: 'readonly', setInterval: 'readonly', clearTimeout: 'readonly',
  clearInterval: 'readonly', Notification: 'readonly', Audio: 'readonly', AbortSignal: 'readonly',
  AbortController: 'readonly', URL: 'readonly', URLSearchParams: 'readonly', Response: 'readonly',
  Request: 'readonly', Headers: 'readonly', TextEncoder: 'readonly', TextDecoder: 'readonly',
  crypto: 'readonly', performance: 'readonly', requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly', getComputedStyle: 'readonly', matchMedia: 'readonly',
  CustomEvent: 'readonly', Event: 'readonly', FileReader: 'readonly', Blob: 'readonly',
  alert: 'readonly', confirm: 'readonly', prompt: 'readonly', history: 'readonly',
  location: 'readonly', screen: 'readonly', self: 'readonly', globalThis: 'readonly',
  atob: 'readonly', btoa: 'readonly', structuredClone: 'readonly', queueMicrotask: 'readonly',
  IntersectionObserver: 'readonly', MutationObserver: 'readonly', ResizeObserver: 'readonly',
  DOMParser: 'readonly', XMLHttpRequest: 'readonly', WebSocket: 'readonly', Worker: 'readonly',
  AudioContext: 'readonly', webkitAudioContext: 'readonly', MediaMetadata: 'readonly',
  speechSynthesis: 'readonly', SpeechSynthesisUtterance: 'readonly',
  webkitSpeechRecognition: 'readonly', SpeechRecognition: 'readonly',
  importScripts: 'readonly', clients: 'readonly', registration: 'readonly',
};

export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'data/adhan.js', 'js/medina2.data.js',
              'js/quranpages.data.js', 'js/plugins/**', 'archive/**', 'mushaf*/**'],
  },
  {
    files: ['js/**/*.js', 'sw.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...browserGlobals, ...appGlobals },
    },
    rules: {
      ...js.configs.recommended.rules,
      // Classic scripts intentionally define globals consumed elsewhere / by HTML.
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
      'no-undef': 'warn', // cross-file globals make this advisory, not blocking
      'no-empty': ['error', { allowEmptyCatch: true }],
      // The files that DEFINE the shared globals would otherwise trip on them.
      'no-redeclare': ['error', { builtinGlobals: false }],
      // Tasmee normalisation regexes intentionally match Arabic combining
      // marks and exotic spaces — these rules misread that as a mistake.
      'no-misleading-character-class': 'off',
      'no-irregular-whitespace': ['error', { skipStrings: true, skipRegExps: true, skipTemplates: true, skipComments: true }],
    },
  },
  {
    // Real ES modules: locale dictionaries (export default) + the ONNX worker (imports).
    files: ['js/i18n/**/*.js', 'js/tarteel-worker.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...browserGlobals, ...appGlobals } },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', { args: 'none' }],
    },
  },
  {
    files: ['scripts/**/*.cjs', 'tests/**/*.js', 'test_all.js', 'playwright.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly', module: 'writable', process: 'readonly', __dirname: 'readonly',
        console: 'readonly', Buffer: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
        fetch: 'readonly', URL: 'readonly', AbortSignal: 'readonly',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', { args: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Tests pass callbacks into page.evaluate() that run in the browser.
      'no-undef': 'off',
    },
  },
];
