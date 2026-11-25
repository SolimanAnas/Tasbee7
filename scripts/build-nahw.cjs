#!/usr/bin/env node
// Builds data/nahw/<matn>.json for the «تعلم النحو» page (pages/nahw.html) from the
// sources kept in scripts/nahw/:
//
//   ajurrumiyya-source.json     المقدمة الآجرومية, fully vowelled by the app, split into
//                               units (a sentence or short paragraph each) under the
//                               matn's own chapters
//   ajurrumiyya-reference.json  Shamela 11371 (دار الصميعي), the matn as published
//                               there, used ONLY to check the letters
//   sharh-ajurrumiyya.json      the simple explanation of each unit
//
// Checked:
//   • units numbered 1…N, each in a chapter, with a sharh, and no sharh for a unit that
//     does not exist; no markup
//   • the LETTERS of the vowelled text equal the reference's, word for word (vowels,
//     hamza and alef forms, ى/ي, ة/ه and punctuation do not count). Where ours differs
//     from Shamela on purpose, the difference is listed below with its reason; each must
//     apply exactly once, so an unexplained difference — or an unused exception — fails.
//
//   node scripts/build-nahw.cjs          build
//   node scripts/build-nahw.cjs --check  verify the built files are current
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(__dirname, 'nahw');
const OUT = path.join(ROOT, 'data', 'nahw');
const read = f => JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));

const MATN = [
  {
    id: 'ajurrumiyya', title: 'المقدمة الآجرومية', short: 'الآجرومية',
    author: 'أبو عبد الله محمد بن محمد بن داود الصنهاجي، ابن آجُرُّوم (ت 723هـ)',
    sourceText: 'نص المتن من «متن الآجرومية» (دار الصميعي، ١٤١٩هـ) في المكتبة الشاملة، مشكولًا في التطبيق، ومقابَلًا حرفًا حرفًا بالأصل المنشور، وبما أورده الشيخ محمد محيي الدين عبد الحميد في «التحفة السنية».',
    sourceUrl: 'https://shamela.ws/book/11371',
    sharhRefs: 'مستفاد من «التحفة السنية بشرح المقدمة الآجرومية» لمحمد محيي الدين عبد الحميد',
    // Where ours differs from Shamela's letters, deliberately (skeleton words → skeleton words).
    exceptions: [
      ['الكسره والياء والفتحه وللخفض ثلاث علامات', 'وللخفض ثلاث علامات الكسره والياء والفتحه', 'الخفض: الشاملة تطبع «الكسرة، والياء، والفتحة.» قبل «وللخفض ثلاث علامات:» فتنفصل عنها؛ ترتيبها في التحفة السنية: «وللخفض ثلاث علامات: الكسرة، والياء، والفتحة»'],
      ['وجمع التكسير المنصرف وفي جمع المؤنث', 'وجمع التكسير المنصرف وجمع المؤنث', 'الخفض بالكسرة: «وفي» زائدة في نسخة الشاملة؛ ليست في نص التحفة السنية'],
      ['لم لما الم الما ولام', 'لم ولما والم والما ولام', 'الجوازم: العطف بالواو كما في نص التحفة السنية'],
      ['ما قام الا زيدا والا زيد', 'ما قام القوم الا زيد والا زيدا', 'المستثنى بعد منفي تام: «القوم» ساقطة في نسخة الشاملة فلا يكون الكلام تامًّا؛ والمثال في التحفة السنية: «ما قام القوم إلا زيدٌ»'],
    ],
  },
];

const H = /[ً-ْٰـ]/g;
function skeleton(s) {
  return s.replace(H, '')
    .replace(/[«»"“”]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[^ء-ي\s]/g, ' ')
    .split(/\s+/).filter(Boolean).join(' ');
}

function build(m) {
  const src = read(`${m.id}-source.json`);
  const sharh = read(`sharh-${m.id}.json`);
  const ref = read(`${m.id}-reference.json`);
  const errors = [];
  const units = src.units.map(u => ({ n: u.n, sec: u.sec, t: u.t, sharh: sharh[String(u.n)] }));
  units.forEach((u, i) => {
    if (u.n !== i + 1) errors.push(`unit ${i + 1} numbered ${u.n}`);
    if (!u.sec) errors.push(`unit ${u.n}: no chapter`);
    if (!u.t || !u.t.trim()) errors.push(`unit ${u.n}: no text`);
    if (!u.sharh || !u.sharh.trim()) errors.push(`unit ${u.n}: no sharh`);
    for (const t of [u.t || '', u.sharh || '']) if (/<\s*\/?\s*[a-z]/i.test(t)) errors.push(`unit ${u.n}: markup`);
  });
  const extra = Object.keys(sharh).filter(k => !(k >= 1 && k <= units.length));
  if (extra.length) errors.push('sharh for unknown units: ' + extra.join(', '));
  // letters against the reference
  let refSk = skeleton(ref.lines.join(' '));
  const mine = skeleton(units.map(u => u.t).join(' '));
  for (const [from, to, why] of m.exceptions) {
    const parts = refSk.split(from);
    if (parts.length !== 2) { errors.push(`exception not applicable exactly once (${parts.length - 1}×): ${why}`); continue; }
    refSk = parts[0] + to + parts[1];
  }
  if (refSk !== mine) {
    const a = refSk.split(' '), b = mine.split(' ');
    let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
    errors.push(`letters differ from the reference at word ${i}: …${a.slice(Math.max(0, i - 3), i + 4).join(' ')} | ours …${b.slice(Math.max(0, i - 3), i + 4).join(' ')}`);
  }
  const chapters = [];
  units.forEach(u => { if (!chapters.length || chapters[chapters.length - 1].title !== u.sec) chapters.push({ title: u.sec, from: u.n }); });
  const out = {
    v: 1, id: m.id, title: m.title, short: m.short, author: m.author,
    source: m.sourceText, sourceUrl: m.sourceUrl,
    sharhNote: 'شرح مبسّط من إعداد التطبيق للمبتدئين، ' + m.sharhRefs + '. يُراجَع مع شيخٍ متقن، والتلقّي هو الأصل في تعلّم العربية.',
    chapters, units,
  };
  return { out, errors };
}

const check = process.argv.includes('--check');
let failed = false;
if (!check) fs.mkdirSync(OUT, { recursive: true });
for (const m of MATN) {
  const { out, errors } = build(m);
  const file = path.join(OUT, m.id + '.json');
  const text = JSON.stringify(out);
  if (errors.length) { failed = true; console.error(`✗ ${m.id}: ${errors.slice(0, 10).join('; ')}`); continue; }
  if (check) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) { failed = true; console.error(`✗ data/nahw/${m.id}.json is out of date — run node scripts/build-nahw.cjs`); continue; }
  } else fs.writeFileSync(file, text);
  console.log(`✓ data/nahw/${m.id}.json: ${out.units.length} units, ${out.chapters.length} chapters, sharh for each, letters equal to the reference (${m.exceptions.length} documented differences)`);
}
if (failed) process.exit(1);
