// Audio and radio players on wide, short landscape screens: car head units
// (800×480 to 1920×720) and phones held sideways. One screen with no
// scrolling; the player in two columns with a line between — the title and
// the controls on the reading side, the art beside them — the pickers in
// view, big tap targets; phones in portrait keep their layout.
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8080';
const CAR = [[800, 480], [1024, 600], [1280, 720], [1920, 720]];
const SIDEWAYS = [[844, 390], [740, 360]];

async function open(page, file, { width, height, lang = 'ar' }) {
  await page.setViewportSize({ width, height });
  await page.addInitScript(l => { try { localStorage.setItem('themeMode', 'dark'); localStorage.setItem('zad_lang', l); } catch (e) {} }, lang);
  await page.route(u => !u.href.startsWith(BASE_URL), route => route.abort());
  await page.goto(`${BASE_URL}/pages/${file}`, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  return page.evaluate(() => {
    const box = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
    const de = document.documentElement;
    return {
      overflow: Math.max(de.scrollHeight, document.body.scrollHeight) - innerHeight, vh: innerHeight,
      now: box('.hero-now'), controls: box('.hero-controls'), pickers: box('.sel-row') || box('.app > .sel-card'),
      play: box('.play-pause-btn'), skip: box('.skip-btn'), action: box('.controls-secondary .action-btn'),
      title: box('#nowSurah') || box('#nowStation'),
      divider: getComputedStyle(document.querySelector('.hero-now')).borderInlineStartStyle,
      sideDisplay: getComputedStyle(document.querySelector('.hero-side')).display,
      mini: !!document.querySelector('.mini.show'),
    };
  });
}

test.describe('players on landscape screens', () => {
  test.use({ serviceWorkers: 'block', hasTouch: true });

  for (const file of ['audio.html', 'radio.html']) {
    for (const [width, height] of [...CAR, ...SIDEWAYS]) {
      const car = height >= 480;
      test(`${file} ${width}×${height}: one screen, two columns, big targets`, async ({ page }) => {
        const s = await open(page, file, { width, height });
        expect(s.overflow, 'no scrolling').toBeLessThanOrEqual(1);
        expect(s.sideDisplay).toBe('flex');
        // side by side, the controls on the reading side (right in Arabic), a line between
        expect(s.controls.l).toBeGreaterThanOrEqual(s.now.r - 1);
        expect(s.divider).toBe('solid');
        // the title at the top of the controls
        expect(s.title.l).toBeGreaterThanOrEqual(s.controls.l - 1);
        expect(s.title.r).toBeLessThanOrEqual(s.controls.r + 1);
        expect(Math.abs((s.now.t + s.now.b) / 2 - (s.controls.t + s.controls.b) / 2)).toBeLessThan(s.vh * 0.25);
        expect(s.pickers.b).toBeLessThanOrEqual(s.vh);
        expect(s.play.w).toBeGreaterThanOrEqual(car ? 72 : 60);    // phones sideways: still well over 44 px
        expect(s.skip.w).toBeGreaterThanOrEqual(car ? 56 : 46);
        expect(Math.min(s.action.w, s.action.h)).toBeGreaterThanOrEqual(car ? 46 : 44);
        expect(s.mini).toBe(false);
      });
    }

    test(`${file} on a phone in portrait keeps one column`, async ({ page }) => {
      const s = await open(page, file, { width: 390, height: 844 });
      expect(s.sideDisplay).toBe('contents');
      expect(s.play.w).toBeLessThan(80);
    });
  }

  test('English: the columns mirror (controls on the left, art on the right)', async ({ page }) => {
    const s = await open(page, 'audio.html', { width: 1024, height: 600, lang: 'en' });
    expect(s.now.l).toBeGreaterThanOrEqual(s.controls.r - 1);
    expect(s.overflow).toBeLessThanOrEqual(1);
  });

  test('audio: the reciter under the art follows the reciter shown, and stays out of portrait', async ({ page }) => {
    await open(page, 'audio.html', { width: 1280, height: 720 });
    await page.evaluate(() => { document.getElementById('nowReciter').innerText = 'محمد صديق المنشاوي (مجود)'; });
    await expect(page.locator('.art-caption')).toHaveText('محمد صديق المنشاوي (مجود)');
    await expect(page.locator('.art-caption')).toHaveAttribute('aria-hidden', 'true');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.art-caption')).toBeHidden();
  });

  test('audio: a recitation that can\'t load shows its message in place of the progress bar', async ({ page }) => {
    await open(page, 'audio.html', { width: 800, height: 480 });
    await page.evaluate(() => { document.getElementById('trackError').hidden = false; });
    await expect(page.locator('.progress-section')).toBeHidden();
    await page.evaluate(() => { document.getElementById('trackError').hidden = true; });
    await expect(page.locator('.progress-section')).toBeVisible();
  });

  test('radio: a long station name wraps in full instead of scrolling, also after turning the phone', async ({ page }) => {
    await open(page, 'radio.html', { width: 390, height: 844 });
    await page.setViewportSize({ width: 800, height: 480 });
    await page.waitForTimeout(300);
    const t = await page.evaluate(() => {
      const e = document.getElementById('nowStation');
      return { ticker: e.classList.contains('ticker-active'), full: e.textContent === e.dataset.text, lines: Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)) };
    });
    expect(t.ticker).toBe(false);
    expect(t.full).toBe(true);
    expect(t.lines).toBeLessThanOrEqual(2);
  });

  test('radio: the station list opens as a centred panel on a wide screen', async ({ page }) => {
    await open(page, 'radio.html', { width: 1280, height: 720 });
    await page.evaluate(() => openStationSheet());
    await page.waitForTimeout(600);
    const r = await page.locator('#stationSheet').boundingBox();
    expect(r.width).toBeLessThanOrEqual(760);
    expect(Math.abs(r.x + r.width / 2 - 640)).toBeLessThan(2);
  });
});
