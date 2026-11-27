// Video maker: the video's length is shown under the reciter (step 2) and in the chip under the
// preview. It is worked out from the real recordings, so here every ayah is a generated 1.5 s
// WAV (the audio server is never called): 7 ayat = 10.5 s + 0.5 s lead-in + 1 s tail = 12 s.
const { test, expect } = require('@playwright/test');
// the settings are in tabs (الآيات / الصوت / المظهر / النص): open the one a control is on
const sec = (page, name) => expect(async () => {
  const tab = page.locator('#vmTab-' + name);
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click({ timeout: 2000 });
  await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 500 });
}).toPass({ timeout: 15000 });

const BASE_URL = 'http://localhost:8080';
test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });

function wav(seconds, rate = 8000) {
  const n = Math.round(seconds * rate), buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  return buf;
}
const waiting = page => page.locator('#vmDurValue.wait');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('zad_lang', 'ar'); localStorage.removeItem('vm_settings'); } catch { /* storage blocked */ } });
  await page.route(url => !url.href.startsWith(BASE_URL) && !/everyayah\.com/.test(url.href), route => route.abort());
});

test('the length follows the recitation and the ayat chosen', async ({ page }) => {
  await page.route(/everyayah\.com\/data\/.+\.mp3$/, route => route.fulfill({ status: 200, headers: { 'Content-Type': 'audio/wav', 'Access-Control-Allow-Origin': '*' }, body: wav(1.5) }));
  await page.goto(`${BASE_URL}/pages/video-maker.html`, { waitUntil: 'load' });
  await sec(page, 'audio');
  await expect(page.locator('#vmDuration')).toBeVisible();
  await expect(waiting(page)).toHaveCount(0, { timeout: 20000 });
  await sec(page, 'audio');
  await expect(page.locator('#vmDurValue')).toHaveText('٠:١٢');                 // 7 × 1.5 + 0.5 + 1
  await expect(page.locator('#vmSummary')).toContainText('٠:١٢');              // and in the chip under the preview
  // fewer ayat: it shows «…» at once, then the new length
  await sec(page, 'ayat');
  await page.fill('#vmTo', '3');
  await sec(page, 'ayat');
  await page.locator('#vmTo').dispatchEvent('change');
  await sec(page, 'audio');
  await expect(page.locator('#vmDurValue')).toHaveText('…');
  await expect(waiting(page)).toHaveCount(0, { timeout: 20000 });
  await sec(page, 'audio');
  await expect(page.locator('#vmDurValue')).toHaveText('٠:٠٦');                 // 3 × 1.5 + 0.5 + 1
  await expect(page.locator('#vmSummary')).toContainText('٠:٠٦');
});

test('with no connection it says so, and never shows a wrong length', async ({ page }) => {
  await page.route(/everyayah\.com\/data\/.+\.mp3$/, route => route.abort());
  await page.goto(`${BASE_URL}/pages/video-maker.html`, { waitUntil: 'load' });
  await sec(page, 'audio');
  await expect(page.locator('#vmDurValue.fail')).toBeVisible({ timeout: 20000 });
  await sec(page, 'audio');
  await expect(page.locator('#vmDurValue')).toContainText('تعذّر');
  await expect(page.locator('#vmSummary')).not.toContainText(/[٠-٩]:[٠-٩]/);   // no length in the chip
});
