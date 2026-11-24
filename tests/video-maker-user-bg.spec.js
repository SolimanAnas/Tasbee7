// Video maker: the user's own pictures and videos as backgrounds. They stay
// on the device (IndexedDB), survive a reload, and can be deleted.
const { test, expect } = require('@playwright/test');
const path = require('path');

const BASE_URL = 'http://localhost:8080';
const BG = path.join(__dirname, '..', 'images', 'video-maker');

test.use({ serviceWorkers: 'block' });

async function open(page) {
  await page.route(url => !url.href.startsWith(BASE_URL), route => route.abort());
  await page.goto(`${BASE_URL}/pages/video-maker.html`, { waitUntil: 'load' });
  await expect(page.locator('#vmBgs .bg-add')).toBeVisible({ timeout: 20000 });
}
const own = page => page.locator('#vmBgs .bg-thumb.is-user');

test('a picture and a video from the device become backgrounds, kept across a reload', async ({ page }) => {
  await open(page);
  await page.setInputFiles('#vmBgFile', path.join(BG, '7.webp'));
  await expect(own(page)).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => VM.state.bg)).toMatch(/^i:user:.+\.jpg$/);
  // Drawn into the canvas without tainting it: the export can still read it.
  expect(await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png').length)).toBeGreaterThan(1000);

  await page.setInputFiles('#vmBgFile', path.join(BG, 'v1.mp4'));
  await expect(own(page)).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => VM.state.bg)).toMatch(/^v:user:.+\.mp4$/);

  await page.reload();
  await expect(own(page)).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => VM.state.bg)).toMatch(/^v:user:/);
});

test('other files are refused, and a deleted background is gone for good', async ({ page }) => {
  await open(page);
  await page.setInputFiles('#vmBgFile', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await expect(own(page)).toHaveCount(0);
  await expect(page.locator('#vmStatus')).not.toBeEmpty();

  await page.setInputFiles('#vmBgFile', path.join(BG, '7.webp'));
  await expect(own(page)).toHaveCount(1);
  await own(page).first().locator('.bg-del').click();
  await expect(own(page)).toHaveCount(0);
  expect(await page.evaluate(() => VM.state.bg)).toBe('g0');
  await page.reload();
  await expect(page.locator('#vmBgs .bg-add')).toBeVisible();
  await expect(own(page)).toHaveCount(0);
});
