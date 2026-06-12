// CI guard: the five locale dictionaries must expose identical key sets.
// Catches the drift the README warns about (a key added to ar/en but
// forgotten in tr/ckb/ur silently falls back or renders the raw key).
// Run: node scripts/check-i18n.cjs
const path = require('path');
const { pathToFileURL } = require('url');

const LOCALES = ['ar', 'en', 'tr', 'ckb', 'ur'];

(async () => {
  const dicts = {};
  for (const loc of LOCALES) {
    const url = pathToFileURL(path.resolve(__dirname, '..', 'js', 'i18n', loc + '.js'));
    dicts[loc] = new Set(Object.keys((await import(url)).default));
  }

  // Union of all keys, then report what each locale is missing.
  const union = new Set();
  for (const loc of LOCALES) for (const k of dicts[loc]) union.add(k);

  let failed = false;
  for (const loc of LOCALES) {
    const missing = [...union].filter(k => !dicts[loc].has(k));
    if (missing.length) {
      failed = true;
      console.error(`✗ ${loc}.js missing ${missing.length} key(s):`);
      missing.forEach(k => console.error('    ' + k));
    }
  }

  console.log(`Locales checked: ${LOCALES.join(', ')} — ${union.size} keys in union.`);
  if (failed) process.exit(1);
  console.log('✓ All locales have identical key sets.');
})();
