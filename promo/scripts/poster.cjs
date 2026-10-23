// Renders the cover artwork: output/zad-al-muslim-poster.png (1920×1080)
// and output/zad-al-muslim-poster-vertical.png (1080×1920).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');

const PROMO = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.ttf': 'font/ttf' };

(async () => {
  const server = http.createServer((req, res) => {
    const p = path.join(PROMO, decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
  }).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const port = server.address().port;
  const browser = await chromium.launch();
  for (const [fmt, w, h, name] of [['landscape', 1920, 1080, 'zad-al-muslim-poster.png'], ['vertical', 1080, 1920, 'zad-al-muslim-poster-vertical.png']]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on('pageerror', e => console.error(e.message));
    await page.goto(`http://127.0.0.1:${port}/src/poster.html?fmt=${fmt}`);
    await page.waitForFunction(() => window.posterReady === true);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(PROMO, 'output', name) });
    console.log('poster →', name);
    await page.close();
  }
  await browser.close();
  server.close();
})();
