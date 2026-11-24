// «تعلم التجويد»: the two mutun with a sharh for every bayt, chapters, and the
// Tuhfa's per-bayt playback from the published timings.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8080';
const ROOT = path.join(__dirname, '..');
const TUHFA = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tajweed', 'tuhfa.json'), 'utf8'));
test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await page.route(url => !url.href.startsWith(BASE_URL), route => route.abort());
});

test('the Tuhfa: 61 abyat in their chapters, each with its sharh, al-Dabba\'s notes folded', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/tajweed.html?matn=tuhfa`, { waitUntil: 'load' });
  await expect(page.locator('.bayt')).toHaveCount(61);
  await expect(page.locator('.b-sharh')).toHaveCount(61);
  await expect(page.locator('.tj-chap')).toHaveCount(TUHFA.chapters.length);
  await expect(page.locator('#b-1 .b-text')).toContainText('يَقُولُ رَاجِي رَحْمَةِ الْغَفُورِ');
  await expect(page.locator('.b-dabba')).toHaveCount(TUHFA.abyat.filter(b => b.dabba).length);
  await expect(page.locator('.b-play')).toHaveCount(61);
  // hide the sharh to memorise
  await page.check('#tjHideSharh');
  await expect(page.locator('#b-1 .b-sharh')).toBeHidden();
});

test('the Jazariyya: 109 abyat, played as a whole (no per-bayt controls, ±10 s instead)', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/tajweed.html?matn=jazariyya`, { waitUntil: 'load' });
  await expect(page.locator('.bayt')).toHaveCount(109);
  await expect(page.locator('.b-sharh')).toHaveCount(109);
  await expect(page.locator('.b-play')).toHaveCount(0);
  await expect(page.locator('#tpRepeat')).toBeHidden();
  await expect(page.locator('#tpPrev')).toHaveAttribute('aria-label', /10|١٠/);
  await expect(page.locator('#tpNext')).toHaveAttribute('aria-label', /10|١٠/);
});

test('a Tuhfa bayt plays from its published start and is followed', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/tajweed.html?matn=tuhfa`, { waitUntil: 'load' });
  await expect(page.locator('.bayt')).toHaveCount(61);
  // No network here: report the seek and stand in for playback.
  await page.evaluate(() => {
    const a = TajweedPage.audio;
    Object.defineProperty(a, 'readyState', { get: () => 4 });
    a.play = () => Promise.resolve();
  });
  await page.locator('#b-6 .b-play').click();
  const r = TUHFA.audio.reciters[await page.evaluate(() => TajweedPage.state.reciterIdx)];
  expect(await page.evaluate(() => TajweedPage.audio.currentTime)).toBeCloseTo(r.abyat[5][0], 1);
  await expect(page.locator('#b-6')).toHaveClass(/playing/);
  await expect(page.locator('#tpInfo')).toContainText('6');
  // the lock screen shows the bayt, the reader and the app icon
  const md = await page.evaluate(() => { const m = navigator.mediaSession.metadata; return m && { title: m.title, art: m.artwork.map(a => a.src) }; });
  expect(md.title).toContain('6');
  expect(md.art.some(s => s.endsWith('/icons/icon_512.png'))).toBe(true);
});

test('the reciter sheet lists every recording with its length and size', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/tajweed.html?matn=tuhfa`, { waitUntil: 'load' });
  await expect(page.locator('.bayt')).toHaveCount(61);
  await page.click('#tpReciter');
  await expect(page.locator('#tjSheet')).toBeVisible();
  await expect(page.locator('#tjRcList .rc')).toHaveCount(TUHFA.audio.reciters.length);
  await expect(page.locator('#tjRcList .rc').first()).toContainText('MB');
  // pick another reader: it becomes the selected one and the player names it
  await page.locator('#tjRcList .rc-pick').nth(2).click();
  await expect(page.locator('#tjSheet')).toBeHidden();
  expect(await page.evaluate(() => TajweedPage.state.reciterIdx)).toBe(2);
  await expect(page.locator('#tpReciterName')).toHaveText(TUHFA.audio.reciters[2].name.replace(/^(الشيخ|القارئ)\s+/, ''));
});

test('a recording saved on the device plays from a local copy', async ({ page }) => {
  const i = TUHFA.audio.reciters.findIndex(r => r.id === 'abdulmohsen_alqasim');
  const r = TUHFA.audio.reciters[i];
  // a valid silent MP3 of the recording's size (MPEG-1 layer III frames, 128 kb/s, 44.1 kHz)
  const frame = Buffer.alloc(417); frame.set([0xFF, 0xFB, 0x90, 0x64]);
  const body = Buffer.alloc(r.size);
  for (let o = 0; o + 417 <= r.size; o += 417) frame.copy(body, o);
  await page.route(r.url, route => route.fulfill({ status: 200, headers: { 'Content-Type': 'audio/mpeg', 'Access-Control-Allow-Origin': '*', 'Content-Length': String(r.size) }, body }));
  await page.goto(`${BASE_URL}/pages/tajweed.html?matn=tuhfa`, { waitUntil: 'load' });
  await expect(page.locator('.bayt')).toHaveCount(61);
  await page.evaluate(n => TajweedPage.selectReciter(n), i);
  await page.click('#tpReciter');
  await page.locator(`#tjRcList .rc[data-i="${i}"] .rc-save`).click();
  await expect(page.locator(`#tjRcList .rc[data-i="${i}"] .rc-save`)).toHaveClass(/done/, { timeout: 15000 });
  await expect(page.locator(`#tjRcList .rc[data-i="${i}"]`)).toContainText('على الجهاز');
  const st = await page.evaluate(() => TajweedPage.state);
  expect(st.saved).toContain(r.url);
  expect(st.src.startsWith('blob:')).toBe(true);
  await expect(page.locator('#tpSaved')).toBeVisible();
  // still there after a reload
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('.bayt')).toHaveCount(61);
  await expect.poll(() => page.evaluate(() => TajweedPage.state.src)).toMatch(/^blob:/);
  await page.evaluate(() => caches.delete('quran-offline-tajweed-v1'));
});

test('an interrupted play is not reported as a failure', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/tajweed.html?matn=tuhfa`, { waitUntil: 'load' });
  await expect(page.locator('.bayt')).toHaveCount(61);
  await page.evaluate(() => {
    const a = TajweedPage.audio;
    Object.defineProperty(a, 'readyState', { get: () => 4 });
    a.play = () => Promise.reject(new DOMException('The play() request was interrupted by a call to pause().', 'AbortError'));
  });
  await page.locator('#b-3 .b-play').click();
  await page.waitForTimeout(300);
  await expect(page.locator('#toast')).not.toHaveClass(/show/);
});
