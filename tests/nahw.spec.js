// «تعلم النحو»: the Ajurrumiyya in its chapters, each unit with its sharh.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8080';
const M = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'nahw', 'ajurrumiyya.json'), 'utf8'));
test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await page.route(url => !url.href.startsWith(BASE_URL), route => route.abort());
});

test('the Ajurrumiyya: every unit with its sharh, chapters in the bar', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/nahw.html`, { waitUntil: 'load' });
  await expect(page.locator('.unit')).toHaveCount(M.units.length);
  await expect(page.locator('.u-sharh')).toHaveCount(M.units.length);
  await expect(page.locator('.nh-chap')).toHaveCount(M.chapters.length);
  await expect(page.locator('#u-1 .u-text')).toContainText('هُوَ اللَّفْظُ الْمُرَكَّبُ الْمُفِيدُ');
  await page.check('#nhHide');
  await expect(page.locator('#u-1 .u-sharh')).toBeHidden();
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#nhHide')).toBeChecked();
});

test('the text size buttons change the size and are remembered', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/nahw.html`, { waitUntil: 'load' });
  await expect(page.locator('#nhSize')).toHaveText('100%');
  await page.click('#nhLarger');
  await expect(page.locator('#nhSize')).toHaveText('110%');
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#nhSize')).toHaveText('110%');
});

test('no horizontal scroll on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(`${BASE_URL}/pages/nahw.html`, { waitUntil: 'load' });
  await expect(page.locator('.unit').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
