/**
 * i18n - Internationalization Engine for Zad Al-Muslim
 * Languages: Arabic (ar), English (en), Kurdish Sorani (ckb), Turkish (tr)
 */
const I18n = (() => {
  const STORAGE_KEY = 'zad_lang';
  const DEFAULT_LANG = 'ar';
  const RTL_LANGS = ['ar', 'ckb', 'ur'];

  let currentLang = localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;
  let translations = {};

  // Resolve the i18n folder relative to THIS script so it works from the root
  // (index.html) and from sub-pages (pages/*.html) and any deploy base.
  const _SCRIPT_SRC = (() => {
    if (document.currentScript && document.currentScript.src) return document.currentScript.src;
    // Fallback: find the script tag by its src attribute (covers dev servers
    // that break document.currentScript)
    const s = document.querySelector('script[src*="i18n.js"]');
    return s ? s.src : '';
  })();
  const _I18N_BASE = _SCRIPT_SRC
    ? new URL(_SCRIPT_SRC.replace(/i18n\.js(?:\?.*)?$/, 'i18n/')).href
    : new URL('../js/i18n/', document.baseURI).href;

  async function loadLang(lang) {
    if (translations[lang]) return translations[lang];
    try {
      const resp = await fetch(`${_I18N_BASE}${lang}.js`);
      const text = await resp.text();
      // Extract the object from "export default { ... }"
      const match = text.match(/export\s+default\s+(\{[\s\S]*\})/);
      if (match) {
        translations[lang] = (new Function('return ' + match[1]))();
      }
      return translations[lang] || {};
    } catch (e) {
      console.warn(`Failed to load lang: ${lang}`, e);
      if (lang !== DEFAULT_LANG) return loadLang(DEFAULT_LANG);
      return {};
    }
  }

  function t(key, params = {}) {
    const dict = translations[currentLang] || translations[DEFAULT_LANG] || {};
    let str = dict[key] || translations[DEFAULT_LANG]?.[key] || key;
    Object.keys(params).forEach(k => {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), params[k]);
    });
    return str;
  }

  // Localized content name (surah / reciter / station). Only en/tr Latin forms
  // are stored in window.I18N_NAMES; ar/ckb/ur fall back to the Arabic `fallback`
  // supplied by the caller (those languages use Arabic script natively).
  function name(category, key, fallback) {
    const cat = (typeof window !== 'undefined' && window.I18N_NAMES && window.I18N_NAMES[category]) || {};
    const e = cat[key];
    if (e && e[currentLang]) return e[currentLang];
    return (fallback != null) ? fallback : key;
  }

  async function setLang(lang) {
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    // Load the dictionary BEFORE applying — otherwise applyTranslations()
    // reads an empty dict and the UI stays in the previous language.
    await loadLang(lang);
    applyTranslations();
    updateDir();
    document.documentElement.lang = lang;
    window.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
  }

  function getLang() {
    return currentLang;
  }

  function isRTL() {
    return RTL_LANGS.includes(currentLang);
  }

  function updateDir() {
    document.documentElement.dir = isRTL() ? 'rtl' : 'ltr';
  }

  function applyTranslations() {
    const dict = translations[currentLang] || {};

    // Text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key && dict[key]) el.textContent = dict[key];
    });

    // innerHTML (for elements with mixed content)
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      if (key && dict[key]) el.innerHTML = dict[key];
    });

    // Placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key && dict[key]) el.placeholder = dict[key];
    });

    // Title attributes
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key && dict[key]) el.title = dict[key];
    });

    // Aria-label
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      if (key && dict[key]) el.setAttribute('aria-label', dict[key]);
    });

    // Document title
    const titleKey = document.querySelector('meta[name="i18n-title"]')?.content;
    if (titleKey && dict[titleKey]) document.title = dict[titleKey];
  }

  async function init() {
    await loadLang(currentLang);
    updateDir();
    document.documentElement.lang = currentLang;
    applyTranslations();
  }

  // Shared language metadata (native label + English name + flag).
  const LANGS = [
    { code: 'ar',  label: 'العربية', en: 'Arabic',          flag: '🇸🇦' },
    { code: 'en',  label: 'English', en: 'English',         flag: '🇬🇧' },
    { code: 'ckb', label: 'کوردی',   en: 'Kurdish (Sorani)', flag: '☀️' },
    { code: 'tr',  label: 'Türkçe',  en: 'Turkish',         flag: '🇹🇷' },
    { code: 'ur',  label: 'اردو',    en: 'Urdu',            flag: '🇵🇰' },
  ];

  const GLOBE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.2"/><path d="M2.8 12h18.4"/><path d="M12 2.8c2.6 2.85 4.1 6.1 4.1 9.2S14.6 18.35 12 21.2C9.4 18.35 7.9 15.1 7.9 12S9.4 5.65 12 2.8z"/></svg>';

  // Language switcher widget (inline button row — used in index settings)
  function createSwitcher(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = LANGS.map(l => `
      <button type="button" class="lang-btn ${l.code === currentLang ? 'active' : ''}"
              data-lang="${l.code}" title="${l.label}">
        <span class="lang-flag">${l.flag}</span>
        <span class="lang-name">${l.label}</span>
      </button>
    `).join('');
    container.addEventListener('click', e => {
      const btn = e.target.closest('[data-lang]');
      if (!btn) return;
      container.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setLang(btn.dataset.lang);
    });
  }

  // --- Bottom-sheet language picker (reusable + first-run prompt) ----------
  function _ensureSheetStyles() {
    if (document.getElementById('i18nSheetStyle')) return;
    const css = `
.i18n-ls-backdrop{position:fixed;inset:0;z-index:100000;display:flex;align-items:flex-end;justify-content:center;
  background:rgba(20,12,4,0);backdrop-filter:blur(0);-webkit-backdrop-filter:blur(0);
  transition:background .35s ease, backdrop-filter .35s ease;}
.i18n-ls-backdrop.open{background:rgba(20,12,4,.46);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);}
.i18n-ls-sheet{width:100%;max-width:460px;box-sizing:border-box;
  background:linear-gradient(180deg, rgba(255,252,245,.985), rgba(247,241,229,.985));
  border:1px solid rgba(175,140,85,.30);border-bottom:none;border-radius:30px 30px 0 0;
  box-shadow:0 -20px 60px rgba(60,40,10,.30);padding:10px 18px calc(22px + env(safe-area-inset-bottom));
  transform:translateY(101%);transition:transform .42s cubic-bezier(.22,1,.36,1);}
.i18n-ls-backdrop.open .i18n-ls-sheet{transform:translateY(0);}
.i18n-ls-handle{width:42px;height:5px;border-radius:99px;background:rgba(120,90,40,.25);margin:6px auto 16px;}
.i18n-ls-head{display:flex;align-items:center;gap:13px;padding:0 4px 16px;}
.i18n-ls-globe{width:48px;height:48px;flex:0 0 48px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  background:radial-gradient(circle at 50% 32%, rgba(26,112,64,.16), rgba(184,136,12,.10));
  border:1.5px solid rgba(26,112,64,.38);color:#1A7040;}
.i18n-ls-globe svg{width:27px;height:27px;}
.i18n-ls-title{font-family:'Amiri',serif;font-size:1.45rem;font-weight:700;color:#1A1208;line-height:1.1;}
.i18n-ls-sub{font-size:.78rem;color:#7A6248;letter-spacing:.03em;margin-top:3px;font-family:'Tajawal',sans-serif;}
.i18n-ls-list{display:flex;flex-direction:column;gap:9px;}
.i18n-ls-row{display:flex;align-items:center;gap:14px;width:100%;box-sizing:border-box;
  padding:13px 15px;border:1px solid rgba(175,140,85,.20);border-radius:17px;background:rgba(255,255,255,.55);
  cursor:pointer;text-align:start;font-family:'Tajawal',sans-serif;
  transition:transform .15s ease,background .2s ease,border-color .2s ease,box-shadow .2s ease;
  opacity:0;transform:translateY(13px);animation:i18nRowIn .42s cubic-bezier(.22,1,.36,1) forwards;}
@keyframes i18nRowIn{to{opacity:1;transform:translateY(0);}}
.i18n-ls-row:active{transform:scale(.98);}
.i18n-ls-row.active{border-color:rgba(26,112,64,.55);background:rgba(26,112,64,.09);box-shadow:0 4px 16px rgba(26,112,64,.13);}
.i18n-ls-flag{font-size:1.75rem;line-height:1;width:40px;flex:0 0 40px;text-align:center;}
.i18n-ls-meta{display:flex;flex-direction:column;flex:1;min-width:0;}
.i18n-ls-native{font-family:'Amiri',serif;font-size:1.28rem;font-weight:700;color:#1A1208;line-height:1.15;}
.i18n-ls-en{font-size:.76rem;color:#8A7250;letter-spacing:.02em;}
.i18n-ls-check{color:#B8880C;font-weight:800;font-size:1.15rem;opacity:0;transform:scale(.4);transition:.2s;}
.i18n-ls-row.active .i18n-ls-check{opacity:1;transform:scale(1);}
@media (prefers-reduced-motion:reduce){.i18n-ls-row{animation:none;opacity:1;transform:none;}.i18n-ls-sheet,.i18n-ls-backdrop{transition:none;}}`;
    const s = document.createElement('style');
    s.id = 'i18nSheetStyle';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function openLangSheet(opts) {
    opts = opts || {};
    _ensureSheetStyles();
    const existing = document.getElementById('i18nLangSheetWrap');
    if (existing) existing.remove();

    const wrap = document.createElement('div');
    wrap.id = 'i18nLangSheetWrap';
    wrap.className = 'i18n-ls-backdrop';
    wrap.dir = isRTL() ? 'rtl' : 'ltr';
    const rows = LANGS.map((l, i) => `
      <button type="button" class="i18n-ls-row${l.code === currentLang ? ' active' : ''}" data-lang="${l.code}" style="animation-delay:${(0.06 + i * 0.05).toFixed(2)}s">
        <span class="i18n-ls-flag">${l.flag}</span>
        <span class="i18n-ls-meta"><span class="i18n-ls-native">${l.label}</span><span class="i18n-ls-en">${l.en}</span></span>
        <span class="i18n-ls-check">✓</span>
      </button>`).join('');
    wrap.innerHTML = `
      <div class="i18n-ls-sheet" role="dialog" aria-modal="true" aria-label="Choose language">
        <div class="i18n-ls-handle"></div>
        <div class="i18n-ls-head">
          <div class="i18n-ls-globe">${GLOBE_SVG}</div>
          <div>
            <div class="i18n-ls-title">${opts.firstRun ? 'اختر لغتك' : 'اختر اللغة'}</div>
            <div class="i18n-ls-sub">Choose your language</div>
          </div>
        </div>
        <div class="i18n-ls-list">${rows}</div>
      </div>`;
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('open'));

    let chosen = false;
    const close = (persistDefault) => {
      if (opts.firstRun && persistDefault && !chosen) {
        try { localStorage.setItem(STORAGE_KEY, currentLang); } catch (e) {}
      }
      wrap.classList.remove('open');
      setTimeout(() => wrap.remove(), 320);
    };
    wrap.addEventListener('click', e => {
      const row = e.target.closest('[data-lang]');
      if (row) { chosen = true; setLang(row.dataset.lang); close(); return; }
      if (e.target === wrap) close(true); // tap backdrop to dismiss
    });
  }

  // Show the picker automatically the very first time (no language chosen yet).
  function maybeFirstRun() {
    try { if (!localStorage.getItem(STORAGE_KEY)) openLangSheet({ firstRun: true }); } catch (e) {}
  }

  return { t, name, init, setLang, getLang, isRTL, applyTranslations, loadLang, createSwitcher, openLangSheet, maybeFirstRun };
})();

// Global shorthand
window.I18n = I18n;
window.t = I18n.t;
