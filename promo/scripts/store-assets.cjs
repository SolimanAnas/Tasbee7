// Renders the Google Play listing graphics (Arabic) into output/google-play/ar/:
//   phone-01..08.png   1080×1920, 24-bit PNG (no alpha)
//   feature-graphic.png 1024×500, 24-bit PNG (no alpha)
//   app-icon-512.png    512×512, 32-bit PNG (from icons/icon_1024.png)
// Specs: https://support.google.com/googleplay/android-developer/answer/9866151
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const PROMO = path.resolve(__dirname, '..');
const OUT = path.join(PROMO, 'output', 'google-play', 'ar');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.ttf': 'font/ttf' };
const ff = (...a) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...a]);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = http.createServer((req, res) => {
    const p = path.join(PROMO, decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
  }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const port = server.address().port;
  const browser = await chromium.launch();
  const jobs = [...Array.from({ length: 8 }, (_, i) => [`shot&i=${i}`, `phone-${String(i + 1).padStart(2, '0')}.png`]), ['feature', 'feature-graphic.png']];
  for (const [q, name] of jobs) {
    const page = await browser.newPage({ viewport: { width: 100, height: 100 } });
    page.on('pageerror', e => console.error(e.message));
    await page.goto(`http://127.0.0.1:${port}/src/store.html?asset=${q}`);
    const { W, H } = await page.waitForFunction(() => window.assetReady).then(h => h.jsonValue());
    await page.setViewportSize({ width: W, height: H });
    await page.waitForTimeout(200);
    const tmp = path.join(OUT, `.${name}`);
    await page.screenshot({ path: tmp, clip: { x: 0, y: 0, width: W, height: H } });
    ff('-i', tmp, '-pix_fmt', 'rgb24', path.join(OUT, name)); // 24-bit, no alpha
    fs.unlinkSync(tmp);
    console.log('→', name);
    await page.close();
  }
  ff('-i', path.join(PROMO, '..', 'icons', 'icon_1024.png'), '-vf', 'scale=512:512:flags=lanczos', '-pix_fmt', 'rgba', path.join(OUT, 'app-icon-512.png'));
  console.log('→ app-icon-512.png');
  await browser.close();
  server.close();
})();
