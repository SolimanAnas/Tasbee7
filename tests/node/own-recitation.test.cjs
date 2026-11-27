// Unit tests for js/own-recitation.js with synthetic "recitations": bursts of a tone
// (the voice) separated by silence. Run: node tests/node/own-recitation.test.cjs
const assert = require('assert');
const R = require('../../js/own-recitation.js');

const SR = 16000;
let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) - 0.5;

// parts: ['v', seconds] = voice, ['s', seconds] = silence. noise = background level.
function build(parts, noise = 0.002) {
  const len = Math.round(parts.reduce((a, p) => a + p[1], 0) * SR);
  const out = new Float32Array(len);
  let t = 0;
  const marks = [];
  for (const [kind, sec] of parts) {
    const n = Math.round(sec * SR);
    if (kind === 'v') {
      marks.push(t / SR);
      for (let i = 0; i < n; i++) {
        // a wobbling "syllable" rhythm so the loudness is not flat, with short fades
        const env = Math.min(1, i / 400, (n - i) / 400) * (0.55 + 0.45 * Math.sin(i / 700));
        out[t + i] = 0.4 * env * Math.sin(i * 0.13) + noise * rnd();
      }
    } else for (let i = 0; i < n; i++) out[t + i] = noise * rnd();
    t += n;
  }
  return { ch: out, starts: marks, seconds: len / SR };
}
const env = ch => R.envelopeDb(ch, ch, SR);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a.toFixed(2)} vs ${b.toFixed(2)}`);

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok  -', name); }

test('clean pauses: finds every ayah start, with high confidence', () => {
  // 7 ayat of different lengths, 0.8 s apart
  const parts = [['s', 0.5]];
  [1.4, 2.2, 1.8, 3.0, 2.4, 1.6, 4.0].forEach((v, i, a) => { parts.push(['v', v]); if (i < a.length - 1) parts.push(['s', 0.8]); });
  parts.push(['s', 1.0]);
  const { ch, starts, seconds } = build(parts);
  const r = R.autoSplit(env(ch), R.HOP, 7);
  assert.strictEqual(r.method, 'silence');
  assert.strictEqual(r.markers.length, 7);
  assert.strictEqual(r.confidence, 'high');
  r.markers.forEach((m, i) => { assert.ok(m <= starts[i] + 0.02, `marker ${i} before the voice`); near(m, starts[i], 0.45, `marker ${i}`); });
  assert.ok(r.end <= seconds && r.end > starts[6] + 3.5, 'end after the last voice');
});

test('breaths inside an ayah (shorter pauses) are not taken as boundaries', () => {
  // ayah 1 has a 0.3 s breath inside, ayah 2 has two; the pauses between ayat are 0.9 s
  const parts = [['s', 0.4], ['v', 1.0], ['s', 0.3], ['v', 1.1], ['s', 0.9], ['v', 0.8], ['s', 0.28], ['v', 0.7], ['s', 0.3], ['v', 0.9], ['s', 0.9], ['v', 2.0], ['s', 0.5]];
  const { ch } = build(parts);
  const r = R.autoSplit(env(ch), R.HOP, 3);
  assert.strictEqual(r.markers.length, 3);
  near(r.markers[1], 0.4 + 1.0 + 0.3 + 1.1 + 0.9, 0.3, 'second ayah start');
  near(r.markers[2], 0.4 + 1.0 + 0.3 + 1.1 + 0.9 + 0.8 + 0.28 + 0.7 + 0.3 + 0.9 + 0.9, 0.3, 'third ayah start');
  assert.ok(['high', 'medium'].includes(r.confidence), 'confidence ' + r.confidence);
});

test('pauses of similar length everywhere: low confidence', () => {
  // 6 voice parts, all pauses 0.5 s; asking for 3 ayat cannot be decided
  const parts = [];
  for (let i = 0; i < 6; i++) { parts.push(['v', 1.2]); if (i < 5) parts.push(['s', 0.5]); }
  const { ch } = build(parts);
  const r = R.autoSplit(env(ch), R.HOP, 3);
  assert.ok(r.markers && r.markers.length === 3);
  assert.strictEqual(r.confidence, 'low');
});

test('fewer pauses than ayat: no split proposed, caller falls back', () => {
  const { ch } = build([['v', 2], ['s', 0.8], ['v', 2], ['s', 0.8], ['v', 2]]);
  const r = R.autoSplit(env(ch), R.HOP, 6);
  assert.strictEqual(r.markers, null);
  assert.strictEqual(r.found, 2);
});

test('one ayah: starts a little before the voice, ends a little after it', () => {
  const { ch, starts } = build([['s', 1.0], ['v', 3.0], ['s', 1.5]]);
  const r = R.autoSplit(env(ch), R.HOP, 1);
  assert.strictEqual(r.markers.length, 1);
  near(r.markers[0], starts[0] - 0.15, 0.1, 'start');
  near(r.end, 1.0 + 3.0 + 0.2, 0.1, 'end');
});

test('silence or flat noise: nothing to split', () => {
  const quiet = new Float32Array(SR * 5);
  assert.strictEqual(R.autoSplit(env(quiet), R.HOP, 3).confidence, 'none');
  const hiss = new Float32Array(SR * 5).map(() => 0.1 * rnd());
  assert.strictEqual(R.autoSplit(env(hiss), R.HOP, 3).markers, null);
});

test('a click in the silence is not a boundary', () => {
  const parts = [['s', 0.5], ['v', 1.5], ['s', 1.2], ['v', 1.5], ['s', 0.5]];
  const { ch } = build(parts);
  ch[Math.round(1.6 * SR) + 1000] = 0.9;     // a one-sample click
  const r = R.autoSplit(env(ch), R.HOP, 2);
  assert.strictEqual(r.markers.length, 2);
  near(r.markers[1], 0.5 + 1.5 + 1.2, 0.3, 'second ayah');
});

test('stereo: the mono mix is used', () => {
  const { ch } = build([['s', 0.5], ['v', 1], ['s', 0.8], ['v', 1], ['s', 0.5]]);
  const right = ch.map(v => -v * 0.5);                 // out of phase and quieter
  const e = R.envelopeDb(ch, right, SR);
  assert.ok(e.length > 100 && e.every(v => Number.isFinite(v)));
});

test('proportional split follows the text lengths', () => {
  const m = R.proportional(1, 11, [10, 30, 60]);
  near(m[0], 1, 1e-9, 'first'); near(m[1], 2, 1e-9, 'second'); near(m[2], 5, 1e-9, 'third');
});

test('normalizeMarkers keeps them ascending, spaced and inside the recording', () => {
  const m = R.normalizeMarkers([5, 3, 3.05, 99], 10, 0.2);
  assert.ok(m.every((v, i) => i === 0 || v >= m[i - 1] + 0.2 - 1e-9), JSON.stringify(m));
  assert.ok(m[m.length - 1] < 10 && m[0] >= 0);
});

test('outline is in 0..1 and has the requested number of bars', () => {
  const { ch } = build([['s', 1], ['v', 2], ['s', 1]]);
  const o = R.outline(env(ch), 120);
  assert.strictEqual(o.length, 120);
  assert.ok(o.every(v => v >= 0 && v <= 1));
  assert.ok(Math.max(...o) > 0.8 && Math.min(...o) < 0.2);
});

test('recorder taps snap to the pause nearest each tap', () => {
  const parts = [['s', 0.4]];
  const V = [1.5, 2.0, 1.2, 2.5];
  V.forEach((v, i) => { parts.push(['v', v]); if (i < V.length - 1) parts.push(['s', 0.7]); });
  parts.push(['s', 0.6]);
  const { ch, starts } = build(parts);
  // taps late by 0.2–0.9 s, one a little early
  const taps = [starts[1] + 0.6, starts[2] - 0.25, starts[3] + 0.9];
  const r = R.snapTaps(env(ch), R.HOP, taps, 4);
  assert.strictEqual(r.markers.length, 4);
  assert.strictEqual(r.snapped, 3);
  r.markers.forEach((m, i) => { assert.ok(m <= starts[i] + 0.02, 'before the voice ' + i); near(m, starts[i], 0.4, 'marker ' + i); });
});

test('a breath near the tap does not win over the real pause', () => {
  // ayah 2 starts at 3.0 s after a 0.8 s pause; a 0.15 s breath sits at 3.9 s inside it
  const parts = [['s', 0.3], ['v', 1.9], ['s', 0.8], ['v', 0.75], ['s', 0.15], ['v', 1.5], ['s', 0.5]];
  const { ch } = build(parts);
  const r = R.snapTaps(env(ch), R.HOP, [3.5], 2);
  near(r.markers[1], 3.0, 0.3, 'second ayah');
});

test('no pause near a tap: the marker sits just before the tap', () => {
  const { ch } = build([['s', 0.3], ['v', 6], ['s', 0.5]]);
  const r = R.snapTaps(env(ch), R.HOP, [3.0], 2);
  assert.strictEqual(r.snapped, 0);
  near(r.markers[1], 2.7, 0.05, 'fallback');
});

test('fewer taps than ayat: only the tapped markers come back', () => {
  const { ch, starts } = build([['s', 0.3], ['v', 1], ['s', 0.8], ['v', 1], ['s', 0.8], ['v', 1], ['s', 0.3]]);
  const r = R.snapTaps(env(ch), R.HOP, [starts[1] + 0.3], 3);
  assert.strictEqual(r.markers.length, 2);
});

test('snapOne: a late tap snaps to the pause before it, after the previous marker', () => {
  const parts = [['s', 0.4], ['v', 1.5], ['s', 0.8], ['v', 2.0], ['s', 0.7], ['v', 1.2], ['s', 0.5]];
  const { ch, starts } = build(parts);
  const e = env(ch);
  const r = R.snapOne(e, R.HOP, starts[1] + 0.7, starts[0]);       // tapped 0.7 s after the voice began
  assert.strictEqual(r.snapped, true);
  near(r.m, starts[1], 0.3, 'snapped');
  assert.ok(r.m <= starts[1] + 0.02, 'before the voice');
  // it never lands before the previous marker
  const early = R.snapOne(e, R.HOP, 0.5, starts[1]);
  assert.ok(early.m >= starts[1] + R.MIN_GAP - 1e-9, 'after the previous marker: ' + early.m);
});

test('snapOne: no pause near the tap: just before the tap', () => {
  const { ch } = build([['s', 0.3], ['v', 6], ['s', 0.5]]);
  const r = R.snapOne(env(ch), R.HOP, 3.0, 0.3);
  assert.strictEqual(r.snapped, false);
  near(r.m, 2.7, 0.05, 'fallback');
});

test('resplit: after a fixed ayah the next ones follow the real pauses, not a breath', () => {
  // ayah 4 follows ayah 3 with a pause too short to see (the auto split misses it, and takes the
  // breath inside ayah 5 instead); the user fixes ayah 4, and the ones after it follow again
  const parts = [['s', 0.5], ['v', 1.4], ['s', 0.8], ['v', 2.2], ['s', 0.8], ['v', 1.8], ['s', 0.1], ['v', 3.0],
    ['s', 0.8], ['v', 1.0], ['s', 0.35], ['v', 1.4], ['s', 0.8], ['v', 1.6], ['s', 0.8], ['v', 4.0], ['s', 1.0]];
  const { ch, starts } = build(parts);
  const e = env(ch);
  const auto = R.autoSplit(e, R.HOP, 7);
  assert.ok(Math.abs(auto.markers[3] - starts[3]) > 1, 'the auto split misses ayah 4');
  const fixed = starts[3] - 0.1;
  const r = R.resplit(e, R.HOP, fixed, auto.end, [30, 40, 25, 60]);
  assert.strictEqual(r.length, 4);
  assert.strictEqual(r[0], fixed);
  near(r[1], starts[4], 0.3, 'ayah 5');
  near(r[2], starts[6], 0.3, 'ayah 6');        // starts[5] is the breath inside ayah 5
  near(r[3], starts[7], 0.3, 'ayah 7');
});

test('resplit: a pause just before the fixed marker is not taken as the next boundary', () => {
  const { ch, starts } = build([['s', 0.4], ['v', 1.5], ['s', 0.9], ['v', 2.0], ['s', 0.7], ['v', 1.2], ['s', 0.5]]);
  const e = env(ch);
  // the user put ayah 2 at the start of the pause before it
  const r = R.resplit(e, R.HOP, starts[1] - 0.85, starts[2] + 1.4, [20, 15]);
  near(r[1], starts[2], 0.3, 'ayah 3');
});

test('resplit: too few pauses: shared by text length', () => {
  const { ch } = build([['s', 0.3], ['v', 6], ['s', 0.5]]);
  const r = R.resplit(env(ch), R.HOP, 0.2, 6.3, [1, 1, 2]);
  assert.strictEqual(r.length, 3);
  near(r[1], 1.725, 0.01, 'by text'); near(r[2], 3.25, 0.01, 'by text');
});

console.log(`\n${passed} tests passed`);
