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

  test('power mode: taps count, a held press shows the exit ring under the finger and does not count', async ({ page }) => {
    await open(page, 'dark');
    await page.evaluate(() => enterPowerMode());
    const count = () => page.locator('#powerCount').innerText();
    const before = Number(await count());

    await page.mouse.click(200, 300);
    await expect(page.locator('#powerCount')).toHaveText(String(before + 1));
    await expect(page.locator('#exitCircle')).not.toHaveClass(/holding/);

    // hold, then let go early: the ring appears where the press is, nothing is counted
    await page.mouse.move(300, 220);
    await page.mouse.down();
    await page.waitForTimeout(600);
    await expect(page.locator('#exitCircle')).toHaveClass(/holding/);
    const pos = await page.evaluate(() => {
      const c = document.getElementById('exitCircle');
      return [c.style.getPropertyValue('--x'), c.style.getPropertyValue('--y')];
    });
    expect(pos).toEqual(['300px', '220px']);
    await page.mouse.up();
    await expect(page.locator('#exitCircle')).not.toHaveClass(/holding/);
    await expect(page.locator('#powerModeOverlay')).toHaveClass(/active/);
    await expect(page.locator('#powerCount')).toHaveText(String(before + 1));

    // near an edge the ring is kept on screen
    await page.mouse.move(5, 5);
    await page.mouse.down();
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => document.getElementById('exitCircle').style.getPropertyValue('--x'))).toBe('80px');
    await page.mouse.up();

    // hold three seconds: leaves the mode, and the lifted finger counts nothing
    await page.mouse.move(200, 400);
    await page.mouse.down();
    await expect(page.locator('#powerModeOverlay')).not.toHaveClass(/active/, { timeout: 4000 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    await expect(page.locator('#count')).toHaveText(String(before + 1));
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
