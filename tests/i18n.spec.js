const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8080';
const I18N_DIR = path.resolve(__dirname, '..', 'js', 'i18n');

const LANGS = ['ar', 'en', 'ckb', 'tr', 'ur'];
const RTL_LANGS = ['ar', 'ckb', 'ur'];

const SUB_PAGES = [
  { path: '/pages/audio.html', titleKey: 'audio_title', checkElement: '[data-i18n="audio_choose_reciter"]' },
  { path: '/pages/radio.html', titleKey: 'radio_title', checkElement: '[data-i18n="radio_header"]' },
  { path: '/pages/about.html', titleKey: 'about_title', checkElement: '[data-i18n="about_title"]' },
  { path: '/pages/howto.html', titleKey: 'howto_title', checkElement: '[data-i18n="howto_title"]' },
  { path: '/pages/masbaha.html', titleKey: 'masbaha_title', checkElement: '[data-i18n="masbaha_title"]' },
  { path: '/pages/qibla.html', titleKey: 'qibla_title', checkElement: '[data-i18n="qibla_title"]' },
  { path: '/pages/notifications.html', titleKey: 'notif_title', checkElement: '[data-i18n="notif_header"]' },
];

// =====================================================
// 1. All translation files exist and are valid modules
// =====================================================
for (const lang of LANGS) {
  test(`${lang}.js translation file exists and is valid`, async () => {
    const filePath = path.join(I18N_DIR, `${lang}.js`);
    expect(fs.existsSync(filePath), `${lang}.js should exist`).toBe(true);

    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toMatch(/^export default \{/);
    expect(content).toMatch(/\};\s*$/);

    const badKeys = content.match(/'[a-zA-Z0-9_]+'\s*:\s*'/g) || [];
    for (const k of badKeys) {
      const keyName = k.split(':')[0].replace(/['"]/g, '').trim();
      expect(keyName).not.toMatch(/:$/);
    }
  });
}

// =====================================================
// 2. All translation files have the same keys as ar.js
// =====================================================
test('all translation files have identical key sets', () => {
  const arContent = fs.readFileSync(path.join(I18N_DIR, 'ar.js'), 'utf8');
  const arKeys = extractKeys(arContent).sort();

  for (const lang of LANGS) {
    if (lang === 'ar') continue;
    const content = fs.readFileSync(path.join(I18N_DIR, `${lang}.js`), 'utf8');
    const langKeys = extractKeys(content).sort();

    const missingInLang = arKeys.filter(k => !langKeys.includes(k));
    const extraInLang = langKeys.filter(k => !arKeys.includes(k));

    expect(
      missingInLang,
      `${lang}.js is missing keys: ${missingInLang.join(', ')}`
    ).toEqual([]);

    expect(
      extraInLang,
      `${lang}.js has extra keys not in ar.js: ${extraInLang.join(', ')}`
    ).toEqual([]);
  }
});

// =====================================================
// 3. No translation value is empty
// =====================================================
for (const lang of LANGS) {
  test(`${lang}.js has no empty translation values`, async () => {
    const content = fs.readFileSync(path.join(I18N_DIR, `${lang}.js`), 'utf8');
    const matches = content.match(/'([^']+)':\s*'([^']*)'/g) || [];
    const empty = [];
    for (const m of matches) {
      const parts = m.split(/:\s*/);
      if (parts[1] === "''" || parts[1] === '""') {
        empty.push(parts[0].replace(/['"]/g, ''));
      }
    }
    expect(empty, `${lang}.js has empty values for: ${empty.join(', ')}`).toEqual([]);
  });
}

// =====================================================
// 4. No duplicate keys within a file
// =====================================================
for (const lang of LANGS) {
  test(`${lang}.js has no duplicate keys`, async () => {
    const content = fs.readFileSync(path.join(I18N_DIR, `${lang}.js`), 'utf8');
    const keys = extractKeys(content);
    const seen = new Set();
    const dupes = [];
    for (const k of keys) {
      if (seen.has(k)) dupes.push(k);
      seen.add(k);
    }
    expect(dupes, `${lang}.js has duplicate keys: ${dupes.join(', ')}`).toEqual([]);
  });
}

// =====================================================
// 5. i18n.js configures RTL_LANGS correctly
// =====================================================
test('i18n.js has correct RTL_LANGS', async () => {
  const i18nContent = fs.readFileSync(
    path.resolve(__dirname, '..', 'js', 'i18n.js'),
    'utf8'
  );
  expect(i18nContent).toContain("RTL_LANGS = ['ar', 'ckb', 'ur']");
});

// =====================================================
// 6. Language switcher has all 5 languages
// =====================================================
test('language switcher renders all 5 languages', async ({ page }) => {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.I18n && window.I18n.getLang(), { timeout: 5000 });

  const buttons = await page.locator('#langSwitcher .lang-btn').all();
  expect(buttons.length).toBe(5);

  const codes = [];
  for (const btn of buttons) {
    const code = await btn.getAttribute('data-lang');
    codes.push(code);
  }
  expect(codes).toEqual(expect.arrayContaining(['ar', 'en', 'ckb', 'tr', 'ur']));
});

// =====================================================
// 7. Default language is Arabic
// =====================================================
test('default language is Arabic', async ({ page }) => {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.I18n && window.I18n.getLang(), { timeout: 5000 });

  const lang = await page.evaluate(() => window.I18n.getLang());
  expect(lang).toBe('ar');
});

// =====================================================
// 8. Language switching works for each language
// =====================================================
for (const lang of LANGS) {
  test(`switching to ${lang} applies translations`, async ({ page }) => {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.I18n && window.I18n.getLang(), { timeout: 5000 });

    await page.evaluate((l) => window.I18n.setLang(l), lang);
    await page.waitForTimeout(500);

    const currentLang = await page.evaluate(() => window.I18n.getLang());
    expect(currentLang).toBe(lang);

    const htmlLang = await page.getAttribute('html', 'lang');
    expect(htmlLang).toBe(lang);

    const htmlDir = await page.getAttribute('html', 'dir');
    const expectedDir = RTL_LANGS.includes(lang) ? 'rtl' : 'ltr';
    expect(htmlDir).toBe(expectedDir);
  });
}

// =====================================================
// 9. DOM elements get translated text
// =====================================================
for (const lang of LANGS) {
  test(`${lang}: data-i18n elements are translated on home page`, async ({ page }) => {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.I18n && window.I18n.getLang(), { timeout: 5000 });

    await page.evaluate((l) => window.I18n.setLang(l), lang);
    await page.waitForTimeout(500);

    const elements = await page.locator('[data-i18n]').all();
    expect(elements.length).toBeGreaterThan(0);

    for (const el of elements) {
      const key = await el.getAttribute('data-i18n');
      const text = await el.textContent();
      if (key && !key.includes('placeholder')) {
        expect(text.trim().length, `Element with data-i18n="${key}" is empty in ${lang}`).toBeGreaterThan(0);
      }
    }
  });
}

// =====================================================
// 10. Translation values are not raw keys (fallback leak)
// =====================================================
for (const lang of LANGS) {
  test(`${lang}: no raw key fallback in visible text`, async ({ page }) => {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.I18n && window.I18n.getLang(), { timeout: 5000 });

    await page.evaluate((l) => window.I18n.setLang(l), lang);
    await page.waitForTimeout(500);

    const elements = await page.locator('[data-i18n]').all();
    for (const el of elements) {
      const key = await el.getAttribute('data-i18n');
      const text = await el.textContent();
      expect(
        text.trim(),
        `Element with key "${key}" shows raw key name instead of translation in ${lang}`
      ).not.toBe(key);
    }
  });
}

// =====================================================
// 11. t() function works with params
// =====================================================
test('t() function handles parameter interpolation', async ({ page }) => {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.I18n && window.I18n.getLang(), { timeout: 5000 });

  const ar = await page.evaluate(() => {
    return window.t('prayer_next', { name: 'Fajr', time: '5 min' });
  });
  expect(ar).toContain('Fajr');
  expect(ar).toContain('5 min');

  await page.evaluate(() => window.I18n.setLang('en'));
  await page.waitForTimeout(300);
  const en = await page.evaluate(() => {
    return window.t('prayer_next', { name: 'Fajr', time: '5 min' });
  });
  expect(en).toContain('Fajr');
  expect(en).toContain('5 min');
});

// =====================================================
// 12. Language persists in localStorage
// =====================================================
test('language persists in localStorage after reload', async ({ page }) => {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.I18n && window.I18n.getLang(), { timeout: 5000 });

  await page.evaluate(() => window.I18n.setLang('ckb'));
  await page.waitForTimeout(300);

  const stored = await page.evaluate(() => localStorage.getItem('zad_lang'));
  expect(stored).toBe('ckb');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.I18n && window.I18n.getLang(), { timeout: 5000 });
  const lang = await page.evaluate(() => window.I18n.getLang());
  expect(lang).toBe('ckb');
});

// =====================================================
// 13. Active button highlights correctly
// =====================================================
test('active language button is highlighted', async ({ page }) => {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.I18n && window.I18n.getLang(), { timeout: 5000 });

  for (const lang of LANGS) {
    await page.evaluate((l) => {
      window.I18n.setLang(l);
      window.I18n.createSwitcher('langSwitcher');
    }, lang);
    await page.waitForTimeout(200);

    const activeBtn = page.locator(`#langSwitcher .lang-btn.active`);
    const activeCode = await activeBtn.getAttribute('data-lang');
    expect(activeCode).toBe(lang);
  }
});

// =====================================================
// 14. Arabic-specific: diacritics or Arabic text present
// =====================================================
test('Arabic translations contain Arabic script', async ({ page }) => {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.I18n && window.I18n.getLang(), { timeout: 5000 });

  await page.evaluate(() => window.I18n.setLang('ar'));
  await page.waitForTimeout(300);

  const title = await page.locator('[data-i18n="app_name"]').textContent();
  const hasArabic = /[\u0600-\u06FF]/.test(title);
  expect(hasArabic, `app_name "${title}" should contain Arabic script`).toBe(true);
});

// =====================================================
// 15. Kurdish Sorani: contains Kurdish text
// =====================================================
test('Kurdish translations contain Kurdish text', async ({ page }) => {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.I18n && window.I18n.getLang(), { timeout: 5000 });

  await page.evaluate(() => window.I18n.setLang('ckb'));
  await page.waitForTimeout(300);

  const title = await page.locator('[data-i18n="app_name"]').textContent();
  const hasArabic = /[\u0600-\u06FF]/.test(title);
  expect(hasArabic, `ckb app_name "${title}" should contain Arabic-script characters`).toBe(true);
});

// =====================================================
// 16. Cross-page language persistence
// =====================================================
for (const lang of LANGS) {
  test(`${lang}: language persists when navigating to sub-pages`, async ({ page }) => {
    // Set language on home page
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.I18n && window.I18n.getLang(), { timeout: 5000 });
    await page.evaluate((l) => window.I18n.setLang(l), lang);
    await page.waitForTimeout(500);

    // Navigate to sub-pages and verify language is applied
    for (const subPage of SUB_PAGES.slice(0, 3)) {
      await page.goto(`${BASE_URL}${subPage.path}`, { waitUntil: 'domcontentloaded' });
      // Wait for I18n to be ready
      await page.waitForFunction(() => window.I18n && window.I18n.getLang(), { timeout: 5000 });
      // Give async init() time to complete its fetch and call updateDir
      await page.waitForTimeout(1500);

      const currentLang = await page.evaluate(() => window.I18n.getLang());
      expect(currentLang, `Language should be ${lang} on ${subPage.path}`).toBe(lang);

      const htmlDir = await page.getAttribute('html', 'dir');
      const expectedDir = RTL_LANGS.includes(lang) ? 'rtl' : 'ltr';
      expect(htmlDir, `Dir should be ${expectedDir} on ${subPage.path}`).toBe(expectedDir);
    }
  });
}

// =====================================================
// 17. Sub-pages: data-i18n elements are translated
// =====================================================
for (const subPage of SUB_PAGES) {
  for (const lang of ['en', 'ckb']) {
    test(`${subPage.path} in ${lang}: data-i18n elements are translated`, async ({ page }) => {
      await page.goto(`${BASE_URL}${subPage.path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.I18n && window.I18n.getLang(), { timeout: 8000 });

      await page.evaluate((l) => window.I18n.setLang(l), lang);
      await page.waitForTimeout(500);

      const elements = await page.locator('[data-i18n]').all();
      expect(elements.length, `${subPage.path} should have data-i18n elements`).toBeGreaterThan(0);

      let translatedCount = 0;
      for (const el of elements) {
        const key = await el.getAttribute('data-i18n');
        const text = await el.textContent();
        if (key && text.trim().length > 0 && !text.trim().startsWith('{')) {
          translatedCount++;
        }
      }
      expect(translatedCount, `${subPage.path} should have translated elements in ${lang}`).toBeGreaterThan(0);
    });
  }
}

// =====================================================
// 18. Audio page: i18n.js loads and reciter sheet title translates
// =====================================================
for (const lang of ['en', 'ar']) {
  test(`audio.html: i18n loads and UI translates in ${lang}`, async ({ page }) => {
    await page.goto(`${BASE_URL}/pages/audio.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.I18n && window.I18n.getLang(), { timeout: 8000 });

    await page.evaluate((l) => window.I18n.setLang(l), lang);
    await page.waitForTimeout(500);

    const titleEl = page.locator('[data-i18n="audio_choose_reciter"]');
    await expect(titleEl).toBeVisible({ timeout: 5000 });
    const text = await titleEl.textContent();
    expect(text.trim().length).toBeGreaterThan(0);
  });
}

// =====================================================
// 19. Radio page: i18n.js loads and header translates
// =====================================================
for (const lang of ['en', 'ar']) {
  test(`radio.html: i18n loads and UI translates in ${lang}`, async ({ page }) => {
    await page.goto(`${BASE_URL}/pages/radio.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.I18n && window.I18n.getLang(), { timeout: 8000 });

    await page.evaluate((l) => window.I18n.setLang(l), lang);
    await page.waitForTimeout(500);

    const headerEl = page.locator('[data-i18n="radio_header"]');
    await expect(headerEl).toBeVisible({ timeout: 5000 });
    const text = await headerEl.textContent();
    expect(text.trim().length).toBeGreaterThan(0);
  });
}

// =====================================================
// 20. All 5 languages work on sub-pages
// =====================================================
for (const subPage of SUB_PAGES.slice(0, 3)) {
  for (const lang of LANGS) {
    test(`${subPage.path}: lang ${lang} loads correctly`, async ({ page }) => {
      await page.goto(`${BASE_URL}${subPage.path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.I18n && window.I18n.getLang(), { timeout: 8000 });

      await page.evaluate((l) => window.I18n.setLang(l), lang);
      await page.waitForTimeout(500);

      const currentLang = await page.evaluate(() => window.I18n.getLang());
      expect(currentLang).toBe(lang);

      const htmlDir = await page.getAttribute('html', 'dir');
      const expectedDir = RTL_LANGS.includes(lang) ? 'rtl' : 'ltr';
      expect(htmlDir).toBe(expectedDir);
    });
  }
}

// =====================================================
// 21. Language change event fires
// =====================================================
test('langchange event fires on language switch', async ({ page }) => {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.I18n && window.I18n.getLang(), { timeout: 5000 });

  const firedLang = await page.evaluate(() => {
    return new Promise((resolve) => {
      window.addEventListener('langchange', (e) => resolve(e.detail.lang), { once: true });
      window.I18n.setLang('tr');
    });
  });
  expect(firedLang).toBe('tr');
});

// =====================================================
// 22. RTL detection for ur language
// =====================================================
test('ur is detected as RTL', async ({ page }) => {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.I18n && window.I18n.getLang(), { timeout: 5000 });

  await page.evaluate(() => window.I18n.setLang('ur'));
  await page.waitForTimeout(300);

  const isRTL = await page.evaluate(() => window.I18n.isRTL());
  expect(isRTL).toBe(true);

  const htmlDir = await page.getAttribute('html', 'dir');
  expect(htmlDir).toBe('rtl');
});

// =====================================================
// Helpers
// =====================================================
function extractKeys(content) {
  const matches = content.match(/app_name|'([^']+)'\s*:|"[^"]+"\s*:/g) || [];
  return [...new Set(matches.map(k => {
    const key = k.split(':')[0].replace(/['"]/g, '').trim();
    return key;
  }))];
}
