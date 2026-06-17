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

// ========== 1. audio.html has Minshawi SEO meta tags ==========
test('audio.html has Minshawi Surah Al-Imran SEO meta tags', async ({ page }) => {
  // Allow extra time for first page load (server warmup + audio data JSON)
  const response = await page.goto(`${BASE_URL}/pages/audio.html`, { waitUntil: 'load', timeout: 30000 });
  expect(response.status()).toBe(200);

  const title = await page.title();
  expect(title).toContain('سورة آل عمران كاملة');
  expect(title).toContain('المنشاوي');
  expect(title).toContain('1967');

  const metaDesc = await page.evaluate(() =>
    document.querySelector('meta[name="description"]')?.getAttribute('content')
  );
  expect(metaDesc).toContain('سورة آل عمران كاملة');
  expect(metaDesc).toContain('المنشاوي');
  expect(metaDesc).toContain('1967');

  const ogTitle = await page.evaluate(() =>
    document.querySelector('meta[property="og:title"]')?.getAttribute('content')
  );
  expect(ogTitle).toContain('سورة آل عمران كاملة');
  expect(ogTitle).toContain('المنشاوي');

  const keywords = await page.evaluate(() =>
    document.querySelector('meta[name="keywords"]')?.getAttribute('content')
  );
  expect(keywords).toContain('آل عمران');
  expect(keywords).toContain('المنشاوي');
  expect(keywords).toContain('المصحف المرتل النادر');
});

// ========== 2. audio.html has JSON-LD for Surah Al-Imran ==========
test('audio.html has JSON-LD with Surah Al-Imran AudioObject', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/audio.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });

  const jsonld = await page.evaluate(() => {
    const script = document.querySelector('script[type="application/ld+json"]');
    return script ? JSON.parse(script.textContent) : null;
  });
  expect(jsonld).not.toBeNull();
  expect(jsonld['@type']).toBe('WebApplication');
  expect(jsonld.audio).toBeDefined();
  expect(jsonld.audio.length).toBeGreaterThanOrEqual(2);

  const alImran = jsonld.audio[0];
  expect(alImran.name).toContain('سورة آل عمران كاملة');
  expect(alImran.name).toContain('المنشاوي');
  expect(alImran.description).toContain('1967');
});

// ========== 3. Play Store banner exists in both pages ==========
test('audio.html has Play Store banner HTML', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/audio.html`, { waitUntil: 'domcontentloaded', timeout: 15000 });

  const hasBanner = await page.evaluate(() => {
    const banner = document.getElementById('playstore-banner');
    return {
      exists: !!banner,
      hasIcon: !!banner?.querySelector('.ps-icon'),
      hasTitle: banner?.querySelector('.ps-title')?.textContent?.includes('زاد المسلم'),
      hasBtn: banner?.querySelector('.ps-btn')?.getAttribute('href')?.includes('play.google.com/store/apps/details?id=io.github.solimananas.twa'),
      hasClose: !!document.getElementById('psCloseBtn'),
    };
  });
  expect(hasBanner.exists).toBe(true);
  expect(hasBanner.hasIcon).toBe(true);
  expect(hasBanner.hasTitle).toBe(true);
  expect(hasBanner.hasBtn).toBe(true);
  expect(hasBanner.hasClose).toBe(true);
});

test('index.html has Play Store banner HTML', async ({ page }) => {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });

  const hasBanner = await page.evaluate(() => {
    const banner = document.getElementById('playstore-banner');
    return {
      exists: !!banner,
      hasBtn: banner?.querySelector('.ps-btn')?.getAttribute('href')?.includes('play.google.com/store/apps/details?id=io.github.solimananas.twa'),
    };
  });
  expect(hasBanner.exists).toBe(true);
  expect(hasBanner.hasBtn).toBe(true);
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
  expect(content).toContain('3000');
  expect(content).toContain('deferredPrompt.prompt()');
  expect(content).toContain('showToast');
  expect(content).toContain('sessionStorage');
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
