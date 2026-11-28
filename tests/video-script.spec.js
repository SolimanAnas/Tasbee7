// Video scripts (js/video-script.js): the whole «خاطرة» video from one text file — uploaded,
// pasted, or written by an AI from the template — with each line's time, font and size, the
// settings of the video, and stickers by number (pictures chosen after) or by id. Also: a
// sticker shown with a chosen text, the sticker pack as a ZIP, and the floating mini preview.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const S = require('../js/video-script.js');

const sec = (page, name) => expect(async () => {
  const tab = page.locator('#vmTab-' + name);
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click({ timeout: 2000 });
  await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 500 });
}).toPass({ timeout: 15000 });

// the picker folds away once a sticker is added: open it, then tap the picture
async function pick(page, id) {
  if ((await page.locator('#vmStPickToggle').getAttribute('aria-expanded')) !== 'true') await page.locator('#vmStPickToggle').click();
  await page.locator(`#vmStGrid [data-sticker="${id}"]`).click();
}
const BASE_URL = 'http://localhost:8080';
test.use({ serviceWorkers: 'block', viewport: { width: 412, height: 915 } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      if (sessionStorage.getItem('vmTestStarted')) return;
      sessionStorage.setItem('vmTestStarted', '1');
      // the floating mini preview (tested on its own in tests/video-script.spec.js) would sit over the controls
      localStorage.setItem('vmMiniMin', '1');
      localStorage.setItem('zad_lang', 'ar');
      localStorage.setItem('vm_settings', JSON.stringify({ mode: 'short', bg: 'g0', motion: false }));
    } catch { /* storage blocked */ }
  });
  await page.route(url => !url.href.startsWith(BASE_URL), route => route.abort());
});
async function open(page) {
  await page.goto(`${BASE_URL}/pages/video-maker.html`, { waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
}
// own words in «خاطرة», where the script box is
async function toTexts(page) {
  await sec(page, 'ayat');
  await page.locator('#vmModeTabs [data-mode="khatira"]').click();
  await page.locator('#vmKContent [data-kc="text"]').click();
  await expect(page.locator('#vmScBox')).toBeVisible();
}
const upload = (page, text, name = 'script.txt') => page.locator('#vmScFile').setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(text, 'utf8') });

const SCRIPT = [
  '# sticker 1: thinking   sticker 2: dua',
  '@font: cairo', '@size: 1.1', '@style: build', '@color: #f5e6b8', '@name: قناة الأثر',
  '',
  '[0:01 - 0:04] هل ضاقت بك الدنيا يوماً؟ <sticker 1 left fade>',
  '[0:05 - 0:09] فإن مع العسر يسراً {font: ruqaa, size: 1.3} <sticker 2>',
  '[0:09.5 - 0:13] ارفع يديك وقل يا رب <sticker 1 right> <sticker h05 top small>',
  '<sticker 2 all bottom float>',
].join('\n');

// How much of the sticker's white is in the lower part of the frame at second t of the video.
const lowWhite = (page, t) => page.evaluate(async t => {
  const tl = await VM.buildTimeline();
  const c = document.createElement('canvas'); c.width = 270; c.height = 480;
  const x = c.getContext('2d', { willReadFrequently: true });
  VM.renderFrame(x, 270, 480, t, tl);
  const d = x.getImageData(0, 300, 270, 180).data; let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] > 225 && d[i + 1] > 225 && d[i + 2] > 225) n++;
  return n;
}, t);

test('an uploaded script makes the video: texts with their times, fonts and sizes, its settings, numbered stickers to fill', async ({ page }) => {
  await open(page);
  await toTexts(page);
  await upload(page, SCRIPT);
  // the texts and what each one was given
  await expect(page.locator('#vmStatus')).toContainText('٣ أسطر');
  // numbered stickers wait for pictures: the stickers card is opened to choose them
  await expect(page.locator('#vmTab-look')).toHaveAttribute('aria-selected', 'true');
  const st = await page.evaluate(() => ({ texts: VM.state.kTexts, opts: VM.state.kOpts, kFont: VM.state.kFont, fontMul: VM.state.fontMul, kStyle: VM.state.kStyle, color: VM.state.color, sheikh: VM.state.sheikh, mode: VM.state.mode, kContent: VM.state.kContent }));
  expect(st.texts).toEqual(['هل ضاقت بك الدنيا يوماً؟', 'فإن مع العسر يسراً', 'ارفع يديك وقل يا رب']);
  expect(st.opts).toEqual([{ a: 1, b: 4 }, { a: 5, b: 9, font: 'ruqaa', size: 1.3 }, { a: 9.5, b: 13 }]);
  expect([st.kFont, st.fontMul, st.kStyle, st.color, st.sheikh, st.mode, st.kContent]).toEqual(['cairo', 1.1, 'build', '#f5e6b8', 'قناة الأثر', 'khatira', 'text']);
  // each text field shows its time / font / size
  await sec(page, 'ayat');
  await expect(page.locator('#vmKTexts .kt-opts').nth(1)).toContainText('0:05 – 0:09');
  await expect(page.locator('#vmKTexts .kt-opts').nth(1)).toContainText('×1.3');
  // the timeline keeps the script's seconds
  const tl = await page.evaluate(async () => (await VM.buildTimeline()).items.map(it => [it.start, it.end, it.font, it.size]));
  expect(tl).toEqual([[1, 4, null, null], [5, 9, 'ruqaa', 1.3], [9.5, 13, null, null]]);
  // the stickers: numbers 1 and 2 waiting for pictures, h05 already one
  await sec(page, 'look');
  await expect(page.locator('#vmStSlots')).toBeVisible();
  await expect(page.locator('#vmStSlotList .st-slot')).toHaveCount(2);
  await expect(page.locator('#vmStSlotList .st-slot.active')).toHaveAttribute('data-slot', '1');
  await expect(page.locator('#vmStSlotHint')).toContainText('ملصق ١');
  let sts = await page.evaluate(() => VM.state.stickers.map(s => [s.slot, s.id, s.line, s.fx]));
  expect(sts).toEqual([[1, null, 0, 'fade'], [2, null, 1, 'pop'], [1, null, 2, 'pop'], [null, 'h05', 2, 'pop'], [2, null, null, 'float']]);
  // before a picture is chosen a number draws nothing
  const none = await lowWhite(page, 2.5);
  // choose: number 1 -> f… the grid's tile; then number 2 is next
  await pick(page, 'h08');
  await expect(page.locator('#vmStSlotList .st-slot.active')).toHaveAttribute('data-slot', '2');
  await pick(page, 'h05');
  await expect(page.locator('#vmStSlotList .st-slot.active')).toHaveCount(0);
  await expect(page.locator('#vmStSlotHint')).toContainText('اختيرت كل الصور');
  sts = await page.evaluate(() => VM.state.stickers.map(s => [s.slot, s.id]));
  expect(sts).toEqual([[1, 'h08'], [2, 'h05'], [1, 'h08'], [null, 'h05'], [2, 'h05']]);
  // a number can be changed later: tap it, then another picture
  await page.locator('#vmStSlotList [data-slot="2"]').click();
  await pick(page, 'h06');
  expect(await page.evaluate(() => VM.state.stickers.filter(s => s.slot === 2).map(s => s.id))).toEqual(['h06', 'h06']);
  // each shows with its line: during line 1 more of the picture than before choosing it
  await expect.poll(() => lowWhite(page, 2.5)).toBeGreaterThan(none + 1500);
  // the line-1 sticker has gone by line 2 (only the whole-video one is left low on the frame)
  const l2 = await lowWhite(page, 7);
  const l1 = await lowWhite(page, 2.5);
  expect(l1).toBeGreaterThan(l2 + 800);
  // remembered
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  expect(await page.evaluate(() => [VM.state.kOpts[1], VM.state.stickers.length, VM.state.stickers[0].line])).toEqual([{ a: 5, b: 9, font: 'ruqaa', size: 1.3 }, 5, 0]);
});

test('a line\'s own font and size draw it differently; the × drops them', async ({ page }) => {
  await open(page);
  await toTexts(page);
  await upload(page, '[0:00 - 0:03] أ\n[0:03 - 0:06] الصبر مفتاح {font: jomhuria, size: 1.4}\n');
  await expect(page.locator('#vmStatus')).toContainText('سطران');
  const frame = () => page.evaluate(async () => {
    const tl = await VM.buildTimeline();
    const c = document.createElement('canvas'); c.width = 270; c.height = 480;
    const x = c.getContext('2d', { willReadFrequently: true });
    await document.fonts.ready;
    VM.renderFrame(x, 270, 480, 5, tl);
    const d = x.getImageData(0, 0, 270, 480).data; let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) n++;
    return n;
  });
  await page.waitForTimeout(500);
  const own = await frame();
  await sec(page, 'ayat');
  await page.locator('#vmKTexts .kt-opts-x').nth(1).click();
  expect(await page.evaluate(() => VM.state.kOpts)).toEqual([{ a: 0, b: 3 }, null]);
  await expect(page.locator('#vmKTexts .kt-opts')).toHaveCount(1);
  const plain = await frame();
  expect(Math.abs(own - plain)).toBeGreaterThan(plain * 0.15);
});

test('pasting a script (and subtitles), the warnings, replacing texts asks first; export reads back', async ({ page }) => {
  await open(page);
  await toTexts(page);
  await page.locator('#vmKText0').fill('نص قديم');
  await page.locator('#vmScPasteBtn').click();
  await expect(page.locator('#vmScPaste')).toBeVisible();
  // a declined replace changes nothing
  page.once('dialog', d => d.dismiss());
  await page.locator('#vmScText').fill('1\n00:00:01,000 --> 00:00:03,000\nسطر أول\n\n2\n00:00:03,500 --> 00:00:06,000\nسطر ثانٍ <sticker 9>\n');
  await page.locator('#vmScApply').click();
  expect(await page.evaluate(() => VM.state.kTexts)).toEqual(['نص قديم']);
  // accepted
  page.once('dialog', d => d.accept());
  await page.locator('#vmScApply').click();
  expect(await page.evaluate(() => VM.state.kTexts)).toEqual(['سطر أول', 'سطر ثانٍ']);
  await expect(page.locator('#vmScPaste')).toBeHidden();
  // warnings are listed
  await sec(page, 'ayat');
  page.once('dialog', d => d.accept());
  await page.locator('#vmScPasteBtn').click();
  await page.locator('#vmScText').fill('@font: comic\n@size: 9\n[0:05 - 0:02] بالمقلوب <sticker zz>\nسطر');
  await page.locator('#vmScApply').click();
  await expect(page.locator('#vmScWarn li')).toHaveCount(4);
  await expect(page.locator('#vmScWarn')).toContainText('comic');
  // nothing in it: says so
  await page.locator('#vmScPasteBtn').click();
  await page.locator('#vmScText').fill('# only a comment\n');
  await page.locator('#vmScApply').click();
  await expect(page.locator('#vmStatus')).toContainText('لا نص');
  // export: the video as a script, which reads back as the same video
  await page.locator('#vmScCancel').click();
  page.once('dialog', d => d.accept());
  await upload(page, SCRIPT);
  await expect(page.locator('#vmStatus')).toContainText('٣ أسطر');
  await expect(page.locator('#vmTab-look')).toHaveAttribute('aria-selected', 'true');
  await sec(page, 'ayat');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#vmScExport').click()]);
  expect(dl.suggestedFilename()).toBe('zad-video-script.txt');
  const text = fs.readFileSync(await dl.path(), 'utf8');
  const back = S.parse(text, { ids: ['h05'] });
  expect(back.lines).toEqual(S.parse(SCRIPT, { ids: ['h05'] }).lines);
  expect(back.settings).toMatchObject({ font: 'cairo', size: 1.1, style: 'build', color: '#f5e6b8', name: 'قناة الأثر' });
  // the stickers come back on their lines, numbers and sides (one alone stands large on the bottom edge)
  expect(back.stickers.map(s => [s.line, s.slot, s.x])).toEqual(S.parse(SCRIPT, { ids: ['h05'] }).stickers.map(s => [s.line, s.slot, s.x]));
});

test('the template for an AI: downloaded and copied, with the fonts, the size range and the stickers', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE_URL });
  await open(page);
  await toTexts(page);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#vmScTemplate').click()]);
  expect(dl.suggestedFilename()).toBe('zad-video-script-template.txt');
  const t = fs.readFileSync(await dl.path(), 'utf8');
  expect(t).toContain('INSTRUCTIONS FOR THE AI');
  for (const f of ['amiri', 'scheherazade', 'naskh', 'ruqaa', 'changa', 'cairo', 'jomhuria', 'gulzar']) expect(t).toMatch(new RegExp('#\\s+' + f + '\\s'));
  expect(t).toContain('from 0.7 (small) to 1.4 (large)');
  // every sticker described for the AI to pick from: what it shows, what it fits, its Arabic name
  expect(t).toContain('PICK THEM YOURSELF');
  expect(t).toContain('h01  Sitting on the floor against a cushion, hugging his knees, looking up. Fits: hope, waiting, quiet reflection, contentment.  ·  يتأمل السماء');
  expect(t).toContain('s22  In sujood on a prayer mat. Fits:');
  expect(t).toContain('s39  Headphones on. Fits:');
  expect((t.match(/^#\s{6}[hs]\d\d {2}.+ Fits: /gm) || []).length).toBe(49);
  // its example uploads as it is
  await upload(page, t);
  await expect(page.locator('#vmStatus')).toContainText('٥ أسطر');
  await expect(page.locator('#vmScWarn')).toBeHidden();
  // copied for pasting into an assistant
  await sec(page, 'ayat');
  await page.locator('#vmScCopy').click();
  await expect(page.locator('#vmStatus')).toContainText('نُسخ القالب');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(t);
});

test('a sticker shown with a chosen text (or set times), and the sticker pack as a ZIP', async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('w1')) { sessionStorage.setItem('w1', '1'); localStorage.setItem('vm_settings', JSON.stringify({ mode: 'khatira', kContent: 'text', bg: 'g0', motion: false, caption: false, kTexts: ['الأول هنا', 'والثاني هنا', 'والثالث'] })); } });
  await open(page);
  await sec(page, 'look');
  await pick(page, 'h03');
  const withSel = page.locator('#vmStWith');
  await expect(withSel.locator('option')).toHaveCount(4);
  await expect(withSel).toHaveValue('time');
  await expect(page.locator('#vmStTimes')).toBeVisible();
  await withSel.selectOption('1');
  expect(await page.evaluate(() => VM.state.stickers[0].line)).toBe(1);
  await expect(page.locator('#vmStTimes')).toBeHidden();
  // shown while the second text is, not with the first or the third
  const span = await page.evaluate(async () => (await VM.buildTimeline()).items.map(it => [it.start, it.end]));
  const mid = k => (span[k][0] + span[k][1]) / 2;
  const on = await lowWhite(page, mid(1)), off1 = await lowWhite(page, mid(0)), off3 = await lowWhite(page, mid(2));
  expect(on).toBeGreaterThan(1500);
  expect(off1).toBeLessThan(on * 0.05);
  expect(off3).toBeLessThan(on * 0.05);
  // back to set times: the line's own seconds, kept
  await withSel.selectOption('time');
  const s = await page.evaluate(() => VM.state.stickers[0]);
  expect(s.line).toBe(null);
  expect(s.from).toBeCloseTo(span[1][0], 0);
  expect(s.to).toBeCloseTo(span[1][1], 0);
  await expect(page.locator('#vmStTimes')).toBeVisible();
  // the pack
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#vmStPack').click()]);
  expect(dl.suggestedFilename()).toBe('zad-stickers.zip');
  const zip = fs.readFileSync(await dl.path());
  const end = zip.length - 22;
  expect(zip.readUInt32LE(end)).toBe(0x06054b50);
  expect(zip.readUInt16LE(end + 10)).toBe(50);                  // 49 pictures and the list
  expect(zip.length).toBeGreaterThan(2_000_000);
  expect(zip.includes(Buffer.from('zad-stickers/h01.webp'))).toBe(true);
  expect(zip.includes(Buffer.from('h05\tيدعو\tMaking dua'))).toBe(true);
  await expect(page.locator('#vmStatus')).toContainText('٤٩');
});

test('the floating mini preview: while the preview is out of view it shows the video live; a tap goes back; × shrinks it, a tap opens it again', async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('p1')) { sessionStorage.setItem('p1', '1'); localStorage.setItem('vmMiniMin', '0'); localStorage.setItem('vm_settings', JSON.stringify({ mode: 'khatira', kContent: 'text', bg: 'g0', motion: false, kTexts: ['الصبر مفتاح الفرج'] })); } });
  await open(page);
  await page.evaluate(() => scrollTo(0, 0));
  await expect(page.locator('#vmMini')).toBeHidden();
  await sec(page, 'text');
  await page.locator('#vmColors [data-color="#e6c068"]').scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await expect(page.locator('#vmMini')).toBeVisible();
  // it is the video's shape, and it follows a change at once
  const sample = () => page.evaluate(() => {
    const c = document.getElementById('vmMiniCanvas'), x = c.getContext('2d', { willReadFrequently: true });
    const d = x.getImageData(0, 0, c.width, c.height).data; let gold = 0, lit = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i] + d[i + 1] + d[i + 2] > 60) lit++; if (d[i] > 200 && d[i + 1] > 160 && d[i + 2] < 140) gold++; }
    return { w: c.width, h: c.height, lit, gold };
  });
  await expect.poll(async () => (await sample()).lit).toBeGreaterThan(1000);
  const a = await sample();
  expect(a.h / a.w).toBeCloseTo(16 / 9, 1);
  await page.locator('#vmColors [data-color="#e6c068"]').click();
  await expect.poll(async () => (await sample()).gold).toBeGreaterThan(a.gold + 30);
  // ▶ plays from the mini preview, and stops
  await page.locator('#vmMiniPlay').click();
  await expect(page.locator('#vmMini')).toHaveClass(/playing/, { timeout: 10000 });
  await page.locator('#vmMiniPlay').click();
  await expect(page.locator('#vmMini')).not.toHaveClass(/playing/, { timeout: 10000 });
  // a tap goes back up to the preview; then it hides
  await page.locator('#vmMiniView').click();
  await expect(page.locator('#vmMini')).toBeHidden({ timeout: 5000 });
  await expect(page.locator('#vmStage')).toBeInViewport({ ratio: 0.5 });
  // ×: shrinks to a round button (remembered); a tap on it brings the preview back
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await expect(page.locator('#vmMini')).toBeVisible();
  await page.locator('#vmMiniClose').click();
  await expect(page.locator('#vmMiniView')).toBeHidden();
  await expect(page.locator('#vmMiniOpen')).toBeVisible();
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  await sec(page, 'text');
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await expect(page.locator('#vmMiniOpen')).toBeVisible();
  await expect(page.locator('#vmMiniView')).toBeHidden();
  await page.locator('#vmMiniOpen').click();
  await expect(page.locator('#vmMiniView')).toBeVisible();
  await expect.poll(async () => (await sample()).lit).toBeGreaterThan(1000);     // live again
});

// quran.com, as in tests/khatira.spec.js: the timings (surah 1) and the MP3 with byte ranges
async function mockQuranCom(page) {
  const FIX = path.join(__dirname, 'fixtures', 'khatira');
  const META = fs.readFileSync(path.join(FIX, '1.json'), 'utf8'), file = fs.readFileSync(path.join(FIX, 'cbr.mp3'));
  await page.route(/api\.qurancdn\.com\/api\/qdc\/audio\/reciters\/\d+\/audio_files/, route => route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: META }));
  await page.route(/download\.quranicaudio\.com\/qdc\/.+\.mp3$/, route => {
    const h = { 'Content-Type': 'audio/mpeg', 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Content-Length, Content-Range', 'Accept-Ranges': 'bytes' };
    const m = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range || '');
    if (!m) return route.fulfill({ status: 200, headers: { ...h, 'Content-Length': String(file.length) }, body: file });
    const a = +m[1], b = Math.min(file.length - 1, m[2] ? +m[2] : file.length - 1);
    route.fulfill({ status: 206, headers: { ...h, 'Content-Range': `bytes ${a}-${b}/${file.length}`, 'Content-Length': String(b - a + 1) }, body: file.subarray(a, b + 1) });
  });
  return JSON.parse(META);
}

test('«آيات» in «الصوت»: a recitation under your own texts, the texts spread over it; a script picks it with @quran', async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('q1')) { sessionStorage.setItem('q1', '1'); localStorage.setItem('vm_settings', JSON.stringify({ mode: 'khatira', kContent: 'text', bg: 'g0', motion: false, surah: 1, from: 3, to: 5, kReciter: 7, kTexts: ['الحمد لله على كل حال', 'ونسأله العون'] })); } });
  await mockQuranCom(page);
  await open(page);
  await sec(page, 'audio');
  await expect(page.locator('#vmSource [data-src="quran"]')).toBeVisible();
  await expect(page.locator('#vmSource [data-src="reciter"]')).toHaveClass(/active/);          // «بدون صوت»
  await expect(page.locator('#vmReciterBox')).toBeHidden();
  await page.locator('#vmSource [data-src="quran"]').click();
  await expect(page.locator('#vmSource [data-src="quran"]')).toHaveClass(/active/);
  expect(await page.evaluate(() => [VM.state.ktAudio, VM.state.recSource, document.body.classList.contains('kt-quran')])).toEqual(['quran', 'reciter', true]);
  // the surah, its ayat and the reciter are here now, under the choice of sound
  await expect(page.locator('#vmKqBox #vmSurahField')).toBeVisible();
  await expect(page.locator('#vmKqBox #vmRangeRow')).toBeVisible();
  await expect(page.locator('#vmReciterBox')).toBeVisible();
  await expect(page.locator('#vmSurahLabel')).toContainText('الفاتحة');
  await expect(page.locator('.kt-silent')).toBeHidden();
  // the timeline: the recitation from the start, the two texts spread over it
  const tl = await page.evaluate(async () => {
    const t = await VM.buildTimeline();
    return { audio: t.audio.map(a => [a.start, a.dur, !!a.buffer]), items: t.items.map(it => [it.start, it.end, !!it.buffer]), total: t.total };
  });
  expect(tl.audio.length).toBe(1);
  const [start, dur, buf] = tl.audio[0];
  expect(buf).toBe(true);
  expect(dur).toBeGreaterThan(2);
  expect(tl.items.every(i => !i.buffer)).toBe(true);
  expect(tl.items[0][0]).toBeCloseTo(start, 1);
  expect(tl.items[1][1]).toBeCloseTo(start + dur, 0);                    // the texts end with the recitation
  expect(tl.items[1][1] - tl.items[1][0]).toBeLessThan(tl.items[0][1] - tl.items[0][0]);   // the shorter text, less time
  expect(tl.total).toBeGreaterThan(start + dur);
  // the preview plays it
  await page.evaluate(() => scrollTo(0, 0));
  await page.locator('#vmStagePlay').click();
  await expect(page.locator('#vmStagePlay')).toBeHidden({ timeout: 10000 });
  await page.locator('#vmStage').click({ position: { x: 20, y: 20 } });
  await expect(page.locator('#vmStagePlay')).toBeVisible({ timeout: 10000 });
  // «بدون صوت» again: the fields go back to «المحتوى» (hidden there for own words), no recitation
  await sec(page, 'audio');
  await page.locator('#vmSource [data-src="reciter"]').click();
  expect(await page.evaluate(() => [VM.state.ktAudio, document.body.classList.contains('kt-quran'), !!document.querySelector('#vmKqBox #vmSurahField')])).toEqual(['none', false, false]);
  await expect(page.locator('#vmSurahField')).toBeHidden();
  expect(await page.evaluate(async () => (await VM.buildTimeline()).audio)).toBeUndefined();
  // a script names the recitation; the export keeps it
  await sec(page, 'ayat');
  page.once('dialog', d => d.accept());
  await upload(page, '@quran: 1:4-5\n[0:00 - 0:03] مالك يوم الدين\nإياك نعبد');
  await expect(page.locator('#vmStatus')).toContainText('سطران');
  expect(await page.evaluate(() => [VM.state.ktAudio, VM.state.surah, VM.state.from, VM.state.to])).toEqual(['quran', 1, 4, 5]);
  expect(await page.evaluate(() => VM.currentScript())).toContain('@quran: 1:4-5');
  await sec(page, 'audio');
  await expect(page.locator('#vmSource [data-src="quran"]')).toHaveClass(/active/);
  await expect(page.locator('#vmFrom')).toHaveValue('4');
});

test('the mini preview can be dragged out of the way, and settles at the nearer side', async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('d2')) { sessionStorage.setItem('d2', '1'); localStorage.setItem('vmMiniMin', '0'); localStorage.setItem('vm_settings', JSON.stringify({ mode: 'khatira', kContent: 'text', bg: 'g0', motion: false, kTexts: ['نص'] })); } });
  await open(page);
  await sec(page, 'text');
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await expect(page.locator('#vmMini')).toBeVisible();
  const a = await page.locator('#vmMini').boundingBox();
  // RTL: it starts on the right
  expect(a.x).toBeGreaterThan(412 / 2);
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(120, 200, { steps: 8 });
  await page.mouse.up();
  const b = await page.locator('#vmMini').boundingBox();
  expect(b.x).toBeCloseTo(12, 0);                       // settled on the left
  expect(b.y).toBeLessThan(a.y - 100);
  // the drag was not a tap: the page did not scroll up to the preview
  await page.waitForTimeout(500);
  await expect(page.locator('#vmMini')).toBeVisible();
});
