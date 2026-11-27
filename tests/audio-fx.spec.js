// Audio effects for the own recording: the panel, the listen button, the effects
// themselves (rendered offline and measured), and a long video exported through them.
const { test, expect } = require('@playwright/test');
// the settings are in tabs (الآيات / الصوت / المظهر / النص): open the one a control is on
const sec = (page, name) => expect(async () => {
  const tab = page.locator('#vmTab-' + name);
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click({ timeout: 2000 });
  await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 500 });
}).toPass({ timeout: 15000 });

const BASE_URL = 'http://localhost:8080';
test.use({ serviceWorkers: 'block', viewport: { width: 412, height: 915 } });

function wav(voice) {
  const SR = 16000, GAP = 0.8, HEAD = 0.5;
  const total = HEAD + voice.reduce((a, b) => a + b, 0) + GAP * (voice.length - 1) + 1;
  const n = Math.round(total * SR), pcm = Buffer.alloc(n * 2);
  let t = HEAD;
  for (const v of voice) {
    const a = Math.round(t * SR), len = Math.round(v * SR);
    for (let i = 0; i < len; i++) {
      const env = Math.min(1, i / 400, (len - i) / 400) * (0.6 + 0.4 * Math.sin(i / 700));
      pcm.writeInt16LE(Math.round(11000 * env * Math.sin(i * 0.13)) + Math.round((Math.random() - 0.5) * 60), (a + i) * 2);
    }
    t += v + GAP;
  }
  for (let i = 0; i < n; i++) if (pcm.readInt16LE(i * 2) === 0) pcm.writeInt16LE(Math.round((Math.random() - 0.5) * 60), i * 2);   // a little room noise
  const b = Buffer.alloc(44 + pcm.length);
  b.write('RIFF', 0); b.writeUInt32LE(36 + pcm.length, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(pcm.length, 40);
  pcm.copy(b, 44);
  return b;
}
function mp4Duration(buf) {
  const at = buf.indexOf('mvhd');
  const version = buf[at + 4];
  if (version === 1) return Number(buf.readBigUInt64BE(at + 4 + 4 + 16 + 4)) / buf.readUInt32BE(at + 4 + 4 + 16);
  return buf.readUInt32BE(at + 4 + 4 + 8 + 4) / buf.readUInt32BE(at + 4 + 4 + 8);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      if (sessionStorage.getItem('vmTestStarted')) return;
      sessionStorage.setItem('vmTestStarted', '1');
      localStorage.setItem('zad_lang', 'ar');
      localStorage.setItem('vm_settings', JSON.stringify({ mode: 'long', surah: 1, from: 1, to: 3, tvTemplate: 'moonlit' }));
      indexedDB.deleteDatabase('vm-own-recitation');
    } catch { /* storage blocked */ }
  });
  await page.route(url => !url.href.startsWith(BASE_URL), route => route.abort());
});

test('the effects really change the sound (measured offline)', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/video-maker.html`, { waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  const r = await page.evaluate(async () => {
    const SR = 48000;
    const ctx = new OfflineAudioContext(1, SR * 3, SR);
    const b = ctx.createBuffer(1, SR * 3, SR);
    const d = b.getChannelData(0);
    for (let i = 0; i < SR * 0.5; i++) d[i] = 0.4 * Math.sin(i * 0.05);     // 0.5 s of sound, then silence
    const lv = { floor: -70, voice: -12, peak: -8 };
    const energy = (c, a, z) => { let e = 0; for (let i = Math.round(a * SR); i < Math.round(z * SR); i++) e += c[i] * c[i]; return e; };
    const none = await AudioFx.renderRange(b, 0, 3, { on: true, reverb: { preset: 'none' }, echo: { mix: 0 }, polish: { on: false } }, lv, SR, 0);
    const room = await AudioFx.renderRange(b, 0, 3, { on: true, reverb: { preset: 'mosque', mix: 0.3, decay: 2.6 }, echo: { mix: 0 }, polish: { on: false } }, lv, SR, 0);
    const echo = await AudioFx.renderRange(b, 0, 3, { on: true, reverb: { preset: 'none' }, echo: { mix: 0.5, delay: 0.3, feedback: 0.3 }, polish: { on: false } }, lv, SR, 0);
    const off = await AudioFx.renderRange(b, 0, 3, { on: false, reverb: { preset: 'mosque', mix: 0.3, decay: 2.6 }, echo: { mix: 0.5 }, polish: { on: true } }, lv, SR, 0);
    // the gate: quiet hiss between phrases is pushed down
    const g = ctx.createBuffer(1, SR * 2, SR);
    const gd = g.getChannelData(0);
    for (let i = 0; i < SR * 2; i++) gd[i] = i < SR * 0.5 ? 0.4 * Math.sin(i * 0.05) : 0.003 * (Math.random() - 0.5);
    const lvg = { floor: -56, voice: -11, peak: -8 };
    const raw = await AudioFx.renderRange(g, 0, 2, { on: true, reverb: { preset: 'none' }, echo: { mix: 0 }, polish: { on: true, gate: 0, warmth: 0, clarity: 0, comp: 0, normalize: false } }, lvg, SR, 0);
    const gated = await AudioFx.renderRange(g, 0, 2, { on: true, reverb: { preset: 'none' }, echo: { mix: 0 }, polish: { on: true, gate: 80, warmth: 0, clarity: 0, comp: 0, normalize: false } }, lvg, SR, 0);
    return {
      noneTail: energy(none.ch0, 0.8, 3), roomTail: energy(room.ch0, 0.8, 3),
      echoAt: energy(echo.ch0, 0.55, 0.85), noneAt: energy(none.ch0, 0.55, 0.85),
      offTail: energy(off.ch0, 0.8, 3), stereo: energy(room.ch1, 0.8, 3) > 0,
      hissRaw: energy(raw.ch0, 1.2, 2), hissGated: energy(gated.ch0, 1.2, 2), gatedVoice: energy(gated.ch0, 0.1, 0.4), rawVoice: energy(raw.ch0, 0.1, 0.4),
    };
  });
  expect(r.noneTail).toBeLessThan(1e-6);
  expect(r.roomTail).toBeGreaterThan(1);              // the mosque keeps ringing after the sound stops
  expect(r.stereo).toBe(true);
  expect(r.echoAt).toBeGreaterThan(r.noneAt + 1);     // the echo comes back 0.3 s later
  expect(r.offTail).toBeLessThan(1e-6);               // master switch off = untouched
  expect(r.hissGated).toBeLessThan(r.hissRaw / 4);    // the gate lowers the room noise …
  expect(r.gatedVoice).toBeGreaterThan(r.rawVoice * 0.8);   // … and leaves the voice alone
});

test('the panel: presets, sliders, listen, and a long video exported through the effects', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(`${BASE_URL}/pages/video-maker.html`, { waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  await sec(page, 'audio');
  await expect(page.locator('#vmFxBox')).toBeHidden();           // only for an own recording
  await page.setInputFiles('#vmOwnFile', { name: 'mine.wav', mimeType: 'audio/wav', buffer: wav([1.4, 2.0, 1.6]) });
  await expect(page.locator('#vmSyncList .sync-row')).toHaveCount(4, { timeout: 30000 });
  await page.locator('#vmSyncDone').click();
  await sec(page, 'audio');
  await expect(page.locator('#vmFxBox')).toBeVisible();

  // A room preset sets its own length and amount; the sliders show and change them.
  await sec(page, 'audio');
  await page.locator('#vmFxRooms [data-room="mosque"]').click();
  await sec(page, 'audio');
  await expect(page.locator('#vmFxRevDecayVal')).toHaveText('٢.٦ s');
  let fx = await page.evaluate(() => VM.state.fx);
  expect(fx.reverb).toMatchObject({ preset: 'mosque', decay: 2.6, mix: 0.26 });
  await sec(page, 'audio');
  await page.locator('#vmFxEchoMix').fill('0.3');
  await sec(page, 'audio');
  await page.locator('#vmFxEchoMix').dispatchEvent('change');
  await sec(page, 'audio');
  await page.locator('#vmFxPolish').check();
  await sec(page, 'audio');
  await page.locator('#vmFxComp').fill('70');
  await sec(page, 'audio');
  await page.locator('#vmFxComp').dispatchEvent('change');
  fx = await page.evaluate(() => VM.state.fx);
  expect(fx.echo.mix).toBeCloseTo(0.3);
  expect(fx.polish).toMatchObject({ on: true, comp: 70 });
  expect(fx.touched).toBe(true);

  // Listen, and stop.
  await sec(page, 'audio');
  await page.locator('#vmFxListen').click();
  await sec(page, 'audio');
  await expect(page.locator('#vmFxListenLabel')).toHaveText('إيقاف', { timeout: 10000 });
  await sec(page, 'audio');
  await page.locator('#vmFxListen').click();
  await sec(page, 'audio');
  await expect(page.locator('#vmFxListenLabel')).toHaveText('استمع إلى المؤثرات');

  // Kept across a reload.
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  await sec(page, 'audio');
  await expect(page.locator('#vmFxRooms [data-room="mosque"]')).toHaveClass(/active/);

  // The long video is made through the effects, at the expected length.
  const fast = await page.evaluate(() => !!(window.VideoEncoder && window.AudioEncoder));
  test.skip(!fast, 'no WebCodecs in this browser');
  await sec(page, 'audio');
  await expect(page.locator('#vmDurValue')).not.toHaveText('…', { timeout: 20000 });
  await page.locator('#vmExport').click();
  await expect(page.locator('#vmResult')).toBeVisible({ timeout: 90000 });
  const bytes = await page.evaluate(async () => Array.from(new Uint8Array(await (await fetch(document.getElementById('vmVideo').src)).arrayBuffer())));
  const mp4 = Buffer.from(bytes);
  expect(mp4.indexOf('soun')).toBeGreaterThan(0);
  const d = mp4Duration(mp4);
  expect(d).toBeGreaterThan(7.5);
  expect(d).toBeLessThan(10.5);
});
