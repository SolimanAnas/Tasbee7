// One-shot: convert app-rendered raster images to WebP and remove the PNG/JPG
// originals. Scoped to browser-rendered assets only — og-image.png (social
// scrapers) and icons/ (PWA manifest / iOS) intentionally stay PNG.
// Run: node scripts/to-webp.cjs
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const TARGETS = [
  // Backgrounds (CSS background-image, every page)
  'images/Background-dark.png',
  'images/Background-light.png',
  'images/background-sepia.png',
  // Hadith book thumbnails (img tags, hadith-viewer)
  'assets/thumbnails/6/ImamBukhari1.png',
  'assets/thumbnails/6/ImamMuslim1.png',
  'assets/thumbnails/6/Abu Dawwod.png',
  'assets/thumbnails/6/Imam_al-Trimdhi.png',
  "assets/thumbnails/6/Nasa'ie.png",
  'assets/thumbnails/6/Ibn majah.png',
  'assets/thumbnails/others/رياض الصالحين.png',
  'assets/thumbnails/others/بلوغ المرام.png',
  'assets/thumbnails/others/مشكاة المصابيح2.png',
  'assets/thumbnails/others/الادب المفرد2.png',
  'assets/thumbnails/others/الشمائل المحمدية.png',
  'assets/thumbnails/others/متن الأربعون النووية2.png',
  'assets/thumbnails/others/الأربعون القدسية.png',
  // Manifest screenshot + README hero
  'poster.png',
  'images/Featured.png',
];

(async () => {
  let origTot = 0, webpTot = 0, n = 0;
  for (const rel of TARGETS) {
    const src = path.join(ROOT, rel);
    if (!fs.existsSync(src)) { console.warn('skip (missing):', rel); continue; }
    const out = src.replace(/\.(png|jpe?g)$/i, '.webp');
    const orig = fs.statSync(src).size;
    await sharp(src).webp({ quality: 85, effort: 6 }).toFile(out);
    const webp = fs.statSync(out).size;
    fs.unlinkSync(src);
    origTot += orig; webpTot += webp; n++;
    console.log(`${rel}  ${(orig/1024).toFixed(0)}KB → ${(webp/1024).toFixed(0)}KB`);
  }
  console.log('----');
  console.log(`Converted ${n} files: ${(origTot/1024/1024).toFixed(2)}MB → ${(webpTot/1024/1024).toFixed(2)}MB (saved ${((origTot-webpTot)/1024/1024).toFixed(2)}MB)`);
})();
