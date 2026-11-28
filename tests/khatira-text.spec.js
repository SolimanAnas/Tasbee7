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
