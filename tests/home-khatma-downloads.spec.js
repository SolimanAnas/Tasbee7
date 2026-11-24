// Home: the «الختمة والتحميل» section — the khatma card opens the ثبات wird (or
// its form), the download center saves the translation for the app language.
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8080';
test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await page.route(url => !url.href.startsWith(BASE_URL), route => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('zad_lang', 'en'); localStorage.setItem('zad_lang_chosen', '1'); } catch { /* storage blocked */ } });
});

test('the download center saves the translation for the app language', async ({ page }) => {
  await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
  await expect(page.locator('[data-i18n="section_khatma_dl"]')).toHaveText('Khatma & downloads');
  await page.locator('.feature-card', { has: page.locator('[data-i18n="card_downloads"]') }).click();
  await expect(page.locator('#downloadsSheet')).toHaveClass(/active/);
  await expect(page.locator('#dlTransDesc')).toContainText('Saheeh International');
  await expect(page.locator('#dlTrans')).not.toHaveClass(/saved/);
  await page.locator('#dlTrans').click();
  await expect(page.locator('#dlTrans')).toHaveClass(/saved/);
  const cached = await page.evaluate(async () => (await (await caches.open('quran-offline-translations-v1')).keys()).map(r => r.url.split('/').pop()));
  expect(cached).toEqual(['en.sahih.json']);
  // the other rows lead to the existing downloads
  await expect(page.locator('#dlApp')).toHaveAttribute('onclick', /openOfflineModal/);
  await expect(page.locator('#dlAudio')).toHaveAttribute('onclick', /audio\.html\?download=1/);
});

test('the khatma card opens the wird, or the form to start one', async ({ page }) => {
  await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.removeItem('thabat_v1'));
  await page.locator('.feature-card', { has: page.locator('[data-i18n="card_khatma"]') }).click();
  await page.waitForURL(/thabat\.html\?wird=1/);
  await expect(page.locator('#formSheet')).toHaveClass(/q-mode/);

  // with a wird, the same link opens its page
  await page.evaluate(() => localStorage.setItem('thabat_v1', JSON.stringify({ journeys: [{ id: 'jq', name: 'w', kind: 'quran', cover: 'mushaf', created: Date.now(), streaks: [{ start: Date.now(), seen: [] }], quran: { daily: 4, pos: 10, start: 1, khatmat: 0, log: {} } }], settings: {} })));
  await page.goto(`${BASE_URL}/pages/thabat.html?wird=1`, { waitUntil: 'load' });
  await expect(page.locator('#view')).toHaveClass(/qv/);
});
