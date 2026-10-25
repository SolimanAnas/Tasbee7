// Rebuilds images/video-maker/manifest.json from the background files in that folder.
// The video maker (pages/video-maker.html) can't list a directory on a static
// host, so it reads this manifest instead. Re-run after adding/removing files:
//   npm run bgs:video            keep the curated order, append new files, drop deleted ones
//   npm run bgs:video -- --sort  reset to plain numeric order
// The picker shows videos first, then images, each in manifest order — so the
// manifest order is the arrangement users see (grouped by theme by hand).
// Videos (.mp4/.webm) need a full-size '<name>.thumb.webp' still next to them —
// it's the picker thumbnail and the poster drawn until the video has a frame.
// Those stills are not backgrounds themselves, so they're skipped here.
const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '..', 'images', 'video-maker');
const MANIFEST = path.join(DIR, 'manifest.json');
const numeric = (a, b) => a.localeCompare(b, undefined, { numeric: true });

const onDisk = fs.readdirSync(DIR)
  .filter(f => /\.(png|jpe?g|webp|avif|mp4|webm)$/i.test(f) && !f.endsWith('.thumb.webp'))
  .sort(numeric);

let previous = [];
if (!process.argv.includes('--sort')) {
  try { previous = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch { previous = []; }
  if (!Array.isArray(previous)) previous = [];
}
const kept = previous.filter(f => onDisk.includes(f));
const added = onDisk.filter(f => !kept.includes(f));
const removed = previous.filter(f => !onDisk.includes(f));
const files = kept.concat(added);

const missingThumbs = files.filter(f => /\.(mp4|webm)$/i.test(f))
  .filter(f => !fs.existsSync(path.join(DIR, f.replace(/\.(mp4|webm)$/i, '.thumb.webp'))));

fs.writeFileSync(MANIFEST, JSON.stringify(files, null, 2) + '\n', 'utf8');
console.log(`✓ ${files.length} background(s) → images/video-maker/manifest.json`);
if (added.length) console.log(`  + appended: ${added.join(', ')}`);
if (removed.length) console.log(`  − dropped (no longer on disk): ${removed.join(', ')}`);
missingThumbs.forEach(f => console.warn(`⚠ ${f} has no thumbnail — create it with:\n  ffmpeg -ss 0.5 -i ${f} -frames:v 1 -c:v libwebp -quality 85 ${f.replace(/\.(mp4|webm)$/i, '.thumb.webp')}`));
