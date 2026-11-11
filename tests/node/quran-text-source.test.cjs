// Unit tests for js/quran-text-source.js — the rules that decide which Quran
// text the text mushaf shows. Run: node tests/node/quran-text-source.test.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..', '..');
const Source = require(path.join(ROOT, 'js', 'quran-text-source.js'));
const quran = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'quran.json'), 'utf8'));
const pageMap = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'quran-pages.json'), 'utf8'));
// The same ayahs as served by Quran.com in its two encodings (first ayah of
// every surah, the two ayahs with a carrier-yeh spelling, the longest ayah,
// and every ayah of pages 1, 2 and 604), saved November 2026.
const remote = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'quran-encodings.json'), 'utf8'));

const index = Source.createIndex(quran, pageMap);
const byKey = new Map(quran.map(v => [v.surah + ':' + v.ayah, v]));
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; }
  catch (e) { console.error('✗ ' + name + '\n  ' + e.message); process.exitCode = 1; }
}

test('every page lists its ayahs in mushaf order and the pages cover all 6236', () => {
  let expected = 1;
  for (let p = 1; p <= 604; p++) {
    const list = index.pageAyahs(p);
    assert.ok(list.length > 0, 'page ' + p + ' is empty');
    for (const a of list) assert.strictEqual(a.number, expected++, 'gap or repeat at page ' + p);
  }
  assert.strictEqual(expected - 1, 6236);
  assert.deepStrictEqual(index.pageAyahs(0), []);
  assert.deepStrictEqual(index.pageAyahs(605), []);
});

test('known pages hold the right ayahs', () => {
  assert.deepStrictEqual(index.pageAyahs(1).map(a => a.key), ['1:1', '1:2', '1:3', '1:4', '1:5', '1:6', '1:7']);
  assert.deepStrictEqual(index.pageAyahs(2).map(a => a.key), ['2:1', '2:2', '2:3', '2:4', '2:5']);
  const last = index.pageAyahs(604).map(a => a.key);
  assert.strictEqual(last[0], '112:1');
  assert.strictEqual(last[last.length - 1], '114:6');
  assert.strictEqual(last.length, 15);
});

test('ayah text is the stored text, unchanged — only the prefixed basmala is left out', () => {
  const basmala = byKey.get('1:1').text_uthmani.split(/\s+/);
  assert.strictEqual(basmala.length, 4);
  for (const v of quran) {
    const own = Source.ayahOwnText(v);
    if (v.ayah === 1 && v.surah !== 1 && v.surah !== 9) {
      const words = v.text_uthmani.split(/\s+/);
      // What is removed is exactly the four words of the basmala (same letters)…
      assert.strictEqual(Source.letters(words.slice(0, 4).join(' ')), Source.letters(basmala.join(' ')), v.surah + ':1 prefix is not the basmala');
      // …and everything after it is kept as stored.
      assert.strictEqual(own, words.slice(4).join(' '));
      assert.ok(own.length > 0);
    } else {
      assert.strictEqual(own, v.text_uthmani);
    }
  }
});

test('surah facts come from the local files', () => {
  const a = index.pageAyahs(2)[0];
  assert.strictEqual(a.surah, 2);
  assert.strictEqual(a.numberOfAyahs, 286);
  assert.strictEqual(a.meccan, false);
  assert.strictEqual(a.number, 8);
  assert.strictEqual(index.pageAyahs(1)[0].meccan, true);
  assert.strictEqual(index.pageAyahs(604)[0].numberOfAyahs, 4);
});

test('both remote encodings of an ayah have the letters of the local text', () => {
  for (const [key, enc] of Object.entries(remote)) {
    const local = Source.letters(Source.ayahOwnText(byKey.get(key)));
    assert.ok(local.length > 0);
    assert.strictEqual(Source.letters(enc.qpc), local, 'qpc ' + key);
    assert.strictEqual(Source.letters(enc.uthmani), local, 'uthmani ' + key);
  }
});

test('fetched text must be Arabic script only', () => {
  for (const enc of Object.values(remote)) {
    assert.ok(Source.isQuranScript(enc.qpc));
    assert.ok(Source.isQuranScript(enc.uthmani));
  }
  for (const v of quran) assert.ok(Source.isQuranScript(v.text_uthmani), v.surah + ':' + v.ayah);
  for (const bad of ['', null, 42, 'abc', remote['1:1'].qpc + '<b>', remote['1:1'].qpc + '\u200F', remote['1:1'].qpc + '\n']) {
    assert.strictEqual(Source.isQuranScript(bad), false);
  }
});

test('letters() ignores marks, numbers and spaces but not letters', () => {
  const t = byKey.get('2:255').text_uthmani;
  assert.strictEqual(Source.letters(t + ' ٢٥٥'), Source.letters(t));
  assert.notStrictEqual(Source.letters(t + 'ب'), Source.letters(t));
  assert.notStrictEqual(Source.letters(t.slice(0, -6)), Source.letters(t));
  assert.strictEqual(Source.letters(''), '');
  assert.strictEqual(Source.letters(null), '');
});

function remoteFor(page, encoding) {
  const textByKey = {};
  index.pageAyahs(page).forEach(a => { textByKey[a.key] = remote[a.key][encoding]; });
  return textByKey;
}

test('matching fetched text is used, with the local numbering', () => {
  for (const page of [1, 2, 604]) {
    for (const encoding of ['qpc', 'uthmani']) {
      const local = index.pageAyahs(page);
      const textByKey = remoteFor(page, encoding);
      const result = Source.composePage(local, { textByKey });
      assert.strictEqual(result.source, 'remote');
      assert.strictEqual(result.rejected, null);
      result.ayahs.forEach((a, i) => {
        assert.strictEqual(a.text, textByKey[local[i].key]);
        assert.strictEqual(a.number, local[i].number);
        assert.strictEqual(a.numberInSurah, local[i].numberInSurah);
      });
    }
  }
});

test('a page with swapped, missing, altered or injected text is shown from the local copy', () => {
  const local = index.pageAyahs(2);
  const good = remoteFor(2, 'qpc');
  const cases = {
    swapped: Object.assign({}, good, { '2:2': good['2:3'], '2:3': good['2:2'] }),
    missing: (() => { const t = Object.assign({}, good); delete t['2:4']; return t; })(),
    truncated: Object.assign({}, good, { '2:5': good['2:5'].split(' ').slice(0, -1).join(' ') }),
    extraWord: Object.assign({}, good, { '2:3': good['2:3'] + ' ' + good['2:1'] }),
    injected: Object.assign({}, good, { '2:2': good['2:2'] + '<img src=x onerror=alert(1)>' }),
    notText: Object.assign({}, good, { '2:1': 42 }),
  };
  for (const [name, textByKey] of Object.entries(cases)) {
    const result = Source.composePage(local, { textByKey });
    assert.strictEqual(result.source, 'local', name);
    assert.ok(result.rejected, name);
    result.ayahs.forEach((a, i) => assert.strictEqual(a.text, local[i].text, name));
  }
});

test('nothing fetched means the local text, and audio is matched by ayah, not position', () => {
  const local = index.pageAyahs(1);
  const none = Source.composePage(local, null);
  assert.strictEqual(none.source, 'local');
  assert.strictEqual(none.rejected, null);
  assert.deepStrictEqual(none.audio, local.map(() => null));

  const audio = Source.composePage(local, { textByKey: null, audioByKey: { '1:7': 'https://x/7.mp3', '1:1': 'https://x/1.mp3' } });
  assert.strictEqual(audio.source, 'local');
  assert.deepStrictEqual(audio.audio, ['https://x/1.mp3', null, null, null, null, null, 'https://x/7.mp3']);
});

if (!process.exitCode) console.log(passed + ' tests passed');
