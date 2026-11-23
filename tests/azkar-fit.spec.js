// Adhkar: auto-fit sizes the text so the whole dhikr fits its card; the
// smallest size by hand is 16 px.
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8080';
const SHORT = 29;   // morning #30 «سبحان الله وبحمده»
const LONG = 0;     // morning #1 Ayat al-Kursi

async function open(page, { autoFit = true } = {}) {
  await page.addInitScript(a => {
    try { localStorage.setItem('zad_lang', 'en'); if (a != null) localStorage.setItem('zikrAutoFit', a ? '1' : '0'); } catch (e) {}
  }, autoFit);
  await page.route(url => !url.href.startsWith(BASE_URL), route => route.abort());
  await page.goto(`${BASE_URL}/pages/azkar.html?type=morning`, { waitUntil: 'load' });
  await expect(page.locator('#zikrIndexCounter')).toHaveText('1 of 31');
  await page.evaluate(() => document.fonts.ready);
}
const go = async (page, i) => {
  await page.evaluate(i => { currentIndex = i; loadZikr(); }, i);
  await expect(page.locator('#zikrIndexCounter')).toHaveText(`${i + 1} of 31`);
  await page.waitForTimeout(100);
};
const size = page => page.evaluate(() => parseInt(getComputedStyle(document.documentElement).getPropertyValue('--zikr-size'), 10));
const scrolls = page => page.evaluate(() => { const a = document.querySelector('.zikr-scroll-area'); return a.scrollHeight > a.clientHeight + 1; });

test.describe('adhkar auto-fit', () => {
  test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('a short dhikr is sized up and a long one down, each fitting the card', async ({ page }) => {
    await open(page);
    await expect(page.locator('#autoFitBtn')).toHaveAttribute('aria-pressed', 'true');
    await go(page, SHORT);
    const short = await size(page);
    expect(short).toBeGreaterThanOrEqual(36);
    expect(await scrolls(page)).toBe(false);
    await go(page, LONG);
    const long = await size(page);
    expect(long).toBeLessThan(28);
    expect(long).toBeGreaterThanOrEqual(16);
    expect(await scrolls(page)).toBe(false);   // fits at 390 × 844 (it scrolls at the old fixed 28 px)
  });

  test('A+ turns auto-fit off and goes on from the fitted size; turning it off restores the size chosen by hand', async ({ page }) => {
    await open(page);
    await go(page, LONG);
    const fitted = await size(page);
    await page.locator('.zoom-btns button', { hasText: 'A+' }).tap();
    await expect(page.locator('#autoFitBtn')).toHaveAttribute('aria-pressed', 'false');
    expect(await size(page)).toBe(fitted + 2);
    expect(await page.evaluate(() => localStorage.getItem('zikrFontSize'))).toBe(String(fitted + 2));

    await page.locator('#autoFitBtn').tap();                 // on: fitted again
    await expect(page.locator('#autoFitBtn')).toHaveAttribute('aria-pressed', 'true');
    expect(await size(page)).toBe(fitted);
    await page.locator('#autoFitBtn').tap();                 // off: back to the size set by hand
    expect(await size(page)).toBe(fitted + 2);
  });

  test('the choice is kept, Settings shows it, and the slider and A- go down to 16', async ({ page }) => {
    await open(page);
    await page.reload({ waitUntil: 'load' });
    await expect(page.locator('#autoFitBtn')).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => openSettings());
    await expect(page.locator('#autoFitToggle')).toBeChecked();
    await expect(page.locator('#fontSizeSlider')).toHaveAttribute('min', '16');
    await page.locator('label.toggle-row', { has: page.locator('#autoFitToggle') }).click();   // the switch row, as a finger taps it
    await expect(page.locator('#autoFitToggle')).not.toBeChecked();
    await expect(page.locator('#autoFitBtn')).toHaveAttribute('aria-pressed', 'false');
    await page.evaluate(() => closeSettings());
    for (let i = 0; i < 10; i++) await page.evaluate(() => zoomStep(-2));
    expect(await size(page)).toBe(16);
  });

  test('off by default: the size stays the one chosen by hand', async ({ page }) => {
    await open(page, { autoFit: null });
    await expect(page.locator('#autoFitBtn')).toHaveAttribute('aria-pressed', 'false');
    await go(page, SHORT);
    expect(await size(page)).toBe(28);
  });
});
