// The pages that applied their theme in the load event showed their default
// theme (and right-to-left) first, then switched. Each now sets it in <head>
// with its own rule. Checked here: the theme shown while the page is painted
// but still loading is the one it ends up with after loading — no switch.
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8080';
const PAGES = ['azkar.html', 'radio.html', 'audio.html', 'audio-download.html', 'audio2.html', 'audio3.html',
  'about.html', 'howto.html', 'privacy.html'];

// Open a page with a script held back at the end of <body> (and the language
// file): everything above it is parsed and painted, but the load event can't
// fire until they arrive.
async function midLoadThenLoaded(page, file, { theme, lang = 'ar' }) {
  await page.addInitScript(([t, l]) => {
    try { if (t) localStorage.setItem('themeMode', t); localStorage.setItem('zad_lang', l); } catch (e) {}
  }, [theme, lang]);
  await page.route(url => !url.href.startsWith(BASE_URL), route => route.abort());
  let release;
  const held = new Promise(r => { release = r; });
  await page.route('**/__hold.js', async route => { await held; await route.fulfill({ body: '', contentType: 'text/javascript' }); });
  // the language file too: I18n sets dir once it arrives, which on some pages is before load
  await page.route('**/js/i18n/*.js', async route => { await held; await route.continue(); });
  await page.route(`**/pages/${file}`, async route => {
    const res = await route.fetch();
    const html = (await res.text()).replace(/<\/body>/i, '<script src="/__hold.js"></script></body>');
    await route.fulfill({ response: res, body: html });
  });
  await page.goto(`${BASE_URL}/pages/${file}`, { waitUntil: 'commit' });
  await page.waitForFunction(() => document.body && document.body.children.length > 2);
  const read = () => page.evaluate(() => ({
    loaded: document.readyState === 'complete',
    theme: document.documentElement.getAttribute('data-theme'),
    dir: document.documentElement.dir,
  }));
  const mid = await read();
  release();
  await page.waitForFunction(() => document.readyState === 'complete');
  await page.waitForTimeout(150);
  return { mid, end: await read() };
}

test.describe('first paint in the theme the page ends up with', () => {
  test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });

  for (const file of PAGES) {
    for (const theme of ['light', 'sepia', 'dark', null]) {
      test(`${file}, saved ${theme || 'nothing'}`, async ({ page }) => {
        const { mid, end } = await midLoadThenLoaded(page, file, { theme });
        expect(mid.loaded).toBe(false);
        expect(mid.theme).not.toBeNull();
        expect(mid.theme).toBe(end.theme);
      });
    }
    test(`${file}, English: left-to-right from the start`, async ({ page }) => {
      const { mid, end } = await midLoadThenLoaded(page, file, { theme: 'light', lang: 'en' });
      expect(mid.loaded).toBe(false);
      expect(mid.dir).toBe('ltr');
      expect(end.dir).toBe('ltr');
    });
  }
});
