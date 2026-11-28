// «عرض الآية» (Shorts): the ayah whole, line by line or word by word, as it is recited — exact for
// the reciters quran.com has word timings for, else cut at its stopping marks and matched to the
// pauses in the recitation. Also: the text's height slider, and the mini preview that floats
// wherever it is dragged.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const K = require('../js/khatira.js');
const sec = (page, name) => expect(async () => {
  const tab = page.locator('#vmTab-' + name);
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click({ timeout: 2000 });
  await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 500 });
}).toPass({ timeout: 15000 });

const BASE_URL = 'http://localhost:8080';
const FIX = path.join(__dirname, 'fixtures', 'khatira');
const QPC = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'quran-qpc.json'), 'utf8')).surahs;
test.use({ serviceWorkers: 'block', viewport: { width: 412, height: 915 } });

async function open(page, settings) {
  await page.addInitScript(st => {
    if (sessionStorage.getItem('a')) return;
    sessionStorage.setItem('a', '1');
    localStorage.setItem('zad_lang', 'ar');
    localStorage.setItem('vmMiniMin', '1');
    localStorage.setItem('vm_settings', JSON.stringify(Object.assign({ mode: 'short', bg: 'g0', motion: false, miniPreview: false, caption: false }, st)));
  }, settings);
  await page.route(url => !url.href.startsWith(BASE_URL) && !/qurancdn|quranicaudio|everyayah/.test(url.href), route => route.abort());
  await page.goto(`${BASE_URL}/pages/video-maker.html`, { waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
}
// quran.com: the timings of surah 1 and its MP3 (as in tests/khatira.spec.js)
async function mockQuranCom(page) {
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
// A recitation: a tone for each phrase (as long as its letters), a pause between them.
function recitation(spans, rate = 8000) {
  const total = spans[spans.length - 1][1] + 0.4, n = Math.round(total * rate), buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const t = i / rate, on = spans.some(([a, b]) => t >= a && t < b);
    const v = on ? Math.sin(2 * Math.PI * 220 * t) * 0.5 * (0.7 + 0.3 * Math.sin(2 * Math.PI * 3 * t)) : (Math.random() - 0.5) * 0.002;
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}
// the recited word's gold in a frame of the video (the line view lights it)
const goldAt = (page, t) => page.evaluate(async t => {
  const tl = await VM.buildTimeline();
  const c = document.createElement('canvas'); c.width = 540; c.height = 960;
  const x = c.getContext('2d', { willReadFrequently: true });
  VM.renderFrame(x, 540, 960, t, tl);
  const d = x.getImageData(0, 0, 540, 960).data;
  let gold = 0, white = 0, minX = 540, maxX = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] > 220 && d[i + 1] > 170 && d[i + 1] < 235 && d[i + 2] < 140) gold++;
    if (d[i] > 225 && d[i + 1] > 225 && d[i + 2] > 225) white++;
    // any text, the dimmed words of the line too
    if (d[i] > 110 && d[i + 1] > 110 && d[i + 2] > 100) { const px = (i / 4) % 540; if (px < minX) minX = px; if (px > maxX) maxX = px; }
  }
  return { gold, white, span: maxX - minX };
}, t);

test('a reciter with word timings: every word exactly, from quran.com; line by line lights the word, word by word shows one', async ({ page }) => {
  const meta = await mockQuranCom(page);
  await open(page, { surah: 1, from: 2, to: 4, reciter: 'afasy', basmala: false, ayahView: 'line' });
  await sec(page, 'text');
  await expect(page.locator('#vmAyahView [data-av="line"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#vmAvNoteText')).toContainText('توقيت دقيق لكل كلمة');
  // the reciter says so
  await sec(page, 'audio');
  await expect(page.locator('#vmReciterLabel .rc-exact')).toHaveText('⏱ كلمة بكلمة');
  const tl = await page.evaluate(async () => { const t = await VM.buildTimeline(); return { exact: !!t.exact, items: t.items.map(it => ({ ayah: it.ayah, sync: it.sync, words: it.words.map(w => [w.a, w.b]) })) }; });
  expect(tl.exact).toBe(true);
  // the words' times are quran.com's, shifted onto the video
  const v2 = K.parseMeta(meta).verses[2], ws2 = K.wordsOf(QPC[0][1]), wt2 = K.wordTimes(ws2, v2);
  const shift = tl.items[0].words[0][0] - wt2[0].a / 1000;
  tl.items[0].words.forEach(([a], k) => expect(a).toBeCloseTo(wt2[k].a / 1000 + shift, 3));
  expect(tl.items.map(i => i.sync)).toEqual(['exact', 'exact', 'exact']);
  // line by line: during a word, its gold; nothing lit before the first
  const mid = (tl.items[1].words[1][0] + tl.items[1].words[1][1]) / 2;
  const lit = await goldAt(page, mid + 0.12);
  expect(lit.gold).toBeGreaterThan(150);
  // word by word: one word at a time (narrower than the line)
  await sec(page, 'text');
  await page.locator('#vmAyahView [data-av="word"]').click();
  expect(await page.evaluate(() => VM.state.ayahView)).toBe('word');
  const one = await goldAt(page, mid + 0.3), line = lit;
  expect(one.white).toBeGreaterThan(200);
  expect(one.span).toBeLessThan(line.span);
  // whole: as before (no word times needed)
  await page.locator('#vmAyahView [data-av="full"]').click();
  await expect(page.locator('#vmAvNote')).toBeHidden();
  expect(await page.evaluate(async () => !!(await VM.buildTimeline()).items[0].words)).toBe(false);
});

test('any other reciter: the ayah cut at its stopping marks, each phrase where the reciter starts it', async ({ page }) => {
  // Ayat al-Kursi: nine phrases; the recitation pauses between them
  const ws = K.wordsOf(QPC[1][254]), ph = K.phrasesOf(ws);
  expect(ph.length).toBeGreaterThan(5);
  const spans = [];
  let t = 0.4;
  ph.forEach(([x, y]) => { const len = 0.12 * ws.slice(x, y + 1).reduce((n, w) => n + K.letters(w), 0); spans.push([t, t + len]); t += len + 0.6; });
  const audio = recitation(spans);
  await page.route(/everyayah\.com\/data\/.+\.mp3$/, route => route.fulfill({ status: 200, headers: { 'Content-Type': 'audio/wav', 'Access-Control-Allow-Origin': '*' }, body: audio }));
  await open(page, { surah: 2, from: 255, to: 255, reciter: 'ghamdi', basmala: false, ayahView: 'line' });
  await sec(page, 'text');
  await expect(page.locator('#vmAvNoteText')).toContainText('تقريبي');
  const it = await page.evaluate(async () => { const t = await VM.buildTimeline(); const i = t.items[0]; return { start: i.start, sync: i.sync, words: i.words.map(w => w.a), exact: !!t.exact }; });
  expect(it.exact).toBe(false);
  expect(it.sync).not.toBe('length');                       // found in the pauses
  // each phrase starts as its tone does (within a few tenths of a second)
  ph.forEach(([x], k) => expect(Math.abs((it.words[x] - it.start) - spans[k][0])).toBeLessThan(0.35));
  // in order, all of them
  expect(it.words.length).toBe(ws.length);
  for (let i = 1; i < it.words.length; i++) expect(it.words[i]).toBeGreaterThanOrEqual(it.words[i - 1] - 1e-6);
  // a page of lines at a time, the word recited lit
  const lit = await goldAt(page, it.words[Math.floor(ws.length / 2)] + 0.15);
  expect(lit.gold).toBeGreaterThan(100);
  // the preview plays it
  await page.evaluate(() => scrollTo(0, 0));
  await page.locator('#vmStagePlay').click();
  await expect(page.locator('#vmStagePlay')).toBeHidden({ timeout: 10000 });
  await page.locator('#vmPreview').click();
  await expect(page.locator('#vmStagePlay')).toBeVisible({ timeout: 10000 });
});

test('the text\'s height: a slider between the margins; the three buttons are its marks', async ({ page }) => {
  await open(page, { mode: 'khatira', kContent: 'text', kTexts: ['الصبر مفتاح الفرج'] });
  await sec(page, 'text');
  const centre = () => page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 540; c.height = 960;
    const x = c.getContext('2d', { willReadFrequently: true });
    VM.renderFrame(x, 540, 960, 0, null);
    const d = x.getImageData(0, 60, 540, 900).data; let n = 0, sy = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 225 && d[i + 1] > 225 && d[i + 2] > 225) { n++; sy += Math.floor(i / 4 / 540) + 60; }
    return sy / n / 960;
  });
  await expect(page.locator('#vmTextAlign [data-ta="top"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#vmTextY')).toHaveValue('0');
  const top = await centre();
  await page.locator('#vmTextY').fill('0.3');
  expect(await page.evaluate(() => [VM.state.textY, VM.state.textPos])).toEqual([0.3, null]);
  await expect(page.locator('#vmTextAlign [aria-pressed="true"]')).toHaveCount(0);   // between the marks
  const third = await centre();
  await page.locator('#vmTextAlign [data-ta="bottom"]').click();
  await expect(page.locator('#vmTextY')).toHaveValue('1');
  const bottom = await centre();
  expect(third).toBeGreaterThan(top + 0.08);
  expect(bottom).toBeGreaterThan(third + 0.2);
  // the slider set at a mark lights that button
  await page.locator('#vmTextY').fill('0.5');
  await expect(page.locator('#vmTextAlign [data-ta="middle"]')).toHaveAttribute('aria-pressed', 'true');
  // remembered, and undoable
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  expect(await page.evaluate(() => VM.state.textY)).toBe(0.5);
});

test('the mini preview floats: dragged anywhere by mouse or finger, it stays there (remembered); the shrunk button drags too', async ({ page }) => {
  await open(page, { mode: 'khatira', kContent: 'text', kTexts: ['نص'], miniPreview: true });
  await page.evaluate(() => localStorage.setItem('vmMiniMin', '0'));
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  await sec(page, 'text');
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await expect(page.locator('#vmMiniView')).toBeVisible();
  // its entrance (a short slide and scale) over before it is measured and grabbed
  const settled = () => page.evaluate(() => Promise.all(document.getElementById('vmMini').getAnimations().map(x => x.finished)));
  await settled();
  // mouse: to the middle of the screen, and it stays there (no jump to a side)
  let b = await page.locator('#vmMini').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(206, 330, { steps: 8 });
  await page.mouse.up();
  b = await page.locator('#vmMini').boundingBox();
  expect(Math.abs(b.x + b.width / 2 - 206)).toBeLessThan(6);
  expect(Math.abs(b.y + b.height / 2 - 330)).toBeLessThan(6);
  await page.waitForTimeout(500);
  await expect(page.locator('#vmMiniView')).toBeVisible();                  // the drag was not a tap
  // finger
  const cdp = await page.context().newCDPSession(page);
  const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', 206, 330); await touch('touchMove', 190, 300); await touch('touchMove', 140, 220); await touch('touchEnd', 0, 0);
  b = await page.locator('#vmMini').boundingBox();
  expect(Math.abs(b.x + b.width / 2 - 140)).toBeLessThan(6);
  expect(Math.abs(b.y + b.height / 2 - 220)).toBeLessThan(6);
  // kept clear of the bar at the bottom however far it is pulled
  await page.mouse.move(140, 220); await page.mouse.down(); await page.mouse.move(140, 2000, { steps: 4 }); await page.mouse.up();
  b = await page.locator('#vmMini').boundingBox();
  const bar = await page.locator('.action-bar').boundingBox();
  expect(b.y + b.height).toBeLessThanOrEqual(bar.y);
  const at = { x: b.x, y: b.y };
  // remembered after a reload
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  await sec(page, 'text');
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await expect(page.locator('#vmMiniView')).toBeVisible();
  await settled();
  await expect.poll(async () => Math.abs((await page.locator('#vmMini').boundingBox()).x - at.x)).toBeLessThan(6);
  // shrunk: its button floats too, and a tap (not a drag) opens it
  await page.locator('#vmMiniClose').click();
  const o = await page.locator('#vmMiniOpen').boundingBox();
  await page.mouse.move(o.x + o.width / 2, o.y + o.height / 2); await page.mouse.down(); await page.mouse.move(80, 150, { steps: 6 }); await page.mouse.up();
  const o2 = await page.locator('#vmMiniOpen').boundingBox();
  expect(Math.abs(o2.x + o2.width / 2 - 80)).toBeLessThan(6);
  await page.waitForTimeout(450);
  await expect(page.locator('#vmMiniView')).toBeHidden();                    // still shrunk
  await page.locator('#vmMiniOpen').click();
  await expect(page.locator('#vmMiniView')).toBeVisible();
});
