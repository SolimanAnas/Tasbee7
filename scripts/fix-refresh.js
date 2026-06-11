const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'pages');
const filePath = path.join(pagesDir, 'notifications.html');
let content = fs.readFileSync(filePath, 'utf8');
const imgTag = '<img src="img/SVG/refresh.svg" class="action-icon" style="width:1em;height:1em;vertical-align:-0.125em;">';
content = content.replace(/[\u{1F504}]/gu, imgTag);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed remaining refresh emoji in notifications.html');
