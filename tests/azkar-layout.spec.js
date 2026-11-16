// Adhkar page layout on phones with real safe areas (status bar / notch on top,
// gesture bar / home indicator below). The test browser fakes them through CDP.
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8080';

async function openWithInsets(page, context, { lang = 'ar', top = 59, bottom = 34 } = {}) {
  const cdp = await context.newCDPSession(page);
  try {
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top, bottom, left: 0, right: 0 } });
  } catch (e) {
    test.skip(true, 'this browser cannot emulate safe areas');
  }
  await page.addInitScript(l => { try { localStorage.setItem('zad_lang', l); localStorage.setItem('themeMode', 'light'); } catch (e) {} }, lang);
  await page.goto(`${BASE_URL}/pages/azkar.html?type=morning`, { waitUntil: 'load' });
  await page.waitForTimeout(800);
}
const box = (page, sel) => page.locator(sel).first().boundingBox();

test.describe('adhkar layout', () => {
  test.use({ serviceWorkers: 'block', viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });

  test('the top buttons sit below the status bar, the ring above the bottom buttons', async ({ page, context }) => {
    await openWithInsets(page, context, { top: 59, bottom: 34 });
    const [btn, ring, controls] = await Promise.all([box(page, '.top-bar .icon-btn'), box(page, '.counter-anchor'), box(page, '.controls')]);
    expect(btn.y).toBeGreaterThanOrEqual(59);
    expect(ring.y + ring.height).toBeLessThanOrEqual(controls.y);
  });

  test('with the audio player open the ring still clears the buttons', async ({ page, context }) => {
    await openWithInsets(page, context, { top: 32, bottom: 24 });
    await page.evaluate(() => showMiniPlayer());
    await page.waitForTimeout(600);
    await page.evaluate(() => { const w = document.querySelector('.page-wrapper'); w.scrollTop = w.scrollHeight; });
    const [ring, controls] = await Promise.all([box(page, '.counter-anchor'), box(page, '.controls')]);
    expect(ring.y + ring.height).toBeLessThanOrEqual(controls.y);
  });

  test('the dhikr text starts below the A- / A+ buttons', async ({ page, context }) => {
    await openWithInsets(page, context);
    const [zoom, area] = await Promise.all([box(page, '.zoom-btns'), box(page, '.zikr-scroll-area')]);
    expect(area.y).toBeGreaterThanOrEqual(zoom.y + zoom.height);
  });

  test('in English, Previous is on the left and Next on the right', async ({ page, context }) => {
    await openWithInsets(page, context, { lang: 'en' });
    const [prev, next] = await Promise.all([box(page, '#prevBtn'), box(page, '#nextBtn')]);
    expect(prev.x).toBeLessThan(next.x);
  });
});
