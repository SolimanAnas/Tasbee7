// CI guard: every entry in sw.js STATIC_ASSETS must resolve to a real file.
// Catches the classic regression where a page/asset is deleted but left in the
// precache manifest — installs would then fail to cache it and log warnings.
// Exits non-zero if any referenced asset is missing.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const match = sw.match(/const STATIC_ASSETS\s*=\s*\[([\s\S]*?)\n\];/);
if (!match) {
  console.error('✗ Could not find STATIC_ASSETS array in sw.js');
  process.exit(1);
}

// Parse line-by-line so filenames containing an apostrophe (e.g. "Nasa'ie.png")
// inside a double-quoted entry don't confuse a naive ["']...["'] regex.
const assets = [];
for (const raw of match[1].split('\n')) {
  const line = raw.trim();
  if (!line || line.startsWith('//')) continue;
  const q = line[0];
  if (q !== '"' && q !== "'") continue;
  const end = line.indexOf(q, 1);
  if (end === -1) continue;
  assets.push(line.slice(1, end));
}

const missing = [];
for (const asset of assets) {
  // "./" is the app root (index.html); skip the bare root entry.
  if (asset === './') continue;
  const rel = asset.replace(/^\.\//, '').split('?')[0].split('#')[0];
  if (!fs.existsSync(path.join(ROOT, rel))) missing.push(asset);
}

console.log(`Precache entries checked: ${assets.length}`);
if (missing.length) {
  console.error(`✗ ${missing.length} precache asset(s) missing from disk:`);
  missing.forEach(m => console.error('  ' + m));
  process.exit(1);
}
console.log('✓ All precache assets resolve.');
