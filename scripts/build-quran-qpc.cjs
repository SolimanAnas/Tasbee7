#!/usr/bin/env node
// Builds data/quran-qpc.json: the King Fahd Complex "QPC Hafs" encoding of the
// Quran text, which the mushaf font (fonts/uthmani-colored.ttf, a KFGQPC Hafs
// font) is made for. The text mushaf fetches this encoding page by page; the
// video maker needs it offline, so it is stored here.
//
// Nothing is trusted from the network: every ayah must have exactly the letters
// of the checked data/quran.json (QuranTextSource.letters) and contain nothing
// but Arabic script, or the build fails and no file is written.
//
// Output: { "v": 1, "surahs": [[ayah1, ayah2, ...], ...114] } — each ayah
// without its trailing number (the video draws its own ayah marker) and without
// a basmala (quran.com does not prefix one, except 1:1 which is the basmala).
//
//   node scripts/build-quran-qpc.cjs        download, verify, write
//   node scripts/build-quran-qpc.cjs --check  verify the existing file only
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const QTS = require('../js/quran-text-source.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'quran-qpc.json');
const quran = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'quran.json'), 'utf8'));

function localAyat() {
  const surahs = [];
  for (const e of quran) (surahs[e.surah - 1] = surahs[e.surah - 1] || [])[e.ayah - 1] = QTS.ayahOwnText(e);
  return surahs;
}

function verify(data) {
  const local = localAyat();
  const errors = [];
  if (!data || !Array.isArray(data.surahs) || data.surahs.length !== 114) return ['expected 114 surahs'];
  local.forEach((ayat, si) => {
    const got = data.surahs[si];
    if (!Array.isArray(got) || got.length !== ayat.length) { errors.push('surah ' + (si + 1) + ': ayah count'); return; }
    ayat.forEach((t, ai) => {
      const q = got[ai];
      if (!QTS.isQuranScript(q)) errors.push((si + 1) + ':' + (ai + 1) + ' not Arabic script');
      else if (QTS.letters(q) !== QTS.letters(t)) errors.push((si + 1) + ':' + (ai + 1) + ' letters differ');
    });
  });
  return errors;
}

async function download() {
  const surahs = [];
  for (let n = 1; n <= 114; n++) {
    const url = 'https://api.quran.com/api/v4/quran/verses/qpc_hafs?chapter_number=' + n;
    let json;
    for (let attempt = 1; ; attempt++) {
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        json = await r.json();
        break;
      } catch (e) {
        if (attempt >= 4) throw new Error(url + ': ' + e.message);
        await new Promise(res => setTimeout(res, 1000 * attempt));
      }
    }
    const ayat = [];
    for (const v of json.verses) {
      const [s, a] = v.verse_key.split(':').map(Number);
      if (s !== n) throw new Error('unexpected verse ' + v.verse_key);
      // Drop the trailing ayah number (Arabic-Indic digits) the font turns into a medallion.
      ayat[a - 1] = String(v.text_qpc_hafs).replace(/[\s\u00A0]*[\u0660-\u0669]+\s*$/, '').trim();
    }
    surahs.push(ayat);
    process.stdout.write('\r' + n + '/114');
  }
  process.stdout.write('\n');
  return { v: 1, surahs };
}

(async () => {
  const check = process.argv.includes('--check');
  const data = check ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : await download();
  const errors = verify(data);
  if (errors.length) {
    console.error('✗ ' + errors.length + ' problem(s):\n  ' + errors.slice(0, 20).join('\n  '));
    process.exit(1);
  }
  if (!check) fs.writeFileSync(OUT, JSON.stringify(data));
  const hash = crypto.createHash('sha256').update(fs.readFileSync(OUT)).digest('hex');
  console.log('✓ data/quran-qpc.json: 6236 ayat match data/quran.json letter for letter (sha256 ' + hash + ')');
})().catch(e => { console.error(e.message); process.exit(1); });
