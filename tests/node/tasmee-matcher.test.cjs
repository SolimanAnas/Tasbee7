/* Node-level tests for js/tasmee-matcher.js — the shared alignment brain
 * driving Tasmee' Pro v3 (pages/quran_v2.html).
 *
 * Mirrors the behavioral contract pinned by tests/tasmee-v2.spec.js so the
 * v3 (TasmeeMatcher-driven) panel matches the v2 inline matcher's observable
 * behavior, plus covers what v2 could not do: tajweed variants, idgham
 * fusion, extra-word tracking, and overlap idempotence.
 *
 * Run: node tests/node/tasmee-matcher.test.cjs   (exits non-zero on failure)
 */
'use strict';
const assert = require('node:assert');
const TasmeeMatcher = require('../../js/tasmee-matcher.js');

let passed = 0;
function t(name, fn) {
  fn();
  passed++;
  console.log('✓ ' + name);
}

// Surah 2 opening (matches the p2 scenario in tests/tasmee-v2.spec.js)
const P2_AYAHS = [
  { surah: 2, ayah: 1, text: 'الم' },
  { surah: 2, ayah: 2, text: 'ذَٰلِكَ الْكِتَابُ لَا رَيْبَ فِيهِ هُدًى لِّلْمُتَّقِينَ' },
  { surah: 2, ayah: 3, text: 'الَّذِينَ يُؤْمِنُونَ بِالْغَيْبِ وَيُقِيمُونَ الصَّلَاةَ' },
];

t('skipped word flagged missed; pointer lands after للمتقين (spec parity)', () => {
  const m = new TasmeeMatcher();
  m.buildFromAyahs(P2_AYAHS);
  m.feedTranscript('الم ذلك الكتاب لا فيه هدى للمتقين'); // ريب skipped
  assert.strictEqual(m.position, 8, 'pointer through للمتقين');
  const s = m.score();
  assert.strictEqual(s.missed, 1, 'exactly ريب missed');
  assert.strictEqual(s.correct, 7);
  const miss = m.mistakes().filter(x => x.type === 'missing');
  assert.strictEqual(miss.length, 1);
  assert.match(miss[0].word, /ر[َيْ]*ب/, 'the missing word is ريب');
  assert.strictEqual(miss[0].surah, 2);
  assert.strictEqual(miss[0].ayah, 2);
});

t('overlapping sliding-window transcript advances without double-counting (spec parity)', () => {
  const m = new TasmeeMatcher();
  m.buildFromAyahs(P2_AYAHS);
  m.feedTranscript('الم ذلك الكتاب لا فيه هدى للمتقين');
  m.feedTranscript('هدى للمتقين الذين يؤمنون بالغيب'); // window overlaps 2 old words
  assert.strictEqual(m.position, 11, 'pointer through بالغيب');
  assert.strictEqual(m.score().missed, 1, 'overlap did not create new misses');
});

t('feeding the identical window twice is idempotent', () => {
  const m = new TasmeeMatcher();
  m.buildFromAyahs(P2_AYAHS);
  m.feedTranscript('الم ذلك الكتاب لا فيه هدى للمتقين');
  const pos = m.position, missed = m.score().missed;
  m.feedTranscript('الم ذلك الكتاب لا فيه هدى للمتقين');
  assert.strictEqual(m.position, pos, 'position unchanged on replay');
  assert.strictEqual(m.score().missed, missed, 'missed unchanged on replay');
});

t('iqlab variant: ن before ب accepted as م (منۢ بعد → مم بعد)', () => {
  const m = new TasmeeMatcher();
  m.buildFromAyahs([{ surah: 30, ayah: 4, text: 'مِن بَعْدُ' }]);
  m.feedTranscript('مم بعد');
  assert.strictEqual(m.position, 2);
  assert.strictEqual(m.score().correct, 2, 'iqlab pronunciation matched both words');
});

t('idgham fusion: two words recited as one (من ربهم → مربهم)', () => {
  const m = new TasmeeMatcher();
  m.buildFromAyahs([{ surah: 2, ayah: 5, text: 'مِّن رَّبِّهِمْ' }]);
  m.feedTranscript('مربهم');
  assert.strictEqual(m.position, 2, 'both fused words consumed');
  assert.strictEqual(m.score().correct, 2);
});

t('inserted word recorded as extra, not silently dropped', () => {
  const extras = [];
  const m = new TasmeeMatcher({ onExtra: w => extras.push(w) });
  m.buildFromAyahs([{ surah: 1, ayah: 2, text: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ' }]);
  m.feedTranscript('الحمد ياه لله رب العالمين');
  assert.deepStrictEqual(extras, ['ياه']);
  assert.strictEqual(m.position, 4, 'real words all matched around the insertion');
  const extraMistakes = m.mistakes().filter(x => x.type === 'extra');
  assert.strictEqual(extraMistakes.length, 1);
});

t('setTokens path (how tasmee-pro-v3 builds from rect-words) behaves identically', () => {
  // Mimic js/quran/tasmee-pro-v3.js _v2BuildTokens: prebuilt tokens with
  // page metadata, variants computed via a scratch instance.
  const scratch = new TasmeeMatcher();
  const words = 'الم ذلك الكتاب لا ريب فيه هدى للمتقين الذين يؤمنون بالغيب'.split(' ');
  const toks = words.map((raw, i) => ({
    idx: i, surah: 2, ayah: i === 0 ? 1 : (i <= 7 ? 2 : 3), wordIdxInAyah: i,
    raw, norm: scratch.normArabic(raw), state: 'pending', variants: null
  }));
  for (let i = 0; i < toks.length; i++) {
    toks[i].variants = scratch.variantsFor(toks[i].raw, toks[i].norm, toks[i + 1] ? toks[i + 1].norm : '');
  }
  const seen = [];
  const m = new TasmeeMatcher({ onWord: (tok, state) => seen.push([tok.idx, state]) });
  m.setTokens(toks);
  m.feedTranscript('الم ذلك الكتاب لا فيه هدى للمتقين');
  assert.strictEqual(m.position, 8);
  assert.strictEqual(m.score().missed, 1);
  // callbacks delivered reveal events for every matched/missed word
  const revealed = seen.filter(([, st]) => st === 'correct' || st === 'fuzzy' || st === 'missed');
  assert.strictEqual(revealed.length, 8);
});

t('window slice re-sync (manual nav pattern): fresh matcher over a slice starts clean', () => {
  // tasmee-pro-v3 rebuilds the matcher over allTokens.slice(ptr) after
  // tpPrev/tpSkipBack — verify a sliced restart re-matches the retried ayah.
  const scratch = new TasmeeMatcher();
  const words = 'قل كونوا حجارة او حديدا'.split(' ');
  const toks = words.map((raw, i) => ({
    idx: i, surah: 17, ayah: 50, wordIdxInAyah: i,
    raw, norm: scratch.normArabic(raw), state: 'pending', variants: null
  }));
  toks.forEach((tk, i) => {
    tk.variants = scratch.variantsFor(tk.raw, tk.norm, toks[i + 1] ? toks[i + 1].norm : '');
  });
  const m = new TasmeeMatcher();
  m.setTokens(toks.map((tk, i) => Object.assign({}, tk, { idx: i, state: 'pending' })));
  m.feedTranscript('قل كونوا حجارة او حديدا');
  assert.strictEqual(m.position, 5);
  // simulate tpSkipBack: rebuild from index 0 with reset states
  m.setTokens(toks.map((tk, i) => Object.assign({}, tk, { idx: i, state: 'pending' })));
  assert.strictEqual(m.position, 0, 'retry starts from the ayah start');
  m.feedTranscript('قل كونوا حجارة او حديدا');
  assert.strictEqual(m.score().correct, 5, 'retry matches cleanly');
});

console.log('\n' + passed + ' tests passed');
