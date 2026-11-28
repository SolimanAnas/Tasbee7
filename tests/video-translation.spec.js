// «ترجمة الآيات»: a translation under the ayat (the Quran reader's, data/translations from the
// Tanzil Project) — under the whole ayah, under the line being recited, and under the word; on
// the panel; remembered and loaded with the page; not for your own words.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const sec = (page, name) => expect(async () => {
  const tab = page.locator('#vmTab-' + name);
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click({ timeout: 2000 });
  await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 500 });
}).toPass({ timeout: 15000 });

const BASE_URL = 'http://localhost:8080';
const EN = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'translations', 'en.sahih.json'), 'utf8'));
test.use({ serviceWorkers: 'block', viewport: { width: 412, height: 915 } });

function wav(seconds, rate = 8000) {
  const n = Math.round(seconds * rate), buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin(i / rate * 2 * Math.PI * 200) * 8000), 44 + i * 2);
  return buf;
}
async function open(page, settings) {
  await page.addInitScript(st => {
    if (sessionStorage.getItem('t')) return;
    sessionStorage.setItem('t', '1');
    localStorage.setItem('zad_lang', 'ar');
    localStorage.setItem('vm_settings', JSON.stringify(Object.assign({ mode: 'short', bg: 'g0', motion: false, miniPreview: false, caption: false, surah: 1, from: 2, to: 3, reciter: 'ghamdi', basmala: false }, st)));
  }, settings || {});
  await page.route(url => !url.href.startsWith(BASE_URL) && !/everyayah/.test(url.href), route => route.abort());
  await page.route(/everyayah\.com\/data\/.+\.mp3$/, route => route.fulfill({ status: 200, headers: { 'Content-Type': 'audio/wav', 'Access-Control-Allow-Origin': '*' }, body: wav(3) }));
  await page.goto(`${BASE_URL}/pages/video-maker.html`, { waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
}
// how much text is in the lower part of a frame (the translation sits under the ayah)
const lower = (page, t) => page.evaluate(async t => {
  const tl = t == null ? null : await VM.buildTimeline();
  const c = document.createElement('canvas'); c.width = 540; c.height = 960;
  const x = c.getContext('2d', { willReadFrequently: true });
  VM.renderFrame(x, 540, 960, t == null ? 0 : t, tl);
  const d = x.getImageData(0, 0, 540, 960).data;
  let n = 0, top = 960, bottom = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] > 225 && d[i + 1] > 225 && d[i + 2] > 225) { n++; const y = Math.floor(i / 4 / 540); if (y < top) top = y; if (y > bottom) bottom = y; }
  return { n, top, bottom };
}, t);

test('chosen in «النص»: under the ayah, on its panel; remembered and loaded with the page', async ({ page }) => {
  await open(page);
  await sec(page, 'text');
  await expect(page.locator('#vmTrans [data-trans=""]')).toHaveAttribute('aria-pressed', 'true');
  const plain = await lower(page, null);
  await page.locator('#vmTrans [data-trans="en.sahih"]').click();
  await expect(page.locator('#vmTrans [data-trans="en.sahih"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => VM.translation)).toBe('en.sahih');
  // the ayah and its translation together: more text, reaching further down
  const withT = await lower(page, null);
  expect(withT.n).toBeGreaterThan(plain.n * 1.3);
  expect(withT.bottom).toBeGreaterThan(plain.bottom + 40);
  // the very translation of 1:2 is drawn: its words are there in the right file
  expect(EN.surahs[0][1]).toContain('Lord of the worlds');
  // remembered, and loaded as the page opens
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  await expect.poll(() => page.evaluate(() => VM.translation)).toBe('en.sahih');
  // «بدون»: gone again
  await sec(page, 'text');
  await page.locator('#vmTrans [data-trans=""]').click();
  const off = await lower(page, null);
  expect(Math.abs(off.n - plain.n)).toBeLessThan(plain.n * 0.1);
});

test('line by line and word by word: the translation of the ayah being recited', async ({ page }) => {
  await open(page, { trans: 'en.sahih', ayahView: 'line' });
  await expect.poll(() => page.evaluate(() => VM.translation)).toBe('en.sahih');
  const tl = await page.evaluate(async () => { const t = await VM.buildTimeline(); return t.items.map(it => [it.start, it.end]); });
  const line = await lower(page, (tl[1][0] + tl[1][1]) / 2);
  await page.evaluate(() => { VM.state.trans = null; });
  const lineNo = await lower(page, (tl[1][0] + tl[1][1]) / 2);
  expect(line.n).toBeGreaterThan(lineNo.n + 300);
  await page.evaluate(() => { VM.state.trans = 'en.sahih'; VM.state.ayahView = 'word'; });
  const word = await lower(page, (tl[1][0] + tl[1][1]) / 2);
  await page.evaluate(() => { VM.state.trans = null; });
  const wordNo = await lower(page, (tl[1][0] + tl[1][1]) / 2);
  expect(word.n).toBeGreaterThan(wordNo.n + 300);
  expect(word.bottom).toBeGreaterThan(wordNo.bottom + 30);
});

test('offered for ayat, not for your own words (they have no translation)', async ({ page }) => {
  await open(page, { mode: 'khatira', kContent: 'text', kTexts: ['نص من كتابتي'], trans: 'en.sahih' });
  await sec(page, 'text');
  await expect(page.locator('#vmTrans')).toBeHidden();
  // ayat in «خاطرة»: offered
  await page.evaluate(() => { document.querySelector('#vmKContent [data-kc="quran"]').click(); });
  await expect(page.locator('#vmTrans')).toBeVisible();
});
