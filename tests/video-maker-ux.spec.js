// Video maker: the header (theme toggle, settings with the language), the sheets as dialogs,
// every control named, and nothing wider than a small phone.
const { test, expect } = require('@playwright/test');
// the settings are in tabs (الآيات / الصوت / المظهر / النص): open the one a control is on
const sec = (page, name) => expect(async () => {
  const tab = page.locator('#vmTab-' + name);
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click({ timeout: 2000 });
  await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 500 });
}).toPass({ timeout: 15000 });

const BASE_URL = 'http://localhost:8080';
test.use({ serviceWorkers: 'block', viewport: { width: 375, height: 760 } });

test.beforeEach(async ({ page }) => {
  await page.route(url => !url.href.startsWith(BASE_URL), route => route.abort());
});

test('header: the theme button cycles the app themes; language is in the settings sheet', async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('t')) { sessionStorage.setItem('t', '1'); localStorage.setItem('zad_lang', 'ar'); localStorage.setItem('themeMode', 'light'); } });
  await page.goto(`${BASE_URL}/pages/video-maker.html`, { waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  const theme = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  const first = await theme();
  await expect(page.locator('#vmThemeBtn')).toHaveAttribute('data-t', first === 'warm' ? 'sepia' : first);
  await page.locator('#vmThemeBtn').click();
  const second = await theme();
  expect(second).not.toBe(first);
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });   // started: its buttons work
  expect(await theme()).toBe(second);                                         // remembered, app-wide
  // no language button in the header any more: it is a row in the settings sheet
  await expect(page.locator('.header [onclick*="openLanguage"]')).toHaveCount(0);
  await page.locator('#vmSettingsBtn').click();
  await expect(page.locator('#vmSettingsSheet')).toHaveClass(/active/);
  await expect(page.locator('#vmLangSub')).toHaveText('العربية');
  await page.locator('#vmLangRow').click();
  await expect(page.locator('#vmSettingsSheet')).not.toHaveClass(/active/);
  await expect(page.locator('.lang-btn .lang-name', { hasText: 'English' })).toBeVisible({ timeout: 5000 });   // the app's language sheet (not the translation choice)
});

// Sheets are real dialogs for the keyboard and screen readers: named by their title, focus
// moves in when one opens, Tab stays inside, Escape closes it, focus goes back to its button.
test('sheets: focus in, Tab kept inside, Escape closes, focus returns', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/video-maker.html`, { waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  for (const id of ['vmSettingsSheet', 'vmSurahSheet', 'vmSearchSheet', 'vmPopularSheet', 'vmRecSheet', 'vmSyncSheet', 'vmReciterSheet', 'vmResult']) {
    const named = await page.evaluate(i => { const d = document.getElementById(i); const t = document.getElementById(d.getAttribute('aria-labelledby')); return !!(t && t.textContent.trim()); }, id);
    expect(named, id + ' is named by its title').toBe(true);
  }
  await sec(page, 'ayat');
  await page.locator('#vmSurahBtn').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#vmSurahSheet')).toHaveClass(/active/);
  await expect(page.locator('#vmSurahSheetTitle')).toBeFocused();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => !!document.activeElement.closest('#vmSurahSheet'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('#vmSurahSheet')).not.toHaveClass(/active/);
  await expect(page.locator('#vmSurahBtn')).toBeFocused();
});

test('every control has a name, and nothing is wider than a 320 px phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto(`${BASE_URL}/pages/video-maker.html`, { waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  await sec(page, 'look');
  await expect(page.locator('#vmBgs [data-bg]').first()).toBeVisible();
  const r = await page.evaluate(() => {
    const name = el => (el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.textContent) ||
      el.textContent || el.title || (el.labels && el.labels[0] && el.labels[0].textContent) || '').trim();
    const unnamed = [...document.querySelectorAll('button, a[href], input:not([type=hidden]):not([type=file]), select:not([hidden]), textarea')]
      .filter(el => !name(el)).map(el => el.id || el.className || el.outerHTML.slice(0, 60));
    const pressed = [...document.querySelectorAll('#vmBgs [data-bg]')].filter(b => b.getAttribute('aria-pressed') === 'true').length;
    // the sync sheet's buttons at this width (the sheet is laid out even while closed)
    const nav = document.getElementById('vmSyncNext').closest('.sf-nav');
    document.getElementById('vmSyncSheet').classList.add('active');
    const navRight = Math.max(...[...nav.children].map(b => b.getBoundingClientRect().right));
    const navLeft = Math.min(...[...nav.children].map(b => b.getBoundingClientRect().left));
    document.getElementById('vmSyncSheet').classList.remove('active');
    return { unnamed, pressed, page: document.documentElement.scrollWidth, W: document.documentElement.clientWidth, navLeft, navRight };
  });
  expect(r.unnamed).toEqual([]);
  expect(r.pressed).toBe(1);
  expect(r.page).toBeLessThanOrEqual(r.W);
  expect(r.navLeft).toBeGreaterThanOrEqual(0);
  expect(r.navRight).toBeLessThanOrEqual(r.W);
});

// The settings are four tabs: one part at a time, any order, arrow keys move between them,
// and the create bar stays whichever is open.
test('section tabs: one part at a time, in any order, by touch or keyboard', async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.setItem('zad_lang', 'ar'); localStorage.removeItem('vm_settings'); } });
  await page.goto(`${BASE_URL}/pages/video-maker.html`, { waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  const shown = () => page.evaluate(() => [...document.querySelectorAll('.controls-col > section[data-sec]')]
    .filter(s => s.getClientRects().length).map(s => s.dataset.sec).filter((v, i, a) => a.indexOf(v) === i));
  expect(await shown()).toEqual(['ayat']);
  await page.locator('#vmTab-text').click();
  expect(await shown()).toEqual(['text']);
  await expect(page.locator('#vmTab-text')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#vmExport')).toBeVisible();
  await page.locator('#vmTab-text').focus();
  await page.keyboard.press('ArrowRight');                                    // in Arabic the next tab is to the left
  await expect(page.locator('#vmTab-look')).toBeFocused();
  expect(await shown()).toEqual(['look']);
  await page.keyboard.press('Home');
  expect(await shown()).toEqual(['ayat']);
  // the bar stays at the top while the part below it scrolls
  await page.locator('#vmTab-text').click();
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  const top = await page.locator('#vmSecTabs').evaluate(el => el.getBoundingClientRect().top);
  expect(top).toBeLessThan(12);
  // switching while it is stuck starts the new part right under it
  await page.locator('#vmTab-audio').click();
  const gap = await page.evaluate(() => document.querySelector('section[data-sec="audio"]').getBoundingClientRect().top - document.getElementById('vmSecTabs').getBoundingClientRect().bottom);
  expect(gap).toBeGreaterThanOrEqual(0);
  expect(gap).toBeLessThan(30);
});

// The audit: what a thumb, a tired eye and a slow font load need.
test.describe('the audit: touch targets, text size, contrast, and word gaps after a font loads', () => {
  for (const [mode, theme] of [['short', 'light'], ['khatira', 'dark'], ['long', 'sepia']]) {
    test(`${mode} / ${theme}: every control at least 40 px, no text under 12 px, text at 4.5:1`, async ({ page }) => {
      await page.addInitScript(([mode, theme]) => {
        if (sessionStorage.getItem('a')) return;
        sessionStorage.setItem('a', '1');
        localStorage.setItem('vmMiniMin', '1');
        localStorage.setItem('zad_lang', 'ar');
        localStorage.setItem('themeMode', theme);
        localStorage.setItem('vm_settings', JSON.stringify({ mode, kContent: 'text', kTexts: ['الصبر مفتاح الفرج', 'ومن يتق الله'], bg: 'g0', motion: false }));
      }, [mode, theme]);
      await page.goto(`${BASE_URL}/pages/video-maker.html`, { waitUntil: 'load' });
      await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
      for (const tab of ['ayat', 'audio', 'look', 'text']) {
        await sec(page, tab);
        const r = await page.evaluate(() => {
          const vis = el => { const s = getComputedStyle(el); const b = el.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && b.width > 0 && b.height > 0 && !el.closest('.bottom-sheet:not(.active), [hidden], canvas'); };
          const name = el => (el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0]) + ' «' + (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 20) + '»';
          const small = [], tiny = [], low = [];
          document.querySelectorAll('button, a[href], select, textarea, input:not([type=hidden]):not([type=file]):not([type=range]):not([type=checkbox])').forEach(el => {
            if (!vis(el)) return;
            const b = el.getBoundingClientRect();
            if (b.width < 40 || b.height < 40) small.push(name(el) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height));
          });
          const lum = c => { const m = c.match(/[\d.]+/g); if (!m) return null; const v = m.slice(0, 3).map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return { L: 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2], a: m[3] == null ? 1 : +m[3] }; };
          const bgOf = el => { for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); const l = lum(s.backgroundColor); if (l && l.a > 0.85) return l.L; if (s.backgroundImage !== 'none' && e !== document.body && e !== document.documentElement) return null; } return null; };
          const seen = new Set(), w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          for (let n; (n = w.nextNode());) {
            const el = n.parentElement;
            if (!el || seen.has(el) || !n.textContent.trim() || !vis(el) || el.closest('svg, button:disabled')) continue;
            seen.add(el);
            const s = getComputedStyle(el), fs = parseFloat(s.fontSize);
            if (fs < 12) tiny.push(name(el) + ' ' + fs + 'px');
            const fg = lum(s.color), bg = bgOf(el);
            if (fg && bg != null) {
              const cr = (Math.max(fg.L, bg) + 0.05) / (Math.min(fg.L, bg) + 0.05);
              const large = fs >= 18.5 || (fs >= 14 && +s.fontWeight >= 700);
              if (cr < (large ? 3 : 4.5)) low.push(name(el) + ' ' + cr.toFixed(2));
            }
          }
          return { small, tiny, low };
        });
        expect(r.small, tab + ': small targets').toEqual([]);
        expect(r.tiny, tab + ': tiny text').toEqual([]);
        expect(r.low, tab + ': low contrast').toEqual([]);
      }
    });
  }

  test('«خاطرة»: the gaps between words are spaces, even when the face loaded after the first layout', async ({ page }) => {
    await page.addInitScript(() => {
      if (sessionStorage.getItem('g')) return;
      sessionStorage.setItem('g', '1');
      localStorage.setItem('zad_lang', 'ar');
      localStorage.setItem('vm_settings', JSON.stringify({ mode: 'khatira', kContent: 'text', kTexts: ['الصبر مفتاح الفرج'], kFont: 'amiri', textAlign: 'middle', bg: 'g0', motion: false }));
    });
    await page.goto(`${BASE_URL}/pages/video-maker.html`, { waitUntil: 'load' });
    await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    // the widest empty run between the words of the first line, against the face's own space
    const r = await page.evaluate(() => {
      const cv = document.getElementById('vmCanvas'), x = cv.getContext('2d', { willReadFrequently: true });
      const y0 = Math.round(cv.height * 0.38), y1 = Math.round(cv.height * 0.5);
      const d = x.getImageData(0, y0, cv.width, y1 - y0).data;
      const ink = [];
      for (let i = 0; i < cv.width; i++) { let on = 0; for (let j = 0; j < y1 - y0; j += 2) { const k = (j * cv.width + i) * 4; if (d[k] > 220 && d[k + 1] > 220 && d[k + 2] > 220) on++; } ink.push(on > 0); }
      const first = ink.indexOf(true), last = ink.lastIndexOf(true);
      let gap = 0, run = 0;
      for (let i = first; i <= last; i++) { if (ink[i]) run = 0; else gap = Math.max(gap, ++run); }
      const c = document.createElement('canvas').getContext('2d');
      c.font = '100px KhAmiri';
      return { gap, space100: c.measureText(' ').width, words: VM.khatiraLayout ? null : null };
    });
    // the line is about 0.14 of the width tall (151 px on 1080): a space is ~44 px; the bug left ~150
    expect(r.gap).toBeGreaterThan(20);
    expect(r.gap).toBeLessThan(95);
  });
});
