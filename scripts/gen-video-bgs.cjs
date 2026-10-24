// Rebuilds images/video-maker/manifest.json from the background files in that folder.
// The video maker (pages/video-maker.html) can't list a directory on a static
// host, so it reads this manifest instead. Re-run after adding/removing files:
//   npm run bgs:video
// Videos (.mp4/.webm) need a full-size '<name>.thumb.webp' still next to them —
// it's the picker thumbnail and the poster drawn until the video has a frame.
// Those stills are not backgrounds themselves, so they're skipped here.
const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '..', 'images', 'video-maker');
const files = fs.readdirSync(DIR)
  .filter(f => /\.(png|jpe?g|webp|avif|mp4|webm)$/i.test(f) && !f.endsWith('.thumb.webp'))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const missingThumbs = files.filter(f => /\.(mp4|webm)$/i.test(f))
  .filter(f => !fs.existsSync(path.join(DIR, f.replace(/\.(mp4|webm)$/i, '.thumb.webp'))));

fs.writeFileSync(path.join(DIR, 'manifest.json'), JSON.stringify(files, null, 2) + '\n', 'utf8');
console.log(`✓ ${files.length} background(s) → images/video-maker/manifest.json`);
missingThumbs.forEach(f => console.warn(`⚠ ${f} has no thumbnail — create it with:\n  ffmpeg -ss 0.5 -i ${f} -frames:v 1 -c:v libwebp -quality 85 ${f.replace(/\.(mp4|webm)$/i, '.thumb.webp')}`));
