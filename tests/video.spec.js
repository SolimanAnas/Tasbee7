const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8080';
const PAGE_URL = `${BASE_URL}/pages/video.html`;
const YT_URL   = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

const MOCK_META = { title: 'فيديو تجريبي', author_name: 'قناة تجريبية', thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' };
const MOCK_STREAM = 'https://example.com/stream.mp4';

async function mockApis(page) {
  await page.route('**/noembed.com/**', r =>
    r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(MOCK_META) }));
  await page.route('**/api.cobalt.tools/**', r =>
    r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ status:'tunnel', url: MOCK_STREAM }) }));
  // stub the stream itself so the <video> doesn't error
  await page.route(MOCK_STREAM, r =>
    r.fulfill({ status:200, contentType:'video/mp4', body: Buffer.alloc(0) }));
}

async function mockCobaltFail(page) {
  await page.route('**/noembed.com/**', r =>
    r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(MOCK_META) }));
  await page.route('**/api.cobalt.tools/**', r => r.abort());
}

async function loadUrl(page, url = YT_URL) {
  await mockApis(page);
  await page.fill('#urlInput', url);
  await page.waitForSelector('#playerShell.visible', { timeout: 8000 });
}

/* ── 1. Page basics ── */
test('video.html loads with 200', async ({ page }) => {
  const res = await page.goto(PAGE_URL, { waitUntil:'domcontentloaded', timeout:15000 });
  expect(res.status()).toBe(200);
});

test('video.html has correct title', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  expect(await page.title()).toContain('مشغّل');
});

test('home link is correct', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  expect(await page.locator('.header a.icon-btn').getAttribute('href')).toBe('/Tasbee7/index.html');
});

test('no 404 resource errors on load', async ({ page }) => {
  const errors = [];
  page.on('response', r => { if(r.status()>=400 && !r.url().includes('googleapis')) errors.push(r.url()); });
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(800);
  expect(errors).toEqual([]);
});

/* ── 2. Initial UI state ── */
test('URL input is visible', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await expect(page.locator('#urlInput')).toBeVisible();
});

test('paste button is visible', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await expect(page.locator('.paste-btn')).toBeVisible();
});

test('player is hidden initially', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await expect(page.locator('#playerShell')).toBeHidden();
});

test('fallback banner is hidden initially', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await expect(page.locator('#fallbackBanner')).toBeHidden();
});

test('history card is visible with empty state', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await expect(page.locator('#historyCard')).toBeVisible();
  await expect(page.locator('.empty-state')).toBeVisible();
});

test('cover art is hidden initially', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await expect(page.locator('#coverArt')).toBeHidden();
});

/* ── 3. URL validation ── */
test('non-YouTube URL does not trigger load', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await page.fill('#urlInput', 'https://example.com/video.mp4');
  await page.waitForTimeout(800);
  await expect(page.locator('#playerShell')).toBeHidden();
});

test('invalid text does not trigger load', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await page.fill('#urlInput', 'not a url');
  await page.waitForTimeout(800);
  await expect(page.locator('#playerShell')).toBeHidden();
});

/* ── 4. Successful load ── */
test('YouTube URL shows player', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await loadUrl(page);
  await expect(page.locator('#playerShell')).toBeVisible();
});

test('video element is present inside player', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await loadUrl(page);
  await expect(page.locator('#vid')).toBeAttached();
});

test('video title is displayed', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await loadUrl(page);
  await expect(page.locator('#nowTitle')).toHaveText(MOCK_META.title);
});

test('channel name is displayed', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await loadUrl(page);
  await expect(page.locator('#nowChannel')).toHaveText(MOCK_META.author_name);
});

test('play button is enabled after load', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await loadUrl(page);
  await expect(page.locator('#playBtn')).not.toBeDisabled();
});

test('seekbar is visible after load', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await loadUrl(page);
  await expect(page.locator('#seekbarWrap')).toBeVisible();
});

test('time labels are visible', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await loadUrl(page);
  await expect(page.locator('#timeCur')).toBeVisible();
  await expect(page.locator('#timeDur')).toBeVisible();
});

/* ── 5. Controls ── */
test('skip buttons are present', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await loadUrl(page);
  const btns = await page.locator('.ctrl-btn').all();
  expect(btns.length).toBeGreaterThanOrEqual(4);
});

test('volume slider is present', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await loadUrl(page);
  await expect(page.locator('#volSlider')).toBeVisible();
});

test('audio-only badge exists', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await loadUrl(page);
  await expect(page.locator('#bgBadge')).toBeVisible();
});

test('PiP badge exists', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await loadUrl(page);
  await expect(page.locator('#pipBadge')).toBeVisible();
});

test('loop badge exists', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await loadUrl(page);
  await expect(page.locator('#loopBadge')).toBeVisible();
});

test('loop badge toggles on/off', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await loadUrl(page);
  await page.click('#loopBadge');
  await expect(page.locator('#loopBadge')).toHaveClass(/on/);
  await page.click('#loopBadge');
  await expect(page.locator('#loopBadge')).not.toHaveClass(/on/);
});

test('audio-only badge toggles cover art', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await loadUrl(page);
  await expect(page.locator('#coverArt')).toBeHidden();
  await page.click('#bgBadge');
  await expect(page.locator('#bgBadge')).toHaveClass(/on/);
  await expect(page.locator('#coverArt')).toBeVisible();
  await page.click('#bgBadge');
  await expect(page.locator('#coverArt')).toBeHidden();
});

test('cover art image src is set', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await loadUrl(page);
  const src = await page.locator('#coverImg').getAttribute('src');
  expect(src).toBeTruthy();
});

/* ── 6. Media Session API ── */
test('mediaSession metadata is set after load', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await loadUrl(page);
  const title = await page.evaluate(() => navigator.mediaSession?.metadata?.title);
  expect(title).toBe('فيديو تجريبي');
});

test('mediaSession artist is set', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await loadUrl(page);
  const artist = await page.evaluate(() => navigator.mediaSession?.metadata?.artist);
  expect(artist).toBe('قناة تجريبية');
});

test('mediaSession artwork is set', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await loadUrl(page);
  const artLen = await page.evaluate(() => navigator.mediaSession?.metadata?.artwork?.length ?? 0);
  expect(artLen).toBeGreaterThan(0);
});

/* ── 7. Cobalt failure → fallback ── */
test('cobalt failure shows fallback banner', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await mockCobaltFail(page);
  await page.fill('#urlInput', YT_URL);
  await page.locator('#fallbackBanner').waitFor({ state:'visible', timeout:8000 });
  await expect(page.locator('#fallbackBanner')).toBeVisible();
});

test('fallback banner has Cobalt and YouTube buttons', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await mockCobaltFail(page);
  await page.fill('#urlInput', YT_URL);
  await page.locator('#fallbackBanner').waitFor({ state:'visible', timeout:8000 });
  await expect(page.locator('.fb-btn-p')).toBeVisible();
  await expect(page.locator('.fb-btn-s')).toBeVisible();
});

/* ── 8. Theme ── */
test('theme cycles on button click', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await page.click('.header .icon-btn:last-child');
  const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  expect(after).not.toBe(before);
});

test('all three themes available', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  const seen = new Set();
  for(let i=0;i<4;i++){
    seen.add(await page.evaluate(()=>document.documentElement.getAttribute('data-theme')));
    await page.click('.header .icon-btn:last-child');
  }
  expect(seen.size).toBe(3);
});

/* ── 9. History ── */
test('history item appears after playing a video', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await loadUrl(page);
  await expect(page.locator('.history-item')).toBeVisible();
});

test('history item shows video title', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await loadUrl(page);
  await expect(page.locator('.history-title').first()).toContainText(MOCK_META.title);
});

test('history clear button removes entries', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await loadUrl(page);
  await expect(page.locator('.history-item')).toBeVisible();
  await page.click('.history-clear');
  await expect(page.locator('.empty-state')).toBeVisible();
  await expect(page.locator('.history-item')).toBeHidden();
});

test('history persists across reload', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await loadUrl(page);
  await page.reload({ waitUntil:'domcontentloaded' });
  await expect(page.locator('.history-item')).toBeVisible();
});

/* ── 10. youtu.be + shorts ── */
test('youtu.be URL triggers load', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await mockApis(page);
  await page.fill('#urlInput', 'https://youtu.be/dQw4w9WgXcQ');
  await page.locator('#playerShell.visible').waitFor({ timeout:8000 });
  await expect(page.locator('#playerShell')).toBeVisible();
});

test('shorts URL triggers load', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil:'domcontentloaded' });
  await mockApis(page);
  await page.fill('#urlInput', 'https://www.youtube.com/shorts/dQw4w9WgXcQ');
  await page.locator('#playerShell.visible').waitFor({ timeout:8000 });
  await expect(page.locator('#playerShell')).toBeVisible();
});
