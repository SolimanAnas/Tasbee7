const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'pages');
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));

let totalFixed = 0;

for (const file of files) {
  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace img/SVG/ with ../img/SVG/ (but not if already ../img/SVG/)
  const regex = /src="(?!.*\.\.\/)img\/SVG\//g;
  const matches = content.match(regex);
  if (matches) {
    content = content.replace(/src="img\/SVG\//g, 'src="../img/SVG/');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`${file}: ${matches.length} paths fixed`);
    totalFixed += matches.length;
  }
}

console.log(`\nTotal: ${totalFixed} SVG paths fixed`);
