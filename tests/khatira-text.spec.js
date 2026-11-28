// «خاطرة» with the user's own words: text fields (النص ١، النص ٢… «أضف نصاً»), shown word by
// word, timed to the user's recording (synced in the timing sheet like ayat) or, with no audio,
// each for as long as it takes to read.
const { test, expect } = require('@playwright/test');
// the settings are in tabs: open the one a control is on
const sec = (page, name) => expect(async () => {
  const tab = page.locator('#vmTab-' + name);
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click({ timeout: 2000 });
  await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 500 });
}).toPass({ timeout: 15000 });

const BASE_URL = 'http://localhost:8080';
test.use({ serviceWorkers: 'block', viewport: { width: 412, height: 915 } });

// a "recording": three bursts of voice, 0.9 s apart
function recording(voices) {
  const SR = 16000, HEAD = 0.5, GAP = 0.9;
  const total = HEAD + voices.reduce((a, b) => a + b, 0) + GAP * (voices.length - 1) + 1;
  const n = Math.round(total * SR), pcm = Buffer.alloc(n * 2);
  let t = HEAD;
  for (const v of voices) {
    const a = Math.round(t * SR), len = Math.round(v * SR);
    for (let i = 0; i < len; i++) pcm.writeInt16LE(Math.round(11000 * Math.min(1, i / 400, (len - i) / 400) * (0.6 + 0.4 * Math.sin(i / 700)) * Math.sin(i * 0.13)), (a + i) * 2);
    t += v + GAP;
  }
  const buf = Buffer.alloc(44 + pcm.length);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + pcm.length, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(pcm.length, 40);
  pcm.copy(buf, 44);
  return buf;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      if (sessionStorage.getItem('vmTestStarted')) return;
      sessionStorage.setItem('vmTestStarted', '1');
      localStorage.setItem('zad_lang', 'ar');
      localStorage.setItem('vm_settings', JSON.stringify({ mode: 'khatira', bg: 'g0' }));
      indexedDB.deleteDatabase('vm-own-recitation');
    } catch { /* storage blocked */ }
  });
  await page.route(url => !url.href.startsWith(BASE_URL), route => route.abort());
});
async function open(page) {
  await page.goto(`${BASE_URL}/pages/video-maker.html`, { waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
}
const field = (page, i) => page.locator('#vmKText' + i);

test('your own words: text fields, added and deleted, shown word by word without audio', async ({ page }) => {
  await open(page);
  // the content: your own words by default, the Quran controls out of the way
  await expect(page.locator('#vmTab-ayat')).toContainText('المحتوى');
  await expect(page.locator('#vmKContent [data-kc="text"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#vmSurahBtn')).toBeHidden();
  await expect(page.locator('#vmFrom')).toBeHidden();
  await expect(page.locator('.kt-row')).toHaveCount(1);
  await expect(page.locator('.kt-row .kt-label')).toHaveText('النص ١');
  await expect(page.locator('.kt-row .kt-del')).toHaveCount(0);            // the last one stays
  await field(page, 0).fill('الصبر مفتاح الفرج');
  await page.locator('#vmKTextAdd').click();
  await expect(page.locator('.kt-row')).toHaveCount(2);
  await expect(field(page, 1)).toBeFocused();
  await field(page, 1).fill('Patience is light');
  await page.locator('#vmKTextAdd').click();
  await field(page, 2).fill('والعاقبة للمتقين');
  await expect(page.locator('#vmSummary')).toContainText('٣ نصوص', { timeout: 5000 });
  // the timeline: each text for as long as it takes to read, its words one after the other
  const tl = await page.evaluate(async () => {
    const t = await VM.buildTimeline();
    return { items: t.items.map(it => ({ text: it.text, audio: !!it.buffer, words: it.words.map(w => w.text), start: it.start, end: it.end })),
      shown: t.items.flatMap(it => it.words).map(w => VM.khatiraWordAt((w.a + w.b) / 2).text) };
  });
  expect(tl.items.map(i => i.text)).toEqual(['الصبر مفتاح الفرج', 'Patience is light', 'والعاقبة للمتقين']);
  expect(tl.items.every(i => !i.audio)).toBe(true);
  expect(tl.shown).toEqual(['الصبر', 'مفتاح', 'الفرج', 'Patience', 'is', 'light', 'والعاقبة', 'للمتقين']);
  for (let i = 1; i < 3; i++) expect(tl.items[i].start).toBeCloseTo(tl.items[i - 1].end, 5);
  // delete the middle one
  await page.locator('.kt-row').nth(1).locator('.kt-del').click();
  await expect(page.locator('.kt-row')).toHaveCount(2);
  await expect(field(page, 1)).toHaveValue('والعاقبة للمتقين');
  await expect(page.locator('.kt-row').nth(1).locator('.kt-label')).toHaveText('النص ٢');
  // remembered
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  await expect(field(page, 0)).toHaveValue('الصبر مفتاح الفرج');
  await expect(field(page, 1)).toHaveValue('والعاقبة للمتقين');
  // ayat instead: the Quran controls are back, the fields go
  await page.locator('#vmKContent [data-kc="quran"]').click();
  await expect(page.locator('#vmSurahBtn')).toBeVisible();
  await expect(page.locator('.kt-row').first()).toBeHidden();
  await expect(page.locator('#vmTab-ayat')).toContainText('المحتوى');
});

// What the video shows at a moment, from the frame itself. «Text» = a pixel that is whitish (the
// text, also at half strength) or gold (the word being recited) over the dark green gradient.
const textMask = (page, style, seg, words) => page.evaluate(async ([style, seg, words]) => {
  VM.state.kStyle = style;
  const tl = await VM.buildTimeline();
  const c = document.createElement('canvas'); c.width = 540; c.height = 960;
  const x = c.getContext('2d', { willReadFrequently: true });
  return words.map(wi => {
    const w = tl.items[seg].words[wi];
    VM.renderFrame(x, 540, 960, w.a + 0.3, tl);
    const d = x.getImageData(0, 0, 540, 960).data;
    const mask = new Uint8Array(540 * 960);
    let gold = 0, gx = 0;
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (r > 105 && g > 105 && b > 105) mask[j] = 1;
      else if (r > 200 && g > 160 && b < 140) { mask[j] = 1; gold++; gx += j % 540; }
    }
    return { mask, gold, goldX: gold ? gx / gold : 0 };
  }).reduce((acc, m, i) => { acc.push(m); return acc; }, []).map(m => ({ n: m.mask.reduce((n, v) => n + v, 0), gold: m.gold, goldX: m.goldX, mask: Array.from(m.mask.keys()).filter(k => m.mask[k]) }));
}, [style, seg, words]);
const overlap = (A, B) => {
  const sb = new Set(B.mask);
  let inter = 0;
  for (const k of A.mask) if (sb.has(k)) inter++;
  return { inter: inter / A.n, jaccard: inter / (A.n + B.n - inter) };
};

test('the whole line shows, the word being recited lit; or words appear as recited; or one at a time', async ({ page }) => {
  await open(page);
  await field(page, 0).fill('الصبر مفتاح الفرج وبعد العسر يسر');
  await expect(page.locator('#vmSummary')).toContainText('نص واحد', { timeout: 5000 });
  await sec(page, 'text');
  // the way to show it: the whole line is the default
  await expect(page.locator('#vmKStyle [data-ks="line"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => VM.state.kStyle)).toBe('line');
  // 6 words. Whole line: the same text is in place at the first and at the last word, and the lit word moves
  const [l0, l5] = await textMask(page, 'line', 0, [0, 5]);
  expect(overlap(l0, l5).jaccard).toBeGreaterThan(0.8);
  expect(l0.gold).toBeGreaterThan(300);
  expect(l5.gold).toBeGreaterThan(300);
  expect(l5.goldX).toBeLessThan(l0.goldX - 60);                 // right to left along the line
  // one at a time: a different word each time
  const [w0, w5] = await textMask(page, 'word', 0, [0, 5]);
  expect(overlap(w0, w5).jaccard).toBeLessThan(0.3);
  expect(w0.gold).toBe(0);
  // build: what was there stays, and more comes
  const [b0, b5] = await textMask(page, 'build', 0, [0, 5]);
  expect(overlap(b0, b5).inter).toBeGreaterThan(0.9);
  expect(b5.n).toBeGreaterThan(b0.n * 2.2);
  // and the whole line is wider than one word
  expect(l0.n).toBeGreaterThan(b0.n * 2.2);
  // the buttons choose
  await page.locator('#vmKStyle [data-ks="word"]').click();
  await expect(page.locator('#vmKStyle [data-ks="word"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => VM.state.kStyle)).toBe('word');
  await page.reload({ waitUntil: 'load' });                                    // remembered
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  expect(await page.evaluate(() => VM.state.kStyle)).toBe('word');
});

test('a long text is laid out in lines at a readable size, and paged when it would not fit', async ({ page }) => {
  await open(page);
  const short = 'الصبر مفتاح الفرج';
  const long = Array.from({ length: 40 }, () => 'ربنا آتنا في الدنيا حسنة وفي الآخرة حسنة وقنا عذاب النار').join(' ');   // 400+ words
  await field(page, 0).fill(short);
  await page.locator('#vmKTextAdd').click();
  await field(page, 1).fill(long);
  await expect(page.locator('#vmSummary')).toContainText('نصان', { timeout: 5000 }).catch(() => {});
  // large text with airy lines (the 400 characters of a field fit one page at the default spacing)
  const L = await page.evaluate(async () => { VM.state.fontMul = 1.4; VM.state.lineGap = 2.2; await VM.buildTimeline(); return [VM.khatiraLayout(0, 540, 960), VM.khatiraLayout(1, 540, 960)]; });
  expect(L[0].pages.length).toBe(1);
  expect(L[0].size).toBeGreaterThan(540 * 0.09);                               // a short text is large
  expect(L[1].pages.length).toBeGreaterThan(1);                                // a long one is paged
  expect(L[1].size).toBeGreaterThanOrEqual(540 * 0.055 - 0.01);                // never smaller than readable
  expect(L[1].pages.every(p => p.length <= 12)).toBe(true);
  // the page shown follows the word: the first and the last word of the long text both draw text
  const ink = await page.evaluate(async () => {
    const tl = await VM.buildTimeline();
    const ws = tl.items[1].words;
    const c = document.createElement('canvas'); c.width = 540; c.height = 960;
    const x = c.getContext('2d', { willReadFrequently: true });
    const n = i => { VM.renderFrame(x, 540, 960, ws[i].a + 0.3, tl); const d = x.getImageData(0, 0, 540, 960).data; let k = 0; for (let j = 0; j < d.length; j += 4) if ((d[j] > 105 && d[j + 1] > 105 && d[j + 2] > 105) || (d[j] > 200 && d[j + 1] > 160 && d[j + 2] < 140)) k++; return k; };
    return [n(0), n(Math.floor(ws.length / 2)), n(ws.length - 1)];
  });
  ink.forEach(v => expect(v).toBeGreaterThan(2000));
});

test('your own words timed to your recording, synced like ayat', async ({ page }) => {
  test.setTimeout(90000);
  await open(page);
  await field(page, 0).fill('الحمد لله على كل حال');
  await page.locator('#vmKTextAdd').click();
  await field(page, 1).fill('ما أجمل الصبر');
  await page.locator('#vmKTextAdd').click();
  await field(page, 2).fill('والفرج قريب');
  await sec(page, 'audio');
  await expect(page.locator('#vmSource [data-src="reciter"]')).toContainText('بدون صوت');
  await expect(page.locator('#vmReciterBox')).toBeHidden();
  await page.locator('#vmSource [data-src="own"]').click();
  await page.locator('#vmSheikh').fill('أبو عبد الله');
  await page.setInputFiles('#vmOwnFile', { name: 'خاطرتي.wav', mimeType: 'audio/wav', buffer: recording([1.6, 1.2, 1.0]) });
  // the timing sheet: one row per text, «النص ١ من ٣»
  await expect(page.locator('#vmSyncList .sync-row')).toHaveCount(4, { timeout: 30000 });
  await expect(page.locator('#vmSyncSheetTitle')).toHaveText('ضبط توقيت الصوت');           // not «الآيات»: it is the audio
  await expect(page.locator('#vmSyncFocusCount')).toHaveText('النص ١ من ٣');
  await expect(page.locator('#vmSyncFocusText')).toHaveText('الحمد لله على كل حال');
  await page.locator('#vmSyncDone').click();
  await expect(page.locator('#vmSyncSheet')).not.toHaveClass(/active/);
  const tl = await page.evaluate(async () => {
    const t = await VM.buildTimeline();
    return t.items.map(it => ({ audio: !!it.buffer, off: it.offset, dur: it.dur, words: it.words.length, first: it.words[0].a - it.start }));
  });
  expect(tl.map(i => i.words)).toEqual([5, 3, 2]);
  expect(tl.every(i => i.audio)).toBe(true);
  // each text sits on its burst of voice (0.5 s, 3.0 s, 5.1 s in)
  [0.5, 3.0, 5.1].forEach((s, i) => expect(Math.abs(tl[i].off - (s - 0.15))).toBeLessThan(0.3));
});

test('a video of your own words is made (no audio)', async ({ page }) => {
  test.setTimeout(90000);
  await open(page);
  const canRecord = await page.evaluate(() => !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream));
  test.skip(!canRecord, 'no MediaRecorder');
  await field(page, 0).fill('كن جميلاً ترَ الوجود جميلاً');
  await page.locator('#vmExport').click();
  await expect(page.locator('#vmResult')).toBeVisible({ timeout: 60000 });
  const size = await page.evaluate(async () => (await (await fetch(document.getElementById('vmVideo').src)).blob()).size);
  expect(size).toBeGreaterThan(10000);
  expect(await page.locator('#vmDownload').getAttribute('download')).toMatch(/^khatira-\d{8}-\d{4}\./);
});
