// Home page: the saved theme, the reading direction and the prayer card's arch
// are in place from the first paint. The theme used to be applied in the load
// event (after every image and the language file), so the page showed the dark
// default first and then switched; the arch waited for the scripts at the end
// of the page, so the card showed as a plain rectangle first.
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8080';
const BG = {   // --bg-base of each theme
  light: 'rgb(248, 250, 252)', dark: 'rgb(15, 23, 42)', sepia: 'rgb(239, 227, 204)', 'plain-dark': 'rgb(0, 0, 0)',
};

// Open the home page and stop it mid-load: the first script after the page's
// content is held back, so everything above it is parsed and painted but the
// load event can't fire — the moment the flash used to show.
async function openMidLoad(page, { theme, lang } = {}) {
  await page.addInitScript(([t, l]) => {
    try {
      if (t) localStorage.setItem('themeMode', t);
      localStorage.setItem('zad_lang', l || 'ar');   // a language is set: no first-run picker
    } catch (e) {}
  }, [theme, lang]);
  await page.route('**/data/cities.js', async route => { await new Promise(r => setTimeout(r, 2500)); await route.continue(); });
  await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'commit' });
  await page.waitForSelector('.bottom-nav', { state: 'attached' });
  return page.evaluate(() => ({
    loaded: document.readyState === 'complete',
    theme: document.documentElement.getAttribute('data-theme'),
    bg: getComputedStyle(document.body).backgroundColor,
    dir: document.documentElement.dir,
    lang: document.documentElement.lang,
    arch: (() => {
      const w = document.getElementById('prayerWidget'), d = document.getElementById('pwOutline').getAttribute('d') || '';
      return { clip: w.style.clipPath.startsWith('path('), outline: d.length > 50 };
    })(),
  }));
}

test.describe('home page first paint', () => {
  test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });

  for (const [saved, expected] of [['light', 'light'], ['sepia', 'sepia'], ['plain-dark', 'plain-dark'], ['dark', 'dark'], ['warm', 'sepia']]) {
    test(`saved "${saved}": shown as ${expected} before the page has finished loading`, async ({ page }) => {
      const s = await openMidLoad(page, { theme: saved });
      expect(s.loaded).toBe(false);
      expect(s.theme).toBe(expected);
      expect(s.bg).toBe(BG[expected]);
    });
  }

  for (const scheme of ['light', 'dark']) {
    test(`nothing saved, system ${scheme}: ${scheme} from the start`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      const s = await openMidLoad(page);
      expect(s.loaded).toBe(false);
      expect(s.theme).toBe(scheme);
      expect(s.bg).toBe(BG[scheme]);
    });
  }

  test('English: left-to-right from the start (no right-to-left layout first)', async ({ page }) => {
    const s = await openMidLoad(page, { theme: 'light', lang: 'en' });
    expect(s.loaded).toBe(false);
    expect(s.dir).toBe('ltr');
    expect(s.lang).toBe('en');
  });

  test('the prayer card has its arch (clip and outline) before the page has finished loading', async ({ page }) => {
    const s = await openMidLoad(page, { theme: 'light' });
    expect(s.loaded).toBe(false);
    expect(s.arch).toEqual({ clip: true, outline: true });
  });

  test('after loading, the theme buttons show the saved theme', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('themeMode', 'sepia'); localStorage.setItem('zad_lang', 'ar'); } catch (e) {} });
    await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
    await expect(page.locator('#t-sepia')).toHaveClass(/active/);
    await expect(page.locator('#t-dark')).not.toHaveClass(/active/);
    expect(await page.evaluate(() => localStorage.getItem('themeMode'))).toBe('sepia');
  });
});
