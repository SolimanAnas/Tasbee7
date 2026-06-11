const fs = require('fs');
const path = require('path');

const KEYS_TO_CHANGE = [
  'about_mission_title',
  'about_features_title', 
  'about_sadaqa_title',
  'about_footer',
  'notif_test_btn',
  'qibla_calibrate_btn',
  'hisn_download',
  'audio_sleep_timer',
  'audio_favorites',
];

const pagesDir = path.join(__dirname, '..', 'pages');
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));

let totalFixed = 0;

for (const file of files) {
  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let fileFixed = 0;

  for (const key of KEYS_TO_CHANGE) {
    const from = `data-i18n="${key}"`;
    const to = `data-i18n-html="${key}"`;
    const regex = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = content.match(regex);
    if (matches) {
      content = content.replace(regex, to);
      fileFixed += matches.length;
    }
  }

  if (fileFixed > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`${file}: ${fileFixed} elements changed to data-i18n-html`);
    totalFixed += fileFixed;
  }
}

console.log(`\nTotal: ${totalFixed} elements updated`);
