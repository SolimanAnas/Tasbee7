// CI guard: data/quran.json is the app's single stored copy of the Quran text.
// It must never change by accident — not by an editor's "format on save", a
// find-and-replace, a merge, or a script that was meant for something else.
//
// This check fails unless the file is byte-for-byte the one whose SHA-256 is
// recorded in data/quran.sha256, and re-proves its shape on every run:
// 6,236 ayahs, the Hafs count for each of the 114 surahs, strict mushaf order,
// and no invisible control/format characters inside the text.
//
// Changing the text on purpose (regenerating it from the source named in
// ATTRIBUTION.md with scripts/build-quran-json.cjs) means updating the
// checksum in the same commit:
//   node scripts/verify-quran.cjs --update
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'data', 'quran.json');
const SUM = path.join(ROOT, 'data', 'quran.sha256');

const AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111,
  110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83,
  182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96,
  29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31,
  50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5,
  8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

// Code point of the first control/format character in a string, or 0.
// Ranges: C0 and C1 controls, zero-width and bidi marks, word joiners, BOM.
const INVISIBLE = [[0x0000, 0x001F], [0x007F, 0x009F], [0x200B, 0x200F], [0x202A, 0x202E], [0x2060, 0x2064], [0xFEFF, 0xFEFF]];
function invisibleChar(text) {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (INVISIBLE.some(([lo, hi]) => c >= lo && c <= hi)) return c;
  }
  return 0;
}

const raw = fs.readFileSync(FILE);
const hash = crypto.createHash('sha256').update(raw).digest('hex');
const errors = [];

let list;
try { list = JSON.parse(raw.toString('utf8')); }
catch (e) { console.error('✗ data/quran.json is not valid JSON: ' + e.message); process.exit(1); }

if (!Array.isArray(list) || list.length !== 6236) {
  errors.push(`expected 6236 ayahs, found ${Array.isArray(list) ? list.length : 'a non-array'}`);
} else {
  let i = 0;
  for (let s = 1; s <= 114; s++) {
    for (let a = 1; a <= AYAH_COUNTS[s - 1]; a++, i++) {
      const v = list[i];
      if (!v || v.surah !== s || v.ayah !== a) {
        errors.push(`entry ${i}: expected ${s}:${a}, found ${v ? v.surah + ':' + v.ayah : 'nothing'}`);
        s = 115; break; // one ordering error is enough; the rest would cascade
      }
      for (const field of ['text_uthmani', 'text_clean']) {
        const t = v[field];
        if (typeof t !== 'string' || !t.trim()) { errors.push(`${s}:${a} ${field} is empty`); continue; }
        if (t !== t.trim()) errors.push(`${s}:${a} ${field} has leading/trailing space`);
        // Control and format characters (BOM, zero-width marks, bidi controls…)
        // are not part of the text and are invisible in review.
        const bad = invisibleChar(t);
        if (bad) errors.push(`${s}:${a} ${field} contains U+${bad.toString(16).toUpperCase().padStart(4, '0')}`);
      }
    }
  }
}

if (process.argv.includes('--update')) {
  if (errors.length) {
    console.error('✗ Not updating the checksum — the file fails validation:');
    errors.slice(0, 20).forEach(e => console.error('  ' + e));
    process.exit(1);
  }
  fs.writeFileSync(SUM, hash + '  data/quran.json\n');
  console.log('✓ data/quran.sha256 updated: ' + hash);
  process.exit(0);
}

let expected = '';
try { expected = fs.readFileSync(SUM, 'utf8').trim().split(/\s+/)[0]; } catch (_) {}
if (!expected) errors.push('data/quran.sha256 is missing');
else if (expected !== hash) {
  errors.push('data/quran.json has changed: SHA-256 is ' + hash + ', recorded ' + expected +
    '. If the change is intended, regenerate from the source and run: node scripts/verify-quran.cjs --update');
}

if (errors.length) {
  console.error(`✗ Quran text check failed (${errors.length}):`);
  errors.slice(0, 20).forEach(e => console.error('  ' + e));
  process.exit(1);
}
console.log('✓ Quran text: 6236 ayahs, 114 surahs, order and checksum verified.');
