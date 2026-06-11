const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'pages');
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));

const LINK_TAG = '  <link rel="stylesheet" href="../css/svg-theme.css">';
const INSERT_AFTER = '</title>';

let totalFixed = 0;

for (const file of files) {
  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Skip if already has the link
  if (content.includes('svg-theme.css')) continue;
  
  // Skip if no SVG icons
  if (!content.includes('img/SVG/')) continue;
  
  // Insert after </title>
  if (content.includes(INSERT_AFTER)) {
    content = content.replace(INSERT_AFTER, INSERT_AFTER + '\n' + LINK_TAG);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`${file}: added svg-theme.css link`);
    totalFixed++;
  }
}

console.log(`\nTotal: ${totalFixed} pages updated`);
