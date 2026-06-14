const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8080';
const PAGE_URL = `${BASE_URL}/pages/download.html`;

const MOCK_VIDEO = {
  title: 'فيديو تجريبي',
  author_name: 'قناة تجريبية',
  thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
};

const SAMPLE_YT_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

// Intercept noembed so tests work offline
async function mockNoembed(page) {
  await page.route('**/noembed.com/**', route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_VIDEO) });
  });
}

// Intercept cobalt API
async function mockCobaltSuccess(page) {
  await page.route('**/api.cobalt.tools/**', route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'tunnel', url: 'https://example.com/file.mp3' }) });
  });
}

async function mockCobaltError(page) {
  await page.route('**/api.cobalt.tools/**', route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'error', error: { code: 'error.api.link.unsupported' } }) });
  });
}

async function mockCobaltNetworkFail(page) {
  await page.route('**/api.cobalt.tools/**', route => route.abort());
}

// Helper: enter a YT URL and wait for the preview to appear
async function enterYouTubeUrl(page, url = SAMPLE_YT_URL) {
  await mockNoembed(page);
  await page.fill('#urlInput', url);
  await page.waitForSelector('.preview-card.visible', { timeout: 5000 });
}

// ===== 1. Page loads =====
test('download.html loads with 200', async ({ page }) => {
  const res = await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  expect(res.status()).toBe(200);
});

test('download.html has correct title', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  expect(await page.title()).toContain('تحميل');
});

// ===== 2. Initial UI state =====
test('URL input is visible on load', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#urlInput')).toBeVisible();
});

test('paste button is visible on load', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.paste-btn')).toBeVisible();
});

test('download button is hidden initially', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#downloadBtn')).toBeHidden();
});

test('format card is hidden initially', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#formatCard')).toBeHidden();
});

test('quality card is hidden initially', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#qualityCard')).toBeHidden();
});

test('preview card is hidden initially', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#previewCard')).toBeHidden();
});

test('fallback banner is hidden initially', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#fallbackBanner')).toBeHidden();
});

test('history card is visible with empty state', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#historyCard')).toBeVisible();
  await expect(page.locator('.empty-state')).toBeVisible();
});

// ===== 3. URL validation =====
test('non-YouTube URL does not show preview', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await page.fill('#urlInput', 'https://example.com/video');
  await page.waitForTimeout(800);
  await expect(page.locator('#previewCard')).toBeHidden();
  await expect(page.locator('#downloadBtn')).toBeHidden();
});

test('invalid text does not show preview', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await page.fill('#urlInput', 'not a url');
  await page.waitForTimeout(800);
  await expect(page.locator('#previewCard')).toBeHidden();
});

// ===== 4. YouTube URL preview =====
test('YouTube URL shows preview card', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await enterYouTubeUrl(page);
  await expect(page.locator('#previewCard')).toBeVisible();
});

test('preview shows video title', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await enterYouTubeUrl(page);
  await expect(page.locator('#previewTitle')).toHaveText(MOCK_VIDEO.title);
});

test('preview shows channel name', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await enterYouTubeUrl(page);
  await expect(page.locator('#previewChannel')).toHaveText(MOCK_VIDEO.author_name);
});

test('preview shows thumbnail image', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await enterYouTubeUrl(page);
  const src = await page.locator('#previewImg').getAttribute('src');
  expect(src).toBeTruthy();
});

test('YouTube URL shows format card', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await enterYouTubeUrl(page);
  await expect(page.locator('#formatCard')).toBeVisible();
});

test('YouTube URL shows quality card', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await enterYouTubeUrl(page);
  await expect(page.locator('#qualityCard')).toBeVisible();
});

test('YouTube URL shows download button', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await enterYouTubeUrl(page);
  await expect(page.locator('#downloadBtn')).toBeVisible();
});

// ===== 5. youtu.be short URL =====
test('youtu.be short URL is recognized', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await enterYouTubeUrl(page, 'https://youtu.be/dQw4w9WgXcQ');
  await expect(page.locator('#previewCard')).toBeVisible();
});

// ===== 6. YouTube Shorts URL =====
test('YouTube Shorts URL is recognized', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await enterYouTubeUrl(page, 'https://www.youtube.com/shorts/dQw4w9WgXcQ');
  await expect(page.locator('#previewCard')).toBeVisible();
});

// ===== 7. Format selection =====
test('MP3 format card is selected by default', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await enterYouTubeUrl(page);
  await expect(page.locator('#fmtMp3')).toHaveClass(/selected/);
  await expect(page.locator('#fmtMp4')).not.toHaveClass(/selected/);
});

test('clicking MP4 selects it', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await enterYouTubeUrl(page);
  await page.click('#fmtMp4');
  await expect(page.locator('#fmtMp4')).toHaveClass(/selected/);
  await expect(page.locator('#fmtMp3')).not.toHaveClass(/selected/);
});

test('MP3 quality chips show kbps', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await enterYouTubeUrl(page);
  const chips = await page.locator('.quality-chip').allTextContents();
  expect(chips.some(c => c.includes('kbps'))).toBe(true);
});

test('MP4 quality chips show p suffix', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await enterYouTubeUrl(page);
  await page.click('#fmtMp4');
  const chips = await page.locator('.quality-chip').allTextContents();
  expect(chips.some(c => c.includes('p'))).toBe(true);
});

test('clicking a quality chip marks it active', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await enterYouTubeUrl(page);
  const chips = page.locator('.quality-chip');
  const first = chips.first();
  await first.click();
  await expect(first).toHaveClass(/active/);
});

// ===== 8. Download flow — cobalt success =====
test('successful cobalt response shows success status', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await enterYouTubeUrl(page);
  await mockCobaltSuccess(page);
  await page.click('#downloadBtn');
  await expect(page.locator('#statusMsg')).toHaveClass(/success/, { timeout: 5000 });
});

// ===== 9. Download flow — cobalt API error =====
test('cobalt API error shows error status and fallback banner', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await enterYouTubeUrl(page);
  await mockCobaltError(page);
  await page.click('#downloadBtn');
  await expect(page.locator('#statusMsg')).toHaveClass(/error/, { timeout: 5000 });
  await expect(page.locator('#fallbackBanner')).toBeVisible({ timeout: 5000 });
});

// ===== 10. Download flow — network failure =====
test('cobalt network failure shows error and fallback banner', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await enterYouTubeUrl(page);
  await mockCobaltNetworkFail(page);
  await page.click('#downloadBtn');
  await expect(page.locator('#statusMsg')).toHaveClass(/error/, { timeout: 5000 });
  await expect(page.locator('#fallbackBanner')).toBeVisible({ timeout: 5000 });
});

test('fallback banner has Cobalt and Y2mate buttons', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await enterYouTubeUrl(page);
  await mockCobaltNetworkFail(page);
  await page.click('#downloadBtn');
  await page.locator('#fallbackBanner').waitFor({ state: 'visible', timeout: 5000 });
  await expect(page.locator('.fallback-btn-primary')).toBeVisible();
  await expect(page.locator('.fallback-btn-secondary')).toBeVisible();
});

// ===== 11. Theme cycling =====
test('theme button cycles through themes', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  const initialTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await page.click('.header .icon-btn:last-child');
  const newTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  expect(newTheme).not.toBe(initialTheme);
});

test('all three themes are available', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  const themes = new Set();
  for (let i = 0; i < 4; i++) {
    themes.add(await page.evaluate(() => document.documentElement.getAttribute('data-theme')));
    await page.click('.header .icon-btn:last-child');
  }
  expect(themes.size).toBe(3);
});

// ===== 12. History =====
test('history clear button removes entries', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  // Seed history via localStorage
  await page.evaluate(() => {
    localStorage.setItem('dlHistory', JSON.stringify([{
      title: 'Test', channel: 'Ch', thumbnail: '', url: 'https://youtu.be/test', format: 'mp3', quality: '192', time: Date.now()
    }]));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.history-item')).toBeVisible();
  await page.click('.history-clear');
  await expect(page.locator('.empty-state')).toBeVisible();
  await expect(page.locator('.history-item')).toBeHidden();
});

test('history items show format badge', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('dlHistory', JSON.stringify([{
      title: 'Test', channel: 'Ch', thumbnail: '', url: 'https://youtu.be/test', format: 'mp3', quality: '192', time: Date.now()
    }]));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.history-badge')).toContainText('MP3');
});

// ===== 13. Clearing URL hides preview =====
test('clearing URL hides preview and controls', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await enterYouTubeUrl(page);
  await expect(page.locator('#downloadBtn')).toBeVisible();
  await page.fill('#urlInput', '');
  await page.dispatchEvent('#urlInput', 'input');
  await page.waitForTimeout(200);
  await expect(page.locator('#downloadBtn')).toBeHidden();
  await expect(page.locator('#previewCard')).toBeHidden();
});

// ===== 14. Home link is correct =====
test('home link points to /Tasbee7/index.html', async ({ page }) => {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  const href = await page.locator('.header a.icon-btn').getAttribute('href');
  expect(href).toBe('/Tasbee7/index.html');
});

// ===== 15. No broken resources =====
test('download.html loads with no 404 errors', async ({ page }) => {
  const errors = [];
  page.on('response', r => { if (r.status() >= 400 && !r.url().includes('noembed') && !r.url().includes('googleapis')) errors.push(r.url()); });
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  expect(errors).toEqual([]);
});
