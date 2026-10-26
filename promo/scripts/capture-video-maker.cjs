// Captures the real Ayah Video Maker (pages/video-maker.html) for the
// status/story promo: genuine Arabic editor screens, the popular-ayat sheet,
// and a clip exported by the app itself (its own canvas + MediaRecorder,
// recitation fetched from everyayah.com as in the app).
//
//   node scripts/capture-video-maker.cjs
// → assets/screens/vm-*.png, assets/video-maker/clip.mp4
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = path.resolve(__dirname, '..', 'assets', 'screens');
const CLIPS = path.resolve(__dirname, '..', 'assets', 'video-maker');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ttf': 'font/ttf',
  '.otf': 'font/otf', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };

// The clip: Ash-Sharh 94:5–6, Mishary Alafasy (app default), picture 3 with motion, story 9:16.
const SETTINGS = {
  surah: 94, from: 5, to: 6, reciter: 'afasy', bg: 'i:3.webp', format: 'story', motion: true,
  multiBg: false, bgs: [], fontMul: 1, color: '#ffffff', caption: true, branding: true, textPanel: true, basmala: true,
};

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  fs.mkdirSync(CLIPS, { recursive: true });
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' }); res.end(d); });
  }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 892 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    colorScheme: 'dark', locale: 'ar', timezoneId: 'Asia/Riyadh', serviceWorkers: 'block',
  });
  await ctx.addInitScript(s => {
    if (sessionStorage.getItem('__promo_init')) return;
    localStorage.setItem('zad_lang', 'ar');
    localStorage.setItem('themeMode', 'dark');
    localStorage.setItem('vm_settings', s);
    sessionStorage.setItem('__promo_init', '1');
  }, JSON.stringify(SETTINGS));
  const page = await ctx.newPage();
  page.on('pageerror', e => console.error('[page]', e.message));
  await page.goto(`${base}/pages/video-maker.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const shot = async name => { await page.waitForTimeout(700); await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); console.log('captured', name); };

  await shot('vm-editor');
  // each numbered step brought to the top of the screen, as a user scrolls
  const heads = await page.$$('.step-head');
  for (let i = 1; i < heads.length; i++) {
    await heads[i].evaluate(el => {
      const card = el.parentElement;
      window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - 70);
    });
    await shot(`vm-step${i + 1}`);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('#vmPopularBtn');
  await shot('vm-popular');
  await page.click('#vmPopularSheet [data-close-pick]');   // the sheet's own close button
  await page.waitForTimeout(800);

  // export a real clip with the app's own recorder (real time)
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('#vmExport');
  await page.waitForTimeout(1500);
  await shot('vm-recording');
  await page.waitForSelector('#vmResult:not([hidden])', { timeout: 180000 });
  await page.waitForTimeout(1500);
  await shot('vm-result');
  const b64 = await page.evaluate(async () => {
    const buf = await (await fetch(document.getElementById('vmVideo').src)).arrayBuffer();
    let s = ''; const u = new Uint8Array(buf);
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s);
  });
  const type = await page.evaluate(() => document.getElementById('vmDownload').download);
  const out = path.join(CLIPS, 'clip' + path.extname(type));
  fs.writeFileSync(out, Buffer.from(b64, 'base64'));
  console.log('clip →', out, (fs.statSync(out).size / 1e6).toFixed(1), 'MB');
  await browser.close();
  server.close();
})();
