// Home: the prayer times card is a framed picture (images/prayer-frame-*.webp,
// 1200 × 630) drawn as a border image in three bands. Its content must sit in
// the picture's zones at every width: the header between the minarets, below
// the frame's top edge and above the horizon; the prayer times on the water,
// inside the frame. Positions are in % of the card's width (the picture scales
// with it).
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8080';
const FRAME = { dark: 'dark', 'plain-dark': 'dark', light: 'light', sepia: 'sepia' };

async function open(page, theme) {
  await page.addInitScript(t => {
    try {
      localStorage.setItem('themeMode', t); localStorage.setItem('zad_lang', 'ar');
      localStorage.setItem('prayer_lat', '30.0444'); localStorage.setItem('prayer_lng', '31.2357'); localStorage.setItem('prayer_city', 'Cairo');
    } catch (e) {}
  }, theme);
  await page.route(u => !u.href.startsWith(BASE_URL), route => route.abort());
  await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
  await expect(page.locator('#homePrayerChips > *')).toHaveCount(6);
  return page.evaluate(() => {
    const card = document.getElementById('prayerWidget'), c = card.getBoundingClientRect(), W = c.width;
    const box = sel => {
      const r = document.querySelector(sel).getBoundingClientRect();
      return { x0: (r.left - c.left) / W * 100, x1: (r.right - c.left) / W * 100, y0: (r.top - c.top) / W * 100, y1: (r.bottom - c.top) / W * 100 };
    };
    const t = document.querySelector('.prayer-timer').getBoundingClientRect(), m = document.querySelector('.prayer-meta').getBoundingClientRect();
    const cut = [...document.querySelectorAll('.prayer-hijri, .prayer-city, .prayer-timer')].some(e => e.scrollWidth > e.clientWidth + 1);
    return {
      frame: getComputedStyle(card).borderImageSource, height: c.height / W * 100,
      timer: box('.prayer-timer'), meta: box('.prayer-meta'), label: box('.prayer-next-label'), chips: box('#homePrayerChips'),
      overlap: t.right > m.left && m.right > t.left, cut,
    };
  });
}

test.describe('prayer card on its framed picture', () => {
  test.use({ serviceWorkers: 'block', isMobile: true, hasTouch: true });

  for (const width of [320, 390, 430]) {
    for (const theme of Object.keys(FRAME)) {
      test(`${width}px, ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const s = await open(page, theme);
        expect(s.frame).toContain(`prayer-frame-${FRAME[theme]}.webp`);
        expect(s.height).toBeGreaterThanOrEqual(52.4);            // never shorter than the picture (no squashing)
        for (const k of ['timer', 'meta', 'label']) {              // between the minarets, under the top edge, over the horizon
          expect(s[k].x0, k).toBeGreaterThanOrEqual(9.3);
          expect(s[k].x1, k).toBeLessThanOrEqual(90.7);
          expect(s[k].y0, k).toBeGreaterThanOrEqual(13.3);
          expect(s[k].y1, k).toBeLessThanOrEqual(30.5);
        }
        expect(s.chips.y0).toBeGreaterThanOrEqual(32);             // on the water
        expect(s.chips.y1).toBeLessThanOrEqual(s.height - 1.3);    // above the bottom of the frame
        expect(s.chips.x0).toBeGreaterThanOrEqual(1.5);            // inside the gold sides
        expect(s.chips.x1).toBeLessThanOrEqual(98.5);
        expect(s.overlap).toBe(false);
        expect(s.cut).toBe(false);
      });
    }
  }
});
