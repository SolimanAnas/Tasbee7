// Remote text is shown as text, and the tafsir sheet does not need the network.
const { test, expect } = require('@playwright/test');

const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8080';
// Expected text comes from the data file itself, never from a retyped copy.
const QURAN = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'quran.json'), 'utf8'));
const ayahText = (s, a) => QURAN.find(v => v.surah === s && v.ayah === a).text_uthmani;
const PAYLOAD = '<img src=x onerror="window.__injected=1">';

test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('quranV3DlDone', '1');
      localStorage.setItem('zoom_hint_dismissed', '1');
    } catch (e) {}
  });
});

async function openMushaf(page) {
  await page.goto(`${BASE_URL}/pages/quran.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof handleGlobalSearch === 'function' && typeof contextShowTafsir === 'function');
}

test('search results show API text as text, not markup', async ({ page }) => {
  await page.route('**/api.alquran.cloud/v1/search/**', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      code: 200,
      data: {
        count: 1,
        matches: [{
          number: 262, numberInSurah: 255,
          text: 'الله لا اله الا هو ' + PAYLOAD,
          surah: { number: 999, name: 'سورة ' + PAYLOAD },
        }],
      },
    }),
  }));
  await openMushaf(page);
  await page.evaluate(() => handleGlobalSearch('الله'));

  const item = page.locator('#searchResults .search-result-item').first();
  await expect(item).toBeVisible();
  await expect(item).toContainText('<img src=x');
  expect(await page.locator('#searchResults img').count()).toBe(0);
  expect(await page.evaluate(() => window.__injected)).toBeUndefined();
});

test('the "no results" line shows what was typed as text', async ({ page }) => {
  await page.route('**/api.alquran.cloud/v1/search/**', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ code: 200, data: { count: 0, matches: [] } }),
  }));
  await openMushaf(page);
  await page.evaluate(q => handleGlobalSearch(q), 'zz' + PAYLOAD);

  await expect(page.locator('#searchResults .search-empty')).toContainText('<img src=x');
  expect(await page.locator('#searchResults img').count()).toBe(0);
  expect(await page.evaluate(() => window.__injected)).toBeUndefined();
});

test('tafsir opens with no connection, quoting the ayah from the local text', async ({ page }) => {
  // Everything outside the app itself is unreachable.
  await page.route(url => !url.href.startsWith(BASE_URL), route => route.abort());
  await openMushaf(page);
  await page.waitForFunction(() => !!window.SQL);

  await page.evaluate(() => { windowCurrentAyahGlobal = { surah: 2, ayah: 255 }; return contextShowTafsir(true); });

  const quote = page.locator('#tafsirContent .imlaei-text');
  await expect(quote).toContainText(ayahText(2, 255), { timeout: 20000 });
  const length = await page.locator('#tafsirContent').evaluate(el => el.textContent.length);
  expect(length).toBeGreaterThan(400); // the tafsir itself, not just the quote
});

test('the local quote for ayah 1 leaves out the prefixed basmala', async ({ page }) => {
  await page.route(url => !url.href.startsWith(BASE_URL), route => route.abort());
  await openMushaf(page);
  // 2:1 is stored as "<basmala> الٓمٓ": only the ayah itself is quoted.
  const stored = ayahText(2, 1).split(/\s+/);
  expect(stored.length).toBe(5);
  expect(await page.evaluate(() => tafsirLocalAyah(2, 1))).toBe(stored[4]);
  // Al-Fatihah (the basmala is ayah 1) and At-Tawbah (no basmala) are untouched.
  expect(await page.evaluate(() => tafsirLocalAyah(1, 1))).toBe(ayahText(1, 1));
  expect(await page.evaluate(() => tafsirLocalAyah(9, 1))).toBe(ayahText(9, 1));
});

test('tafsir quote from the API is escaped', async ({ page }) => {
  await page.route('**/api.alquran.cloud/v1/ayah/**', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ code: 200, data: { text: 'نص ' + PAYLOAD } }),
  }));
  await openMushaf(page);
  await page.waitForFunction(() => !!window.SQL);
  await page.evaluate(() => { windowCurrentAyahGlobal = { surah: 1, ayah: 2 }; return contextShowTafsir(true); });

  await expect(page.locator('#tafsirContent .imlaei-text')).toContainText('<img src=x', { timeout: 20000 });
  expect(await page.locator('#tafsirContent .imlaei-text img').count()).toBe(0);
  expect(await page.evaluate(() => window.__injected)).toBeUndefined();
});
