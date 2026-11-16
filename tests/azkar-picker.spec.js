// Adhkar: the «1 of 31» badge opens a list of the whole set to jump to any dhikr.
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8080';

// morning set: #1 (×1) and #2 (×3) done, #8 part-way (1 of 4)
async function open(page, counts = { 0: 1, 1: 3, 7: 1 }) {
  await page.addInitScript(c => {
    try {
      localStorage.setItem('zad_lang', 'en');
      localStorage.setItem('azkar_counts_morning', JSON.stringify({ date: new Date().toDateString(), counts: c }));
    } catch (e) {}
  }, counts);
  await page.route(url => !url.href.startsWith(BASE_URL), route => route.abort());
  await page.goto(`${BASE_URL}/pages/azkar.html?type=morning`, { waitUntil: 'load' });
  await expect(page.locator('#zikrIndexCounter')).toHaveText('1 of 31');
}

test.describe('adhkar picker', () => {
  test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('the badge is a named button that lists every dhikr with its progress', async ({ page }) => {
    await open(page);
    const badge = page.locator('#zikrIndexBtn');
    await expect(badge).toHaveAttribute('aria-label', /1 of 31 — Go to a dhikr/);
    await badge.tap();
    await expect(page.locator('#jumpModal')).toHaveClass(/active/);
    const rows = page.locator('.jump-row');
    await expect(rows).toHaveCount(31);
    await expect(page.locator('#jumpSummary')).toHaveText('2 of 31 completed');
    await expect(rows.nth(0)).toHaveAttribute('aria-current', 'true');
    await expect(rows.nth(1)).toHaveClass(/is-done/);
    await expect(rows.nth(7).locator('.jr-count')).toHaveText('1/4');
    await expect(rows.nth(2).locator('.jr-count')).toHaveText('×3');
    await expect(page.locator('.jump-row.is-current')).toBeFocused();
  });

  test('choosing a dhikr shows it with its saved count and closes the list', async ({ page }) => {
    await open(page);
    await page.locator('#zikrIndexBtn').tap();
    const text = await page.evaluate(() => azkarData[7].arabic);
    await page.locator('.jump-row').nth(7).tap();
    await expect(page.locator('#jumpModal')).not.toHaveClass(/active/);
    await expect(page.locator('#zikrIndexCounter')).toHaveText('8 of 31');
    await expect(page.locator('#arabicText')).toHaveText(text);
    await expect(page.locator('#counter')).toHaveText('3');   // 1 of 4 already said
  });

  test('a jump right after finishing a dhikr is not undone by the move to the next one', async ({ page }) => {
    await open(page, {});
    await page.evaluate(() => {
      increment();                                   // #1 needs one: done, the next one is due in 600 ms
      openJump();
      document.querySelectorAll('.jump-row')[9].click();
    });
    await page.waitForTimeout(1000);
    await expect(page.locator('#zikrIndexCounter')).toHaveText('10 of 31');
  });

  test('Escape closes the list and gives focus back to the badge', async ({ page }) => {
    await open(page);
    await page.locator('#zikrIndexBtn').click();
    await expect(page.locator('#jumpModal')).toHaveClass(/active/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#jumpModal')).not.toHaveClass(/active/);
    await expect(page.locator('#zikrIndexBtn')).toBeFocused();
    await expect(page.locator('#zikrIndexCounter')).toHaveText('1 of 31');
  });
});
