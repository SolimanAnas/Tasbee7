const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8080';

const PAGES = [
  'azkar.html', 'quran-text.html', 'notifications.html',
  'sleeping.html', 'hadith-viewer.html', 'about.html',
  'audio.html', 'qibla.html', 'duaa.html', 'hisn.html',
  'masbaha.html', 'hadith.html', 'takrar.html', 'azkar2.html',
];

for (const file of PAGES) {
  test(`${file}: inline SVGs have no unwanted rotation`, async ({ page }) => {
    await page.goto(`${BASE_URL}/pages/${file}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const result = await page.evaluate(() => {
      const inlineSvgs = document.querySelectorAll('svg.action-icon, svg.setting-icon, svg.close-icon, svg.option-icon');
      const remainingImgs = document.querySelectorAll('img[src*="img/SVG/"]');

      const samples = [];
      inlineSvgs.forEach((svg, i) => {
        if (i < 8) {
          const cs = window.getComputedStyle(svg);
          const rect = svg.getBoundingClientRect();
          samples.push({
            color: cs.color,
            transform: cs.transform,
            display: cs.display,
            w: Math.round(rect.width),
            h: Math.round(rect.height),
          });
        }
      });

      return {
        inlineCount: inlineSvgs.length,
        remainingImgCount: remainingImgs.length,
        samples,
        bodyColor: window.getComputedStyle(document.body).color,
      };
    });

    console.log(`${file}:`, JSON.stringify(result, null, 2));

    // All icon images should be replaced with inline SVGs
    expect(result.inlineCount, `${file}: should have inlined SVGs`).toBeGreaterThan(0);
    expect(result.remainingImgCount, `${file}: no <img> should remain`).toBe(0);

    // No rotation: icon SVGs must not have a matrix transform
    // (progress ring SVGs inside .progress-wrapper are allowed to rotate)
    for (const s of result.samples) {
      expect(
        s.transform,
        `${file}: SVG icon should not be rotated (transform: ${s.transform})`
      ).toBe('none');
      // Icons should have non-zero dimensions
      expect(s.w, `${file}: SVG width should be > 0`).toBeGreaterThan(0);
      expect(s.h, `${file}: SVG height should be > 0`).toBeGreaterThan(0);
    }
  });

  test(`${file}: inline SVGs have correct theme color`, async ({ page }) => {
    await page.goto(`${BASE_URL}/pages/${file}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Dark mode
    await page.evaluate(() => document.body.setAttribute('data-theme', 'dark'));
    await page.waitForTimeout(300);

    const dark = await page.evaluate(() => {
      const svgs = document.querySelectorAll('svg.action-icon, svg.setting-icon, svg.close-icon, svg.option-icon');
      const colors = [];
      svgs.forEach((svg, i) => {
        if (i < 5) colors.push(window.getComputedStyle(svg).color);
      });
      return { colors, bodyColor: window.getComputedStyle(document.body).color };
    });

    // Light mode
    await page.evaluate(() => document.body.setAttribute('data-theme', 'light'));
    await page.waitForTimeout(300);

    const light = await page.evaluate(() => {
      const svgs = document.querySelectorAll('svg.action-icon, svg.setting-icon, svg.close-icon, svg.option-icon');
      const colors = [];
      svgs.forEach((svg, i) => {
        if (i < 5) colors.push(window.getComputedStyle(svg).color);
      });
      return { colors, bodyColor: window.getComputedStyle(document.body).color };
    });

    console.log(`${file} dark:`, JSON.stringify(dark));
    console.log(`${file} light:`, JSON.stringify(light));

    expect(dark.colors.length + light.colors.length, `${file}: should have sampled SVG colors`).toBeGreaterThan(0);

    // SVGs should not be black in dark mode (unless page has fixed dark bg)
    if (dark.bodyColor !== 'rgb(0, 0, 0)') {
      for (const c of dark.colors) {
        expect(c, `${file}: SVG should not be black in dark mode`).not.toBe('rgb(0, 0, 0)');
      }
    }
  });
}
