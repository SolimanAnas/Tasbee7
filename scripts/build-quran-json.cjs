#!/usr/bin/env node
/*
 * build-quran-json.cjs
 * ────────────────────
 * Rebuilds data/quran.json from the Quran.com API v4 `text_uthmani` script.
 *
 * WHY: the previous data/quran.json was in KFGQPC "Mushaf al-Madinah" encoding,
 * which carries thousands of tajwid small-meem marks (U+06E2 / U+06ED) that only
 * render correctly in a KFGQPC font. Rendered in Amiri (Tasmee' Pro, quran-text.html)
 * those marks appear as a stray meem on most tanwin. Quran.com's `text_uthmani`
 * is a cleaner Uthmani that renders correctly in Amiri and keeps the small meem at
 * genuine iqlab positions only.
 *
 * WHAT IS PRESERVED (the file's existing contract):
 *   - Array of 6236 objects, field order: surah, ayah, text_uthmani, text_clean,
 *     surah_name, surah_name_en.
 *   - surah_name / surah_name_en are kept verbatim from the current file (their
 *     specific Arabic form "سُورَةُ …" and transliteration "Al-Faatiha" are NOT
 *     Quran.com's scheme, so we do not touch them).
 *   - The basmala is prepended to ayah 1 of every surah except 1 (where it IS
 *     ayah 1) and 9 (which has none) — matching the current data convention that
 *     js/quran/tasmee-pro-v2.js relies on (it strips the basmala back off).
 *   - text_clean is derived with a transform proven to reproduce all 6236 current
 *     text_clean values from the current text_uthmani (see clean() below).
 *
 * USAGE:
 *   node scripts/build-quran-json.cjs            # fetch + build + validate + write
 *   node scripts/build-quran-json.cjs --self-test # offline: prove the build/clean
 *                                                  # logic against the current file
 *
 * NETWORK: requires api.quran.com (or api.qurancdn.com) in the environment's egress
 * allowlist. Egress policy is fixed when the container starts, so allowlist changes
 * need a fresh session to take effect.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'quran.json');

// Canonical Hafs ayah counts per surah (1..114). Hard validation guard so a
// truncated/partial API response can never be written to disk.
const AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111,
  110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83,
  182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96,
  29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31,
  50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5,
  8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];
const TOTAL = AYAH_COUNTS.reduce((a, b) => a + b, 0); // 6236

// ── text_clean derivation ────────────────────────────────────────────────
// Strips Quranic combining marks + tatweel, folds alef-wasla/hamza-seats to bare
// alef, teh-marbuta→heh, alef-maqsura→yeh, drops BOM, collapses spaces. Small waw
// (U+06E5) and small yeh (U+06E6) are KEPT — the dataset treats them as letters.
// Verified to reproduce all 6236 current text_clean values exactly.
function clean(s) {
  return s
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۤۧۨ-ۭ]/g, '')
    .replace(/ـ/g, '')                       // tatweel
    .replace(/ٱ/g, 'ا')                 // ٱ → ا
    .replace(/[آأإ]/g, 'ا')   // آ أ إ → ا
    .replace(/ة/g, 'ه')                 // ة → ه
    .replace(/ى/g, 'ي')                 // ى → ي
    .replace(/\uFEFF/g, '')                       // drop BOM
    .replace(/ +/g, ' ')
    .trim();
}

const stripBOM = (s) => s.replace(/\uFEFF/g, '');
const startsWithBasmala = (text) => clean(text).startsWith('بسم الله');

// ── Core build (pure, testable): map verse_key→uthmani + the current file → new array
function build(uthmaniByKey, current) {
  const basmala = stripBOM((uthmaniByKey['1:1'] || '').trim());
  if (!basmala) throw new Error('basmala (verse 1:1) missing from source');

  return current.map((o) => {
    const key = o.surah + ':' + o.ayah;
    let t = uthmaniByKey[key];
    if (t == null) throw new Error('source missing verse ' + key);
    // Write the source text verbatim (trim + BOM strip only). Do NOT NFC-normalize:
    // the Uthmani text relies on a specific combining-mark order that renders
    // correctly as-is; reordering marks risks changing how diacritics stack.
    t = stripBOM(t.trim());

    // basmala convention: ayah 1 of surahs 2..114 except 9 (guard double-prepend)
    if (o.ayah === 1 && o.surah !== 1 && o.surah !== 9 && !startsWithBasmala(t)) {
      t = basmala + ' ' + t;
    }

    return {
      surah: o.surah,
      ayah: o.ayah,
      text_uthmani: t,
      text_clean: clean(t),
      surah_name: o.surah_name,
      surah_name_en: o.surah_name_en,
    };
  });
}

// ── Validation: refuse to write anything that isn't a complete, sane mushaf
function validate(out) {
  const errs = [];
  if (out.length !== TOTAL) errs.push(`expected ${TOTAL} verses, got ${out.length}`);

  const counts = {};
  const seen = new Set();
  for (const o of out) {
    const key = o.surah + ':' + o.ayah;
    if (seen.has(key)) errs.push('duplicate verse ' + key);
    seen.add(key);
    counts[o.surah] = (counts[o.surah] || 0) + 1;
    if (!o.text_uthmani || !o.text_uthmani.trim()) errs.push('empty text_uthmani at ' + key);
    if (!o.text_clean || !o.text_clean.trim()) errs.push('empty text_clean at ' + key);
    if (!o.surah_name) errs.push('missing surah_name at ' + key);
    if (!o.surah_name_en) errs.push('missing surah_name_en at ' + key);
    if (/[\uFEFF]/.test(o.text_uthmani)) errs.push('stray BOM in text at ' + key);
  }
  for (let s = 1; s <= 114; s++) {
    if (counts[s] !== AYAH_COUNTS[s - 1]) {
      errs.push(`surah ${s}: expected ${AYAH_COUNTS[s - 1]} ayat, got ${counts[s] || 0}`);
    }
    // basmala present on ayah 1 (except 1 and 9)
    if (s !== 1 && s !== 9) {
      const a1 = out.find((o) => o.surah === s && o.ayah === 1);
      if (a1 && !startsWithBasmala(a1.text_uthmani)) {
        errs.push(`surah ${s}: ayah 1 does not start with basmala`);
      }
    }
  }
  if (errs.length) {
    throw new Error('VALIDATION FAILED:\n  - ' + errs.slice(0, 40).join('\n  - ') +
      (errs.length > 40 ? `\n  …and ${errs.length - 40} more` : ''));
  }
}

// ── Network: GET JSON with redirect follow + small retry
function getJSON(url, attempt = 1) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'tasbee7-build', Accept: 'application/json' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(getJSON(res.headers.location, attempt));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('bad JSON from ' + url + ': ' + e.message)); }
      });
    }).on('error', (e) => {
      if (attempt < 4) {
        const wait = 2000 * 2 ** (attempt - 1);
        setTimeout(() => resolve(getJSON(url, attempt + 1)), wait);
      } else reject(e);
    });
  });
}

async function fetchUthmani() {
  const hosts = [
    'https://api.quran.com/api/v4/quran/verses/uthmani',
    'https://api.qurancdn.com/api/v4/quran/verses/uthmani',
  ];
  let lastErr;
  for (const url of hosts) {
    try {
      const data = await getJSON(url);
      if (!data || !Array.isArray(data.verses)) throw new Error('unexpected shape from ' + url);
      const map = {};
      for (const v of data.verses) map[v.verse_key] = v.text_uthmani;
      return map;
    } catch (e) { lastErr = e; console.warn('  · ' + e.message); }
  }
  throw lastErr;
}

// ── Self-test: prove build()+clean()+validate() against the current file, offline.
// Simulates the API (which returns ayah 1 WITHOUT basmala) by stripping the basmala
// off the current ayah-1 verses, then asserts the rebuild reproduces the current
// file (modulo the intentionally-dropped 1:1 BOM).
function selfTest() {
  const current = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const basmala = stripBOM(current.find((o) => o.surah === 1 && o.ayah === 1).text_uthmani.trim());

  const mock = {};
  for (const o of current) {
    let t = stripBOM(o.text_uthmani);
    if (o.ayah === 1 && o.surah !== 1 && o.surah !== 9 && t.startsWith(basmala + ' ')) {
      t = t.slice(basmala.length + 1); // strip basmala to mimic the API response
    }
    mock[o.surah + ':' + o.ayah] = t;
  }

  const out = build(mock, current);
  validate(out);

  let diff = 0;
  const samples = [];
  for (let i = 0; i < current.length; i++) {
    const a = out[i], b = current[i];
    const eq = a.surah === b.surah && a.ayah === b.ayah &&
      a.text_uthmani === stripBOM(b.text_uthmani) &&
      a.text_clean === stripBOM(b.text_clean) &&
      a.surah_name === b.surah_name && a.surah_name_en === b.surah_name_en;
    if (!eq) { diff++; if (samples.length < 6) samples.push(b.surah + ':' + b.ayah); }
  }
  console.log(`self-test: ${current.length - diff}/${current.length} verses reproduce the current file (BOM ignored)`);
  if (diff) { console.log('  diffs at:', samples.join(', '), diff > 6 ? '…' : ''); process.exitCode = 1; }
  else console.log('✓ build/clean/validate logic verified — ready to run against the live API.');
}

async function main() {
  if (process.argv.includes('--self-test')) return selfTest();

  console.log('Fetching Quran.com text_uthmani (all 6236 verses)…');
  const map = await fetchUthmani();
  console.log('  got', Object.keys(map).length, 'verses');

  const current = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const out = build(map, current);
  validate(out);

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  console.log(`✓ wrote ${out.length} verses to ${path.relative(ROOT, OUT)}`);
}

main().catch((e) => { console.error('\n✗ ' + e.message); process.exit(1); });
