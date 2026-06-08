// Reverse double-encoded mojibake introduced by commit e9ec1cb (UTF-16 -> UTF-8
// conversion that decoded Arabic UTF-8 bytes as CP1252, then re-saved as UTF-8).
//
// Strategy: per-RUN reversal. A mojibake run = consecutive chars whose CP1252
// byte is >= 0x80 (original UTF-8 Arabic is all multibyte >= 0x80; ASCII is
// shared and left alone). Each run is mapped back to CP1252 bytes and decoded as
// UTF-8 ONLY IF the result is valid (no U+FFFD) — so legitimately-correct chars
// (real Arabic, emoji, a stray "…") that don't form valid UTF-8 are left intact.
//
//   node scripts/fix-mojibake.cjs            # dry-run
//   node scripts/fix-mojibake.cjs --write     # apply
const fs = require("fs");
const path = require("path");

const WRITE = process.argv.includes("--write");
const root = path.resolve(__dirname, "..");

const CP1252 = {
  0x20AC:0x80,0x201A:0x82,0x0192:0x83,0x201E:0x84,0x2026:0x85,0x2020:0x86,
  0x2021:0x87,0x02C6:0x88,0x2030:0x89,0x0160:0x8A,0x2039:0x8B,0x0152:0x8C,
  0x017D:0x8E,0x2018:0x91,0x2019:0x92,0x201C:0x93,0x201D:0x94,0x2022:0x95,
  0x2013:0x96,0x2014:0x97,0x02DC:0x98,0x2122:0x99,0x0161:0x9A,0x203A:0x9B,
  0x0153:0x9C,0x017E:0x9E,0x0178:0x9F,
};
function toByte(cp) { if (cp <= 0xFF) return cp; return (cp in CP1252) ? CP1252[cp] : -1; }

function fixText(str) {
  const chars = [...str];
  let out = "";
  let i = 0, fixes = 0;
  while (i < chars.length) {
    const b = toByte(chars[i].codePointAt(0));
    if (b < 0x80) { out += chars[i]; i++; continue; }   // ASCII or non-CP1252 (real Arabic/emoji)
    // collect a run of non-ASCII CP1252-representable chars
    let j = i, bytes = [];
    while (j < chars.length) {
      const bj = toByte(chars[j].codePointAt(0));
      if (bj < 0x80) break;
      bytes.push(bj); j++;
    }
    const run = chars.slice(i, j).join("");
    const decoded = Buffer.from(bytes).toString("utf8");
    if (!decoded.includes("�")) { out += decoded; if (decoded !== run) fixes++; }
    else out += run;                                    // not valid UTF-8 → leave as-is
    i = j;
  }
  return { out, fixes };
}

const files = [
  "css/quran-v4.css",
  "js/quran/download.js",
  "js/quran/settings.js",
  "js/quran/tafsir.js",
  "js/quran/ui-extras.js",
  "js/quran/ui.js",
];

for (const rel of files) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) { console.log(`SKIP (missing): ${rel}`); continue; }
  const orig = fs.readFileSync(abs, "utf8");
  // Iterate to undo multiple encoding layers (ui-extras.js is triple-encoded).
  let cur = orig, passes = 0, totalFixes = 0;
  for (; passes < 6; passes++) {
    const { out, fixes } = fixText(cur);
    if (out === cur || fixes === 0) break;
    cur = out; totalFixes += fixes;
  }
  const residual = /[ØÙÚÛ][-¿]/.test(cur);
  const sample = (cur.split("\n").find(l => /[؀-ۿ]/.test(l)) || "").trim().slice(0, 64);
  console.log(`${rel}: ${totalFixes} run(s) in ${passes} pass(es) | residual=${residual} | e.g. → ${sample}`);
  if (WRITE && cur !== orig) fs.writeFileSync(abs, cur, "utf8");
}
