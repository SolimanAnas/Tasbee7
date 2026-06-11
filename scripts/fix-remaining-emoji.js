const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'pages');
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));

const ADDITIONAL_MAP = {
  '📌': { svg: 'pin', cls: 'setting-icon' },
  '✨': { svg: 'zap', cls: 'setting-icon' },
  '🤝': { svg: 'user', cls: 'setting-icon' },
  '❤': { svg: 'heart', cls: 'setting-icon' },
  '😴': { svg: 'moon', cls: 'action-icon' },
  '📥': { svg: 'download', cls: 'action-icon' },
  '🧭': { svg: 'compass', cls: 'setting-icon' },
  '🧪': { svg: 'info', cls: 'setting-icon' },
};

let totalReplacements = 0;

for (const file of files) {
  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let fileReplacements = 0;

  for (const [emoji, info] of Object.entries(ADDITIONAL_MAP)) {
    const imgTag = `<img src="../img/SVG/${info.svg}.svg" class="${info.cls}" style="width:1em;height:1em;vertical-align:-0.125em;">`;
    const regex = new RegExp(emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = content.match(regex);
    if (matches) {
      content = content.replace(regex, imgTag);
      fileReplacements += matches.length;
    }
  }

  if (fileReplacements > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`${file}: ${fileReplacements} replacements`);
    totalReplacements += fileReplacements;
  }
}

console.log(`\nTotal: ${totalReplacements} additional emoji replaced`);
