// Renders the commercial frame-by-frame with headless Chromium and encodes it
// with FFmpeg. Frames are pure functions of time, so the timeline is split
// across parallel workers and the segments are concatenated losslessly.
//
//   node scripts/render.cjs --fmt=landscape            full render → output/
//   node scripts/render.cjs --fmt=vertical --workers=3
//   node scripts/render.cjs --fmt=landscape --stills=0.5,4.5,12  (PNG stills)
//   node scripts/render.cjs --fmt=landscape --from=8 --to=15     (partial preview)
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');

const PROMO = path.resolve(__dirname, '..');
const OUT = path.join(PROMO, 'output');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const FMT = arg('fmt', 'landscape');
const LANG = arg('lang', 'en');
const PLAY = process.argv.includes('--play');
const PAGE = arg('page', 'index.html');  // e.g. vm-promo.html (Ayah Video Maker promo)
const TAG = (PAGE === 'index.html' ? '' : PAGE.replace(/\.html$/, '') + '-') + FMT + (LANG === 'en' ? '' : `-${LANG}`) + (PLAY ? '-play' : '');
const WORKERS = parseInt(arg('workers', String(Math.max(1, Math.min(3, os.cpus().length - 1)))), 10);
const MIME = { '.html': 'text/html', '.css': 'text/css', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.js': 'application/javascript', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };

function serve() {
  return new Promise(res => {
    const s = http.createServer((req, rsp) => {
      const p = path.join(PROMO, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(PROMO)) { rsp.writeHead(403); return rsp.end(); }
      fs.readFile(p, (e, d) => {
        if (e) { rsp.writeHead(404); return rsp.end(); }
        rsp.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
        rsp.end(d);
      });
    }).listen(0, '127.0.0.1', () => res(s));
  });
}

async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: 100, height: 100 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('[page error]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('[console]', m.text()); });
  await page.goto(`http://127.0.0.1:${port}/src/${PAGE}?fmt=${FMT}&lang=${LANG}${PLAY ? '&play=1' : ''}`);
  const meta = await page.evaluate(() => window.ready);
  await page.setViewportSize({ width: meta.W, height: meta.H });
  const cdp = await page.context().newCDPSession(page);
  return { page, meta, cdp };
}

async function grab(cdp) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, captureBeyondViewport: false });
  return Buffer.from(data, 'base64');
}

async function renderSegment(browser, port, f0, f1, file, idx) {
  const { page, meta, cdp } = await openPage(browser, port);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(meta.FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-tune', 'film', '-pix_fmt', 'yuv420p',
    '-x264-params', 'keyint=60:min-keyint=30', '-r', String(meta.FPS), file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    await page.evaluate(t => window.renderFrame(t), f / meta.FPS);
    const png = await grab(cdp);
    if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - f0) % 60 === 0) console.log(`  [w${idx}] frame ${f}/${f1} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await page.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const port = server.address().port;
  const browser = await chromium.launch({ args: ['--disable-gpu-vsync', '--force-color-profile=srgb', '--font-render-hinting=none'] });

  const stills = arg('stills');
  if (stills) {
    const dir = path.join(PROMO, 'build', 'stills', TAG);
    fs.mkdirSync(dir, { recursive: true });
    const { page, cdp } = await openPage(browser, port);
    for (const s of stills.split(',')) {
      await page.evaluate(t => window.renderFrame(t), parseFloat(s));
      fs.writeFileSync(path.join(dir, `t${parseFloat(s).toFixed(2).padStart(5, '0')}.png`), await grab(cdp));
    }
    console.log('stills →', dir);
    await browser.close(); server.close();
    return;
  }

  const { meta } = await openPage(browser, port);
  const from = Math.round(parseFloat(arg('from', '0')) * meta.FPS);
  const to = Math.round(parseFloat(arg('to', String(meta.DURATION))) * meta.FPS);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zad-render-'));
  const per = Math.ceil((to - from) / WORKERS);
  const segs = [];
  console.log(`rendering ${FMT} frames ${from}-${to} with ${WORKERS} workers`);
  const t0 = Date.now();
  await Promise.all(Array.from({ length: WORKERS }, (_, i) => {
    const a = from + i * per, b = Math.min(to, a + per);
    const file = path.join(tmp, `seg${i}.mp4`);
    segs.push(file);
    return renderSegment(browser, port, a, b, file, i);
  }));
  await browser.close(); server.close();
  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, segs.map(s => `file '${s}'`).join('\n'));
  const silent = path.join(PROMO, 'build', `video-${TAG}${arg('from') ? '-partial' : ''}.mp4`);
  fs.mkdirSync(path.dirname(silent), { recursive: true });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent]);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`video → ${silent} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
})();
