const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'pages');
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));

const SCRIPT_TAG = '  <script src="../js/svg-injector.js"></script>';
const INSERT_BEFORE = '</body>';

let totalFixed = 0;

for (const file of files) {
  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Skip if already has the script
  if (content.includes('svg-injector.js')) continue;
  
  // Skip if no SVG icons
  if (!content.includes('img/SVG/')) continue;
  
  // Insert before </body>
  if (content.includes(INSERT_BEFORE)) {
    content = content.replace(INSERT_BEFORE, SCRIPT_TAG + '\n' + INSERT_BEFORE);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`${file}: added svg-injector.js`);
    totalFixed++;
  }
}

console.log(`\nTotal: ${totalFixed} pages updated`);
