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

test('the Jazariyya: 109 abyat, played as a whole (no per-bayt controls)', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/tajweed.html?matn=jazariyya`, { waitUntil: 'load' });
  await expect(page.locator('.bayt')).toHaveCount(109);
  await expect(page.locator('.b-sharh')).toHaveCount(109);
  await expect(page.locator('.b-play')).toHaveCount(0);
  await expect(page.locator('#tpPrev')).toBeHidden();
  await expect(page.locator('#tpRepeat')).toBeHidden();
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
});
