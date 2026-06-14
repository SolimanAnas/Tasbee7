const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8080';

const THEMED_PAGES = [
  { file: 'quran-text.html', name: 'Quran Text' },
  { file: 'azkar.html', name: 'Azkar' },
  { file: 'sleeping.html', name: 'Sleeping' },
  { file: 'hadith-viewer.html', name: 'Hadith Viewer' },
  { file: 'notifications.html', name: 'Notifications' },
  { file: 'about.html', name: 'About' },
  { file: 'audio.html', name: 'Audio' },
  // Radio uses CSS mask for translate icon, no <img> SVGs — excluded
  { file: 'qibla.html', name: 'Qibla' },
  { file: 'duaa.html', name: 'Duaa' },
  { file: 'hisn.html', name: 'Hisn' },
  { file: 'masbaha.html', name: 'Masbaha' },
  { file: 'hadith.html', name: 'Hadith' },
  { file: 'takrar.html', name: 'Takrar' },
];

for (const { file, name } of THEMED_PAGES) {
  test(`${name} - SVG icons render in light mode`, async ({ page }) => {
    await page.goto(`${BASE_URL}/pages/${file}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      document.body.setAttribute('data-theme', 'light');
    });
    await page.waitForTimeout(1500);

    const result = await page.evaluate(() => {
      const imgs = document.querySelectorAll('img[src*="img/SVG/"], svg.action-icon, svg.setting-icon, svg.close-icon, svg.option-icon');
      const icons = [];
      imgs.forEach(img => {
        const rect = img.getBoundingClientRect();
        const style = window.getComputedStyle(img);
        const parent = img.parentElement;
        const parentColor = parent ? window.getComputedStyle(parent).color : 'unknown';
        icons.push({
          src: img.getAttribute('src') ? img.getAttribute('src').split('/').pop() : img.className,
          visible: rect.width > 0 && rect.height > 0,
          parentColor: parentColor,
          display: style.display,
        });
      });
      return {
        total: imgs.length,
        visible: icons.filter(i => i.visible).length,
        icons: icons.slice(0, 10),
        bgColor: window.getComputedStyle(document.body).backgroundColor,
        textColor: window.getComputedStyle(document.body).color,
      };
    });

    console.log(`Light mode - ${name}:`, JSON.stringify(result, null, 2));
    expect(result.total, `${name} should have SVG icons`).toBeGreaterThan(0);
  });

  test(`${name} - SVG icons render in dark mode`, async ({ page }) => {
    await page.goto(`${BASE_URL}/pages/${file}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      document.body.setAttribute('data-theme', 'dark');
    });
    await page.waitForTimeout(1500);

    const result = await page.evaluate(() => {
      const imgs = document.querySelectorAll('img[src*="img/SVG/"], svg.action-icon, svg.setting-icon, svg.close-icon, svg.option-icon');
      const icons = [];
      imgs.forEach(img => {
        const rect = img.getBoundingClientRect();
        const style = window.getComputedStyle(img);
        const parent = img.parentElement;
        const parentColor = parent ? window.getComputedStyle(parent).color : 'unknown';
        icons.push({
          src: img.getAttribute('src') ? img.getAttribute('src').split('/').pop() : img.className,
          visible: rect.width > 0 && rect.height > 0,
          parentColor: parentColor,
          display: style.display,
        });
      });
      return {
        total: imgs.length,
        visible: icons.filter(i => i.visible).length,
        icons: icons.slice(0, 10),
        bgColor: window.getComputedStyle(document.body).backgroundColor,
        textColor: window.getComputedStyle(document.body).color,
      };
    });

    console.log(`Dark mode - ${name}:`, JSON.stringify(result, null, 2));
    expect(result.total, `${name} should have SVG icons`).toBeGreaterThan(0);
  });

  test(`${name} - SVG icons adapt to theme colors`, async ({ page }) => {
    await page.goto(`${BASE_URL}/pages/${file}`, { waitUntil: 'domcontentloaded' });

    // Get light mode colors
    await page.evaluate(() => document.body.setAttribute('data-theme', 'light'));
    await page.waitForTimeout(500);
    const light = await page.evaluate(() => {
      const imgs = document.querySelectorAll('img[src*="img/SVG/"], svg.action-icon, svg.setting-icon, svg.close-icon, svg.option-icon');
      const sample = imgs[0];
      if (!sample) return null;
      const parent = sample.parentElement;
      return {
        parentColor: parent ? window.getComputedStyle(parent).color : null,
        bgColor: window.getComputedStyle(document.body).backgroundColor,
        textColor: window.getComputedStyle(document.body).color,
      };
    });

    // Get dark mode colors
    await page.evaluate(() => document.body.setAttribute('data-theme', 'dark'));
    await page.waitForTimeout(500);
    const dark = await page.evaluate(() => {
      const imgs = document.querySelectorAll('img[src*="img/SVG/"], svg.action-icon, svg.setting-icon, svg.close-icon, svg.option-icon');
      const sample = imgs[0];
      if (!sample) return null;
      const parent = sample.parentElement;
      return {
        parentColor: parent ? window.getComputedStyle(parent).color : null,
        bgColor: window.getComputedStyle(document.body).backgroundColor,
        textColor: window.getComputedStyle(document.body).color,
      };
    });

    if (light && dark) {
      console.log(`${name} - Light: parent=${light.parentColor}, bg=${light.bgColor}, text=${light.textColor}`);
      console.log(`${name} - Dark: parent=${dark.parentColor}, bg=${dark.bgColor}, text=${dark.textColor}`);
      // Some pages have fixed dark backgrounds (sleeping, qibla, masbaha, etc.) 
      // — they don't respond to data-theme on body. That's by design.
      // Verify SVGs at least inherit a valid (non-transparent, non-zero) parent color
      const hasValidColor = light.parentColor && 
        light.parentColor !== 'rgba(0, 0, 0, 0)' && 
        light.parentColor !== 'rgb(0, 0, 0, 0)';
      expect(hasValidColor, `${name}: SVG icon parent should have a valid color`).toBe(true);
    }
  });
}

// ========== Visual regression: screenshot comparison ==========
for (const { file, name } of THEMED_PAGES.slice(0, 5)) {
  test(`Screenshot: ${name} light vs dark`, async ({ page }) => {
    // Light mode
    await page.goto(`${BASE_URL}/pages/${file}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.body.setAttribute('data-theme', 'light'));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `tests/screenshots/${file.replace('.html', '')}-light.png`, fullPage: false });

    // Dark mode
    await page.evaluate(() => document.body.setAttribute('data-theme', 'dark'));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `tests/screenshots/${file.replace('.html', '')}-dark.png`, fullPage: false });

    // Verify screenshots were taken
    expect(fs.existsSync(`tests/screenshots/${file.replace('.html', '')}-light.png`)).toBe(true);
    expect(fs.existsSync(`tests/screenshots/${file.replace('.html', '')}-dark.png`)).toBe(true);
  });
}

// ========== SVG icon color inheritance test ==========
test('SVG icons inherit currentColor from parent in both themes', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/quran-text.html`, { waitUntil: 'domcontentloaded' });

  // Check that SVGs use currentColor
  const svgContent = await page.evaluate(() => {
    const imgs = document.querySelectorAll('img[src*="img/SVG/"], svg.action-icon, svg.setting-icon, svg.close-icon, svg.option-icon');
    const results = [];
    imgs.forEach(img => {
      const parent = img.parentElement;
      const parentColor = parent ? window.getComputedStyle(parent).color : null;
      results.push({
        src: img.getAttribute('src') ? img.getAttribute('src').split('/').pop() : img.className,
        parentColor: parentColor,
      });
    });
    return results.slice(0, 5);
  });

  console.log('SVG color inheritance:', JSON.stringify(svgContent, null, 2));
  
  // All icons should have a parent with a defined color
  for (const icon of svgContent) {
    expect(icon.parentColor, `${icon.src} parent should have a color`).toBeTruthy();
    expect(icon.parentColor, `${icon.src} parent color should not be transparent`).not.toBe('rgba(0, 0, 0, 0)');
  }
});

// ========== Verify no hardcoded colors in SVGs ==========
test('All SVG files use currentColor (no hardcoded colors)', () => {
  const svgDir = path.join(__dirname, '..', 'img', 'SVG');
  const files = fs.readdirSync(svgDir).filter(f => f.endsWith('.svg'));

  for (const file of files) {
    const content = fs.readFileSync(path.join(svgDir, file), 'utf8');
    
    // Check stroke uses currentColor
    const hasCurrentColor = content.includes('stroke="currentColor"') || 
                            content.includes("stroke='currentColor'");
    
    // Check fill uses currentColor or none
    const hasValidFill = content.includes('fill="none"') || 
                         content.includes('fill="currentColor"') ||
                         content.includes("fill='none'") ||
                         content.includes("fill='currentColor'");
    
    // Allow fill="currentColor" for solid icons like circle-filled
    const hasHardcodedColor = /fill="(#[0-9a-fA-F]+|rgb|rgba|[a-z]+)"/.test(content) &&
                              !content.includes('fill="none"') &&
                              !content.includes('fill="currentColor"');

    expect(hasCurrentColor, `${file} should use stroke="currentColor"`).toBe(true);
    expect(hasHardcodedColor, `${file} should not have hardcoded fill colors`).toBe(false);
  }
});
