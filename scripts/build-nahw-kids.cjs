#!/usr/bin/env node
// Builds data/nahw/kids.json — «النحو خطوة خطوة», the graded lessons of pages/nahw-kids.html —
// from scripts/nahw/kids/level-<n>.cjs.
//
// A lesson: { id, title, rule, points[], ex[], parent: { say, play }, quiz[] }; a level adds
// { title, age, goal, lessons[], test[] } (test: extra mixed questions for the level test).
//
// Our own sentences are written with a small markup: {word|label} labels a word in an
// example, {word} marks the answer of a tap question or the word a choice question asks
// about. A Quranic example or question names its ayah instead — { q: '96:2', w: [1, 4],
// m: { 2: 'مفعول به' } } or { tap, q, w, ans: [2] } — and its words are taken from
// data/quran.json (text_uthmani), so they cannot be mistyped.
//
// Checked:
//   • ids unique; every lesson has a rule, points, ≥2 examples, the parent's guide and ≥3
//     questions; every level has a test
//   • every word of our own sentences carries its vowels (a word of two letters or more
//     with no haraka fails)
//   • a tap question has ≥1 answer and something else to tap; a choice question has 2–3
//     wrong options, all different from each other and from the answer; a sentence it
//     asks about marks exactly one word
//   • a Quranic reference exists, its word range is inside the ayah, and every label and
//     answer is inside the range
//
//   node scripts/build-nahw-kids.cjs          build
//   node scripts/build-nahw-kids.cjs --check  verify data/nahw/kids.json is current
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(__dirname, 'nahw', 'kids');
const OUT = path.join(ROOT, 'data', 'nahw', 'kids.json');
const LEVELS = fs.readdirSync(SRC).filter(f => /^level-\d+\.cjs$/.test(f))
  .sort((a, b) => parseInt(a.slice(6), 10) - parseInt(b.slice(6), 10));

const QURAN = {};
const SURAH = {};
for (const a of JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'quran.json'), 'utf8'))) {
  QURAN[a.surah + ':' + a.ayah] = a.text_uthmani.split(/\s+/).filter(w => /[ء-يٱ]/.test(w));
  // «سُورَةُ ٱلْإِخْلَاصِ» → «الإخلاص»
  SURAH[a.surah] = a.surah_name.replace(/^سُورَةُ\s*/, '').replace(/ٱ/g, 'ا').replace(/[\u064B-\u0652\u0670\u06D6-\u06ED]/g, '');
}

const errors = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const HARAKA = /[ً-ْ]/;
const LETTERS = /[ء-يٱ]/g;

// our own sentence → tokens [word, label, after]; label: '' none, true = marked ({word})
function parse(s, where) {
  if (typeof s !== 'string' || !s.trim()) { err(where, 'empty sentence'); return []; }
  if ((s.match(/\{/g) || []).length !== (s.match(/\}/g) || []).length) err(where, 'unbalanced braces: ' + s);
  const toks = [];
  const re = /([^\s{}]*)\{([^{}|]+)(?:\|([^{}]+))?\}([^\s{}]*)|([^\s{}]+)/g;
  let m;
  while ((m = re.exec(s))) toks.push(m);
  const rest = s.replace(re, '').trim();
  if (rest) err(where, 'bad markup: ' + rest);
  return toks.map(m => {
    let word, label = '', before = '', after = '';
    if (m[2] !== undefined) {
      before = m[1]; word = m[2].trim(); label = m[3] === undefined ? true : m[3].trim(); after = m[4];
      if (label === '') err(where, 'empty label: ' + m[0]);
      if (/\s/.test(word)) err(where, 'a marked word with a space: ' + word);
    } else { if (/\|/.test(m[5])) err(where, 'bad markup: ' + m[5]); word = m[5]; }
    const bare = [...word].filter(c => { const k = c.charCodeAt(0); return (k >= 0x621 && k <= 0x652) || k === 0x670; }).join('');   // letters and vowel marks only
    if ((bare.match(LETTERS) || []).length >= 2 && !HARAKA.test(bare)) err(where, `«${word}» has no vowels`);
    return before ? [before + word, label, after] : [word, label, after];
  });
}

function ayah(o, where) {
  const words = QURAN[o.q];
  if (!words) { err(where, 'no ayah ' + o.q); return null; }
  const [a, b] = o.w || [1, words.length];
  if (!(a >= 1 && b <= words.length && a <= b)) { err(where, `words ${a}–${b} outside ${o.q} (${words.length} words)`); return null; }
  const s = o.q.split(':');
  return { a, b, words, ref: `${SURAH[s[0]]}: ${s[1]}` };
}

function example(e, where) {
  if (typeof e === 'string') {
    const t = parse(e, where);
    if (!t.some(x => typeof x[1] === 'string' && x[1])) err(where, 'example labels nothing');
    if (t.some(x => x[1] === true)) err(where, 'unlabelled {word} in an example');
    return { t: t.map(x => [x[0], x[1] || '', x[2]]) };
  }
  const A = ayah(e, where); if (!A) return null;
  const m = e.m || {};
  for (const k of Object.keys(m)) if (!(k >= A.a && k <= A.b)) err(where, `label on word ${k}, outside ${A.a}–${A.b}`);
  const t = A.words.slice(A.a - 1, A.b).map((w, i) => [w, m[A.a + i] || '', '']);
  const out = { t, q: A.ref };
  if (e.n) out.n = e.n;
  return out;
}

function question(x, where) {
  if (x.tap !== undefined) {
    let t;
    if (x.q) {
      const A = ayah(x, where); if (!A) return null;
      for (const k of x.ans || []) if (!(k >= A.a && k <= A.b)) err(where, `answer ${k} outside ${A.a}–${A.b}`);
      t = A.words.slice(A.a - 1, A.b).map((w, i) => [w, (x.ans || []).includes(A.a + i) ? 1 : 0, '']);
    } else {
      const p = parse(x.s, where);
      if (p.some(y => typeof y[1] === 'string' && y[1])) err(where, 'a label in a tap question');
      t = p.map(y => [y[0], y[1] === true ? 1 : 0, y[2]]);
    }
    const n = t.filter(y => y[1]).length;
    if (!n) err(where, 'tap question without an answer');
    if (n === t.length) err(where, 'every word is an answer');
    const out = { k: 'tap', p: x.tap, t };
    if (x.q) out.ref = ayah(x, where).ref;
    return out;
  }
  if (x.mc !== undefined) {
    const o = x.o || [];
    if (!x.a) err(where, 'no answer');
    if (o.length < 1 || o.length > 3) err(where, `${o.length} wrong options`);
    if (new Set([x.a, ...o]).size !== o.length + 1) err(where, 'options repeat: ' + [x.a, ...o].join(' / '));
    const out = { k: 'mc', p: x.mc, a: x.a, o };
    if (x.s) {
      const p = parse(x.s, where);
      if (p.filter(y => y[1] === true).length !== 1 || p.some(y => typeof y[1] === 'string' && y[1])) err(where, 'the sentence must mark exactly one word: ' + x.s);
      out.s = p.map(y => [y[0], y[1] === true ? 1 : 0, y[2]]);
    }
    if (x.why) out.why = x.why;
    return out;
  }
  err(where, 'unknown question ' + JSON.stringify(x).slice(0, 80));
  return null;
}

const ids = new Set();
const levels = LEVELS.map((f, li) => {
  const L = require(path.join(SRC, f));
  const lid = 'l' + (li + 1);
  for (const k of ['title', 'age', 'goal']) if (!L[k]) err(lid, 'no ' + k);
  const lessons = (L.lessons || []).map(s => {
    const where = `${lid}/${s.id}`;
    if (!s.id || ids.has(where)) err(where, 'missing or repeated id');
    ids.add(where);
    for (const k of ['title', 'rule']) if (!s[k]) err(where, 'no ' + k);
    if (!(s.points || []).length) err(where, 'no points');
    if ((s.ex || []).length < 2) err(where, 'fewer than 2 examples');
    if (!s.parent || !s.parent.say || !s.parent.play) err(where, 'no parent guide');
    if ((s.quiz || []).length < 3) err(where, 'fewer than 3 questions');
    return {
      id: s.id, title: s.title, rule: s.rule, points: s.points || [],
      ex: (s.ex || []).map((e, i) => example(e, `${where} ex ${i + 1}`)).filter(Boolean),
      parent: s.parent || {},
      quiz: (s.quiz || []).map((q, i) => question(q, `${where} q ${i + 1}`)).filter(Boolean),
    };
  });
  if (!lessons.length) err(lid, 'no lessons');
  if (!(L.test || []).length) err(lid, 'no test questions');
  return {
    id: lid, title: L.title, age: L.age, goal: L.goal, lessons,
    test: (L.test || []).map((q, i) => question(q, `${lid} test q ${i + 1}`)).filter(Boolean),
  };
});

if (errors.length) { console.error('✗ ' + errors.slice(0, 25).join('\n✗ ') + (errors.length > 25 ? `\n… ${errors.length - 25} more` : '')); process.exit(1); }
const out = {
  v: 1,
  note: 'دروس من إعداد التطبيق، مبنية على القواعد المتفق عليها في كتب النحو المدرسية والمتون (كالآجرومية وشروحها). يُستحسن أن يراجعها المعلّم أو الوالد مع الطفل.',
  levels,
};
const text = JSON.stringify(out);
const nL = levels.reduce((n, l) => n + l.lessons.length, 0);
const nQ = levels.reduce((n, l) => n + l.test.length + l.lessons.reduce((m, s) => m + s.quiz.length, 0), 0);
const nE = levels.reduce((n, l) => n + l.lessons.reduce((m, s) => m + s.ex.length, 0), 0);
if (process.argv.includes('--check')) {
  if (!fs.existsSync(OUT) || fs.readFileSync(OUT, 'utf8') !== text) { console.error('✗ data/nahw/kids.json is out of date — run node scripts/build-nahw-kids.cjs'); process.exit(1); }
} else { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, text); }
console.log(`✓ data/nahw/kids.json: ${levels.length} levels, ${nL} lessons, ${nE} examples, ${nQ} questions (all checked)`);
