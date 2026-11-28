// «خاطرة»: the recitation word by word. quran.com's word timings and the surah's MP3 are mocked
// (tests/fixtures/khatira: a recording with one tone per «word», at the times its 1.json says).
// Only the seconds of the chosen ayat are fetched from a constant-bitrate file (a byte range),
// and each word must start where its tone does in what is decoded.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
// the settings are in tabs (الآيات / الصوت / المظهر / النص): open the one a control is on
const sec = (page, name) => expect(async () => {
  const tab = page.locator('#vmTab-' + name);
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click({ timeout: 2000 });
  await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 500 });
}).toPass({ timeout: 15000 });

const BASE_URL = 'http://localhost:8080';
const FIX = path.join(__dirname, 'fixtures', 'khatira');
const META = fs.readFileSync(path.join(FIX, '1.json'), 'utf8');
test.use({ serviceWorkers: 'block', viewport: { width: 412, height: 915 } });

// quran.com: the timings, and the MP3 with byte ranges (like the real server)
async function mockQuranCom(page, mp3) {
  const file = fs.readFileSync(path.join(FIX, mp3));
  const log = { meta: 0, ranges: [], whole: 0 };
  await page.route(/api\.qurancdn\.com\/api\/qdc\/audio\/reciters\/\d+\/audio_files/, route => {
    log.meta++;
    route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: META });
  });
  await page.route(/download\.quranicaudio\.com\/qdc\/.+\.mp3$/, route => {
    const h = { 'Content-Type': 'audio/mpeg', 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Content-Length, Content-Range', 'Accept-Ranges': 'bytes' };
    const m = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range || '');
    if (!m) { log.whole++; return route.fulfill({ status: 200, headers: { ...h, 'Content-Length': String(file.length) }, body: file }); }
    const a = +m[1], b = Math.min(file.length - 1, m[2] ? +m[2] : file.length - 1);
    log.ranges.push([a, b]);
    route.fulfill({ status: 206, headers: { ...h, 'Content-Range': `bytes ${a}-${b}/${file.length}`, 'Content-Length': String(b - a + 1) }, body: file.subarray(a, b + 1) });
  });
  return { log, size: file.length };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      if (sessionStorage.getItem('vmTestStarted')) return;
      sessionStorage.setItem('vmTestStarted', '1');
      localStorage.setItem('zad_lang', 'ar');
      localStorage.setItem('vm_settings', JSON.stringify({ mode: 'khatira', kContent: 'quran', surah: 1, from: 3, to: 5, kReciter: 7, bg: 'g0' }));
    } catch { /* storage blocked */ }
  });
  await page.route(url => !url.href.startsWith(BASE_URL) && !/qurancdn|quranicaudio/.test(url.href), route => route.abort());
});
async function open(page) {
  await page.goto(`${BASE_URL}/pages/video-maker.html`, { waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  await expect(page.locator('#vmModeTabs [data-mode="khatira"]')).toHaveAttribute('aria-selected', 'true');
}

// For every word: the loudness of the decoded clip just after its start, and just before it.
const alignment = page => page.evaluate(async () => {
  const tl = await VM.buildTimeline();
  const out = [];
  for (const it of tl.items) {
    const b = it.buffer, d = b.getChannelData(0), sr = b.sampleRate;
    const rms = (t0, t1) => { let s = 0, n = 0; for (let i = Math.max(0, Math.round(t0 * sr)); i < Math.min(d.length, Math.round(t1 * sr)); i++) { s += d[i] * d[i]; n++; } return Math.sqrt(s / Math.max(1, n)); };
    const at = t => it.offset + (t - it.start);           // video time -> second of the decoded clip
    for (const w of it.words) out.push({ text: w.text, after: rms(at(w.a) + 0.03, at(w.a) + 0.12), before: rms(at(w.a) - 0.15, at(w.a) - 0.06) });
  }
  return out;
});

for (const [mp3, ranged] of [['cbr.mp3', true], ['cbr-notag.mp3', true], ['vbr.mp3', false]]) {
  test(`word timings line up with the audio (${mp3})`, async ({ page }) => {
    const q = await mockQuranCom(page, mp3);
    await open(page);
    const words = await alignment(page);
    expect(words.length).toBe(9);                           // al-Fatihah 3–5: 2 + 3 + 4 words
    // the words are the app's own Quran text, ayah by ayah
    const text = await page.evaluate(() => VM.timeline.items.flatMap(it => Khatira.wordsOf(it.text)));
    expect(words.map(w => w.text)).toEqual(text);
    for (const w of words) {
      expect(w.after, w.text + ': its tone has begun').toBeGreaterThan(0.1);
      expect(w.before, w.text + ': silence just before').toBeLessThan(0.05);
    }
    if (ranged) {
      expect(q.log.whole).toBe(0);
      const head = q.log.ranges.filter(([a]) => a === 0), clip = q.log.ranges.filter(([a]) => a > 0);
      expect(head.length).toBe(1);
      expect(head[0][1]).toBeLessThan(16384);                   // just the header
      expect(clip.length).toBe(1);
      expect(clip[0][0]).toBeGreaterThan(q.size * 0.2);         // from the middle of the file …
      expect(clip[0][1] - clip[0][0]).toBeLessThan(q.size * 0.7); // … only the seconds needed
    } else {
      expect(q.log.whole).toBe(1);                              // variable bitrate: fetched whole
    }
  });
}

test('the word on screen is the one being recited', async ({ page }) => {
  await mockQuranCom(page, 'cbr.mp3');
  await open(page);
  const r = await page.evaluate(async () => {
    VM.state.kStyle = 'word';                                   // one word at a time: each frame is the word itself
    const tl = await VM.buildTimeline();
    const all = tl.items.flatMap(it => it.words);
    const c = document.createElement('canvas'); c.width = 270; c.height = 480;
    const x = c.getContext('2d');
    const shot = t => { VM.renderFrame(x, 270, 480, t, tl); return x.getImageData(0, 0, 270, 480).data; };
    const diff = (A, B) => { let s = 0; for (let i = 0; i < A.length; i += 4) s += Math.abs(A[i] - B[i]); return s / (A.length / 4); };
    const mid = w => (w.a + w.b) / 2;
    return {
      shown: all.map(w => VM.khatiraWordAt(mid(w)).text),
      want: all.map(w => w.text),
      before: VM.khatiraWordAt(all[0].a - 0.2),
      // a frame in word 2 and in word 3 differ; two frames in word 2 do not (much)
      change: diff(shot(mid(all[1])), shot(mid(all[2]))),
      same: diff(shot(mid(all[1])), shot(mid(all[1]) + 0.05)),
      order: all.every((w, i) => i === 0 || w.a >= all[i - 1].a),
    };
  });
  expect(r.shown).toEqual(r.want);
  expect(r.before).toBeNull();
  expect(r.order).toBe(true);
  expect(r.change).toBeGreaterThan(r.same * 3 + 0.5);
});

test('the tab: its reciters, its faces, and the Shorts controls it shares', async ({ page }) => {
  await mockQuranCom(page, 'cbr.mp3');
  await open(page);
  await expect(page.locator('#vmBasmalaRow')).toBeHidden();               // no timings for it
  await sec(page, 'audio');
  await expect(page.locator('#vmReciterBox .kh-note')).toBeVisible();
  await page.locator('#vmReciterBtn').click();
  await expect(page.locator('#vmReciterList [data-kreciter]')).toHaveCount(await page.evaluate(() => Khatira.RECITERS.length));
  await page.locator('#vmReciterList [data-kreciter="9"]').click();
  await expect(page.locator('#vmReciterLabel')).toContainText('المنشاوي');
  expect(await page.evaluate(() => VM.state.kReciter)).toBe(9);
  // the faces: one per button, the chosen one drawn
  await sec(page, 'text');
  await expect(page.locator('#vmKFonts [data-kfont]')).toHaveCount(await page.evaluate(() => Khatira.FONTS.length));
  await expect(page.locator('#vmKFonts .kf-add')).toBeVisible();
  const frame = () => page.evaluate(() => { const c = document.getElementById('vmCanvas'); return c.toDataURL('image/png').length; });
  const before = await frame();
  await page.locator('#vmKFonts [data-kfont="scheherazade"]').click();
  await expect(page.locator('#vmKFonts [data-kfont="scheherazade"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(frame).not.toBe(before);
  await expect(page.locator('#vmPanel')).toBeHidden();                    // one word needs no panel
  // shared with Shorts: the backgrounds
  await sec(page, 'look');
  await expect(page.locator('#vmBgs .bg-add')).toBeVisible();
  // remembered
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#vmModeTabs [data-mode="khatira"]')).toHaveAttribute('aria-selected', 'true');
  expect(await page.evaluate(() => [VM.state.kFont, VM.state.kReciter])).toEqual(['scheherazade', 9]);
  // the other tabs still read their own reciters
  await page.locator('#vmModeTabs [data-mode="short"]').click();
  await sec(page, 'audio');
  await expect(page.locator('#vmReciterLabel')).not.toContainText('المنشاوي');
});

test('a face without the Uthmani marks gets the word as in common print; the mushaf face keeps it', async ({ page }) => {
  await mockQuranCom(page, 'cbr.mp3');
  await open(page);
  await sec(page, 'text');
  const word = 'نَسۡتَعِينُ', tanween = 'هُدٗى';
  await page.locator('#vmKFonts [data-kfont="cairo"]').click();
  expect(await page.evaluate(([w, t]) => [VM.kText(w), VM.kText(t)], [word, tanween])).toEqual(['نَسْتَعِينُ', 'هُدًى']);
  await page.locator('#vmKFonts [data-kfont="amiri"]').click();
  expect(await page.evaluate(([w, t]) => [VM.kText(w), VM.kText(t)], [word, tanween])).toEqual([word, 'هُد\u08F0ى']);
  await page.locator('#vmKFonts [data-kfont="hafs"]').click();
  expect(await page.evaluate(([w, t]) => [VM.kText(w), VM.kText(t)], [word, tanween])).toEqual([word, tanween]);
});

test('a font from the device: added, used, remembered, deleted; a wrong file is refused', async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('f1')) { sessionStorage.setItem('f1', '1'); indexedDB.deleteDatabase('vm-user-fonts'); } });
  await mockQuranCom(page, 'cbr.mp3');
  await open(page);
  await sec(page, 'text');
  const before = await page.locator('#vmKFonts [data-kfont]').count();
  // a file that is not a font
  await page.setInputFiles('#vmKFontFile', { name: 'notes.ttf', mimeType: 'font/ttf', buffer: Buffer.from('not a font at all') });
  await expect(page.locator('#vmStatus')).toContainText('تعذّر فتح ملف الخط');
  await expect(page.locator('#vmKFonts [data-kfont]')).toHaveCount(before);
  // a real one (a TrueType face that lacks the Uthmani marks)
  await page.setInputFiles('#vmKFontFile', { name: 'خطي الجميل.ttf', mimeType: 'font/ttf', buffer: fs.readFileSync(path.join(__dirname, '..', 'fonts', 'Changa-Variable.ttf')) });
  await expect(page.locator('#vmKFonts [data-kfont]')).toHaveCount(before + 1);
  const tile = page.locator('#vmKFonts .is-user');
  await expect(tile).toContainText('خطي الجميل');
  await expect(tile).toHaveAttribute('aria-pressed', 'true');                  // chosen at once
  expect(await page.evaluate(() => VM.state.kFont)).toMatch(/^u:/);
  expect(await page.evaluate(() => VM.kText('نَسۡتَعِينُ'))).toBe('نَسْتَعِينُ');   // read: it has no ۡ
  // kept on the device
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  await sec(page, 'text');
  await expect(page.locator('#vmKFonts .is-user')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => VM.userFonts.map(u => [u.name, u.known]))).toEqual([['خطي الجميل', true]]);
  // deleted: gone, and the words go back to the first face
  await page.locator('#vmKFonts .is-user .kf-del').click();
  await expect(page.locator('#vmKFonts .is-user')).toHaveCount(0);
  expect(await page.evaluate(() => VM.state.kFont)).toBe('amiri');
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  expect(await page.evaluate(() => VM.userFonts.length)).toBe(0);
});

test('a khatira video is made', async ({ page }) => {
  test.setTimeout(90000);
  await page.addInitScript(() => { if (!sessionStorage.getItem('k2')) { sessionStorage.setItem('k2', '1'); localStorage.setItem('vm_settings', JSON.stringify({ mode: 'khatira', kContent: 'quran', surah: 1, from: 3, to: 4, kReciter: 7, bg: 'g0' })); } });
  await mockQuranCom(page, 'cbr.mp3');
  await open(page);
  const canRecord = await page.evaluate(() => !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream));
  test.skip(!canRecord, 'no MediaRecorder');
  await page.locator('#vmExport').click();
  await expect(page.locator('#vmResult')).toBeVisible({ timeout: 60000 });
  const size = await page.evaluate(async () => (await (await fetch(document.getElementById('vmVideo').src)).blob()).size);
  expect(size).toBeGreaterThan(10000);
  expect(await page.locator('#vmDownload').getAttribute('download')).toMatch(/^quran-khatira-001-3-4\./);
});
