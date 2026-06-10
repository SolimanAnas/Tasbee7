const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');

// ---- Static file server (same as tests/server.js) ----
const ROOT = path.resolve(__dirname, '..');
const PORT = 8089;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp3': 'audio/mpeg',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
  '.onnx': 'application/octet-stream',
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0].split('#')[0];
  const decodedPath = decodeURIComponent(urlPath);
  let filePath = path.join(ROOT, decodedPath === '/' ? 'index.html' : decodedPath);
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 Not Found</h1>');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'Service-Worker-Allowed': '/',
    });
    res.end(data);
  });
});

server.listen(PORT, async () => {
  console.log(`Server at http://localhost:${PORT}`);

  const VIEWPORT = { width: 390, height: 844 }; // iPhone 12/13/14
  const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'screenshots');
  const PAGES_DIR = path.resolve(__dirname, '..', 'pages');

  const pages = [
    { name: 'home', url: '/' },
    ...fs.readdirSync(PAGES_DIR)
      .filter(f => f.endsWith('.html'))
      .sort()
      .map(f => ({ name: f.replace('.html', ''), url: '/pages/' + f })),
  ];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });

  for (const page of pages) {
    console.log(`📸 ${page.name}...`);
    const p = await context.newPage();
    try {
      await p.goto(`http://localhost:${PORT}${page.url}`, { waitUntil: 'networkidle', timeout: 15000 });
      await p.waitForTimeout(1500);
      await p.screenshot({
        path: path.join(SCREENSHOT_DIR, `${page.name}.png`),
        fullPage: true,
      });
      console.log(`  ✅ ${page.name}.png`);
    } catch (e) {
      console.log(`  ⚠️  ${page.name} — ${e.message}`);
      try {
        await p.screenshot({
          path: path.join(SCREENSHOT_DIR, `${page.name}.png`),
          fullPage: true,
        });
        console.log(`  📸 partial saved`);
      } catch (_) {}
    }
    await p.close();
  }

  await browser.close();
  server.close();
  console.log(`\n🎉 Done — ${pages.length} screenshots saved`);
});
