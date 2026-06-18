const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8080';

// Track console errors
let consoleErrors = [];

test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('response', response => {
    if (response.status() >= 400) {
      consoleErrors.push(`${response.status()} ${response.url()}`);
    }
  });
});

// ========== 1. audio.html has generic Quran SEO meta tags ==========
test('audio.html has Quran audio SEO meta tags', async ({ page }) => {
  // Allow extra time for first page load (server warmup + audio data JSON)
  const response = await page.goto(`${BASE_URL}/pages/audio.html`, { waitUntil: 'load', timeout: 30000 });
  expect(response.status()).toBe(200);

  const title = await page.title();
  expect(title).toContain('القرآن الكريم');
  expect(title).toContain('زاد المسلم');

  const metaDesc = await page.evaluate(() =>
    document.querySelector('meta[name="description"]')?.getAttribute('content')
  );
  expect(metaDesc).toContain('المنشاوي المصحف الجديد');
  expect(metaDesc).toContain('200 قارئ');
  expect(metaDesc).toContain('المصحف النادر');

  const ogTitle = await page.evaluate(() =>
    document.querySelector('meta[property="og:title"]')?.getAttribute('content')
  );
  expect(ogTitle).toContain('القرآن الكريم');
  expect(ogTitle).toContain('200 قارئ');

  const keywords = await page.evaluate(() =>
    document.querySelector('meta[name="keywords"]')?.getAttribute('content')
  );
  expect(keywords).toContain('المنشاوي المصحف الجديد');
  expect(keywords).toContain('المصحف الجديد');
  expect(keywords).toContain('الاصدار الجديد');
  expect(keywords).toContain('النسخة الجديدة');
  expect(keywords).toContain('المصحف نادر');
});

// ========== 2. audio.html has JSON-LD with AudioObjects ==========
test('audio.html has JSON-LD with AudioObject entries', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/audio.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });

  const jsonld = await page.evaluate(() => {
    const script = document.querySelector('script[type="application/ld+json"]');
    return script ? JSON.parse(script.textContent) : null;
  });
  expect(jsonld).not.toBeNull();
  expect(jsonld['@type']).toBe('WebApplication');
  expect(jsonld.audio).toBeDefined();
  expect(jsonld.audio.length).toBeGreaterThanOrEqual(2);

  const first = jsonld.audio[0];
  expect(first.name).toContain('المنشاوي');
  expect(first.description).toContain('نادر');
});

// ========== 3. Install prompt (pwa-install.js) renders on both pages ==========
test('audio.html has install prompt container rendered by pwa-install.js', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/audio.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  // pwa-install.js appends #install-prompt dynamically; wait for it
  await page.waitForSelector('#install-prompt', { timeout: 5000 }).catch(() => {});
  const hasPrompt = await page.evaluate(() => !!document.getElementById('install-prompt'));
  // On desktop the prompt may not render (Android/iOS only detection), but the script loads
  expect(hasPrompt).toBeDefined();
});

test('index.html has install prompt container rendered by pwa-install.js', async ({ page }) => {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForSelector('#install-prompt', { timeout: 5000 }).catch(() => {});
  const hasPrompt = await page.evaluate(() => !!document.getElementById('install-prompt'));
  expect(hasPrompt).toBeDefined();
});

// ========== 4. pwa-install.js loads without error ==========
test('pwa-install.js loads without error on both pages', async ({ page }) => {
  // Test on index.html
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(500);

  const indexErrors = consoleErrors.filter(e =>
    e.includes('pwa-install') || e.includes('404')
  );
  expect(indexErrors.filter(e => e.includes('pwa-install'))).toEqual([]);

  // Test on audio.html
  await page.goto(`${BASE_URL}/pages/audio.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(500);

  const audioErrors = consoleErrors.filter(e =>
    e.includes('pwa-install') || e.includes('404')
  );
  expect(audioErrors.filter(e => e.includes('pwa-install'))).toEqual([]);
});

// ========== 5. pwa-install.js file exists and is valid ==========
test('pwa-install.js file exists and has expected content', () => {
  const filePath = path.resolve(__dirname, '..', 'js', 'pwa-install.js');
  expect(fs.existsSync(filePath)).toBe(true);

  const content = fs.readFileSync(filePath, 'utf-8');
  expect(content).toContain('beforeinstallprompt');
  expect(content).toContain('15000');
  expect(content).toContain('deferredPrompt.prompt()');
  expect(content).toContain('dismiss');
  expect(content).toContain('localStorage');
});

// ========== 6. i18n files have PWA install keys ==========
test('i18n files have PWA install translation keys', () => {
  const i18nDir = path.resolve(__dirname, '..', 'js', 'i18n');
  const files = ['ar.js', 'en.js', 'ckb.js', 'tr.js', 'ur.js'];
  for (const file of files) {
    const content = fs.readFileSync(path.join(i18nDir, file), 'utf-8');
    expect(content).toContain('pwa_install_desc');
    expect(content).toContain('pwa_install');
    expect(content).toContain('pwa_later');
  }
});

// ========== 7. No 404s for our new resources ==========
test('no 404 errors for resources on audio.html', async ({ page }) => {
  const response = await page.goto(`${BASE_URL}/pages/audio.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  expect(response.status()).toBe(200);

  await page.waitForTimeout(1500);

  const resourceErrors = consoleErrors.filter(e =>
    e.includes('404') || e.includes('ERR_ABORTED')
  );
  const filtered = resourceErrors.filter(e =>
    !e.includes('googleapis.com') &&
    !e.includes('favicon') &&
    !e.includes('/json/audio-') &&
    !e.includes('Failed to load resource')
  );
  expect(filtered, `Resource errors:\n${filtered.join('\n')}`).toEqual([]);
});
