const fs = require('fs');
const path = require('path');

const I18N_DIR = path.join(__dirname, '..', 'js', 'i18n');
const files = fs.readdirSync(I18N_DIR).filter(f => f.endsWith('.js'));

const EMOJI_MAP = {
  '📌': 'pin',
  '✨': 'zap',
  '🤝': 'user',
  '❤': 'heart',
  '❤️': 'heart',
  '😴': 'moon',
  '📥': 'download',
  '🧭': 'compass',
  '🧪': 'info',
  '📖': 'book',
  '🔄': 'refresh',
  '⚙': 'settings',
  '👁': 'info',
  '📍': 'location',
  '✏️': 'pen',
  '📝': 'edit',
  '📂': 'folder',
  '📅': 'calendar',
  '⏰': 'clock',
  '🔒': 'lock',
  '🔑': 'key',
  '🛡': 'shield',
  '⚡': 'zap',
  '💡': 'lightbulb',
  '🔋': 'battery',
  '📶': 'wifi',
  '☀': 'sun',
  '🌙': 'moon',
  '☕': 'coffee',
  '🔔': 'bell',
  '🎵': 'music',
  '🎧': 'headphones',
  '📱': 'smartphone',
  '🎯': 'target',
  '📚': 'books',
  '💻': 'terminal',
  '🔥': 'zap',
  '💀': 'x',
  '✅': 'check-circle',
  '❌': 'x-circle',
  '⭐': 'star',
  '❤️': 'heart',
  '📌': 'pin',
  '✨': 'zap',
  '🤝': 'user',
};

let totalFixed = 0;

for (const file of files) {
  const filePath = path.join(I18N_DIR, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let fileFixed = 0;

  for (const [emoji, svgName] of Object.entries(EMOJI_MAP)) {
    const imgTag = `<img src="../img/SVG/${svgName}.svg" class="setting-icon" style="width:1em;height:1em;vertical-align:-0.125em;">`;
    const regex = new RegExp(emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = content.match(regex);
    if (matches) {
      content = content.replace(regex, imgTag);
      fileFixed += matches.length;
    }
  }

  if (fileFixed > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`${file}: ${fileFixed} emoji replaced`);
    totalFixed += fileFixed;
  }
}

console.log(`\nTotal: ${totalFixed} emoji replaced in i18n files`);
