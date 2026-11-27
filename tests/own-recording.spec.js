// «تسجيلي»: the user's own recording as the recitation. A synthetic recording (7 bursts of
// tone, 0.8 s apart, standing for the 7 ayat of Al-Fatihah) is uploaded; the app finds the
// pauses, the user fixes a boundary in the sync sheet, and both the Shorts length and the
// long video export follow it. Nothing is downloaded: the audio server is never called.
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8080';
test.use({ serviceWorkers: 'block', viewport: { width: 412, height: 915 } });

const SR = 16000;
const VOICE = [1.4, 2.2, 1.8, 3.0, 2.4, 1.6, 4.0];
const GAP = 0.8, HEAD = 0.5, TAILSIL = 1.0;
function recording(VOICE = [1.4, 2.2, 1.8, 3.0, 2.4, 1.6, 4.0], GAPS) {
  const gapAt = i => (GAPS ? GAPS[i] : GAP);
  const total = HEAD + VOICE.reduce((a, b) => a + b, 0) + VOICE.slice(1).reduce((a, _, i) => a + gapAt(i), 0) + TAILSIL;
  const n = Math.round(total * SR), pcm = Buffer.alloc(n * 2);
  let t = HEAD;
  const starts = [];
  for (const v of VOICE) {
    starts.push(t);
    const a = Math.round(t * SR), len = Math.round(v * SR);
    for (let i = 0; i < len; i++) {
      const env = Math.min(1, i / 400, (len - i) / 400) * (0.6 + 0.4 * Math.sin(i / 700));
      pcm.writeInt16LE(Math.round(11000 * env * Math.sin(i * 0.13)), (a + i) * 2);
    }
    t += v + (gapAt(starts.length - 1) || 0);
  }
  const buf = Buffer.alloc(44 + pcm.length);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + pcm.length, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(pcm.length, 40);
  pcm.copy(buf, 44);
  return { buf, starts, total };
}
const REC = recording();
const SHORT_REC = recording([1.2, 1.5]);     // two ayat: for the real-time (Shorts) export

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
      localStorage.removeItem('vm_settings');
      indexedDB.deleteDatabase('vm-own-recitation');
    } catch { /* storage blocked */ }
  });
  await page.route(url => !url.href.startsWith(BASE_URL), route => route.abort());
});

async function open(page, settings) {
  if (settings) await page.addInitScript(s => { if (!sessionStorage.getItem('vmSeeded')) { sessionStorage.setItem('vmSeeded', '1'); localStorage.setItem('vm_settings', s); } }, JSON.stringify(settings));
  await page.goto(`${BASE_URL}/pages/video-maker.html`, { waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
}
const upload = page => page.setInputFiles('#vmOwnFile', { name: 'تلاوتي.wav', mimeType: 'audio/wav', buffer: REC.buf });

test('upload: the pauses give the split, the sheet fixes it, the length follows', async ({ page }) => {
  await open(page);
  // The toggle shows the upload panel; the reciter stays until a file is in.
  await page.locator('#vmSource [data-src="own"]').click();
  await expect(page.locator('#vmOwnBox')).toBeVisible();
  await expect(page.locator('#vmReciterBox')).toBeHidden();
  await expect(page.locator('#vmOwnPick')).toBeVisible();
  expect(await page.evaluate(() => VM.state.recSource)).toBe('reciter');
  await page.locator('#vmSource [data-src="reciter"]').click();
  await expect(page.locator('#vmReciterBox')).toBeVisible();
  await page.locator('#vmSource [data-src="own"]').click();
  await upload(page);
  // The sheet opens on its own to check the split.
  await expect(page.locator('#vmSyncSheet')).toHaveClass(/active/, { timeout: 30000 });
  await expect(page.locator('#vmSyncList .sync-row')).toHaveCount(8, { timeout: 30000 });   // 7 ayat + the end
  await expect(page.locator('#vmSyncStatus')).not.toHaveClass(/warn/);
  const times = await page.locator('#vmSyncList .sync-row input').evaluateAll(els => els.map(e => parseFloat(e.value)));
  REC.starts.forEach((s, i) => expect(Math.abs(times[i] - s)).toBeLessThan(0.45));
  expect(await page.evaluate(() => VM.state.recSource)).toBe('own');

  // Fix the third boundary by hand (the full list is under «كل الآيات»), then close.
  await page.locator('#vmSyncAll summary').click();
  await page.locator('#vmSyncList .sync-row[data-i="2"] input').fill('5.0');
  await page.locator('#vmSyncList .sync-row[data-i="2"] input').dispatchEvent('change');
  await expect(page.locator('#vmSyncList .sync-row[data-i="2"] input')).toHaveValue('5.0');
  await page.locator('#vmSyncDone').click();
  await expect(page.locator('#vmSyncSheet')).not.toHaveClass(/active/);
  await expect(page.locator('#vmOwnStatus')).toHaveClass(/ok/);

  // Shorts: the length is the recording from the first ayah to the end + lead-in + tail.
  const first = times[0], end = times[7];
  const expected = 0.5 + (end - first) + 1;
  await expect(page.locator('#vmDurValue')).not.toHaveText('…', { timeout: 20000 });
  const shown = (await page.textContent('#vmDurValue')).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).split(':');
  expect(Math.abs((+shown[0] * 60 + +shown[1]) - expected)).toBeLessThan(1.1);

  // It is remembered: after a reload the recording and its synced state are still there.
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  await expect(page.locator('#vmOwnBox')).toBeVisible();
  await expect(page.locator('#vmOwnName')).toHaveText('تلاوتي.wav');
  await expect(page.locator('#vmOwnStatus')).toHaveClass(/ok/);

  // A different range has no sync yet: it is split again, and marked for review.
  await page.fill('#vmTo', '5');
  await page.locator('#vmTo').dispatchEvent('change');
  await expect(page.locator('#vmOwnStatus')).toHaveClass(/warn/, { timeout: 30000 });

  // Delete: back to the reciter list.
  await page.locator('#vmOwnDel').click();
  await expect(page.locator('#vmReciterBox')).toBeVisible();
  await expect(page.locator('#vmOwnBox')).toBeHidden();
  expect(await page.evaluate(() => VM.state.recSource)).toBe('reciter');
});

test('the reciter name can be edited and is used instead of the reciter', async ({ page }) => {
  await open(page);
  await expect(page.locator('#vmSheikh')).toHaveAttribute('placeholder', /العفاسي/);
  await page.fill('#vmSheikh', 'الشيخ أحمد');
  expect(await page.evaluate(() => VM.state.sheikh)).toBe('الشيخ أحمد');
  // the caption on the Shorts video is drawn from it
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  await expect(page.locator('#vmSheikh')).toHaveValue('الشيخ أحمد');
  await page.fill('#vmSheikh', '');
  expect(await page.evaluate(() => VM.state.sheikh)).toBe('');
});

test('a long video is made from the uploaded recording', async ({ page }) => {
  await open(page, { mode: 'long', surah: 1, from: 1, to: 7, tvTemplate: 'moonlit' });
  const fast = await page.evaluate(() => !!(window.VideoEncoder && window.AudioEncoder));
  test.skip(!fast, 'no WebCodecs in this browser');
  await upload(page);
  await expect(page.locator('#vmSyncList .sync-row')).toHaveCount(8, { timeout: 30000 });
  await page.fill('#vmSheikh', 'تلاوتي بصوتي');     // while the sheet is open the page behind keeps its state
  await page.locator('#vmSyncDone').click();
  await expect(page.locator('#vmSyncSheet')).not.toHaveClass(/active/);
  // exact length, no «≈»: an own recording needs no estimate
  await expect(page.locator('#vmDurValue')).toHaveText(/^٠:٢[٢-٤]$/, { timeout: 20000 });
  await page.locator('#vmExport').click();
  await expect(page.locator('#vmResult')).toBeVisible({ timeout: 90000 });
  const bytes = await page.evaluate(async () => Array.from(new Uint8Array(await (await fetch(document.getElementById('vmVideo').src)).arrayBuffer())));
  const mp4 = Buffer.from(bytes);
  expect(mp4.indexOf('ftyp')).toBe(4);
  expect(mp4.indexOf('soun')).toBeGreaterThan(0);              // it has an audio track
  const d = mp4Duration(mp4);
  expect(d).toBeGreaterThan(22);
  expect(d).toBeLessThan(25);
});

test('Shorts: the preview and the recorded video use the uploaded recording', async ({ page }) => {
  test.setTimeout(90000);
  await open(page, { mode: 'short', surah: 1, from: 1, to: 2 });
  await page.setInputFiles('#vmOwnFile', { name: 'two.wav', mimeType: 'audio/wav', buffer: SHORT_REC.buf });
  await expect(page.locator('#vmSyncList .sync-row')).toHaveCount(3, { timeout: 30000 });   // 2 ayat + the end
  await page.locator('#vmSyncDone').click();
  await expect(page.locator('#vmSyncSheet')).not.toHaveClass(/active/);
  // 1.2 + 0.8 + 1.5 + a little around them, plus the lead-in and tail
  await expect(page.locator('#vmDurValue')).toHaveText(/^٠:٠[٥-٧]$/, { timeout: 20000 });

  // The preview plays and stops by itself at the end.
  await page.locator('#vmPreview').click();
  await expect(page.locator('#vmPreviewLabel')).toHaveText('إيقاف', { timeout: 20000 });
  await expect(page.locator('#vmPreviewLabel')).toHaveText('معاينة', { timeout: 30000 });

  // The recording is made in real time (about the length of the video).
  await page.locator('#vmExport').click();
  await expect(page.locator('#vmResult')).toBeVisible({ timeout: 60000 });
  const info = await page.evaluate(async () => {
    const v = document.getElementById('vmVideo');
    await new Promise(r => (v.readyState >= 1 ? r() : v.addEventListener('loadedmetadata', r, { once: true })));
    return { duration: v.duration, size: (await (await fetch(v.src)).blob()).size };
  });
  expect(info.size).toBeGreaterThan(10000);
  if (isFinite(info.duration)) { expect(info.duration).toBeGreaterThan(4); expect(info.duration).toBeLessThan(9); }
});

test('the timing sheet goes ayah by ayah to the end of the track', async ({ page }) => {
  test.setTimeout(90000);
  await open(page);
  await page.locator('#vmSource [data-src="own"]').click();
  await upload(page);
  await expect(page.locator('#vmSyncList .sync-row')).toHaveCount(8, { timeout: 30000 });   // 7 ayat + the end
  const focus = page.locator('#vmSyncFocusCount');
  const times = () => page.locator('#vmSyncList .sync-row input').evaluateAll(els => els.map(e => parseFloat(e.value)));
  const startTimes = await times();

  // It starts on the first ayah; «previous» is off there, and the button says what it will do.
  await expect(focus).toHaveText('الآية ١ من ٧');
  await expect(page.locator('#vmSyncPrev')).toBeDisabled();
  await expect(page.locator('#vmSyncMarkNextLabel')).toHaveText('الآية التالية تبدأ هنا');

  // «Next» moves the check on one ayah at a time, from its start.
  await page.locator('#vmSyncNext').click();
  await expect(focus).toHaveText('الآية ٢ من ٧');
  await expect(page.locator('#vmSyncFTime')).toHaveValue(startTimes[1].toFixed(1));
  await expect(page.locator('#vmSyncPlay')).toHaveText('⏸', { timeout: 10000 });          // it plays the ayah
  await page.locator('#vmSyncPrev').click();
  await expect(focus).toHaveText('الآية ١ من ٧');

  // «The next ayah starts here»: marks the NEXT ayah where the playhead is (snapped to the
  // pause before it), and the check moves on while the audio keeps playing.
  await page.locator('#vmSyncFromStart').click();
  await page.waitForTimeout(700);
  await page.locator('#vmSyncMarkNext').click();
  await expect(focus).toHaveText('الآية ٢ من ٧');
  const afterMark = await times();
  expect(afterMark[0]).toBeCloseTo(startTimes[0], 1);                       // the ayah before is untouched
  expect(afterMark[1]).toBeGreaterThan(afterMark[0]);
  expect(afterMark[2]).toBeGreaterThan(afterMark[1]);
  await expect(page.locator('#vmSyncStatus')).toHaveText('عُدّل التوقيت يدوياً');
  await page.locator('#vmSyncPlay').click();                                // pause

  // Moving an ayah later than the ones after it pushes them along: one pass never gets stuck.
  await page.locator('#vmSyncFTime').fill('12.0');
  await page.locator('#vmSyncFTime').dispatchEvent('change');
  const pushed = await times();
  expect(pushed[1]).toBeCloseTo(12.0, 1);
  for (let i = 2; i < pushed.length; i++) expect(pushed[i]).toBeGreaterThan(pushed[i - 1]);
  expect(pushed[7]).toBeGreaterThan(pushed[6]);                             // the end moved too

  // Step on to the last ayah: its button now marks the end; one more «next» reaches the end row,
  // and «next» there says «done» and closes the sheet.
  for (let k = 3; k <= 7; k++) await page.locator('#vmSyncNext').click();
  await expect(focus).toHaveText('الآية ٧ من ٧');
  await expect(page.locator('#vmSyncMarkNextLabel')).toHaveText('نهاية التلاوة هنا');
  await page.locator('#vmSyncNext').click();
  await expect(focus).toHaveText('نهاية التلاوة');
  await expect(page.locator('#vmSyncMarkNext')).toBeHidden();
  await expect(page.locator('#vmSyncNextLabel')).toHaveText('تم');
  await page.locator('#vmSyncNext').click();
  await expect(page.locator('#vmSyncSheet')).not.toHaveClass(/active/);
  await expect(page.locator('#vmOwnStatus')).toHaveClass(/ok/);
});

// One pause the auto split can't see (ayah 4 follows ayah 3 after 0.1 s) and a breath inside
// ayah 5 that it takes instead: fixing ayah 4 by hand puts the ayat after it right again.
const MISSED = recording([1.4, 2.2, 1.8, 3.0, 1.0, 1.4, 1.6, 4.0], [0.8, 0.8, 0.1, 0.8, 0.35, 0.8, 0.8]);
const TRUE_STARTS = [0, 1, 2, 3, 4, 6, 7].map(i => MISSED.starts[i]);     // MISSED.starts[5] is the breath

test('fixing one ayah syncs the ones after it; ayat placed by hand stay', async ({ page }) => {
  test.setTimeout(90000);
  await open(page);
  await page.locator('#vmSource [data-src="own"]').click();
  await page.setInputFiles('#vmOwnFile', { name: 'تلاوتي.wav', mimeType: 'audio/wav', buffer: MISSED.buf });
  await expect(page.locator('#vmSyncList .sync-row')).toHaveCount(8, { timeout: 30000 });
  const times = () => page.locator('#vmSyncList .sync-row input').evaluateAll(els => els.map(e => parseFloat(e.value)));
  const before = await times();
  expect(Math.abs(before[3] - TRUE_STARTS[3])).toBeGreaterThan(1);        // ayah 4 is wrong …
  expect(Math.abs(before[4] - TRUE_STARTS[4])).toBeGreaterThan(1);        // … and so is everything after it

  for (let k = 0; k < 3; k++) await page.locator('#vmSyncNext').click();
  await page.locator('#vmSyncPlay').click();                               // pause
  await expect(page.locator('#vmSyncFocusCount')).toHaveText('الآية ٤ من ٧');
  await page.locator('#vmSyncFTime').fill((TRUE_STARTS[3] - 0.1).toFixed(1));
  await page.locator('#vmSyncFTime').dispatchEvent('change');
  const after = await times();
  for (let i = 0; i < 3; i++) expect(after[i]).toBeCloseTo(before[i], 1);   // the ones before: untouched
  for (let i = 4; i < 7; i++) expect(Math.abs(after[i] - TRUE_STARTS[i])).toBeLessThan(0.35);
  await expect(page.locator('#vmSyncFollowNote')).toHaveText('ضُبطت الآيات ٥–٧ تلقائياً من هذه العلامة');

  // ayah 6 placed by hand: a later change to ayah 4 leaves it where it is
  await page.locator('#vmSyncNext').click();
  await page.locator('#vmSyncNext').click();
  await page.locator('#vmSyncPlay').click();
  await page.locator('#vmSyncFTime').fill((after[5] + 0.3).toFixed(1));
  await page.locator('#vmSyncFTime').dispatchEvent('change');
  const hand = (await times())[5];
  await page.locator('#vmSyncPrev').click();
  await page.locator('#vmSyncPrev').click();
  await page.locator('#vmSyncPlay').click();
  await page.locator('#vmSyncFPlus').click();
  expect((await times())[5]).toBeCloseTo(hand, 1);

  // «sync the following ayat» works them all out again from here, the hand-placed one too
  await page.locator('#vmSyncFollow').click();
  const again = await times();
  for (let i = 4; i < 7; i++) expect(Math.abs(again[i] - TRUE_STARTS[i])).toBeLessThan(0.35);

  // the split is kept, with what was placed by hand
  await page.locator('#vmSyncDone').click();
  await expect(page.locator('#vmSyncSheet')).not.toHaveClass(/active/);
  const kept = await page.evaluate(() => new Promise(res => {
    const r = indexedDB.open('vm-own-recitation');
    r.onsuccess = () => { const g = r.result.transaction('rec').objectStore('rec').get('meta'); g.onsuccess = () => res(Object.values(g.result.sync)[0]); };
  }));
  expect(kept.fixed).toEqual([3]);
  for (let i = 4; i < 7; i++) expect(Math.abs(kept.m[i] - TRUE_STARTS[i])).toBeLessThan(0.35);
});
