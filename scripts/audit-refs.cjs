// One-off repo audit: verify every local src/href reference in HTML resolves.
const fs = require('fs'), path = require('path');
const pages = ['index.html', ...fs.readdirSync('pages').filter(f => f.endsWith('.html')).map(f => 'pages/' + f)];
const problems = [];
for (const pg of pages) {
  const dir = path.dirname(pg);
  const html = fs.readFileSync(pg, 'utf8');
  const refs = [...html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)].map(m => m[1]);
  for (const r of refs) {
    if (/^(https?:|data:|mailto:|tel:|#|javascript:|blob:)/i.test(r)) continue;
    // Skip template-literal placeholders (e.g. src="${thumb}") — these are
    // resolved at runtime from inline JS and can't be checked statically.
    if (r.includes('${')) continue;
    const clean = r.split('?')[0].split('#')[0];
    if (!clean) continue;
    let resolved = clean.startsWith('/')
      ? clean.replace(/^\/+/, '').replace(/^Tasbee7\//, '')
      : path.join(dir, clean);
    resolved = resolved.split(path.sep).join('/');
    if (!fs.existsSync(resolved)) problems.push(`${pg}  ->  ${r}   (resolved: ${resolved})`);
  }
}
console.log('Pages scanned:', pages.length);
console.log('Broken local references:', problems.length);
problems.forEach(p => console.log('  ' + p));
if (problems.length) process.exit(1);
