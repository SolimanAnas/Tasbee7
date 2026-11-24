#!/usr/bin/env node
// Builds data/tajweed/<matn>.json for the «تعلم التجويد» page (pages/tajweed.html)
// from the sources kept in scripts/tajweed/:
//
//   tuhfa-source.json      تحفة الأطفال — the al-Dabba' edition (Shamela 9632):
//                          vowelled text + al-Dabba''s short notes (public domain)
//   jazariyya-source.json  المقدمة الجزرية — qiraat-api (checked by the app's owner),
//                          identical to the critical edition (Shamela 581) in abyat
//                          1–106 and 108, chapter headings from that edition
//   sharh-*.json           the simple explanation of each bayt (one per bayt)
//   *-audio.json           recordings («مكتبة قرآني» on archive.org); for the Tuhfa
//                          with the published start/end of every bayt
//
// Checked: abyat numbered 1…N with both hemistichs, a chapter for each, a sharh
// for every bayt and none extra, no markup, timings for every bayt in order and
// inside the recording.
//
//   node scripts/build-tajweed.cjs          build
//   node scripts/build-tajweed.cjs --check  verify the built files are current
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(__dirname, 'tajweed');
const OUT = path.join(ROOT, 'data', 'tajweed');
const read = f => JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));

const MUTUN = [
  { id: 'tuhfa', title: 'تحفة الأطفال والغلمان في تجويد القرآن', author: 'سليمان بن حسين الجمزوري (ت بعد 1198هـ)', count: 61,
    sharhRefs: 'مستفاد من شرح الشيخ علي محمد الضبّاع الوجيز على التحفة، ومن «فتح الأقفال بشرح تحفة الأطفال» للناظم',
    timed: true },
  { id: 'jazariyya', title: 'المقدمة فيما يجب على قارئ القرآن أن يعلمه (الجزرية)', author: 'محمد بن محمد ابن الجزري (ت 833هـ)', count: 109,
    sharhRefs: 'مستفاد من «الحواشي المفهمة في شرح المقدمة» لابن الناظم، و«المنح الفكرية في شرح المقدمة الجزرية» للملا علي القاري',
    timed: false },
];

function build(m) {
  const src = read(`${m.id}-source.json`);
  const sharh = read(`sharh-${m.id}.json`);
  const audio = read(`${m.id}-audio.json`);
  const errors = [];
  const abyat = src.abyat.map(b => ({ n: b.n, sec: b.sec, a: b.a, b: b.b, sharh: sharh[String(b.n)], ...(b.dabba && b.dabba.length ? { dabba: b.dabba } : {}) }));
  if (abyat.length !== m.count) errors.push(`${abyat.length} abyat, expected ${m.count}`);
  abyat.forEach((b, i) => {
    if (b.n !== i + 1) errors.push(`bayt ${i + 1} numbered ${b.n}`);
    if (!b.a || !b.b) errors.push(`bayt ${b.n}: a hemistich is missing`);
    if (!b.sec) errors.push(`bayt ${b.n}: no chapter`);
    if (!b.sharh || !b.sharh.trim()) errors.push(`bayt ${b.n}: no sharh`);
    for (const t of [b.a, b.b, b.sharh || '', ...(b.dabba || [])]) if (/<\s*\/?\s*[a-z]/i.test(t)) errors.push(`bayt ${b.n}: markup`);
  });
  const extra = Object.keys(sharh).filter(k => !(k >= 1 && k <= m.count));
  if (extra.length) errors.push('sharh for unknown abyat: ' + extra.join(', '));
  for (const r of audio.reciters) {
    if (!/^https:\/\/archive\.org\/download\//.test(r.url)) errors.push(`${r.id}: unexpected audio host`);
    if (m.timed) {
      if (!Array.isArray(r.abyat) || r.abyat.length !== m.count) { errors.push(`${r.id}: timings for ${r.abyat && r.abyat.length} abyat`); continue; }
      r.abyat.forEach(([s, e], i) => {
        const next = r.abyat[i + 1];
        if (!(s >= 0 && e > s && e <= r.duration + 0.5 && (!next || e <= next[0] + 0.05))) errors.push(`${r.id}: bayt ${i + 1} timing ${s}–${e}`);
      });
    }
  }
  const chapters = [];
  abyat.forEach(b => { if (!chapters.length || chapters[chapters.length - 1].title !== b.sec) chapters.push({ title: b.sec, from: b.n }); });
  const out = {
    v: 1, id: m.id, title: m.title, author: m.author,
    source: src.source, sourceUrl: src.sourceUrl,
    sharhNote: 'شرح مبسّط من إعداد التطبيق للمبتدئين، ' + m.sharhRefs + '. يُراجَع مع شيخٍ متقن، والتلقّي هو الأصل في تعلّم التجويد.',
    audio: { source: audio.source, timed: m.timed, reciters: audio.reciters },
    chapters, abyat,
  };
  return { out, errors };
}

const check = process.argv.includes('--check');
let failed = false;
if (!check) fs.mkdirSync(OUT, { recursive: true });
for (const m of MUTUN) {
  const { out, errors } = build(m);
  const file = path.join(OUT, m.id + '.json');
  const text = JSON.stringify(out);
  if (errors.length) { failed = true; console.error(`✗ ${m.id}: ${errors.slice(0, 10).join('; ')}`); continue; }
  if (check) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) { failed = true; console.error(`✗ data/tajweed/${m.id}.json is out of date — run node scripts/build-tajweed.cjs`); continue; }
  } else fs.writeFileSync(file, text);
  console.log(`✓ data/tajweed/${m.id}.json: ${out.abyat.length} abyat, ${out.chapters.length} chapters, sharh for each, ${out.audio.reciters.length} recordings${m.timed ? ' timed bayt by bayt' : ''}`);
}
if (failed) process.exit(1);
