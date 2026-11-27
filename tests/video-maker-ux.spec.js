// Video maker: the header (theme toggle, settings with the language), the sheets as dialogs,
// every control named, and nothing wider than a small phone.
const { test, expect } = require('@playwright/test');

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
  expect(await theme()).toBe(second);                                         // remembered, app-wide
  // no language button in the header any more: it is a row in the settings sheet
  await expect(page.locator('.header [onclick*="openLanguage"]')).toHaveCount(0);
  await page.locator('#vmSettingsBtn').click();
  await expect(page.locator('#vmSettingsSheet')).toHaveClass(/active/);
  await expect(page.locator('#vmLangSub')).toHaveText('العربية');
  await page.locator('#vmLangRow').click();
  await expect(page.locator('#vmSettingsSheet')).not.toHaveClass(/active/);
  await expect(page.getByText('English').first()).toBeVisible({ timeout: 5000 });   // the app's language sheet
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
