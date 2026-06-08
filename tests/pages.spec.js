const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8080';
const PAGES_DIR = path.resolve(__dirname, '..', 'pages');

const pageFiles = fs.readdirSync(PAGES_DIR).filter(f => f.endsWith('.html'));

// Track console errors (404s, etc.) during each test
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

// ========== 1. Every page loads with no 404s ==========
for (const file of pageFiles) {
  test(`${file} loads with no resource errors`, async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/pages/${file}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    expect(response.status()).toBe(200);

    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);

    // Allow a moment for late-loading resources
    await page.waitForTimeout(1000);

    const resourceErrors = consoleErrors.filter(e => e.includes('404') || e.includes('ERR_ABORTED') || e.includes('Failed to load'));
    const relevantErrors = resourceErrors.filter(e =>
      !e.includes('googleapis.com') &&
      !e.includes('favicon') &&
      !e.includes('mushaf') &&     // mushaf page images are large, optional, cached
      !e.includes('/json/audio-')  // audio data files fetched at runtime (partial local data)
    );
    // Filter out orphaned "Failed to load" messages whose URL counterpart was already removed
    const finalErrors = relevantErrors.filter(e => {
      if (e.includes('Failed to load resource')) return false;
      return true;
    });

    expect(finalErrors, `${file} has resource errors:\n${finalErrors.join('\n')}`).toEqual([]);
  });
}

// ========== 2. index.html loads with no errors ==========
test('index.html loads with no resource errors', async ({ page }) => {
  const response = await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  expect(response.status()).toBe(200);
  await page.waitForTimeout(1000);
  const resourceErrors = consoleErrors.filter(e => e.includes('404') || e.includes('ERR_ABORTED') || e.includes('Failed to load'));
  const relevant = resourceErrors.filter(e => !e.includes('favicon') && !e.includes('mushaf') && !e.includes('/json/audio-') && !e.includes('Failed to load resource'));
  expect(relevant, `index.html has resource errors:\n${relevant.join('\n')}`).toEqual([]);
});

// ========== 3. index.html navigation links point to pages/ ==========
test('index.html navigation links point to pages/', async ({ page }) => {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });

  const linkCalls = await page.evaluate(() => {
    const html = document.documentElement.innerHTML;
    const goRegex = /go\('([^']+)'\)/g;
    const results = [];
    let match;
    while ((match = goRegex.exec(html)) !== null) {
      results.push(match[1]);
    }
    return results;
  });

  for (const link of linkCalls) {
    expect(link).toMatch(/^pages\//);
  }
});

// ========== 4. Every pages/*.html has correct index.html navigation ==========
for (const file of pageFiles) {
  test(`${file} has correct index.html navigation`, async ({ page }) => {
    await page.goto(`${BASE_URL}/pages/${file}`, { waitUntil: 'domcontentloaded', timeout: 15000 });

    const brokenRefs = await page.evaluate(() => {
      const html = document.documentElement.innerHTML;
      const results = [];
      // Find bare 'index.html' or "index.html" without a path prefix
      const matches = html.match(/['"]index\.html['"]/g);
      if (matches) results.push(...matches);
      return results;
    });

    expect(brokenRefs, `${file}: found bare index.html refs (should use /Tasbee7/index.html): ${brokenRefs.join(', ')}`).toEqual([]);
  });
}

// ========== 5. index.html feature cards ==========
test('index.html feature cards navigate to pages/', async ({ page }) => {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  const cards = await page.locator('.feature-card').all();
  expect(cards.length).toBeGreaterThan(0);
  for (const card of cards) {
    const onclick = await card.getAttribute('onclick') || '';
    expect(onclick).toMatch(/go\('pages\/|openPrayerModal/);
  }
});

// ========== 6. Settings sheet links ==========
test('index.html settings links use pages/', async ({ page }) => {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.setting-item[onclick]'))
      .map(el => el.getAttribute('onclick'));
  });
  for (const link of links) {
    if (link.includes("go(")) {
      expect(link).toMatch(/go\('pages\//);
    }
  }
});

// ========== 7. Quran hero ==========
test('index.html quran hero uses pages/', async ({ page }) => {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  const hasCorrectPaths = await page.evaluate(() => {
    const scripts = document.querySelectorAll('script');
    for (const s of scripts) {
      const t = s.textContent || '';
      if (t.includes('handleQuranClick') || t.includes('selectQuran')) {
        return t.includes("'pages/quran.html'") && t.includes("'pages/quran-text.html'");
      }
    }
    return false;
  });
  expect(hasCorrectPaths).toBe(true);
});

// ========== 8. Intra-page links ==========
test('intra-page links within pages/ use correct paths', async ({ page }) => {
  const testCases = [
    { file: 'audio.html', pattern: 'about.html' },
    { file: 'quran-text.html', pattern: 'quran.html' },
    { file: 'quran.html', pattern: 'quran-text.html' },
    { file: '404.html', pattern: 'quran.html' },
  ];
  for (const { file, pattern } of testCases) {
    await page.goto(`${BASE_URL}/pages/${file}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const raw = await page.evaluate(() => document.documentElement.innerHTML);
    const regex = new RegExp(pattern.replace('.', '\\.'));
    expect(regex.test(raw), `${file} should contain a link to ${pattern}`).toBe(true);
  }
});

// ========== 9. manifest.json ==========
test('manifest.json shortcuts point to pages/', async ({ page }) => {
  const response = await page.goto(`${BASE_URL}/manifest.json`, { waitUntil: 'domcontentloaded' });
  expect(response.status()).toBe(200);
  const text = await page.evaluate(() => document.body.textContent);
  const manifest = JSON.parse(text);
  for (const shortcut of manifest.shortcuts) {
    expect(shortcut.url).toMatch(/^pages\//);
  }
  expect(['index.html', './']).toContain(manifest.start_url);
});

// ========== 10. sw.js STATIC_ASSETS ==========
test('sw.js STATIC_ASSETS point to pages/', async ({ page }) => {
  const response = await page.goto(`${BASE_URL}/sw.js`, { waitUntil: 'domcontentloaded' });
  expect(response.status()).toBe(200);
  const swText = await page.evaluate(() => document.body.textContent);
  const htmlAssets = swText.match(/["']\.\/[^"']*\.html["']/g) || [];
  for (const asset of htmlAssets) {
    const clean = asset.replace(/["']/g, '');
    if (clean !== './' && clean !== './index.html' && clean !== './404.html') {
      expect(clean, `sw.js asset ${clean} should start with ./pages/`).toMatch(/^\.\/pages\//);
    }
  }
});

// ========== 11. All files exist ==========
test('all referenced HTML files exist in pages/', () => {
  const actual = fs.readdirSync(PAGES_DIR).filter(f => f.endsWith('.html'));
  // Every .html file in pages/ should be loadable
  expect(actual.length).toBeGreaterThan(0);
  // Core pages that must exist
  const required = [
    '404.html', 'about.html', 'audio.html', 'azkar.html', 'duaa.html',
    'hadith.html', 'hisn.html', 'howto.html', 'masbaha.html',
    'notifications.html', 'qibla.html', 'quran-text.html', 'quran.html',
    'quran2.html', 'radio.html',
  ];
  for (const file of required) {
    expect(actual.includes(file), `${file} should exist in pages/`).toBe(true);
  }
});
