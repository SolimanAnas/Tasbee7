// The in-app recorder: Chromium's fake microphone plays a synthetic "recitation" (bursts
// of tone with pauses); the test reads along in the teleprompter, taps «التالي» (and
// «رجوع» once), finishes, and checks the take became the recitation, synced from the taps.
const { test, expect } = require('@playwright/test');
// the settings are in tabs (الآيات / الصوت / المظهر / النص): open the one a control is on
const sec = (page, name) => expect(async () => {
  const tab = page.locator('#vmTab-' + name);
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click({ timeout: 2000 });
  await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 500 });
}).toPass({ timeout: 15000 });
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE_URL = 'http://localhost:8080';

// 60 s of 1.6 s "phrases" separated by 0.9 s pauses, written once for the fake microphone.
const WAV = path.join(os.tmpdir(), 'zad-fake-mic.wav');
(function writeFakeMic() {
  const SR = 16000, total = 60, n = SR * total, pcm = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const t = (i / SR) % 2.5;
    if (t < 1.6) {
      const k = t * SR, len = 1.6 * SR;
      const env = Math.min(1, k / 400, (len - k) / 400) * (0.6 + 0.4 * Math.sin(k / 700));
      pcm.writeInt16LE(Math.round(10000 * env * Math.sin(i * 0.13)), i * 2);
    }
  }
  const b = Buffer.alloc(44 + pcm.length);
  b.write('RIFF', 0); b.writeUInt32LE(36 + pcm.length, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(pcm.length, 40);
  pcm.copy(b, 44);
  fs.writeFileSync(WAV, b);
})();

test.use({
  serviceWorkers: 'block',
  viewport: { width: 412, height: 915 },
  permissions: ['microphone'],
  launchOptions: {
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + WAV],
  },
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      if (sessionStorage.getItem('vmTestStarted')) return;
      sessionStorage.setItem('vmTestStarted', '1');
      localStorage.setItem('zad_lang', 'ar');
      localStorage.setItem('vm_settings', JSON.stringify({ surah: 1, from: 1, to: 4 }));
      indexedDB.deleteDatabase('vm-own-recitation');
    } catch { /* storage blocked */ }
  });
  await page.route(url => !url.href.startsWith(BASE_URL), route => route.abort());
});

test('record with the teleprompter: the taps become the sync, polish switches on', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto(`${BASE_URL}/pages/video-maker.html`, { waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  await sec(page, 'audio');
  await page.locator('#vmSource [data-src="own"]').click();
  await sec(page, 'audio');
  await page.locator('#vmOwnRec').click();
  await expect(page.locator('#vmRecSheet')).toHaveClass(/active/);
  await expect(page.locator('#vmRecCount')).toHaveText('الآية ١ من ٤');
  await expect(page.locator('#vmRecAyah')).toContainText('بِسۡمِ');
  await expect(page.locator('#vmRecNextBtn')).toBeDisabled();

  await page.locator('#vmRecMain').click();
  await expect(page.locator('#vmRecMainLabel')).toHaveText('إنهاء', { timeout: 10000 });   // after the 3-2-1
  await expect(page.locator('#vmRecPrompt')).toHaveClass(/live/);

  await page.waitForTimeout(2500);
  await page.locator('#vmRecNextBtn').click();
  await expect(page.locator('#vmRecCount')).toHaveText('الآية ٢ من ٤');
  await page.waitForTimeout(2500);
  await page.locator('#vmRecPrompt').click();                       // the text is a big «التالي» too
  await expect(page.locator('#vmRecCount')).toHaveText('الآية ٣ من ٤');
  await page.locator('#vmRecBack').click();                         // oops, too early
  await expect(page.locator('#vmRecCount')).toHaveText('الآية ٢ من ٤');
  await page.waitForTimeout(400);
  await page.keyboard.press('Space');                               // and from the keyboard
  await expect(page.locator('#vmRecCount')).toHaveText('الآية ٣ من ٤');
  await page.waitForTimeout(2500);
  await page.locator('#vmRecNextBtn').click();
  await expect(page.locator('#vmRecCount')).toHaveText('الآية ٤ من ٤');
  await expect(page.locator('#vmRecNextLabel')).toHaveText('إنهاء');
  await page.waitForTimeout(2200);
  await page.locator('#vmRecNextBtn').click();                      // finish on the last ayah

  // The take is the recitation now, and the timing sheet shows the synced result.
  await expect(page.locator('#vmSyncSheet')).toHaveClass(/active/, { timeout: 30000 });
  await expect(page.locator('#vmSyncList .sync-row')).toHaveCount(5);        // 4 ayat + the end
  await expect(page.locator('#vmSyncStatus')).toContainText('ضغطاتك');
  const times = await page.locator('#vmSyncList .sync-row input').evaluateAll(els => els.map(e => parseFloat(e.value)));
  for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
  expect(times[4] - times[0]).toBeGreaterThan(7);
  await page.locator('#vmSyncDone').click();

  const st = await page.evaluate(() => ({ src: VM.state.recSource, polish: VM.state.fx.polish.on }));
  expect(st).toEqual({ src: 'own', polish: true });
  await sec(page, 'audio');
  await expect(page.locator('#vmOwnStatus')).toHaveClass(/ok/);
  await sec(page, 'audio');
  await expect(page.locator('#vmOwnName')).toHaveText(/^recording-.*\.(webm|m4a|ogg)$/);
  await sec(page, 'audio');
  await expect(page.locator('#vmFxBox')).toBeVisible();
  await sec(page, 'audio');
  await expect(page.locator('#vmDurValue')).not.toHaveText('…', { timeout: 20000 });
});

test('closing the sheet while recording keeps the take', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto(`${BASE_URL}/pages/video-maker.html`, { waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  await sec(page, 'audio');
  await page.locator('#vmSource [data-src="own"]').click();
  await sec(page, 'audio');
  await page.locator('#vmOwnRec').click();
  await page.locator('#vmRecMain').click();
  await expect(page.locator('#vmRecMainLabel')).toHaveText('إنهاء', { timeout: 10000 });
  await page.waitForTimeout(2500);
  await page.locator('#vmRecSheet [data-close-pick]').click();
  // saved (the ayat not reached share the rest of the take), then shown for a check
  await expect(page.locator('#vmSyncSheet')).toHaveClass(/active/, { timeout: 30000 });
  await expect(page.locator('#vmSyncList .sync-row')).toHaveCount(5);
  expect(await page.evaluate(() => VM.state.recSource)).toBe('own');
});
