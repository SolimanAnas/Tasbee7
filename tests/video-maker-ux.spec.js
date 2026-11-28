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
