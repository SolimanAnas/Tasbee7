// «خاطرة»: word timings and which bytes of an MP3 hold which seconds (js/khatira.js).
// Run: node tests/node/khatira.test.cjs
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const K = require('../../js/khatira.js');

const FIX = path.join(__dirname, '..', 'fixtures', 'khatira');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok  -', name); }
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('the API answer: verse timings per ayah, malformed entries dropped', () => {
  const m = K.parseMeta(JSON.parse(fs.readFileSync(path.join(FIX, '1.json'), 'utf8')));
  assert.ok(m.url.endsWith('/1.mp3'));
  assert.deepStrictEqual(Object.keys(m.verses).map(Number), [1, 2, 3, 4, 5]);
  assert.strictEqual(m.verses[3].segs.length, 2, 'the [1] entry is gone');
  assert.ok(m.verses[3].segs.every(s => s.length === 3));
});

test('words: the tokens with letters (a standing ۞ is not a word)', () => {
  assert.deepStrictEqual(K.wordsOf('۞ إِنَّ ٱللَّهَ لَا'), ['إِنَّ', 'ٱللَّهَ', 'لَا']);
  assert.deepStrictEqual(K.wordsOf('ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ'), ['ٱلرَّحۡمَٰنِ', 'ٱلرَّحِيمِ']);
});

test('word times: from the timings, one per word', () => {
  const v = { from: 0, to: 3000, segs: [[1, 100, 700], [2, 700, 1500], [3, 1500, 2900]] };
  const t = K.wordTimes(['أ', 'ب', 'ج'], v);
  assert.deepStrictEqual(t, [{ a: 100, b: 700 }, { a: 700, b: 1500 }, { a: 1500, b: 2900 }]);
});

test('word times: a word the timings skip gets its share of the gap', () => {
  const v = { from: 0, to: 4000, segs: [[1, 100, 700], [3, 1500, 2000], [4, 2000, 3800]] };
  const t = K.wordTimes(['أب', 'جدهو', 'زح', 'طي'], v);
  assert.strictEqual(t.length, 4);
  near(t[1].a, 700, 1, 'starts where the one before ends');
  near(t[1].b, 1500, 1, 'ends where the next starts');
  for (let i = 1; i < 4; i++) assert.ok(t[i].a >= t[i - 1].a, 'in order');
});

test('word times: when the timings count the words differently, the spoken time is shared by letters', () => {
  // the timings have 8 words, the text 7 (a word written as one, recited as two)
  const segs = [];
  for (let k = 1; k <= 8; k++) segs.push([k, 1000 + (k - 1) * 500, 1000 + k * 500]);
  const words = ['وَمَالِيَ', 'لَآ', 'أَعۡبُدُ', 'ٱلَّذِي', 'فَطَرَنِي', 'وَإِلَيۡهِ', 'تُرۡجَعُونَ'];
  const t = K.wordTimes(words, { from: 900, to: 5200, segs });
  assert.strictEqual(t.length, 7);
  near(t[0].a, 1000, 0.001, 'from the first spoken word');
  near(t[6].b, 5000, 0.001, 'to the last');
  assert.ok(t[6].b - t[6].a > t[1].b - t[1].a, 'a longer word gets more time');
});

// every frame of a file: [byte offset, ...] from its audio start
function frames(b, info) {
  const out = [];
  for (let i = info.audio; i < b.length - 4;) { const f = K.frameAt(b, i); if (!f) break; out.push(i); i += f.len; }
  return out;
}

test('MP3 header: constant bitrate with an Info frame, without one, and variable bitrate', () => {
  const read = f => K.mp3Info(new Uint8Array(fs.readFileSync(path.join(FIX, f)).subarray(0, 65536)));
  const cbr = read('cbr.mp3'), plain = read('cbr-notag.mp3'), vbr = read('vbr.mp3');
  assert.strictEqual(cbr.cbr, true); assert.strictEqual(cbr.tag, 'Info'); assert.strictEqual(cbr.kbps, 32);
  assert.strictEqual(plain.cbr, true); assert.strictEqual(plain.tag, '');
  assert.strictEqual(vbr.cbr, false); assert.strictEqual(vbr.tag, 'Xing');
  assert.ok(cbr.audio > 45, 'the Info frame is skipped');
  assert.ok(cbr.encDelay > 500 && cbr.encDelay < 2000, 'the encoder delay from its LAME header: ' + cbr.encDelay);
  assert.strictEqual(plain.encDelay, 0, 'no header, no delay to read');
});

test('a byte range from the middle of a constant-bitrate file: its first frame and the second it starts at', () => {
  for (const f of ['cbr.mp3', 'cbr-notag.mp3']) {
    const b = new Uint8Array(fs.readFileSync(path.join(FIX, f)));
    const info = K.mp3Info(b.subarray(0, 65536));
    const all = frames(b, info);
    for (const sec of [0.5, 3.7, 8.2, 12.9]) {
      const want = Math.floor(sec * info.sr / info.spf);
      near(K.byteAt(info, sec), all[want], 1, `${f}: byte of second ${sec}`);
      for (const back of [0, 1, 37, 90]) {
        const base = Math.floor(K.byteAt(info, sec)) - back;
        const r = K.firstFrame(b.subarray(base), base, info);
        const idx = all.indexOf(base + r.pos);
        assert.ok(idx >= 0, `${f}: lands on a real frame (${sec}s, -${back})`);
        assert.strictEqual(r.index, idx, `${f}: the index of that frame`);
        near(r.sec, (idx * info.spf - 529 - info.encDelay) / info.sr, 1e-9, `${f}: the second its decoded audio starts at`);
      }
    }
  }
});

test('the reciters all have names and a known style', () => {
  assert.ok(K.RECITERS.length >= 10);
  for (const r of K.RECITERS) {
    assert.ok(r.id > 0 && r.name && r.en);
    assert.ok(['murattal', 'mujawwad', 'muallim'].includes(r.style));
  }
  assert.ok(K.metaUrl(7, 2).includes('/7/audio_files?chapter=2&segments=true'));
});

test('each bundled face: its file reads, and its list of missing marks is exactly what the file lacks', () => {
  const qpc = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'quran-qpc.json'), 'utf8')).surahs;
  const used = [...new Set([...qpc.flat().join('')])].filter(c => c.codePointAt(0) >= 0x600);
  for (const f of K.FONTS.filter(x => x.file)) {
    const cm = K.cmapOf(fs.readFileSync(path.join(__dirname, '..', '..', 'fonts', f.file)));
    assert.ok(cm && cm.size > 200, f.id + ': cmap read');
    const lacks = used.filter(c => !cm.has(c.codePointAt(0))).sort().join('');
    assert.strictEqual(lacks, [...f.missing].sort().join(''), f.id + ': missing marks');
    assert.strictEqual(['\u08F0', '\u08F1', '\u08F2'].filter(c => cm.has(c.codePointAt(0))).join(''), f.open, f.id + ': open tanween');
    // what it lacks has a stand-in it draws, or is a mark that can be left out
    const has = K.hasIn(f);
    for (const c of lacks) assert.ok(!K.adaptWord('ب' + c, has).includes(c), f.id + ': ' + c.codePointAt(0).toString(16));
    // every character of the whole Quran, adapted, is one the face draws
    for (const c of new Set(K.adaptWord(qpc.flat().join(' '), has))) if (c.codePointAt(0) >= 0x600) assert.ok(cm.has(c.codePointAt(0)), f.id + ': draws ' + c.codePointAt(0).toString(16));
  }
  assert.strictEqual(K.cmapOf(new Uint8Array([0x77, 0x4F, 0x46, 0x32, 0, 0, 0, 0]).buffer), null, 'WOFF2: not read');
});

test('a word for a face without the Uthmani marks reads as in common print', () => {
  const cairo = K.hasIn(K.FONTS.find(f => f.id === 'cairo')), amiri = K.hasIn(K.FONTS.find(f => f.id === 'amiri'));
  assert.strictEqual(K.adaptWord('نَسۡتَعِينُ', cairo), 'نَسْتَعِينُ');                 // ۡ -> ْ
  assert.strictEqual(K.adaptWord('إِنَّهُۥ', cairo), 'إِنَّهُ');                          // the small waw left out
  assert.strictEqual(K.adaptWord('ٱلرَّحۡمَٰنِ', cairo), 'ٱلرَّحْمَٰنِ');               // ٱ and ٰ it has
  assert.strictEqual(K.adaptWord('رَّبِّهِمۡۖ', cairo), 'رَّبِّهِمْ');                    // the stop sign left out
  // the staggered tanween of the QPC text: Unicode's open tanween, or the plain one
  assert.strictEqual(K.adaptWord('غِشَٰوَةٞ', cairo), 'غِشَٰوَةٌ');
  assert.strictEqual(K.adaptWord('هُدٗى', cairo), 'هُدًى');
  assert.strictEqual(K.adaptWord('ظُلُمَٰتٖ', cairo), 'ظُلُمَٰتٍ');
  assert.strictEqual(K.adaptWord('هُدٗى', amiri), 'هُد\u08F0ى');
  assert.strictEqual(K.adaptWord('إِنَّهُۥ', amiri), 'إِنَّهُۥ', 'a face with every mark keeps it');
  // unknown coverage (a WOFF font): only the tanween change, to the plain ones
  assert.strictEqual(K.adaptWord('نَسۡتَعِينُ', null), 'نَسۡتَعِينُ');
  assert.strictEqual(K.adaptWord('هُدٗى', null), 'هُدًى');
});

test('an ayah in phrases at its stopping marks (an-Nur 35), timed from where each phrase starts', () => {
  const qpc = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'quran-qpc.json'), 'utf8')).surahs;
  const ws = K.wordsOf(qpc[23][34]);
  const ph = K.phrasesOf(ws);
  assert.deepStrictEqual(ph, [[0, 3], [4, 8], [9, 11], [12, 21], [22, 31], [32, 34], [35, 39], [40, 43], [44, 47]]);
  // every phrase but the last ends on a stopping mark, or is a long run cut in two
  ph.slice(0, -1).forEach(([x, y]) => assert.ok(/[\u06D6-\u06DB]/.test(ws[y]) || y - x + 1 >= 6, 'ends at a stop: ' + ws[y]));
  // a short ayah with no mark is one phrase
  assert.deepStrictEqual(K.phrasesOf(K.wordsOf('ٱلۡحَمۡدُ لِلَّهِ رَبِّ ٱلۡعَٰلَمِينَ')), [[0, 3]]);
  // a long one with no mark is cut near its middle
  assert.deepStrictEqual(K.phrasesOf(Array.from({ length: 14 }, () => 'كلمة')), [[0, 6], [7, 13]]);
  // the words of each phrase share its time by their length, phrase after phrase
  const starts = ph.map((_, k) => 1 + k * 2), wt = K.phraseWordTimes(ws, ph, starts, 19);
  assert.strictEqual(wt.length, ws.length);
  ph.forEach(([x, y], k) => {
    assert.ok(Math.abs(wt[x].a - starts[k]) < 1e-9, 'a phrase starts where it was found');
    assert.ok(Math.abs(wt[y].b - (k + 1 < ph.length ? starts[k + 1] : 19)) < 1e-9, 'and ends where the next starts');
  });
  for (let i = 1; i < wt.length; i++) assert.ok(wt[i].a >= wt[i - 1].a - 1e-9, 'in order');
});

test('the Shorts reciters with word timings on quran.com', () => {
  const ids = Object.values(K.QDC_OF);
  assert.strictEqual(ids.length, 12);
  for (const id of ids) assert.ok(K.RECITERS.some(r => r.id === id), 'a quran.com reciter: ' + id);
  assert.strictEqual(K.QDC_OF.dosary, 97);
  assert.strictEqual(K.QDC_OF.afasy, 7);
});

console.log(`\n${passed} tests passed`);
