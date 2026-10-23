// Captures genuine Zad Al-Muslim screens from the app source in this repo.
// Serves the repo root locally, opens each page in a phone-sized Chromium
// viewport and saves a PNG to promo/assets/screens/. Nothing in the app is
// modified; only localStorage preferences (language, theme) are pre-set,
// exactly as a user would choose them in Settings.
//
//   node scripts/capture-screens.cjs [--only id1,id2]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(__dirname, '..', 'assets', 'screens');
const PORT = 8095;
const VIEW = { width: 412, height: 892 }; // ~19.5:9 phone, matches the mockup screen
const DPR = 3;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon',
};

// Each shot: page URL, language, theme, optional in-page prep and settle time.
const SHOTS = [
  { id: 'home-en', url: '/index.html', lang: 'en' },
  { id: 'home-ar', url: '/index.html', lang: 'ar' },
  { id: 'home-tr', url: '/index.html', lang: 'tr' },
  { id: 'home-ur', url: '/index.html', lang: 'ur' },
  { id: 'home-ckb', url: '/index.html', lang: 'ckb' },
  { id: 'quran-p1', url: '/pages/quran.html', lang: 'en', ls: { lastPage: '1' }, wait: 3500 },
  { id: 'quran-p2', url: '/pages/quran.html', lang: 'en', ls: { lastPage: '2' }, wait: 3500 },
  { id: 'audio', url: '/pages/audio.html', lang: 'en', wait: 3000 },
  { id: 'azkar', url: '/pages/azkar.html', lang: 'en', wait: 2500 },
  { id: 'hisn', url: '/pages/hisn.html', lang: 'en' },
  // Real taps on the counter: a short sequence of genuine states (30→33).
  ...[30, 31, 32, 33].map(n => ({
    id: `masbaha-${n}`, url: '/pages/masbaha.html', lang: 'en',
    act: async page => {
      for (let i = 0; i < n; i++) { await page.click('.progress-wrapper'); await page.waitForTimeout(40); }
      await page.waitForTimeout(900);
    },
  })),
  { id: 'hadith', url: '/pages/hadith.html', lang: 'en', wait: 3000 },
  // Device placed in London so the distance / bearing are meaningful. Headless
  // Chromium has no magnetometer, so the compass sensor is emulated (as Chrome
  // DevTools' Sensors panel does): the phone lies flat, facing the Qibla.
  { id: 'qibla-compass', url: '/pages/qibla.html', lang: 'en', tz: 'Europe/London', geo: { latitude: 51.5074, longitude: -0.1278 },
    act: async page => {
      await page.click('#start-btn');
      for (let i = 0; i < 30; i++) {
        await page.evaluate(() => window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute',
          { alpha: 360 - 119, beta: 0, gamma: 0, absolute: true })));
        await page.waitForTimeout(100);
      }
      await page.waitForTimeout(1500);
    } },
  { id: 'radio', url: '/pages/radio.html', lang: 'en', wait: 3000 },
  { id: 'takrar', url: '/pages/takrar.html', lang: 'en' },
  { id: 'sleeping', url: '/pages/sleeping.html', lang: 'en' },
];

// Arabic-UI twins of every feature screen (used by the Arabic cut: ?lang=ar).
SHOTS.push(...SHOTS
  .filter(s => s.lang === 'en' && !s.id.startsWith('home') && !s.id.startsWith('quran') && s.id !== 'qibla-compass')
  .map(s => ({ ...s, id: `${s.id}-ar`, lang: 'ar' })));
// In Arabic the running compass is shifted by an app layout bug (#qibla-marker
// overflows the right edge → RTL page offset), so the Arabic cut uses the
// Qibla start screen instead.
SHOTS.push({ id: 'qibla-ar', url: '/pages/qibla.html', lang: 'ar' });

function serve() {
  return http.createServer((req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
    const file = path.join(ROOT, p === '/' ? 'index.html' : p);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('404'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  }).listen(PORT);
}

(async () => {
  const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
  fs.mkdirSync(OUT, { recursive: true });
  const server = serve();
  const browser = await chromium.launch();
  for (const s of SHOTS) {
    if (only.length && !only.includes(s.id)) continue;
    const ctx = await browser.newContext({
      viewport: VIEW, deviceScaleFactor: DPR, isMobile: true, hasTouch: true,
      colorScheme: 'dark', locale: s.lang === 'ar' ? 'ar' : 'en-US',
      serviceWorkers: 'block', timezoneId: s.tz || 'Asia/Riyadh',
      // Fixed position (Makkah region) so prayer/qibla screens are deterministic.
      geolocation: s.geo || { latitude: 21.42, longitude: 39.83 }, permissions: ['geolocation'],
    });
    await ctx.addInitScript(([lang, theme, extra]) => {
      try {
        if (!sessionStorage.getItem('__promo_init')) {
          localStorage.setItem('zad_lang', lang);
          localStorage.setItem('themeMode', theme);
          // State of a returning user: first-run hints and the offline-download
          // prompt already dismissed, prayer location set (Makkah).
          ['quranV3DlDone', 'hisnTocHintShown', 'duaaTocHintShown', 'takrarWelcomeSeen',
           'zoom_hint_dismissed', 'tpv2_marker_hint', 'hisnTocOpened', 'duaaTocOpened']
            .forEach(k => localStorage.setItem(k, '1'));
          localStorage.setItem('prayer_lat', '21.42');
          localStorage.setItem('prayer_lng', '39.83');
          localStorage.setItem('current_location_name', 'Makkah');
          Object.entries(extra || {}).forEach(([k, v]) => localStorage.setItem(k, v));
          sessionStorage.setItem('__promo_init', '1');
        }
      } catch (e) {}
    }, [s.lang, s.theme || 'dark', s.ls]);
    const page = await ctx.newPage();
    try {
      await page.goto(`http://127.0.0.1:${PORT}${s.url}`, { waitUntil: 'networkidle', timeout: 30000 });
    } catch (e) { console.warn(`  ${s.id}: networkidle timeout, continuing`); }
    await page.waitForTimeout(s.wait || 2000);
    // Close first-run sheets / install prompts that a returning user would not see.
    await page.evaluate(() => {
      document.querySelectorAll('#i18nLangSheetWrap, .pwa-install-banner, #pwaInstallBanner, .toast').forEach(el => el.remove());
    });
    if (s.act) await s.act(page);
    await page.waitForTimeout(300);
    const file = path.join(OUT, `${s.id}.png`);
    await page.screenshot({ path: file });
    console.log('captured', s.id);
    await ctx.close();
  }
  await browser.close();
  server.close();
})();
