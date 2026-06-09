# Translation Guide — زاد المسلم (Zad Al-Muslim)

## Overview

This document tracks the internationalization (i18n) progress for all pages in the Zad Al-Muslim Islamic companion app.

**Supported Languages:**

| Code | Language | RTL | Status |
|------|----------|-----|--------|
| `ar` | العربية (Arabic) | ✅ | Complete |
| `en` | English | ❌ | Complete |
| `ckb` | کوردی (Kurdish Sorani) | ✅ | Complete |
| `tr` | Türkçe (Turkish) | ❌ | Complete |
| `ur` | اردو (Urdu) | ✅ | Complete |

---

## Translation Status

### Translated Pages (14/22)

| Page | i18n.js | data-i18n | JS t() | Status |
|------|---------|-----------|--------|--------|
| `index.html` | ✅ | ✅ | ✅ | Complete |
| `pages/audio.html` | ✅ | ✅ | ✅ | Complete |
| `pages/radio.html` | ✅ | ✅ | ✅ | Complete |
| `pages/about.html` | ✅ | ✅ | ✅ | Complete |
| `pages/howto.html` | ✅ | ✅ | ✅ | Complete |
| `pages/notifications.html` | ✅ | ✅ | ✅ | Complete |
| `pages/qibla.html` | ✅ | ✅ | ✅ | Complete |
| `pages/tasmee-dashboard.html` | ✅ | ✅ | ✅ | Complete |
| `pages/masbaha.html` | ✅ | ✅ | ✅ | Complete |
| `pages/hadith.html` | ✅ | ✅ | ✅ | Complete |
| `pages/azkar.html` | ✅ | ✅ | ✅ | Complete |
| `pages/hisn.html` | ✅ | ✅ | ✅ | Complete |
| `pages/duaa.html` | ✅ | ✅ | ✅ | Complete |
| `pages/takrar.html` | ✅ | ✅ | ✅ | Complete |

### Pages Without i18n (8/22)

| Page | Reason | Notes |
|------|--------|-------|
| `pages/quran.html` | Quran reader — religious content stays Arabic | UI chrome still pending |
| `pages/quran-text.html` | Quran text viewer — religious content | UI chrome still pending |
| `pages/tasmee-review.html` | Spaced-repetition review page | UI chrome still pending |
| `pages/sleeping.html` | Sleeping adhkar — religious content | Legacy/duplicate page |
| `pages/salah.html` | Post-prayer adhkar — religious content | Legacy/duplicate page |
| `pages/hadith-viewer.html` | Hadith viewer — religious content | Legacy/duplicate page |
| `pages/azkar2.html` | Azkar page variant | Legacy/duplicate page |
| `pages/quran2.html` | Quran reader variant | Legacy/duplicate page |

---

## Architecture

### File Structure

```
js/
├── i18n.js          # i18n engine (RTL detection, language switcher)
└── i18n/
    ├── ar.js        # Arabic (default)
    ├── en.js        # English
    ├── ckb.js       # Kurdish Sorani
    ├── tr.js        # Turkish
    └── ur.js        # Urdu
```

### How It Works

1. **Loading**: Each page loads `i18n.js` which provides the `t()` function
2. **Initialization**: `I18n.init()` loads the current language file
3. **HTML Elements**: Uses `data-i18n` attributes for static text
4. **JavaScript**: Uses `t('key')` function for dynamic text
5. **Language Switcher**: Widget in settings for user selection

### Supported Attributes

| Attribute | Usage | Example |
|-----------|-------|---------|
| `data-i18n` | Text content | `<span data-i18n="home">Home</span>` |
| `data-i18n-html` | InnerHTML (mixed content) | `<div data-i18n-html="subtitle">...</div>` |
| `data-i18n-placeholder` | Input placeholders | `<input data-i18n-placeholder="search">` |
| `data-i18n-title` | Title attributes | `<button data-i18n-title="settings">` |
| `data-i18n-aria` | Aria labels | `<input data-i18n-aria="email">` |

---

## Adding Translations to a Page

### Step 1: Add i18n.js Script

In the `<head>` or before closing `</body>`:

```html
<script src="../js/i18n.js"></script>
```

### Step 2: Add Meta Tag (Optional)

For page title translation:

```html
<meta name="i18n-title" content="page_title">
```

### Step 3: Add data-i18n Attributes

Replace hardcoded text with translation keys:

```html
<!-- Before -->
<h1>الإعدادات</h1>

<!-- After -->
<h1 data-i18n="settings_title">الإعدادات</h1>
```

### Step 4: Add JS t() Calls

For dynamic text in JavaScript:

```javascript
// Before
alert('تم النسخ بنجاح');

// After
alert(t('copied'));
```

---

## Translation Keys

### Common Keys

| Key | Arabic | English | Kurdish | Turkish | Urdu |
|-----|--------|---------|---------|---------|------|
| `app_name` | زاد المسلم | Zad Al-Muslim | ... | ... | ... |
| `home` | الرئيسية | Home | ... | ... | ... |
| `settings` | الإعدادات | Settings | ... | ... | ... |
| `close` | إغلاق | Close | ... | ... | ... |
| `search` | بحث | Search | ... | ... | ... |
| `loading` | جاري التحميل... | Loading... | ... | ... | ... |
| `copied` | تم النسخ | Copied | ... | ... | ... |
| `previous` | السابق | Previous | ... | ... | ... |
| `next` | التالي | Next | ... | ... | ... |

### Page-Specific Keys

Each page has its own set of keys prefixed with the page name:

- `hadith_*` - Hadith encyclopedia keys
- `azkar_*` - Adhkar page keys
- `hisn_*` - Hisn Al-Muslim keys
- `duaa_*` - Duaa Garden keys
- `takrar_*` - Takrar (repetition) keys
- `quran_*` - Quran reader keys
- `prayer_*` - Prayer times keys
- etc.

---

## RTL Support

RTL languages (`ar`, `ckb`, `ur`) are automatically detected:

```javascript
const RTL_LANGS = ['ar', 'ckb', 'ur'];

// In i18n.js
function isRTL() {
  return RTL_LANGS.includes(currentLang);
}

function updateDir() {
  document.documentElement.dir = isRTL() ? 'rtl' : 'ltr';
}
```

**CSS Considerations:**
- Use logical properties: `margin-inline-start` instead of `margin-left`
- Use `dir="rtl"` on HTML element for automatic RTL support
- Test with all RTL languages

---

## Testing

### Manual Testing

1. Open app in browser
2. Switch language in settings
3. Navigate through all pages
4. Verify all text is translated
5. Check RTL/LTR layout

### Automated Tests

Run Playwright tests:

```bash
npx playwright test tests/i18n.spec.js
```

Tests verify:
- All 5 languages load correctly
- Language switcher works
- RTL detection works
- Page titles translate
- Key UI elements translate

---

## Adding a New Language

### Step 1: Create Language File

Create `js/i18n/{code}.js`:

```javascript
export default {
  app_name: '...',
  home: '...',
  // ... all keys
};
```

### Step 2: Update i18n.js

Add to language switcher array:

```javascript
const langs = [
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ckb', label: 'کوردی', flag: '☀️' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { code: 'ur', label: 'اردو', flag: '🇵🇰' },
  { code: 'new', label: 'New Language', flag: '🏳️' },  // Add here
];
```

### Step 3: Add RTL (if needed)

```javascript
const RTL_LANGS = ['ar', 'ckb', 'ur', 'new'];
```

### Step 4: Translate All Keys

Copy `en.js` as template and translate all values.

---

## Key Counts

| Language | Unique Keys | Status |
|----------|-------------|--------|
| Arabic (ar) | 582 | Complete |
| English (en) | 582 | Complete |
| Kurdish (ckb) | 582 | Complete |
| Turkish (tr) | 582 | Complete |
| Urdu (ur) | 582 | Complete |

**All 5 language files contain the same 582 unique translation keys.**

---

## Common Patterns

### Interpolation

Use `{param}` syntax:

```javascript
// Translation key
loaded_count: 'تم تحميل {n} حديث'

// Usage
t('loaded_count', { n: 42 })
// Result: "تم تحميل 42 حديث"
```

### Conditional Text

```javascript
const text = t('no_results');
if (text === 'no_results') {
  // Fallback if key missing
}
```

### Safe Fallback

```javascript
// In files that may load before i18n.js
const text = window.t ? t('key') : 'fallback';
```

---

## Notes

1. **Religious Content**: Quran text, hadiths, adhkar, and duaas stay in Arabic regardless of language
2. **UI Only**: Only interface elements (labels, buttons, headings, toasts) are translated
3. **Fallback**: If a key is missing in current language, falls back to Arabic
4. **Performance**: Language files are loaded on demand, not all at once
5. **Caching**: Language files are cached in memory after first load

---

## Troubleshooting

### Text Not Translating

1. Check if `i18n.js` is loaded
2. Verify `data-i18n` attribute exists on element
3. Check key exists in language file
4. Verify `I18n.init()` is called

### RTL Layout Issues

1. Check `RTL_LANGS` array includes language code
2. Use CSS logical properties
3. Test with `dir="rtl"` attribute

### Missing Keys

1. Add key to all 5 language files
2. Use English as placeholder if translation pending
3. Run tests to verify

---

## Progress Log

### Completed
- ✅ Created `js/i18n/ckb.js` — Kurdish Sorani translation
- ✅ Updated `js/i18n.js` — RTL_LANGS includes `['ar', 'ckb', 'ur']`
- ✅ Fixed all translation files for missing keys
- ✅ Created Playwright test suite — 33 tests, all passing
- ✅ Audio page translated (24 JS + 1 HTML key)
- ✅ Radio page translated (16 JS keys)
- ✅ About page translated (17 data-i18n)
- ✅ Howto page translated (13 data-i18n)
- ✅ Notifications page translated (37 data-i18n + 18 JS)
- ✅ Qibla page translated (17 data-i18n + 7 JS)
- ✅ Tasmee dashboard translated (20 data-i18n + 16 JS)
- ✅ Hadith page translated (10 data-i18n + 25 JS)
- ✅ Azkar page translated (24 data-i18n + 2 JS)
- ✅ Hisn page translated (18 data-i18n + 9 JS)
- ✅ Duaa page translated (18 data-i18n + 7 JS)
- ✅ Takrar page translated (25+ data-i18n + 25 JS)
- ✅ Index page translated (15+ data-i18n + 15 JS)
- ✅ Added 47 missing keys to ckb.js (11 prayer + 36 takrar)
- ✅ Added 47 missing keys to tr.js (11 prayer + 36 takrar)
- ✅ Added 47 missing keys to ur.js (11 prayer + 36 takrar)

### In Progress
- 🔄 None — all 582 keys are now present in all 5 language files

### Remaining
- ⏳ Quran pages (quran.html, quran-text.html) — UI elements only
- ⏳ Religious content pages — mostly Arabic-only
