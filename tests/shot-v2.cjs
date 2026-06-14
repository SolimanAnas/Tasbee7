// quick visual capture of Tasmee' v2 states (dev aid, not a test)
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://localhost:8742/pages/quran-t.html?page=287', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    try { dlSkip(); } catch (e) {}
    const dl = document.getElementById('dlModal');
    if (dl) dl.style.display = 'none';
  });
  await page.waitForFunction(() => typeof dbReady !== 'undefined' && dbReady, null, { timeout: 20000 });
  await page.evaluate(async () => { await _v2LoadQuranText(); await _v2Open(287); });
  await page.waitForFunction(() => window._tpv2 && _tpv2.words.length > 0, null, { timeout: 15000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'screenshots/v2-masked.png' });

  await page.evaluate(() => _v2StartFromAyah(17, 53));
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'screenshots/v2-start-from-53.png' });

  await page.evaluate(() => tpToggleText());
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'screenshots/v2-peek.png' });

  await browser.close();
  console.log('done');
})();
