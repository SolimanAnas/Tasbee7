const fs = require('fs');
const path = require('path');

const EMOJI_MAP = {
  '✕': { svg: 'close', cls: 'close-icon' },
  '✓': { svg: 'check', cls: 'action-icon' },
  '✓': { svg: 'check', cls: 'action-icon' },
  '✦': { svg: 'star', cls: 'setting-icon' },
  '👁': { svg: 'info', cls: 'action-icon' },
  '🏠': { svg: 'home', cls: 'action-icon' },
  '⚙': { svg: 'settings', cls: 'action-icon' },
  '😴': { svg: 'moon', cls: 'action-icon' },
  '✨': { svg: 'zap', cls: 'setting-icon' },
  '🤝': { svg: 'user', cls: 'setting-icon' },
  '❌': { svg: 'x-circle', cls: 'action-icon' },
  '★': { svg: 'star', cls: 'action-icon' },
  '📄': { svg: 'file-text', cls: 'action-icon' },
  '📥': { svg: 'download', cls: 'action-icon' },
  '🌗': { svg: 'moon', cls: 'action-icon' },
  '🔥': { svg: 'zap', cls: 'setting-icon' },
  '🧪': { svg: 'info', cls: 'setting-icon' },
  '🕋': { svg: 'quran', cls: 'setting-icon' },
  '🔊': { svg: 'volume', cls: 'action-icon' },
  '📋': { svg: 'copy', cls: 'action-icon' },
  '🌍': { svg: 'globe', cls: 'action-icon' },
  '📖': { svg: 'book', cls: 'setting-icon' },
  '🔎': { svg: 'search', cls: 'action-icon' },
  '🔖': { svg: 'bookmark', cls: 'setting-icon' },
  '🔤': { svg: 'text', cls: 'setting-icon' },
  '🎨': { svg: 'palette', cls: 'setting-icon' },
  '🕌': { svg: 'quran', cls: 'option-icon' },
  '📜': { svg: 'file-text', cls: 'option-icon' },
  '🇵🇰': { svg: 'flag', cls: 'option-icon' },
  '🛞': { svg: 'settings', cls: 'setting-icon' },
  '🌙': { svg: 'moon', cls: 'option-icon' },
  '⬇': { svg: 'download', cls: 'action-icon' },
  '⭐': { svg: 'star', cls: 'setting-icon' },
  '❤': { svg: 'heart', cls: 'setting-icon' },
  '🔗': { svg: 'link', cls: 'setting-icon' },
  '📌': { svg: 'pin', cls: 'setting-icon' },
  '📍': { svg: 'location', cls: 'setting-icon' },
  '✏': { svg: 'pen', cls: 'setting-icon' },
  '📝': { svg: 'edit', cls: 'setting-icon' },
  '📂': { svg: 'folder', cls: 'setting-icon' },
  '📅': { svg: 'calendar', cls: 'setting-icon' },
  '⏰': { svg: 'clock', cls: 'setting-icon' },
  '🔒': { svg: 'lock', cls: 'setting-icon' },
  '🔑': { svg: 'key', cls: 'setting-icon' },
  '🛡': { svg: 'shield', cls: 'setting-icon' },
  '⚡': { svg: 'zap', cls: 'setting-icon' },
  '💡': { svg: 'lightbulb', cls: 'setting-icon' },
  '🔋': { svg: 'battery', cls: 'setting-icon' },
  '📶': { svg: 'wifi', cls: 'setting-icon' },
  '☀': { svg: 'sun', cls: 'setting-icon' },
  '🧭': { svg: 'compass', cls: 'setting-icon' },
  '☕': { svg: 'coffee', cls: 'setting-icon' },
  '🔔': { svg: 'bell', cls: 'setting-icon' },
  '🔍': { svg: 'search', cls: 'action-icon' },
  '🎵': { svg: 'music', cls: 'setting-icon' },
  '🎧': { svg: 'headphones', cls: 'setting-icon' },
  '🎚': { svg: 'sliders', cls: 'setting-icon' },
  '🖥': { svg: 'monitor', cls: 'setting-icon' },
  '📊': { svg: 'bar-chart', cls: 'setting-icon' },
  '📈': { svg: 'trending-up', cls: 'setting-icon' },
  '💬': { svg: 'message-circle', cls: 'setting-icon' },
  '👤': { svg: 'user', cls: 'setting-icon' },
  '🚩': { svg: 'flag', cls: 'setting-icon' },
  '⚠': { svg: 'alert-triangle', cls: 'setting-icon' },
  '✅': { svg: 'check-circle', cls: 'setting-icon' },
  '▶': { svg: 'play', cls: 'action-icon' },
  '⏸': { svg: 'pause', cls: 'action-icon' },
  '⏪': { svg: 'skip-back', cls: 'action-icon' },
  '⏩': { svg: 'skip-forward', cls: 'action-icon' },
  '🔁': { svg: 'repeat', cls: 'action-icon' },
  '📤': { svg: 'share', cls: 'action-icon' },
  '☰': { svg: 'menu', cls: 'action-icon' },
  '📱': { svg: 'smartphone', cls: 'setting-icon' },
  '🎯': { svg: 'target', cls: 'setting-icon' },
  '📐': { svg: 'layers', cls: 'setting-icon' },
  '📚': { svg: 'books', cls: 'setting-icon' },
  '📗': { svg: 'book', cls: 'setting-icon' },
  '📘': { svg: 'book', cls: 'setting-icon' },
  '📙': { svg: 'book', cls: 'setting-icon' },
  '📒': { svg: 'file-text', cls: 'setting-icon' },
  '📁': { svg: 'folder', cls: 'setting-icon' },
  '🌐': { svg: 'globe', cls: 'setting-icon' },
  '📿': { svg: 'azkar', cls: 'setting-icon' },
  '🤲': { svg: 'prayer', cls: 'setting-icon' },
  '✔': { svg: 'check', cls: 'action-icon' },
  '✔️': { svg: 'check', cls: 'action-icon' },
  '☆': { svg: 'star', cls: 'action-icon' },
  '🗑': { svg: 'trash', cls: 'action-icon' },
  '🖨': { svg: 'printer', cls: 'action-icon' },
  '💾': { svg: 'save', cls: 'action-icon' },
  '🖼': { svg: 'image', cls: 'setting-icon' },
  '📷': { svg: 'camera', cls: 'setting-icon' },
  '🎤': { svg: 'mic', cls: 'setting-icon' },
  '✂': { svg: 'scissors', cls: 'action-icon' },
  '💻': { svg: 'terminal', cls: 'setting-icon' },
  '⟨': { svg: 'chevron-left', cls: 'action-icon' },
  '⟩': { svg: 'chevron-right', cls: 'action-icon' },
};

const pagesDir = path.join(__dirname, '..', 'pages');
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));

let totalReplacements = 0;

for (const file of files) {
  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let fileReplacements = 0;

  for (const [emoji, info] of Object.entries(EMOJI_MAP)) {
    const imgTag = `<img src="img/SVG/${info.svg}.svg" class="${info.cls}" style="width:1em;height:1em;vertical-align:-0.125em;">`;
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

console.log(`\nTotal: ${totalReplacements} emoji replaced across ${files.length} files`);
