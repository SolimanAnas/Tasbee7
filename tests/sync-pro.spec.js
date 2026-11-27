// The timing sheet of «تسجيلي» at a pro level: the split survives a noisy room, the boundaries
// worth checking are pointed out (and walked through), every edit can be undone, a dragged
// marker snaps to the pauses, and the recording plays slower for exact marking.
const { test, expect } = require('@playwright/test');
// the settings are in tabs (الآيات / الصوت / المظهر / النص): open the one a control is on
const sec = (page, name) => expect(async () => {
  const tab = page.locator('#vmTab-' + name);
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click({ timeout: 2000 });
  await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 500 });
}).toPass({ timeout: 15000 });

const BASE_URL = 'http://localhost:8080';
test.use({ serviceWorkers: 'block', viewport: { width: 412, height: 915 } });

const SR = 16000;
// Voice bursts (a 331 Hz tone with a syllable rhythm) separated by gaps; hum = mains hum level.
function recording(voices, gaps, hum = 0) {
  const HEAD = 0.5, TAIL = 1.0;
  const total = HEAD + voices.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0) + TAIL;
  const n = Math.round(total * SR), pcm = Buffer.alloc(n * 2);
  const at = new Float32Array(n);
  for (let i = 0; i < n; i++) at[i] = hum * (Math.sin(2 * Math.PI * 50 * i / SR) + 0.3 * Math.sin(2 * Math.PI * 100 * i / SR));
  let t = HEAD;
  const starts = [];
  voices.forEach((v, k) => {
    starts.push(t);
    const a = Math.round(t * SR), len = Math.round(v * SR);
    for (let i = 0; i < len; i++) at[a + i] += 0.33 * Math.min(1, i / 400, (len - i) / 400) * (0.6 + 0.4 * Math.sin(i / 700)) * Math.sin(i * 0.13);
    t += v + (gaps[k] || 0);
  });
  for (let i = 0; i < n; i++) pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(at[i] * 32767))), i * 2);
  const buf = Buffer.alloc(44 + pcm.length);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + pcm.length, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(pcm.length, 40);
  pcm.copy(buf, 44);
  return { buf, starts };
}
const CLEAN = recording([1.4, 2.2, 1.8, 3.0, 2.4, 1.6, 4.0], [0.8, 0.8, 0.8, 0.8, 0.8, 0.8]);
const HUM = recording([1.4, 2.2, 1.8, 3.0, 2.4, 1.6, 4.0], [0.8, 0.8, 0.8, 0.8, 0.8, 0.8], 0.3);
// ayah 4 follows ayah 3 after 0.1 s (too short to hear as a pause), ayah 5 has a breath inside
const MISSED = recording([1.4, 2.2, 1.8, 3.0, 1.0, 1.4, 1.6, 4.0], [0.8, 0.8, 0.1, 0.8, 0.35, 0.8, 0.8]);
const TRUE_MISSED = [0, 1, 2, 3, 4, 6, 7].map(i => MISSED.starts[i]);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      if (sessionStorage.getItem('vmTestStarted')) return;
      sessionStorage.setItem('vmTestStarted', '1');
      localStorage.setItem('zad_lang', 'ar');
      localStorage.removeItem('vm_settings');
      indexedDB.deleteDatabase('vm-own-recitation');
    } catch { /* storage blocked */ }
  });
  await page.route(url => !url.href.startsWith(BASE_URL), route => route.abort());
});

async function openWith(page, rec) {
  await page.goto(`${BASE_URL}/pages/video-maker.html`, { waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  await sec(page, 'audio');
  await page.locator('#vmSource [data-src="own"]').click();
  await page.setInputFiles('#vmOwnFile', { name: 'تلاوتي.wav', mimeType: 'audio/wav', buffer: rec.buf });
  await expect(page.locator('#vmSyncList .sync-row')).toHaveCount(8, { timeout: 30000 });   // 7 ayat + the end
  await page.waitForFunction(() => VM.own && VM.own.sync);
}
const sync = page => page.evaluate(() => VM.own.sync);

test('a room with mains hum: the split still finds every pause', async ({ page }) => {
  await openWith(page, HUM);
  const s = await sync(page);
  s.m.forEach((m, i) => expect(Math.abs(m - (HUM.starts[i] - 0.15)), 'ayah ' + (i + 1)).toBeLessThan(0.3));
  expect(s.unsure).toEqual([]);
  await expect(page.locator('#vmSyncReview')).toBeHidden();
  // the same recording measured on the full signal (the hum fills the pauses) does not split
  const broad = await page.evaluate(() => {
    const b = VM.own.buffer, R = OwnRecitation;
    const r = R.autoSplit(R.envelopeDb(b.getChannelData(0), null, b.sampleRate), R.HOP, 7);
    return r.markers;
  });
  const ok = broad && broad.every((m, i) => Math.abs(m - (HUM.starts[i] - 0.15)) < 0.3);
  expect(ok).toBeFalsy();
});

test('boundaries to check: pointed out, walked through, cleared by a fix or a confirm', async ({ page }) => {
  test.setTimeout(90000);
  await openWith(page, MISSED);
  let s = await sync(page);
  expect(s.unsure.length).toBeGreaterThan(0);
  expect(s.unsure).toContain(3);                                    // the ayah that runs into the next
  await expect(page.locator('#vmSyncReview')).toBeVisible();
  await expect(page.locator('#vmSyncReviewText')).toContainText('غير مؤكد');
  await expect(page.locator('#vmSyncList .sync-row.unsure')).toHaveCount(s.unsure.length);
  // «راجع التالي»: goes to a boundary to check and plays across it, then stops by itself
  await page.locator('#vmSyncReviewBtn').click();
  s = await sync(page);
  expect(s.unsure).toContain(s.sel);
  await expect(page.locator('#vmSyncUnsure')).toBeVisible();
  await expect(page.locator('#vmSyncConfirm')).toBeVisible();
  await expect(page.locator('#vmSyncPlay')).toHaveText('⏸', { timeout: 5000 });
  await expect(page.locator('#vmSyncPlay')).toHaveText('▶', { timeout: 8000 });     // ~3 s around the boundary
  // fixing ayah 4 at its real start clears it, and the ayat after it follow
  await page.evaluate(() => { const b = [...document.querySelectorAll('#vmSyncList .sync-row')][3]; b.click(); });
  await page.locator('#vmSyncFTime').fill((TRUE_MISSED[3] - 0.1).toFixed(1));
  await page.locator('#vmSyncFTime').dispatchEvent('change');
  s = await sync(page);
  expect(s.unsure).not.toContain(3);
  for (let i = 4; i < 7; i++) expect(Math.abs(s.m[i] - TRUE_MISSED[i]), 'ayah ' + (i + 1)).toBeLessThan(0.35);
  // whatever is left: «الفاصل صحيح» confirms each, and the bar goes away
  for (let guard = 0; guard < 8 && (await sync(page)).unsure.length; guard++) {
    await page.locator('#vmSyncReviewBtn').click();
    await page.locator('#vmSyncConfirm').click();
  }
  expect((await sync(page)).unsure).toEqual([]);
  await expect(page.locator('#vmSyncReview')).toBeHidden();
  await expect(page.locator('#vmSyncList .sync-row.unsure')).toHaveCount(0);
});

test('every edit can be undone and redone (buttons and Ctrl+Z)', async ({ page }) => {
  await openWith(page, CLEAN);
  await expect(page.locator('#vmSyncUndo')).toBeDisabled();
  const before = (await sync(page)).m;
  await page.locator('#vmSyncNext').click();                        // ayah 2
  await page.locator('#vmSyncPlay').click();                        // pause
  await page.locator('#vmSyncFPlus').click();
  await page.locator('#vmSyncFPlus').click();
  expect((await sync(page)).m[1]).toBeCloseTo(before[1] + 0.2, 2);
  await page.locator('#vmSyncUndo').click();
  expect((await sync(page)).m[1]).toBeCloseTo(before[1] + 0.1, 2);
  await page.locator('#vmSyncUndo').click();
  expect((await sync(page)).m).toEqual(before);
  await expect(page.locator('#vmSyncUndo')).toBeDisabled();
  await page.locator('#vmSyncRedo').click();
  expect((await sync(page)).m[1]).toBeCloseTo(before[1] + 0.1, 2);
  // keyboard
  await page.locator('#vmSyncFocusCount').click();
  await page.keyboard.press('Control+z');
  expect((await sync(page)).m).toEqual(before);
  await page.keyboard.press('Control+Shift+z');
  expect((await sync(page)).m[1]).toBeCloseTo(before[1] + 0.1, 2);
  // , and . move the chosen boundary by 50 ms
  await page.keyboard.press('.');
  expect((await sync(page)).m[1]).toBeCloseTo(before[1] + 0.15, 2);
});

test('a dragged marker snaps to a pause; with Alt it goes exactly where it is dropped', async ({ page }) => {
  await openWith(page, CLEAN);
  await page.locator('#vmSyncZoom [data-win="0"]').click();          // the whole recording in view
  const { m, snaps } = await sync(page);
  const total = await page.evaluate(() => VM.own.buffer.duration);
  // where the waveform is on screen: in view, and once the sheet has stopped moving
  const place = async () => {
    await page.locator('#vmSyncWave').scrollIntoViewIfNeeded();
    let box = null;
    await expect.poll(async () => {
      const b = await page.locator('#vmSyncWave').boundingBox();
      const same = box && Math.abs(b.y - box.y) < 0.5;
      box = b;
      return same;
    }, { intervals: [150] }).toBe(true);
    return { xOf: t => box.x + t / total * box.width, y: box.y + box.height / 2 };
  };
  const drag = async (from, to) => {
    const { xOf, y } = await place();
    await page.mouse.move(xOf(from), y);
    await page.mouse.down();
    await page.mouse.move(xOf(to), y, { steps: 4 });
    await page.mouse.up();
  };
  // ayah 3's marker, dropped 0.25 s after its pause: back onto the pause
  await drag(m[2], m[2] + 0.25);
  let s = await sync(page);
  expect(s.sel).toBe(2);                                             // it was picked up
  expect(snaps.some(p => Math.abs(p - s.m[2]) < 0.005)).toBe(true);
  // with Alt held, no snapping
  await page.keyboard.down('Alt');
  await drag(s.m[2], s.m[2] + 0.25);
  await page.keyboard.up('Alt');
  s = await sync(page);
  expect(Math.abs(s.m[2] - (m[2] + 0.25))).toBeLessThan(0.08);
  expect(snaps.some(p => Math.abs(p - s.m[2]) < 0.05)).toBe(false);
  // a drag is one step of undo
  await page.locator('#vmSyncUndo').click();
  const back = (await sync(page)).m[2];
  expect(snaps.some(p => Math.abs(p - back) < 0.005)).toBe(true);
});

test('slower playback for exact marking', async ({ page }) => {
  await openWith(page, CLEAN);
  const speed = page.locator('#vmSyncSpeed');
  await expect(speed).toHaveText('1×');
  await speed.click();
  await expect(speed).toHaveText('.75×');
  expect((await sync(page)).rate).toBe(0.75);
  await page.locator('#vmSyncFromStart').click();
  await expect.poll(async () => (await sync(page)).playbackRate).toBe(0.75);     // the player itself runs slower
  await speed.click();
  await expect(speed).toHaveText('.5×');
  await speed.click();
  await expect(speed).toHaveText('1×');
});
