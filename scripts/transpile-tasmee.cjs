// One-shot transpiler: strips TypeScript types from the Tasmee' classic-script
// modules into committed .js twins (the deployed GitHub Pages site serves source,
// so .ts cannot be loaded directly). Run: node scripts/transpile-tasmee.cjs
const ts = require("typescript");
const fs = require("fs");
const path = require("path");

const files = ["js/tasmee-engine.ts", "js/tasmee-matcher.ts", "js/tasmee-store.ts"];
const root = path.resolve(__dirname, "..");

for (const rel of files) {
  const abs = path.join(root, rel);
  const src = fs.readFileSync(abs, "utf8");
  const banner = "/* AUTO-GENERATED from " + path.basename(rel) +
    " — do not edit directly. Regenerate: node scripts/transpile-tasmee.cjs */\n";
  const out = ts.transpileModule(src, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.None,
      removeComments: false,
    },
    fileName: rel,
  }).outputText;
  const dest = abs.replace(/\.ts$/, ".js");
  fs.writeFileSync(dest, banner + out, "utf8");
  console.log("emitted", rel.replace(/\.ts$/, ".js"), (banner + out).length, "bytes");
}
