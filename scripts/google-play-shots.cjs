const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');

// ---- Config ----
const ROOT = path.resolve(__dirname, '..');
const PORT = 8091;
const OUTPUT_DIR = path.resolve(__dirname, '..', 'screenshots', 'google-play');
const PHONE_W = 412;
const PHONE_H = 915;
const SHOT_W = 1440;
const SHOT_H = 3200;

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
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0].split('#')[0];
  const decodedPath = decodeURIComponent(urlPath);
  let filePath = path.join(ROOT, decodedPath === '/' ? 'index.html' : decodedPath);
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('404');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  });
});

// ---- Screenshot definitions ----
const SCREENSHOTS = [
  {
    id: '01-home',
    url: '/',
    title: 'Everything You Need',
    subtitle: 'in One App',
    waitFor: null,
  },
  {
    id: '02-quran',
    url: '/pages/quran.html?page=1',
    title: 'Interactive Holy Quran',
    subtitle: 'Search, bookmarks and multiple Mushaf styles',
    waitFor: 'document.querySelector(".page") || document.querySelector("#app")',
  },
  {
    id: '03-audio',
    url: '/pages/audio.html',
    title: 'Listen to the Quran',
    subtitle: 'Multiple reciters with background playback',
    waitFor: null,
  },
  {
    id: '04-tasmee',
    url: '/pages/quran.html?page=287',
    title: 'Memorize with Confidence',
    subtitle: 'Speech recognition and spaced repetition',
    waitFor: null,
  },
  {
    id: '05-hisn',
    url: '/pages/hisn.html',
    title: 'Daily Adhkar and Duas',
    subtitle: 'Complete Hisn Al-Muslim collection',
    waitFor: null,
  },
  {
    id: '06-qibla',
    url: '/pages/qibla.html',
    title: 'Find the Qibla',
    subtitle: 'Anywhere',
    waitFor: null,
  },
  {
    id: '07-masbaha',
    url: '/pages/masbaha.html',
    title: 'Smart Tasbeeh Counter',
    subtitle: 'Daily targets and lifetime statistics',
    waitFor: null,
  },
  {
    id: '08-notifications',
    url: '/pages/notifications.html',
    title: 'Never Miss',
    subtitle: 'a Prayer',
    waitFor: null,
  },
];

// ---- Template HTML ----
function buildTemplateHTML(title, subtitle, screenshotBase64) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @font-face { font-family:'Tajawal'; src:url('file:///${ROOT.replace(/\\/g, '/')}/fonts/Tajawal.ttf') format('truetype'); font-weight:700; }
  @font-face { font-family:'Amiri'; src:url('file:///${ROOT.replace(/\\/g, '/')}/fonts/Amiri.ttf') format('truetype'); font-weight:700; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width: ${SHOT_W}px; height: ${SHOT_H}px;
    background: linear-gradient(160deg, #0a1628 0%, #0f1f3a 35%, #0a1628 65%, #0d1a2d 100%);
    display: flex; flex-direction: column;
    align-items: center; justify-content: space-between;
    overflow: hidden; position: relative;
    font-family: 'Tajawal', 'Segoe UI', system-ui, sans-serif;
  }
  /* Subtle pattern overlay */
  body::before {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    opacity: 0.03;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Cg fill='none' stroke='%2310b981' stroke-width='1'%3E%3Crect x='21' y='21' width='22' height='22'/%3E%3Crect x='21' y='21' width='22' height='22' transform='rotate(45 32 32)'/%3E%3C/g%3E%3C/svg%3E");
    background-size: 64px 64px;
  }

  /* Header */
  .header {
    position: relative; z-index: 1;
    width: 100%; padding: 80px 80px 40px;
    text-align: center;
  }
  .header .emerald-line {
    width: 80px; height: 4px; margin: 0 auto 40px;
    background: linear-gradient(90deg, #10b981, #059669);
    border-radius: 2px;
  }
  .header h1 {
    font-size: 108px; font-weight: 700; line-height: 1.15;
    color: #ffffff;
    letter-spacing: -1px;
  }
  .header h1 span {
    background: linear-gradient(135deg, #34d399 0%, #10b981 50%, #059669 100%);
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .header .subtitle {
    font-size: 52px; font-weight: 400; line-height: 1.3;
    color: rgba(255,255,255,0.65);
    margin-top: 20px;
    font-family: 'Amiri', serif;
  }

  /* Screenshot area */
  .screenshot-area {
    position: relative; z-index: 1;
    flex: 1; display: flex; align-items: center; justify-content: center;
    width: 100%; padding: 0 40px;
  }
  .phone-frame {
    width: 780px; border-radius: 52px;
    overflow: hidden;
    box-shadow: 0 40px 100px rgba(0,0,0,0.65), 0 0 0 3px rgba(255,255,255,0.1);
    background: #1a1a1a;
  }
  .phone-frame img {
    width: 100%; height: auto; display: block;
  }

  /* Footer */
  .footer {
    position: relative; z-index: 1;
    width: 100%; padding: 40px 80px 70px;
    display: flex; align-items: center; justify-content: center; gap: 24px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }
  .footer .logo-icon {
    width: 56px; height: 56px;
    background: linear-gradient(135deg, #10b981, #059669);
    border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 20px rgba(16,185,129,0.3);
  }
  .footer .logo-icon svg { width: 32px; height: 32px; }
  .footer .brand-text {
    font-size: 40px; font-weight: 700; color: rgba(255,255,255,0.85);
    letter-spacing: 0.5px;
  }
  .footer .brand-sub {
    font-size: 28px; color: rgba(255,255,255,0.4);
    margin-top: 4px;
  }

  /* Ambient glow */
  .glow {
    position: absolute; width: 600px; height: 600px;
    border-radius: 50%; filter: blur(120px);
    pointer-events: none; z-index: 0;
  }
  .glow-1 { top: -200px; right: -100px; background: rgba(16,185,129,0.12); }
  .glow-2 { bottom: -150px; left: -100px; background: rgba(59,130,246,0.08); }
</style>
</head>
<body>
  <div class="glow glow-1"></div>
  <div class="glow glow-2"></div>

  <div class="header">
    <div class="emerald-line"></div>
    <h1>${title}</h1>
    ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
  </div>

  <div class="screenshot-area">
    <div class="phone-frame">
      <img src="data:image/png;base64,${screenshotBase64}" />
    </div>
  </div>

  <div class="footer">
    <div class="logo-icon">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white" opacity="0.9"/>
        <path d="M2 17l10 5 10-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
        <path d="M2 12l10 5 10-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
      </svg>
    </div>
    <div>
      <div class="brand-text">زاد المسلم</div>
      <div class="brand-sub">Zad Al-Muslim</div>
    </div>
  </div>
</body>
</html>`;
}

// ---- Main ----
server.listen(PORT, async () => {
  console.log(`\n🚀 Google Play Screenshot Generator — ${SHOT_W}×${SHOT_H} PNG\n`);
  console.log(`Server at http://localhost:${PORT}`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  for (const shot of SCREENSHOTS) {
    process.stdout.write(`\n📸 ${shot.id}: "${shot.title}" ...`);

    // Step 1: capture raw phone screenshot
    const phoneCtx = await browser.newContext({
      viewport: { width: PHONE_W, height: PHONE_H },
      deviceScaleFactor: 2,
    });
    const phonePage = await phoneCtx.newPage();
    let rawBuffer;
    try {
      const url = `http://localhost:${PORT}${shot.url}`;
      await phonePage.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
      await phonePage.waitForTimeout(2500);

      // Hide any overlays/modals
      await phonePage.evaluate(() => {
        document.querySelectorAll('.modal-overlay, .modal, [id*="Modal"], [id*="modal"]').forEach(el => {
          el.style.display = 'none';
        });
        // Scroll to top
        window.scrollTo(0, 0);
      });
      await phonePage.waitForTimeout(300);

      rawBuffer = await phonePage.screenshot({ type: 'png' });
      console.log(' ✅ raw captured');
    } catch (e) {
      console.log(` ⚠️ ${e.message.split('\n')[0]}`);
      try {
        rawBuffer = await phonePage.screenshot({ type: 'png' });
      } catch (_) {
        await phonePage.close();
        await phoneCtx.close();
        continue;
      }
    }
    await phonePage.close();
    await phoneCtx.close();

    // Step 2: compose into template
    const base64 = rawBuffer.toString('base64');
    const templateHTML = buildTemplateHTML(shot.title, shot.subtitle, base64);

    const composeCtx = await browser.newContext({
      viewport: { width: SHOT_W, height: SHOT_H },
      deviceScaleFactor: 1,
    });
    const composePage = await composeCtx.newPage();
    try {
      await composePage.setContent(templateHTML, { waitUntil: 'networkidle' });
      await composePage.waitForTimeout(500);

      await composePage.screenshot({
        path: path.join(OUTPUT_DIR, `${shot.id}.png`),
        type: 'png',
      });
      console.log(` ✅ saved → screenshots/google-play/${shot.id}.png`);
    } catch (e) {
      console.log(` ❌ compose failed: ${e.message.split('\n')[0]}`);
    }
    await composePage.close();
    await composeCtx.close();
  }

  await browser.close();
  server.close();
  console.log(`\n🎉 Done — ${SCREENSHOTS.length} screenshots saved to screenshots/google-play/\n`);
});
