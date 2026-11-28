// The video script (js/video-script.js) and the ZIP writer of the sticker pack (js/zip-store.js).
// Run: node tests/node/video-script.test.cjs
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const S = require('../../js/video-script.js');
const Z = require('../../js/zip-store.js');

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok  -', name); }
const IDS = ['h01', 'h05', 's08'];

test('settings, lines with times, per-line font and size, sticker placeholders', () => {
  const r = S.parse([
    '# a comment',
    '@font: changa', '@size: 1.2', '@style: word', '@color: #E6C068', '@format: square', '@name: قناة الخير',
    '',
    '[0:00 - 0:04] الصبر مفتاح الفرج <sticker 1 left fade>',
    '[4.5 - 0:09.5] ومن يتق الله {font: ruqaa, size: 1.3} <sticker 2> <sticker 1 right small flip>',
    'سطر بلا وقت',
    '[0:12] يبدأ فقط',
  ].join('\n'), { ids: IDS });
  assert.deepStrictEqual(r.settings, { font: 'changa', size: 1.2, style: 'word', color: '#e6c068', format: 'square', name: 'قناة الخير' });
  assert.deepStrictEqual(r.lines, [
    { text: 'الصبر مفتاح الفرج', a: 0, b: 4 },
    { text: 'ومن يتق الله', a: 4.5, b: 9.5, font: 'ruqaa', size: 1.3 },
    { text: 'سطر بلا وقت', a: null, b: null },
    { text: 'يبدأ فقط', a: 12, b: null },
  ]);
  assert.deepStrictEqual(r.stickers.map(s => [s.line, s.slot, s.id, s.fx, s.flip, s.x]), [
    [0, 1, null, 'fade', false, 0.24],
    [1, 2, null, 'pop', false, 0.5],      // the only one of its line without a place: centred
    [1, 1, null, 'pop', true, 0.76],
  ]);
  assert.strictEqual(r.stickers[2].s, 0.3, 'small');
  assert.strictEqual(r.stickers[1].s, 0.38, 'two on a line: a little smaller');
  assert.ok(r.stickers.every(s => s.y === 0.75), 'low on the video by default');
  assert.deepStrictEqual(r.warnings, []);
});

test('sticker ids, whole-video stickers, Arabic tags and digits, sticker-only rows', () => {
  const r = S.parse([
    '<sticker 3 all top float>',
    '[٠:٠٠ - ٠:٠٣] أولاً <ملصق ٢ يمين>',
    '<sticker h05 zoom>',
    'ثانياً <sticker S08>',
    '<sticker zz9> <sticker 999>',
  ].join('\n'), { ids: IDS });
  assert.deepStrictEqual(r.lines.map(l => [l.text, l.a, l.b]), [['أولاً', 0, 3], ['ثانياً', null, null]]);
  assert.deepStrictEqual(r.stickers.map(s => [s.line, s.slot, s.id, s.fx]), [
    [0, 2, null, 'pop'],           // <ملصق ٢ يمين> on line 0
    [null, 3, null, 'float'],      // `all` (written before any line): the whole video
    [0, null, 'h05', 'zoom'],      // the row of stickers only: with the line before
    [1, null, 's08', 'pop'],
  ]);
  const all = r.stickers.find(s => s.slot === 3);
  assert.strictEqual(all.line, null);
  assert.strictEqual(all.y, 0.2);
  assert.strictEqual(r.stickers.find(s => s.slot === 2).x, 0.76);
  assert.deepStrictEqual(r.warnings.map(w => w.code), ['tag', 'tag']);
});

test('subtitle files (SRT, WebVTT) read as scripts', () => {
  const srt = '1\n00:00:01,000 --> 00:00:04,500\nالسطر الأول\nيكمل هنا <sticker 1>\n\n2\n00:00:05,000 --> 00:00:08,000\nالسطر الثاني\n';
  const r = S.parse(srt, { ids: IDS });
  assert.deepStrictEqual(r.lines.map(l => [l.text, l.a, l.b]), [['السطر الأول يكمل هنا', 1, 4.5], ['السطر الثاني', 5, 8]]);
  assert.deepStrictEqual(r.stickers.map(s => [s.line, s.slot]), [[0, 1]]);
  const vtt = 'WEBVTT\n\n00:01.000 --> 00:03.000 align:center\nHello there\n\n00:03.500 --> 00:06.000\nSecond line\n';
  assert.deepStrictEqual(S.parse(vtt).lines.map(l => [l.text, l.a, l.b]), [['Hello there', 1, 3], ['Second line', 3.5, 6]]);
});

test('text that only looks like a time stays text; bad values warn and are kept in range', () => {
  const r = S.parse('3 - 4 أشياء تغير حياتك\n<b>عريض</b>\n[0:05 - 0:02] بالمقلوب\n@size: 3\n@font: comic\n[1:00] {size: 0.2, font: nope} صغير', { ids: IDS });
  assert.strictEqual(r.lines[0].text, '3 - 4 أشياء تغير حياتك');
  assert.strictEqual(r.lines[1].text, '<b>عريض</b>', 'angle brackets that are not stickers are text');
  assert.deepStrictEqual([r.lines[2].a, r.lines[2].b], [5, null], 'an end before the start is dropped');
  assert.strictEqual(r.settings.size, 1.4);
  assert.strictEqual(r.settings.font, undefined);
  assert.strictEqual(r.lines[3].size, 0.7);
  assert.strictEqual(r.lines[3].font, undefined);
  assert.deepStrictEqual(r.warnings.map(w => w.code).sort(), ['font', 'font', 'size', 'size', 'time']);
});

test('@quran: a recitation under the text', () => {
  assert.deepStrictEqual(S.parse('@quran: 94:5-6\nسطر').settings.quran, { surah: 94, from: 5, to: 6 });
  assert.deepStrictEqual(S.parse('@quran: ٢:٢٥٥\nسطر').settings.quran, { surah: 2, from: 255, to: 255 });
  for (const bad of ['115:1', '2:10-5', '2:1-40', 'البقرة']) {
    const r = S.parse('@quran: ' + bad + '\nسطر');
    assert.strictEqual(r.settings.quran, undefined, bad);
    assert.deepStrictEqual(r.warnings.map(w => w.code), ['quran'], bad);
  }
  assert.ok(S.serialize({ settings: { quran: { surah: 94, from: 5, to: 6 } }, lines: [{ text: 'أ', a: null, b: null }] }).includes('@quran: 94:5-6'));
});

test('@spacing: the space between lines, kept in range', () => {
  assert.strictEqual(S.parse('@spacing: 1.3\nأ').settings.spacing, 1.3);
  const r = S.parse('@spacing: 5\nأ');
  assert.strictEqual(r.settings.spacing, 2.4);
  assert.deepStrictEqual(r.warnings.map(w => w.code), ['spacing']);
  assert.ok(S.serialize({ settings: { spacing: 1.3 }, lines: [{ text: 'أ', a: null, b: null }] }).includes('@spacing: 1.3'));
  assert.ok(S.template({}).includes('@spacing: <number>'));
});

test('sticker tags: until the next sticker, or to the end', () => {
  const r = S.parse('أ <sticker 1 next>\nب <sticker 2 end>\nج <sticker 3>');
  assert.deepStrictEqual(r.stickers.map(s => s.until), ['next', 'end', 'line']);
  const back = S.parse(S.serialize(r));
  assert.deepStrictEqual(back.stickers.map(s => s.until), ['next', 'end', 'line']);
});

test('@position: where the text sits', () => {
  assert.strictEqual(S.parse('@position: bottom\nأ').settings.position, 'bottom');
  assert.strictEqual(S.parse('@position: أعلى\nأ').settings.position, 'top');
  assert.deepStrictEqual(S.parse('@position: left\nأ').warnings.map(w => w.code), ['position']);
  assert.strictEqual(S.parse('@position: 0.3\nأ').settings.position, 0.3);
  assert.strictEqual(S.parse('@position: 75%\nأ').settings.position, 0.75);
  assert.deepStrictEqual(S.parse('@position: 1.5\nأ').warnings.map(w => w.code), ['position']);
  assert.ok(S.serialize({ settings: { position: 0.3 }, lines: [{ text: 'أ', a: null, b: null }] }).includes('@position: 0.3'));
  assert.ok(S.serialize({ settings: { position: 'top' }, lines: [{ text: 'أ', a: null, b: null }] }).includes('@position: top'));
});

test('@look: the background colours', () => {
  assert.strictEqual(S.parse('@look: cinematic\nأ').settings.look, 'cinematic');
  assert.deepStrictEqual(S.parse('@look: sepia-ish\nأ').warnings.map(w => w.code), ['look']);
  assert.ok(S.serialize({ settings: { look: 'golden' }, lines: [{ text: 'أ', a: null, b: null }] }).includes('@look: golden'));
  assert.ok(S.template({}).includes('@look: none | warm'));
});

test('limits: lines, length, stickers', () => {
  const many = Array.from({ length: 40 }, (_, i) => `سطر ${i + 1} <sticker 1>`).join('\n');
  const r = S.parse(many + '\n' + 'ك'.repeat(500));
  assert.strictEqual(r.lines.length, S.LIMITS.lines);
  assert.strictEqual(r.stickers.length, S.LIMITS.stickers);
  assert.ok(r.warnings.some(w => w.code === 'lines' && w.detail === '11'));
  assert.ok(S.parse('ك'.repeat(500)).lines[0].text.length === S.LIMITS.chars);
});

test('a script written out reads back the same', () => {
  const src = S.parse('@font: cairo\n@style: build\n[0:00 - 0:04] أ ب {size: 1.2} <sticker 1 fade>\n[0:04 - 0:07.5] ج د {font: ruqaa} <sticker h05 flip>\nبلا وقت\n<sticker 2 all>', { ids: IDS });
  const text = S.serialize(src);
  const back = S.parse(text, { ids: IDS });
  assert.deepStrictEqual(back.settings, src.settings);
  assert.deepStrictEqual(back.lines, src.lines);
  assert.deepStrictEqual(back.stickers.map(s => [s.line, s.slot, s.id, s.fx, s.flip]), src.stickers.map(s => [s.line, s.slot, s.id, s.fx, s.flip]));
  assert.strictEqual(S.clock(67.5), '1:07.5');
});

test('the template: instructions, every font, the size range, every sticker with what it shows, and an example that reads', () => {
  const stickers = [
    { id: 'h05', ar: 'يدعو', en: 'Making dua', about: 'Standing, both hands raised in dua. Fits: supplication.' },
    { id: 'h06', ar: 'يقرأ المصحف', en: 'Reading', about: 'Standing, reading an open mushaf. Fits: the Quran.' },
    { id: 'h10', ar: 'مهموم', en: 'Worried', about: 'Sitting, head in his hand. Fits: grief, worry.' },
  ];
  for (const lang of ['ar', 'en']) {
    const t = S.template({ lang, stickers });
    assert.ok(t.includes('INSTRUCTIONS FOR THE AI'));
    assert.ok(t.includes('PICK THEM YOURSELF'), 'the AI picks the stickers');
    for (const f of S.FONTS) assert.ok(new RegExp('#\\s+' + f + '\\s').test(t), lang + ': font ' + f);
    assert.ok(!/#\s+hafs\s/.test(t), 'not the mushaf face');
    assert.ok(t.includes('from 0.7 (small) to 1.4 (large)'));
    assert.ok(t.includes('h05  Standing, both hands raised in dua. Fits: supplication.  ·  يدعو'));
    for (const fx of S.FX) assert.ok(t.includes(fx));
    const r = S.parse(t, { ids: stickers.map(x => x.id) });
    assert.strictEqual(r.lines.length, 5, lang + ': the example reads');
    assert.deepStrictEqual(r.warnings, []);
    assert.ok(r.lines[2].font && r.lines[2].size === 1.3);
    assert.deepStrictEqual(r.stickers.map(x => x.id), ['h10', 'h06', 'h05'], lang + ': the example picks by id');
    assert.ok(r.lines.every((l, i) => l.a === [0, 4, 9, 14, 19][i]));
    // without the list, numbers for the user to fill
    assert.deepStrictEqual([...new Set(S.parse(S.template({ lang }), {}).stickers.map(x => x.slot))].sort(), [1, 2, 3]);
  }
});

test('the ZIP of the sticker pack: a valid archive with UTF-8 names', () => {
  const a = new Uint8Array(3000).map((_, i) => (i * 7) & 255), b = new TextEncoder().encode('h01 يتأمل\n');
  const zip = Z.make([{ name: 'stickers/h01.webp', data: a }, { name: 'الملصقات.txt', data: b }]);
  assert.strictEqual(Z.crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
  // read it back: the central directory points at each local header, CRCs match
  const v = new DataView(zip.buffer);
  const end = zip.length - 22;
  assert.strictEqual(v.getUint32(end, true), 0x06054b50);
  assert.strictEqual(v.getUint16(end + 10, true), 2);
  let p = v.getUint32(end + 16, true);
  const names = [];
  for (let i = 0; i < 2; i++) {
    assert.strictEqual(v.getUint32(p, true), 0x02014b50);
    const n = v.getUint16(p + 28, true), off = v.getUint32(p + 42, true), size = v.getUint32(p + 24, true);
    const name = new TextDecoder().decode(zip.subarray(p + 46, p + 46 + n));
    names.push(name);
    assert.strictEqual(v.getUint32(off, true), 0x04034b50);
    const data = zip.subarray(off + 30 + n, off + 30 + n + size);
    assert.strictEqual(Z.crc32(data), v.getUint32(p + 16, true));
    p += 46 + n;
  }
  assert.deepStrictEqual(names, ['stickers/h01.webp', 'الملصقات.txt']);
  // and a real unzip agrees, where there is one
  let py = null;
  try { execFileSync('python3', ['-c', '1']); py = 'python3'; } catch (e) { /* none */ }
  if (py) {
    const f = path.join(os.tmpdir(), 'vm-pack-test.zip');
    fs.writeFileSync(f, zip);
    const out = execFileSync(py, ['-c', 'import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print("|".join(z.namelist()))', f]).toString().trim();
    assert.strictEqual(out, 'stickers/h01.webp|الملصقات.txt');
    fs.unlinkSync(f);
  }
});

console.log(`\n${passed} tests passed`);
