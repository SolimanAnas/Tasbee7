const fs = require('fs');
const path = require('path');

const THUMBNAILS_DIR = path.resolve(__dirname, '..', 'assets', 'thumbnails');

const books = [
  { id: 'bukhari', name: 'صحيح البخاري', color: '#1a472a', accent: '#4ade80' },
  { id: 'muslim', name: 'صحيح مسلم', color: '#1e3a5f', accent: '#60a5fa' },
  { id: 'abudawud', name: 'سنن أبي داود', color: '#4a1942', accent: '#c084fc' },
  { id: 'tirmidhi', name: 'جامع الترمذي', color: '#7c2d12', accent: '#fb923c' },
  { id: 'nasai', name: 'سنن النسائي', color: '#134e4a', accent: '#2dd4bf' },
  { id: 'ibnmajah', name: 'سنن ابن ماجه', color: '#5b21b6', accent: '#a78bfa' },
  { id: 'riyad_assalihin', name: 'رياض الصالحين', color: '#0f766e', accent: '#5eead4' },
  { id: 'bulugh_almaram', name: 'بلوغ المرام', color: '#92400e', accent: '#fbbf24' },
  { id: 'mishkat_almasabih', name: 'مشكاة المصابيح', color: '#1e40af', accent: '#93c5fd' },
  { id: 'aladab_almufrad', name: 'الأدب المفرد', color: '#701a75', accent: '#f0abfc' },
  { id: 'shamail_muhammadiyah', name: 'الشمائل المحمدية', color: '#065f46', accent: '#6ee7b7' },
  { id: 'nawawi40', name: 'الأربعون النووية', color: '#9a3412', accent: '#fdba74' },
  { id: 'qudsi40', name: 'الأربعون القدسية', color: '#1e3a5f', accent: '#7dd3fc' },
];

function generateSVG(book) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="280" viewBox="0 0 400 280">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${book.color};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${book.color}dd;stop-opacity:1" />
    </linearGradient>
    <pattern id="pattern-${book.id}" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="20" cy="20" r="1.5" fill="${book.accent}22"/>
      <circle cx="0" cy="0" r="1" fill="${book.accent}15"/>
      <circle cx="40" cy="0" r="1" fill="${book.accent}15"/>
      <circle cx="0" cy="40" r="1" fill="${book.accent}15"/>
      <circle cx="40" cy="40" r="1" fill="${book.accent}15"/>
    </pattern>
  </defs>
  
  <!-- Background -->
  <rect width="400" height="280" fill="url(#bg)"/>
  <rect width="400" height="280" fill="url(#pattern-${book.id})"/>
  
  <!-- Decorative border -->
  <rect x="12" y="12" width="376" height="256" rx="12" fill="none" stroke="${book.accent}44" stroke-width="1.5"/>
  
  <!-- Corner ornaments -->
  <circle cx="30" cy="30" r="8" fill="${book.accent}22"/>
  <circle cx="370" cy="30" r="8" fill="${book.accent}22"/>
  <circle cx="30" cy="250" r="8" fill="${book.accent}22"/>
  <circle cx="370" cy="250" r="8" fill="${book.accent}22"/>
  
  <!-- Book icon -->
  <g transform="translate(175, 60)" fill="${book.accent}">
    <path d="M25 5 C25 5 20 0 10 0 C0 0 -5 5 -5 5 L-5 45 C-5 45 0 40 10 40 C20 40 25 45 25 45 Z" fill="${book.accent}33" stroke="${book.accent}" stroke-width="1.5"/>
    <path d="M25 5 C25 5 30 0 40 0 C50 0 55 5 55 5 L55 45 C55 45 50 40 40 40 C30 40 25 45 25 45 Z" fill="${book.accent}22" stroke="${book.accent}" stroke-width="1.5"/>
    <line x1="25" y1="5" x2="25" y2="45" stroke="${book.accent}" stroke-width="1"/>
  </g>
  
  <!-- Book name - Thuluth calligraphy style -->
  <text x="200" y="150" text-anchor="middle" fill="${book.accent}" font-family="'Thuluth', 'AMiri', 'Traditional Arabic', serif" font-size="32" font-weight="bold" letter-spacing="1">${book.name}</text>
  
  <!-- Decorative underline -->
  <path d="M140 172 Q200 180 260 172" fill="none" stroke="${book.accent}44" stroke-width="1.5"/>
  
  <!-- Hadith count badge -->
  <rect x="155" y="188" width="90" height="28" rx="14" fill="${book.accent}22" stroke="${book.accent}44" stroke-width="1"/>
  <text x="200" y="207" text-anchor="middle" fill="${book.accent}" font-family="'Tajawal', sans-serif" font-size="12" font-weight="500">كتاب حديث</text>
  
  <!-- Bottom decorative dots -->
  <circle cx="180" cy="240" r="2" fill="${book.accent}44"/>
  <circle cx="200" cy="240" r="3" fill="${book.accent}66"/>
  <circle cx="220" cy="240" r="2" fill="${book.accent}44"/>
</svg>`;
}

// Generate thumbnails
books.forEach(book => {
  const svg = generateSVG(book);
  const filePath = path.join(THUMBNAILS_DIR, `${book.id}.svg`);
  fs.writeFileSync(filePath, svg, 'utf8');
  console.log(`✅ ${book.id}.svg`);
});

console.log(`\n🎉 Generated ${books.length} thumbnails in ${THUMBNAILS_DIR}`);