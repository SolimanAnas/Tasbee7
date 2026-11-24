#!/usr/bin/env node
// Builds data/translations/<id>.json — one Quran translation per app language,
// shown under the ayah in the text mushaf (pages/quran-text.html), offline.
//
// Source: the Tanzil Project (https://tanzil.net/trans/), "Text (with aya
// numbers)" files. Terms of use: non-commercial use only (this app is free,
// with no ads or payments); an app using more than three of them links back to
// https://tanzil.net/trans/ (the text mushaf's settings and each translation's
// credit line do). The text is stored exactly as published, not modified.
//
// Checked for every translation: 114 surahs, the ayah count of each surah as
// in data/quran.json, every ayah present exactly once, non-empty, no markup.
//
//   node scripts/build-translations.cjs           download, check, write
//   node scripts/build-translations.cjs --check   check the existing files only
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'translations');

// One per app language (js/i18n/*.js). dir: text direction of the translation.
const TRANSLATIONS = [
  { id: 'en.sahih',     lang: 'en',  dir: 'ltr', name: 'Saheeh International' },
  { id: 'tr.diyanet',   lang: 'tr',  dir: 'ltr', name: 'Diyanet İşleri' },
  { id: 'ur.junagarhi', lang: 'ur',  dir: 'rtl', name: 'محمد جوناگڑھی' },
  { id: 'ku.asan',      lang: 'ckb', dir: 'rtl', name: 'بورهان محمد-ئەمین' },
  { id: 'ar.muyassar',  lang: 'ar',  dir: 'rtl', name: 'التفسير الميسر' },
];

// Ayat a published translation leaves empty, checked against a second copy
// of the same translation (Quran.com resource 81 lacks 108:3 too). Kept empty
// rather than filled in; the reader says the translation has no text there.
const KNOWN_GAPS = { 'ku.asan': ['108:3'] };

const quran = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'quran.json'), 'utf8'));
const ayahCounts = [];
for (const v of quran) ayahCounts[v.surah - 1] = Math.max(ayahCounts[v.surah - 1] || 0, v.ayah);

function check(t) {
  const errors = [];
  if (!t || !Array.isArray(t.surahs) || t.surahs.length !== 114) return ['expected 114 surahs'];
  t.surahs.forEach((ayat, i) => {
    if (!Array.isArray(ayat) || ayat.length !== ayahCounts[i]) { errors.push('surah ' + (i + 1) + ': ' + (ayat && ayat.length) + ' ayat, expected ' + ayahCounts[i]); return; }
    ayat.forEach((a, j) => {
      const key = (i + 1) + ':' + (j + 1);
      const gap = (KNOWN_GAPS[t.id] || []).includes(key);
      if (typeof a !== 'string') errors.push(key + ' missing');
      else if (!a.trim() && !gap) errors.push(key + ' empty');
      else if (a.trim() && gap) errors.push(key + ' is no longer empty: remove it from KNOWN_GAPS');
      else if (/<\s*\/?\s*[a-z][^>]*>/i.test(a)) errors.push((i + 1) + ':' + (j + 1) + ' contains markup');
    });
  });
  return errors;
}

async function download(spec) {
  const url = 'https://tanzil.net/trans/?transID=' + encodeURIComponent(spec.id) + '&type=txt-2';
  let text;
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      text = await r.text();
      break;
    } catch (e) {
      if (attempt >= 4) throw new Error(spec.id + ': ' + e.message);
      await new Promise(res => setTimeout(res, 1500 * attempt));
    }
  }
  const surahs = ayahCounts.map(n => new Array(n).fill(null));
  const meta = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^(\d{1,3})\|(\d{1,3})\|(.*)$/);
    if (m) {
      const s = +m[1], a = +m[2];
      if (!surahs[s - 1] || a < 1 || a > surahs[s - 1].length) throw new Error(spec.id + ': unexpected ayah ' + s + ':' + a);
      if (surahs[s - 1][a - 1] !== null) throw new Error(spec.id + ': ayah ' + s + ':' + a + ' twice');
      surahs[s - 1][a - 1] = m[3].trim();
      continue;
    }
    const k = line.match(/^#\s+(Name|Translator|Language|ID|Last Update|Source):\s*(.*)$/);
    if (k) meta[k[1]] = k[2].trim();
  }
  if (meta.ID && meta.ID !== spec.id) throw new Error(spec.id + ': file says ID ' + meta.ID);
  return {
    v: 1, id: spec.id, lang: spec.lang, dir: spec.dir, name: spec.name,
    translator: meta.Translator || spec.name, updated: meta['Last Update'] || '',
    source: 'Tanzil.net — https://tanzil.net/trans/', surahs,
  };
}

(async () => {
  const onlyCheck = process.argv.includes('--check');
  if (!onlyCheck) fs.mkdirSync(OUT_DIR, { recursive: true });
  let failed = false;
  for (const spec of TRANSLATIONS) {
    const file = path.join(OUT_DIR, spec.id + '.json');
    const t = onlyCheck ? JSON.parse(fs.readFileSync(file, 'utf8')) : await download(spec);
    const errors = check(t);
    if (errors.length) { failed = true; console.error('✗ ' + spec.id + ': ' + errors.slice(0, 10).join('; ')); continue; }
    if (!onlyCheck) fs.writeFileSync(file, JSON.stringify(t));
    const gaps = (KNOWN_GAPS[spec.id] || []).length ? ', known gap ' + KNOWN_GAPS[spec.id].join(' ') : '';
    console.log('✓ data/translations/' + spec.id + '.json: 114 surahs, 6236 ayat' + gaps + ' (' + (fs.statSync(file).size / 1048576).toFixed(2) + ' MB)');
  }
  if (failed) process.exit(1);
})().catch(e => { console.error(e.message); process.exit(1); });
