// Offline behaviour, tested against a server that is really switched off
// (closing it is the only "offline" a service worker can't see through:
// browser-level offline emulation doesn't cover requests the SW makes itself).
const { test, expect } = require('@playwright/test');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp3': 'audio/mpeg',
  '.pdf': 'application/pdf', '.wasm': 'application/wasm',
};

// Static server with byte-range support, like the production host.
function startServer() {
  const sockets = new Set();
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
    const file = path.join(ROOT, rel === '/' ? 'index.html' : rel);
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/html' }); res.end('not found'); return; }
      const headers = { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Accept-Ranges': 'bytes' };
      const m = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
      if (m) {
        const start = Number(m[1]);
        const end = m[2] ? Math.min(Number(m[2]), data.length - 1) : data.length - 1;
        res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${data.length}`, 'Content-Length': end - start + 1 });
        res.end(data.subarray(start, end + 1));
        return;
      }
      res.writeHead(200, { ...headers, 'Content-Length': data.length });
      res.end(data);
    });
  });
  server.on('connection', s => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({
    origin: `http://127.0.0.1:${server.address().port}`,
    // Drop keep-alive connections too, or the browser keeps talking to it.
    stop: () => new Promise(done => { sockets.forEach(s => s.destroy()); server.close(() => done()); }),
  })));
}

// Resolves once the service worker controls the page and its precache is complete.
async function waitForOfflineReady(page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(async () => {
    if (!navigator.serviceWorker.controller) return 'no controller';
    const name = (await caches.keys()).find(k => k.startsWith('zad-muslim-'));
    if (!name) return 'no cache';
    const cache = await caches.open(name);
    // The last entry of the precache list and a mid-list page.
    const need = ['img/SVG/zap.svg', 'pages/quran.html', 'js/vendor/sql-wasm.wasm'];
    for (const n of need) if (!(await cache.match(new URL(n, location.origin + '/').href))) return 'missing ' + n;
    return 'ready';
  }), { timeout: 60000 }).toBe('ready');
}

const SAMPLE_MP3 = '/assets/media/sleep-zikr/ar_99.mp3';

test.describe('offline', () => {
  test.describe.configure({ timeout: 120000 });
  let srv;
  test.beforeEach(async () => { srv = await startServer(); });
  test.afterEach(async () => { await srv.stop(); });

  test('precached pages open with the server down, deep links included', async ({ page }) => {
    await page.goto(srv.origin + '/index.html');
    await waitForOfflineReady(page);
    await srv.stop();

    // A page never visited online, opened through a query-string deep link.
    await page.goto(srv.origin + '/pages/azkar.html?type=morning');
    await expect(page).toHaveTitle(/أذكار|زاد/);

    await page.goto(srv.origin + '/pages/hisn.html');
    await expect(page.locator('body')).not.toBeEmpty();

    // The mushaf needs sql.js: it must come from the app itself, not a CDN.
    await page.goto(srv.origin + '/pages/quran.html');
    await expect.poll(() => page.evaluate(() => !!window.SQL), { timeout: 20000 }).toBe(true);
  });

  test('the text mushaf reads any page with the server down', async ({ page }) => {
    await page.goto(srv.origin + '/index.html');
    await waitForOfflineReady(page);
    await srv.stop();

    // A page never opened before, straight from the precached Quran text.
    await page.goto(srv.origin + '/pages/quran-text.html?page=300');
    await expect(page.locator('.ayah-wrapper').first()).toBeVisible({ timeout: 20000 });
    expect(await page.locator('.ayah-wrapper').count()).toBeGreaterThan(3);
  });

  test('a page that was never saved shows the fallback page, not a browser error', async ({ page }) => {
    await page.goto(srv.origin + '/index.html');
    await waitForOfflineReady(page);
    await srv.stop();

    await page.goto(srv.origin + '/pages/never-saved.html');
    await expect(page.locator('#msgTitle')).toBeVisible();
  });

  test('a page entered directly registers the service worker', async ({ page }) => {
    await page.goto(srv.origin + '/pages/hisn.html');
    await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())),
      { timeout: 15000 }).toBe(true);
  });

  test('audio played online is kept and served offline with byte ranges', async ({ page }) => {
    await page.goto(srv.origin + '/index.html');
    await waitForOfflineReady(page);

    // What an <audio> element sends: an open-ended range, answered with a 206.
    const online = await page.evaluate(async url => {
      const res = await fetch(url, { headers: { Range: 'bytes=0-' } });
      return { status: res.status, size: (await res.arrayBuffer()).byteLength };
    }, SAMPLE_MP3);
    expect(online.status).toBe(206);
    const fileSize = fs.statSync(path.join(ROOT, SAMPLE_MP3)).size;
    expect(online.size).toBe(fileSize);

    await expect.poll(() => page.evaluate(async url => {
      const cache = await caches.open('audio-cache-v1');
      return !!(await cache.match(url));
    }, SAMPLE_MP3), { timeout: 15000 }).toBe(true);

    await srv.stop();

    const slice = await page.evaluate(async url => {
      const res = await fetch(url, { headers: { Range: 'bytes=1000-1999' } });
      return {
        status: res.status,
        range: res.headers.get('Content-Range'),
        bytes: Array.from(new Uint8Array(await res.arrayBuffer())),
      };
    }, SAMPLE_MP3);
    expect(slice.status).toBe(206);
    expect(slice.range).toBe(`bytes 1000-1999/${fileSize}`);
    const expected = Array.from(fs.readFileSync(path.join(ROOT, SAMPLE_MP3)).subarray(1000, 2000));
    expect(slice.bytes).toEqual(expected);

    // And a real media element can load and seek in it.
    const duration = await page.evaluate(url => new Promise((resolve, reject) => {
      const a = new Audio(url);
      a.preload = 'auto';
      a.addEventListener('error', () => reject(new Error('audio error ' + (a.error && a.error.code))));
      a.addEventListener('loadedmetadata', () => { a.currentTime = a.duration / 2; });
      a.addEventListener('seeked', () => resolve(a.duration));
    }), SAMPLE_MP3);
    expect(duration).toBeGreaterThan(0);
  });

  test('losing and regaining the connection shows a notice', async ({ page, context }) => {
    await page.goto(srv.origin + '/pages/hisn.html');
    await context.setOffline(true);
    const notice = page.locator('#net-status');
    await expect(notice).toHaveClass(/open/);
    await expect(notice).not.toHaveClass(/online/);
    await expect(notice).toContainText(/اتصال|offline/i);

    await context.setOffline(false);
    await expect(notice).toHaveClass(/online/);
  });
});
