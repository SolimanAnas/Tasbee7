// Masbaha: follows the app theme, and the dhikr picker sheet lists, searches and switches adhkar.
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8080';

async function open(page, theme) {
  await page.addInitScript(t => {
    try { localStorage.setItem('zad_lang', 'ar'); if (t) localStorage.setItem('themeMode', t); } catch (e) {}
  }, theme);
  await page.goto(`${BASE_URL}/pages/masbaha.html`, { waitUntil: 'load' });
}

test.describe('masbaha', () => {
  test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });

  for (const [stored, shown] of [['light', 'light'], ['sepia', 'sepia'], ['dark', 'dark'], ['plain-dark', 'dark'], ['warm', 'sepia']]) {
    test(`themeMode "${stored}" shows the ${shown} theme`, async ({ page }) => {
      await open(page, stored);
      await expect(page.locator('html')).toHaveAttribute('data-theme', shown);
    });
  }

  test('the theme can be changed from settings and is shared with the app', async ({ page }) => {
    await open(page, 'dark');
    await page.evaluate(() => toggleSettings());
    await page.click('[data-theme-swatch="sepia"]');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'sepia');
    await expect(page.locator('[data-theme-swatch="sepia"]')).toHaveClass(/active/);
    expect(await page.evaluate(() => localStorage.getItem('themeMode'))).toBe('sepia');
  });

  test('the picker lists every dhikr in groups, searches, and switches the counter', async ({ page }) => {
    await open(page, 'light');
    await page.click('#dhikrPickerBtn');
    await expect(page.locator('#dhikrSheet')).toHaveClass(/open/);
    const total = await page.evaluate(() => document.getElementById('dhikrSelect').options.length);
    expect(total).toBeGreaterThanOrEqual(17);
    await expect(page.locator('#dhikrList .dhikr-item')).toHaveCount(total);
    await expect(page.locator('#dhikrList .dhikr-group-label')).toHaveCount(4);
    await expect(page.locator('#dhikrList .dhikr-item.active')).toHaveCount(1);

    // search ignores diacritics and hamza forms
    await page.fill('#dhikrSearch', 'استغفر');
    await expect(page.locator('#dhikrList .dhikr-item')).toHaveCount(2);
    await page.fill('#dhikrSearch', 'ذي النون');
    await expect(page.locator('#dhikrList .dhikr-empty')).toHaveCount(1);
    await page.fill('#dhikrSearch', 'الظالمين');
    await page.click('#dhikrList .dhikr-item');

    await expect(page.locator('#dhikrSheet')).not.toHaveClass(/open/);
    await expect(page.locator('#dhikrPickerBtn')).toHaveText('لا إله إلا أنت سبحانك إني كنت من الظالمين');
    await expect(page.locator('#hintBox')).toContainText('ذي النون');
    expect(await page.evaluate(() => localStorage.getItem('currentDhikr'))).toBe('dhannoon');

    await page.click('.progress-wrapper');
    await expect(page.locator('#count')).toHaveText('1');
  });

  test('custom adhkar appear in their own group', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('customDhikrs', JSON.stringify([{ id: 'custom_1', text: 'ذكر تجريبي' }])); } catch (e) {}
    });
    await open(page, 'dark');
    await page.click('#dhikrPickerBtn');
    await expect(page.locator('#dhikrList .dhikr-group-label')).toHaveCount(5);
    await expect(page.locator('#dhikrList .dhikr-group-label').last()).toHaveText('أذكاري الخاصة');
    await expect(page.locator('#dhikrList .dhikr-item').last()).toContainText('ذكر تجريبي');
  });
});
