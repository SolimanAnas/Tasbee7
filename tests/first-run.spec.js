// First run (P1-6): a new reader sees content first; setup steps come one at a
// time and each says why it is needed.
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8080';
test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });

const offline = page => page.route(url => !url.href.startsWith(BASE_URL), route => route.abort());
const isOpen = (page, sel) => page.evaluate(s => { const el = document.querySelector(s); return !!el && el.classList.contains('active'); }, sel);

test.describe('home', () => {
  test('language first, then location with the reason — once', async ({ page }) => {
    await offline(page);
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
    await expect(page.locator('#i18nLangSheetWrap')).toBeVisible();
    expect(await isOpen(page, '#locationModal')).toBe(false);

    await page.click('.i18n-ls-row[data-lang="ar"]');
    await expect.poll(() => isOpen(page, '#locationModal')).toBe(true);
    await expect(page.locator('#locationModal .location-reason')).toContainText('جهازك');

    await page.click('#locationModal .location-later');
    expect(await isOpen(page, '#locationModal')).toBe(false);

    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1200);
    expect(await isOpen(page, '#locationModal')).toBe(false);
  });

  test('no location step when a location is already set', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('prayer_lat', '25.2'); localStorage.setItem('prayer_lng', '55.27'); } catch (e) {} });
    await offline(page);
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
    await page.click('.i18n-ls-row[data-lang="en"]');
    await page.waitForTimeout(1200);
    expect(await isOpen(page, '#locationModal')).toBe(false);
  });
});

test.describe('mushaf', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('zoom_hint_dismissed', '1'); } catch (e) {} });
    await offline(page);
  });
  const offerShown = page => page.evaluate(() => document.getElementById('dlOffer').classList.contains('show'));
  const turn = async (page, n) => { for (let i = 0; i < n; i++) { await page.evaluate(() => goToPage(currentPage + 1)); await page.waitForTimeout(150); } };

  test('the page shows first; the save offer comes after three page turns', async ({ page }) => {
    await page.goto(`${BASE_URL}/pages/quran.html`, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    expect(await isOpen(page, '#dlModal')).toBe(false);
    expect(await offerShown(page)).toBe(false);

    await turn(page, 2);
    expect(await offerShown(page)).toBe(false);
    await turn(page, 1);
    await expect.poll(() => offerShown(page)).toBe(true);

    await page.click('#dlOffer .dl-offer-go');
    expect(await offerShown(page)).toBe(false);
    expect(await isOpen(page, '#dlModal')).toBe(true);
  });

  test('"later" waits, and a second "later" means no', async ({ page }) => {
    await page.goto(`${BASE_URL}/pages/quran.html`, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    await turn(page, 3);
    await expect.poll(() => offerShown(page)).toBe(true);
    await page.click('#dlOffer .dl-offer-later');
    expect(await offerShown(page)).toBe(false);
    expect(Number(await page.evaluate(() => localStorage.getItem('quranV3DlSnooze')))).toBeGreaterThan(Date.now());

    // after the wait: offered again; the second "later" turns it off for good
    await page.evaluate(() => localStorage.setItem('quranV3DlSnooze', '0'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1200);
    await turn(page, 3);
    await expect.poll(() => offerShown(page)).toBe(true);
    await page.click('#dlOffer .dl-offer-later');
    expect(await page.evaluate(() => localStorage.getItem('quranV3DlDone'))).toBe('1');
  });
});
