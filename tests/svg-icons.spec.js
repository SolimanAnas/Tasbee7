const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8080';
const PAGES_DIR = path.resolve(__dirname, '..', 'pages');
const SVG_DIR = path.resolve(__dirname, '..', 'img', 'SVG');

const pageFiles = fs.readdirSync(PAGES_DIR).filter(f => f.endsWith('.html'));
const svgFiles = fs.readdirSync(SVG_DIR).filter(f => f.endsWith('.svg'));

let consoleErrors = [];
let failedResources = [];

test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  failedResources = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('response', response => {
    if (response.status() >= 400) {
      failedResources.push(`${response.status()} ${response.url()}`);
    }
  });
});

// ========== 1. SVG icons load without 404 ==========
test('all SVG icons load without 404', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/quran-text.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const svg404s = failedResources.filter(e =>
    e.includes('/img/SVG/') && (e.includes('404') || e.includes('Failed'))
  );

  expect(svg404s, `SVG icons with 404 errors:\n${svg404s.join('\n')}`).toEqual([]);
});

// ========== 2. No emoji remain in page HTML content ==========
for (const file of pageFiles) {
  test(`${file} has no raw emoji in HTML`, async ({ page }) => {
    await page.goto(`${BASE_URL}/pages/${file}`, { waitUntil: 'domcontentloaded', timeout: 15000 });

    const emojiFound = await page.evaluate(() => {
      const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
      const body = document.body.innerText;
      const matches = body.match(emojiRegex);
      return matches || [];
    });

    expect(emojiFound, `${file} still contains raw emoji: ${emojiFound.join(', ')}`).toEqual([]);
  });
}

// ========== 3. SVG img tags load successfully ==========
test('SVG icon img tags render without broken images', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/quran-text.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const brokenImages = await page.evaluate(() => {
    const imgs = document.querySelectorAll('img[src*="img/SVG/"]');
    const broken = [];
    imgs.forEach(img => {
      if (!img.complete || img.naturalWidth === 0) {
        broken.push(img.src);
      }
    });
    return broken;
  });

  expect(brokenImages, `Broken SVG images:\n${brokenImages.join('\n')}`).toEqual([]);
});

// ========== 4. SVG icons have correct dimensions ==========
test('SVG icons are properly sized (not zero-size)', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/quran-text.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const zeroSizeIcons = await page.evaluate(() => {
    const imgs = document.querySelectorAll('img[src*="img/SVG/"]');
    const zeroSize = [];
    imgs.forEach(img => {
      const rect = img.getBoundingClientRect();
      const style = window.getComputedStyle(img);
      // Check if element or any ancestor is hidden
      let el = img;
      let isHidden = false;
      while (el && el !== document.body) {
        const s = window.getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') {
          isHidden = true;
          break;
        }
        el = el.parentElement;
      }
      // Also check if the icon itself has CSS width/height of 0 or if it's inside a modal overlay
      const inModal = img.closest('.modal-overlay') || img.closest('[id*="Modal"]');
      const modalHidden = inModal && inModal.style.display === 'none';
      if ((rect.width === 0 || rect.height === 0) && !isHidden && !modalHidden) {
        zeroSize.push({ src: img.src.split('/').pop(), width: rect.width, height: rect.height });
      }
    });
    return zeroSize;
  });

  expect(zeroSizeIcons, `Zero-size SVG icons:\n${JSON.stringify(zeroSizeIcons, null, 2)}`).toEqual([]);
});

// ========== 5. All referenced SVG files exist ==========
test('all referenced SVG icons exist on disk', async () => {
  const htmlContent = [];
  for (const file of pageFiles) {
    const content = fs.readFileSync(path.join(PAGES_DIR, file), 'utf8');
    htmlContent.push(content);
  }

  const allHtml = htmlContent.join('\n');
  const svgRefs = allHtml.match(/img\/SVG\/([\w-]+)\.svg/g) || [];
  const uniqueSvgs = [...new Set(svgRefs)];

  for (const ref of uniqueSvgs) {
    const filePath = path.join(__dirname, '..', ref);
    expect(fs.existsSync(filePath), `${ref} is referenced in HTML but does not exist`).toBe(true);
  }
});

// ========== 6. Pages with most SVG icons load correctly ==========
const highSvgPages = [
  'quran-text.html',
  'azkar.html',
  'sleeping.html',
  'hadith-viewer.html',
  'notifications.html',
];

for (const file of highSvgPages) {
  test(`${file} (high SVG count) loads with no resource errors`, async ({ page }) => {
    await page.goto(`${BASE_URL}/pages/${file}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    const svgCount = await page.evaluate(() => {
      return document.querySelectorAll('img[src*="img/SVG/"], svg.action-icon, svg.setting-icon, svg.close-icon, svg.option-icon').length;
    });

    const resourceErrors = failedResources.filter(e =>
      !e.includes('googleapis.com') &&
      !e.includes('favicon') &&
      !e.includes('mushaf') &&
      !e.includes('/json/audio-') &&
      !e.includes('Failed to load resource') &&
      !e.includes('alquran.cloud') &&
      !e.includes('quran.com')
    );

    expect(svgCount, `${file} should have SVG icons`).toBeGreaterThan(0);
    expect(resourceErrors, `${file} has resource errors:\n${resourceErrors.join('\n')}`).toEqual([]);
  });
}

// ========== 7. CSS classes are applied ==========
test('icon CSS classes are defined', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/quran-text.html`, { waitUntil: 'domcontentloaded' });

  const classesExist = await page.evaluate(() => {
    const styleSheets = document.styleSheets;
    const classes = ['action-icon', 'setting-icon', 'close-icon', 'option-icon'];
    const found = {};

    for (const cls of classes) {
      found[cls] = false;
      for (let i = 0; i < styleSheets.length; i++) {
        try {
          const rules = styleSheets[i].cssRules;
          for (let j = 0; j < rules.length; j++) {
            if (rules[j].selectorText && rules[j].selectorText.includes(cls)) {
              found[cls] = true;
              break;
            }
          }
        } catch (e) {
          // cross-origin stylesheet
        }
        if (found[cls]) break;
      }
    }
    return found;
  });

  for (const [cls, exists] of Object.entries(classesExist)) {
    expect(exists, `CSS class .${cls} should be defined`).toBe(true);
  }
});

// ========== 8. SW v42 has SVG precache entries ==========
test('sw.js v42 includes SVG icon precache entries', async ({ page }) => {
  const response = await page.goto(`${BASE_URL}/sw.js`, { waitUntil: 'domcontentloaded' });
  expect(response.status()).toBe(200);
  const swText = await page.evaluate(() => document.body.textContent);

  expect(swText).toContain('zad-muslim-v55');
  expect(swText).toContain('./img/SVG/close.svg');
  expect(swText).toContain('./img/SVG/search.svg');
  expect(swText).toContain('./img/SVG/book.svg');
  expect(swText).toContain('./img/SVG/volume.svg');
  expect(swText).toContain('./img/SVG/settings.svg');
});

// ========== 9. Visual smoke test on key pages ==========
const SVG_ICON_SELECTOR = 'img[src*="img/SVG/"], svg.action-icon, svg.setting-icon, svg.close-icon, svg.option-icon';

async function countVisibleSvgs(page) {
  return await page.evaluate((sel) => {
    const icons = document.querySelectorAll(sel);
    let visibleCount = 0;
    icons.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) visibleCount++;
    });
    return visibleCount;
  }, SVG_ICON_SELECTOR);
}

test('quran-text.html renders with SVG icons visible', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/quran-text.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: 'tests/screenshots/quran-text-svg.png', fullPage: false });

  const svgVisible = await countVisibleSvgs(page);

  expect(svgVisible, 'Should have visible SVG icons').toBeGreaterThan(0);
});

test('azkar.html renders with SVG icons visible', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/azkar.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: 'tests/screenshots/azkar-svg.png', fullPage: false });

  const svgVisible = await countVisibleSvgs(page);

  expect(svgVisible, 'Should have visible SVG icons').toBeGreaterThan(0);
});

test('sleeping.html renders with SVG icons visible', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/sleeping.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: 'tests/screenshots/sleeping-svg.png', fullPage: false });

  const svgVisible = await countVisibleSvgs(page);

  expect(svgVisible, 'Should have visible SVG icons').toBeGreaterThan(0);
});
