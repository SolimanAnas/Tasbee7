/**
 * Creates the quran/ directory structure expected by quran-v2.html
 * by copying .webp files from mushaf pages/ sources with the correct naming.
 *
 * HTML renderPages() expects:
 *   ../quran/medina/page_N.webp
 *   ../quran/medina_green/page_N.webp
 *   ../quran/medina_brown/page_N.webp   (no source — skipped)
 *   ../quran/medina_1420/page_N.webp
 *   ../quran/tajweed/page_N.webp        (HTML uses verse_ but we normalize to page_)
 *
 * Source directories in mushaf pages/:
 *   mushaf-madina-1441/  → 001.webp .. 604.webp  →  medina
 *   madina-green/        → 001.webp .. 621.webp  →  medina_green
 *   madina-1421/         → 001.webp .. 604.webp  →  medina_1420
 *   tajweed/             → 001.webp .. 604.webp  →  tajweed
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const QURAN_DIR = path.join(ROOT, "quran");
const MUSHAF_DIR = path.join(ROOT, "mushaf pages");

const VERSION_MAP = {
  medina:       { source: "mushaf-madina-1441", pages: 604 },
  medina_green: { source: "madina-green",       pages: 604 },
  medina_1420:  { source: "madina-1421",        pages: 604 },
  tajweed:      { source: "tajweed",            pages: 604 },
};

let copied = 0;
let skipped = 0;

for (const [version, cfg] of Object.entries(VERSION_MAP)) {
  const targetDir = path.join(QURAN_DIR, version);
  fs.mkdirSync(targetDir, { recursive: true });

  const sourceDir = path.join(MUSHAF_DIR, cfg.source);
  if (!fs.existsSync(sourceDir)) {
    console.warn(`⚠️  Source directory missing: ${cfg.source} — skipping ${version}`);
    continue;
  }

  for (let p = 1; p <= cfg.pages; p++) {
    const padded = String(p).padStart(3, "0");
    const srcFile = path.join(sourceDir, `${padded}.webp`);
    const dstFile = path.join(targetDir, `page_${p}.webp`);

    if (!fs.existsSync(srcFile)) {
      // For madina-1421, some files may have different naming
      const altSrc = path.join(sourceDir, `page${p}.webp`);
      if (fs.existsSync(altSrc)) {
        fs.copyFileSync(altSrc, dstFile);
        copied++;
        continue;
      }
      skipped++;
      continue;
    }

    fs.copyFileSync(srcFile, dstFile);
    copied++;
  }

  console.log(`  ${version} → ${targetDir}: ${cfg.pages} pages`);
}

console.log(`\n✅ Done: ${copied} files copied, ${skipped} missing`);
