// Builds data/quran-pages.json: which ayah each of the 604 mushaf pages starts
// with, plus the Medinan surahs — the two facts the text mushaf needs to lay a
// page out from the app's own Quran text when there is no connection.
//
// The page starts are read from db/quranpages.sqlite (the word-coordinate
// database the image mushaf already uses), so both readers agree by
// construction. Run after that database changes:
//   node scripts/build-quran-pages.cjs
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const initSqlJs = require(path.join(ROOT, 'js', 'vendor', 'sql-wasm.js'));

// Revelation place as listed by the alquran.cloud surah index (Nov 2026);
// shown only as the «مكية / مدنية» label under a surah title.
const MEDINAN = [2, 3, 4, 5, 8, 9, 13, 22, 24, 33, 47, 48, 49, 55, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 76, 98, 99, 110];

(async () => {
  const SQL = await initSqlJs({ locateFile: f => path.join(ROOT, 'js', 'vendor', f) });
  const db = new SQL.Database(fs.readFileSync(path.join(ROOT, 'db', 'quranpages.sqlite')));
  // First ayah that BEGINS on each page (an ayah continuing from the previous
  // page belongs to the page it starts on).
  const rows = db.exec(
    'SELECT soraid, ayaid, MIN(page) AS p FROM ayarects GROUP BY soraid, ayaid ORDER BY soraid, ayaid')[0].values;
  if (rows.length !== 6236) throw new Error('expected 6236 ayahs, found ' + rows.length);

  const pages = [];
  let prev = 0;
  for (const [surah, ayah, page] of rows) {
    if (page < prev) throw new Error(`page goes backwards at ${surah}:${ayah}`);
    if (page > prev) {
      if (page !== prev + 1) throw new Error(`no ayah starts on page ${prev + 1}`);
      pages.push([surah, ayah]);
      prev = page;
    }
  }
  if (pages.length !== 604) throw new Error('expected 604 pages, found ' + pages.length);

  const out = JSON.stringify({ pages, medinan: MEDINAN });
  fs.writeFileSync(path.join(ROOT, 'data', 'quran-pages.json'), out + '\n');
  console.log(`✓ data/quran-pages.json: ${pages.length} pages, ${out.length} bytes`);
})().catch(e => { console.error('✗ ' + e.message); process.exit(1); });
