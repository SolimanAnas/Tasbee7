// Video maker, «فيديو طويل» tab (js/video-maker-long.js): 16:9 templates, whole-surah
// ranges, an estimated length from file sizes, and the fast WebCodecs export.
// The audio server is never called: HEAD requests answer with a size that is 1 s of
// 128 kbps audio, and every recording is a generated 1 s WAV.
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8080';
test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });

function wav(seconds, rate = 8000) {
  const n = Math.round(seconds * rate), buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  // A quiet tone rather than silence, so the encoder has something to encode.
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(2000 * Math.sin(i / 8)), 44 + i * 2);
  return buf;
}

// Duration of an MP4 from its movie header (mvhd).
function mp4Duration(buf) {
  const at = buf.indexOf('mvhd');
  const version = buf[at + 4];
  if (version === 1) return Number(buf.readBigUInt64BE(at + 4 + 4 + 16 + 4)) / buf.readUInt32BE(at + 4 + 4 + 16);
  return buf.readUInt32BE(at + 4 + 4 + 8 + 4) / buf.readUInt32BE(at + 4 + 4 + 8);
}

test.beforeEach(async ({ page }) => {
  // Fresh settings once per test (not on a reload, which must keep them).
  await page.addInitScript(() => {
    try {
      if (sessionStorage.getItem('vmTestStarted')) return;
      sessionStorage.setItem('vmTestStarted', '1');
      localStorage.setItem('zad_lang', 'ar');
      localStorage.removeItem('vm_settings');
    } catch { /* storage blocked */ }
  });
  await page.route(url => !url.href.startsWith(BASE_URL) && !/everyayah\.com/.test(url.href), route => route.abort());
  await page.route(/everyayah\.com\/data\/.+\.mp3$/, route => route.request().method() === 'HEAD'
    ? route.fulfill({ status: 200, headers: { 'Content-Type': 'audio/mpeg', 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Content-Length' }, body: Buffer.alloc(16000) })
    : route.fulfill({ status: 200, headers: { 'Content-Type': 'audio/wav', 'Access-Control-Allow-Origin': '*' }, body: wav(1) }));
});

test('shorts is the default; the long tab is 16:9 with templates and whole-surah ranges', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/video-maker.html`, { waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  const shortTab = page.locator('#vmModeTabs [data-mode="short"]');
  const longTab = page.locator('#vmModeTabs [data-mode="long"]');
  await expect(shortTab).toHaveClass(/active/);
  await expect(page.locator('#vmTemplates')).toBeHidden();
  await expect(page.locator('#vmFormat')).toBeVisible();
  expect(await page.evaluate(() => [vmCanvas.width, vmCanvas.height])).toEqual([1080, 1920]);

  await longTab.click();
  await expect(longTab).toHaveClass(/active/);
  await expect(page.locator('#vmTemplates .tpl-thumb')).toHaveCount(14);
  await expect(page.locator('#vmTemplates .tpl-thumb.active')).toHaveAttribute('data-tpl', 'dawn');
  // A painted template brings its own picture: no background step.
  await expect(page.locator('#vmBgCard')).toBeHidden();
  await page.locator('#vmTemplates [data-tpl="royal"]').click();
  await expect(page.locator('#vmBgCard')).toBeVisible();
  await expect(page.locator('#vmFormat')).toBeHidden();
  await expect(page.locator('#vmMotion')).toBeHidden();
  await expect(page.locator('.long-hint')).toBeVisible();
  expect(await page.evaluate(() => [vmCanvas.width, vmCanvas.height])).toEqual([1920, 1080]);
  await expect(page.locator('#vmSummary')).toContainText('16:9 · 1080p');

  // The whole of Al-Baqarah is allowed here …
  await page.evaluate(() => { const s = document.getElementById('vmSurah'); s.value = 2; s.dispatchEvent(new Event('change')); });
  await page.fill('#vmTo', '286');
  await page.locator('#vmTo').dispatchEvent('change');
  await expect(page.locator('#vmTo')).toHaveValue('286');
  await expect(page.locator('#vmFrom')).toHaveValue('1');

  // … and the choice of template is kept across a reload.
  await page.locator('#vmTemplates [data-tpl="mosque"]').click();
  await page.reload({ waitUntil: 'load' });
  await expect(longTab).toHaveClass(/active/);
  await expect(page.locator('#vmTemplates .tpl-thumb.active')).toHaveAttribute('data-tpl', 'mosque');
  await expect(page.locator('#vmBgCard')).toBeVisible();

  // Back to shorts: the 20-ayah limit applies again, from the same first ayah.
  await shortTab.click();
  await expect(page.locator('#vmFrom')).toHaveValue('1');
  await expect(page.locator('#vmTo')).toHaveValue('20');
  expect(await page.evaluate(() => [vmCanvas.width, vmCanvas.height])).toEqual([1080, 1920]);
});

test('the long video length is estimated, then the fast export makes an MP4 that long', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/video-maker.html`, { waitUntil: 'load' });
  // The tab only works once the page's scripts have started (the surah picker is filled then).
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  await page.locator('#vmModeTabs [data-mode="long"]').click();
  // Al-Fatihah: 7 ayat × 1 s + 0.6 s lead-in + 1.2 s tail = 8.8 s.
  await expect(page.locator('#vmDurValue')).toHaveText('≈ ٠:٠٩', { timeout: 20000 });

  const fast = await page.evaluate(() => !!(window.VideoEncoder && window.AudioEncoder));
  test.skip(!fast, 'no WebCodecs in this browser');
  await page.locator('#vmExport').click();
  await expect(page.locator('#vmResult')).toBeVisible({ timeout: 60000 });
  await expect(page.locator('#vmDownload')).toHaveAttribute('download', 'quran-long-001-1-7.mp4');
  const bytes = await page.evaluate(async () => {
    const buf = await (await fetch(document.getElementById('vmVideo').src)).arrayBuffer();
    return Array.from(new Uint8Array(buf));
  });
  const mp4 = Buffer.from(bytes);
  expect(mp4.indexOf('ftyp')).toBe(4);
  expect(mp4.indexOf('avc1')).toBeGreaterThan(0);
  expect(mp4Duration(mp4)).toBeGreaterThan(8.5);
  expect(mp4Duration(mp4)).toBeLessThan(9.2);
  // The controls are usable again.
  await expect(page.locator('#vmExport')).toBeEnabled();
  await expect(page.locator('#vmModeTabs [data-mode="short"]')).toBeEnabled();
});
