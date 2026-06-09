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

  async function loadLang(lang) {
    if (translations[lang]) return translations[lang];
    try {
      const resp = await fetch(`js/i18n/${lang}.js`);
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

  // Language switcher widget
  function createSwitcher(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const langs = [
      { code: 'ar', label: 'العربية', flag: '🇸🇦' },
      { code: 'en', label: 'English', flag: '🇬🇧' },
      { code: 'ckb', label: 'کوردی', flag: '☀️' },
      { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
      { code: 'ur', label: 'اردو', flag: '🇵🇰' },
    ];

    container.innerHTML = langs.map(l => `
      <button type="button" class="lang-btn ${l.code === currentLang ? 'active' : ''}"
              data-lang="${l.code}"
              title="${l.label}">
        <span class="lang-flag">${l.flag}</span>
        <span class="lang-name">${l.label}</span>
      </button>
    `).join('');

    container.addEventListener('click', e => {
      const btn = e.target.closest('[data-lang]');
      if (!btn) return;
      const lang = btn.dataset.lang;
      container.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setLang(lang);
    });
  }

  return { t, init, setLang, getLang, isRTL, applyTranslations, loadLang, createSwitcher };
})();

// Global shorthand
window.I18n = I18n;
window.t = I18n.t;
