const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8080';

test('dark mode SVG icons get brightness(0) invert(1) filter', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/azkar.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.body.setAttribute('data-theme', 'dark'));
  await page.waitForTimeout(1000);

  const result = await page.evaluate(() => {
    const imgs = document.querySelectorAll('img[src*="img/SVG/"]');
    const samples = [];
    imgs.forEach((img, i) => {
      if (i < 5) {
        const style = window.getComputedStyle(img);
        samples.push({
          src: img.src.split('/').pop(),
          filter: style.filter,
          parentColor: window.getComputedStyle(img.parentElement).color,
        });
      }
    });
    return samples;
  });

  console.log('Dark mode icons:', JSON.stringify(result, null, 2));
  
  for (const icon of result) {
    expect(icon.filter, `${icon.src} should have invert filter in dark mode`).toContain('invert');
  }
});

test('light mode SVG icons get brightness(0) filter', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/azkar.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.body.setAttribute('data-theme', 'light'));
  await page.waitForTimeout(1000);

  const result = await page.evaluate(() => {
    const imgs = document.querySelectorAll('img[src*="img/SVG/"]');
    const samples = [];
    imgs.forEach((img, i) => {
      if (i < 5) {
        const style = window.getComputedStyle(img);
        samples.push({
          src: img.src.split('/').pop(),
          filter: style.filter,
          parentColor: window.getComputedStyle(img.parentElement).color,
        });
      }
    });
    return samples;
  });

  console.log('Light mode icons:', JSON.stringify(result, null, 2));
  
  for (const icon of result) {
    expect(icon.filter, `${icon.src} should have brightness(0) filter in light mode`).toContain('brightness(0)');
    expect(icon.filter, `${icon.src} should NOT have invert in light mode`).not.toContain('invert');
  }
});

test('quran-text dark mode SVG icons are white', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/quran-text.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.body.setAttribute('data-theme', 'dark'));
  await page.waitForTimeout(1500);

  const result = await page.evaluate(() => {
    const imgs = document.querySelectorAll('img[src*="img/SVG/"]');
    const samples = [];
    imgs.forEach((img, i) => {
      if (i < 10) {
        const style = window.getComputedStyle(img);
        const hasColoredParent = img.closest('[style*="color:#ef4444"]') || 
                                 img.closest('[style*="color:rgb(239"]') ||
                                 img.closest('.icon-btn[style*="color"]');
        samples.push({
          src: img.src.split('/').pop(),
          filter: style.filter,
          visible: img.getBoundingClientRect().width > 0,
          hasColoredParent: !!hasColoredParent,
        });
      }
    });
    return samples;
  });

  console.log('Quran text dark mode:', JSON.stringify(result, null, 2));
  
  for (const icon of result) {
    if (icon.visible && !icon.hasColoredParent) {
      expect(icon.filter, `${icon.src} should have invert filter`).toContain('invert');
    }
  }
});
