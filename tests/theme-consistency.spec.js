// The theme is shared by every page through localStorage themeMode: light,
// dark, sepia or plain-dark (OLED black, home only); "warm" is the adhkar
// page's old name for sepia. Each page shows the nearest theme it has —
// sepia as light and OLED as dark where it has no such theme — from its first
// frame, and never rewrites the saved choice.
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8080';
const SAVED = ['light', 'dark', 'sepia', 'plain-dark', 'warm'];

const HAS_SEPIA = { light: 'light', dark: 'dark', sepia: 'sepia', 'plain-dark': 'dark', warm: 'sepia' };
const NO_SEPIA = { light: 'light', dark: 'dark', sepia: 'light', 'plain-dark': 'dark', warm: 'light' };
const EXPECTED = {
  'index.html': { light: 'light', dark: 'dark', sepia: 'sepia', 'plain-dark': 'plain-dark', warm: 'sepia' },
  'pages/azkar.html': { light: 'light', dark: 'dark', sepia: 'warm', 'plain-dark': 'dark', warm: 'warm' },
  'pages/audio2.html': NO_SEPIA, 'pages/audio3.html': NO_SEPIA, 'pages/about.html': NO_SEPIA,
  'pages/privacy.html': NO_SEPIA, 'pages/notifications.html': NO_SEPIA,
};
for (const p of ['radio', 'audio', 'audio-download', 'howto', 'masbaha', 'hadith', 'hadith-viewer', 'takrar',
  'video-maker', 'duaa', 'hisn', 'nawawi', 'qudsi', 'thabat']) EXPECTED[`pages/${p}.html`] = HAS_SEPIA;

// Records the page's colours at the first frame that shows content.
function recordFirstFrame() {
  window.__look = () => {
    const h = document.documentElement, b = document.body, cb = getComputedStyle(b);
    return { html: h.getAttribute('data-theme'), body: b.getAttribute('data-theme'),
      colors: [cb.backgroundColor, cb.color, getComputedStyle(h).backgroundColor].join(' | ') };
  };
  const tick = () => {
    if (document.body && document.body.childElementCount > 2) { window.__first = window.__look(); return; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function open(page, url, saved) {
  await page.addInitScript(t => {
    try { localStorage.setItem('themeMode', t); localStorage.setItem('zad_lang', 'ar'); } catch (e) {}
  }, saved);
  await page.addInitScript(recordFirstFrame);
  await page.route(u => !u.href.startsWith(BASE_URL), route => route.abort());
  // scripts arrive a little late, as on a phone: the page paints what it has meanwhile
  await page.route(/\.js(\?|$)/, async route => { await new Promise(r => setTimeout(r, 120)); await route.continue(); });
  await page.goto(`${BASE_URL}/${url}`, { waitUntil: 'load' });
  await page.waitForTimeout(250);
}

test.describe('the same theme on every page', () => {
  test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });

  for (const [url, map] of Object.entries(EXPECTED)) {
    for (const saved of SAVED) {
      test(`${url}, saved ${saved}: shows ${map[saved]} from the first frame`, async ({ page }) => {
        await open(page, url, saved);
        const first = await page.evaluate(() => window.__first);
        const end = await page.evaluate(() => window.__look());
        expect(end.html).toBe(map[saved]);
        if (end.body) expect(end.body).toBe(end.html);
        expect(first, 'a frame with content was recorded').toBeTruthy();
        expect(first.colors).toBe(end.colors);
        expect(await page.evaluate(() => localStorage.getItem('themeMode'))).toBe(saved);
      });
    }
  }

  test('«دافئ» in the adhkar settings is saved as sepia and shown as sepia elsewhere', async ({ page }) => {
    // the starting theme is set once (open() would set it again on every page)
    await page.route(u => !u.href.startsWith(BASE_URL), route => route.abort());
    await page.goto(`${BASE_URL}/pages/azkar.html`, { waitUntil: 'load' });
    await page.evaluate(() => { localStorage.setItem('themeMode', 'dark'); localStorage.setItem('zad_lang', 'ar'); });
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(() => setTheme('warm'));
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('warm');
    expect(await page.evaluate(() => localStorage.getItem('themeMode'))).toBe('sepia');
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('sepia');
    await page.goto(`${BASE_URL}/pages/radio.html`, { waitUntil: 'load' });
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('sepia');
  });

  test('radio follows a change made in another tab without saving its own version of it', async ({ context }) => {
    await context.addInitScript(() => { try { localStorage.setItem('themeMode', 'light'); localStorage.setItem('zad_lang', 'ar'); } catch (e) {} });
    await context.route(u => !u.href.startsWith(BASE_URL), route => route.abort());
    const radio = await context.newPage();
    await radio.goto(`${BASE_URL}/pages/radio.html`, { waitUntil: 'load' });
    const other = await context.newPage();
    await other.goto(`${BASE_URL}/pages/about.html`, { waitUntil: 'load' });
    await other.evaluate(() => localStorage.setItem('themeMode', 'plain-dark'));   // e.g. OLED chosen on home
    await expect.poll(() => radio.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');
    expect(await radio.evaluate(() => localStorage.getItem('themeMode'))).toBe('plain-dark');
  });
});
