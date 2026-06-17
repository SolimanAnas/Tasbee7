# SEO & Google Play Optimization Guide

Agentic prompt for enhancing discoverability of **زاد المسلم (Zad Al-Muslim)** — Islamic Quran/Adhkar PWA with a Google Play Store TWA.

---

## 1. Meta Tags (per page)

### Title tag
- Start with the page's primary Arabic keyword, then the English translation, then `| زاد المسلم`
- Max ~60 chars
- Audio page example: `سورة آل عمران كاملة — المنشاوي المصحف المرتل النادر 1967م | زاد المسلم`

### Meta description
- One sentence with the core unique value (e.g. "تسجيل نادر بعد 60 سنة")
- Include key entity names (المنشاوي, عبدالباسط, etc.) and year numbers when relevant
- Max ~160 chars

### Meta keywords
- **100–200 Arabic long-tail keywords** — Quran reciters, surah names, maqamat (نهاوند, صبا, حجاز), emotional keywords (يبكي, يناجي ربه, مبكية)
- Group semantically: reciter variants, surah+reciter, maqam+reciter, rarity terms (نادر, لأول مرة, كنوز)
- Include compound keywords like `المنشاوي سورة البقرة`, `المنشاوي تجويد`
- For every new reciter/release added to the JSON data, append 20–40 associated keywords

## 2. Open Graph & Twitter Cards

- `og:title` / `twitter:title` — same as `<title>` but can be slightly longer (max 65 chars)
- `og:description` — match meta description, but can be a bit shorter
- `og:image` — use `https://solimananas.github.io/Tasbee7/og-image.png` (or a page-specific poster if created)
- `twitter:card` — `summary_large_image`
- Always set `og:locale`, `og:site_name`, `og:url`, `twitter:url`

## 3. JSON-LD Structured Data

Each page should have JSON-LD with **at minimum** a `WebApplication` type. For audio pages, add an `audio` array of `AudioObject` entries.

### WebApplication (base)
```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "الاستماع للقرآن — زاد المسلم",
  "applicationCategory": "Multimedia",
  "operatingSystem": "Web",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
}
```

### AudioObject (per featured recitation)
- `name`: reciter name + surah + recording details
- `description`: 2-3 sentences with rarity keywords (تسجيل نادر, يذاع لأول مرة, after 60 years)
- `genre`: `["Quran Recitation", "ترتيل", "تجويد"]`
- `associatedArticle`: link to a news/article context when relevant (e.g. المصحف الجديد for Minshawi)

**When to add**: whenever a new reciter/track is added to the JSON data files, create a corresponding `AudioObject` in `audio.html`'s JSON-LD.

## 4. PWA Install Toast

File: `js/pwa-install.js`

- Captures `beforeinstallprompt` event
- Shows a glassmorphism bottom toast after **3 seconds** if:
  - Not in standalone mode (`display-mode: standalone`)
  - Not already installed (`localStorage.zad_installed === 'true'`)
  - Not dismissed this session (`sessionStorage.zad_dismiss_install`)
- Includes app icon, name (from i18n), Install / Later buttons
- On `appinstalled`, sets `localStorage.zad_installed = 'true'` and removes toast
- Dismiss uses `sessionStorage` so it re-appears next session

**Included on**: `index.html` + `pages/audio.html`

## 5. Android Play Store Banner

A top-of-page banner that appears **only on Android devices** (user-agent check), linking to:
```
https://play.google.com/store/apps/details?id=io.github.solimananas.twa
```

- Dark green gradient background with glassmorphism
- App icon, title "زاد المسلم", subtitle, rating ★ 4.8, Install button
- Dismiss button (per-session via `sessionStorage`)
- Animate in from top

**Included on**: `index.html` + `pages/audio.html`

## 6. Sitemap

File: `sitemap.xml`

- Every HTML page in `pages/` must be listed
- Use correct lastmod dates
- Priority scale:
  - `1.0` — index.html
  - `0.9` — audio.html (recitations = primary feature)
  - `0.8` — quran.html, quran-text.html, radio.html
  - `0.7` — azkar.html, masbaha.html
  - `0.6` — hadith.html, hisn.html, duaa.html, qibla.html
  - `0.5` — notifications.html, about.html, howto.html
- Changefreq: `weekly` for audio/quran pages, `monthly` for others
- Update lastmod when content changes (new recitation/release)

## 7. i18n Keys for Install Prompts

Add to every language file (`js/i18n/{ar,en,ckb,tr,ur}.js`):

```js
'pwa_install_desc': `حمّل التطبيق للوصول السريع`,   // Arabic example
'pwa_install': `تثبيت`,                              // Install
'pwa_later': `لاحقاً`,                               // Later
```

## 8. Google Play Store Listing (external)

For the TWA at `io.github.solimananas.twa`:

- **Title**: `زاد المسلم — القرآن والأذكار | Zad Al-Muslim`
- **Short description**: القرآن الكريم بصوت كبار القراء، الأذكار، المسبحة، وإذاعة القرآن بدون إعلانات
- **Full description**: Include the same 200 keywords from the meta keywords, organized in paragraphs. Highlight unique content like "المصحف الجديد للشيخ محمد صديق المنشاوي — تسجيل نادر بعد 60 عاماً"
- **Screenshots**: 6–8 screenshots showing the audio player, Quran reader, azkar counter, prayer times
- **Feature graphic**: 1024×500 — green gradient with logo and "القرآن الكريم • الأذكار • المسبحة"
- **Category**: Education / Lifestyle
- **Tags**: Quran, Islam, Adhkar, Muslim, Prayer, Tasbih

## 9. Keyword Strategy

### Primary entities
- المنشاوي, محمد صديق المنشاوي, المصحف الجديد
- عبدالباسط عبدالصمد, الحصري, السديس, ماهر المعيقلي, سعد الغامدي, مشاري العفاسي

### Keyword patterns to generate
For each reciter, generate:
1. `{reciter}` alone
2. `{reciter} {surah}` (e.g. المنشاوي سورة البقرة)
3. `{reciter} {maqam}` (e.g. المنشاوي نهاوند)
4. `{reciter} {emotion}` (e.g. المنشاوي يبكي, المنشاوي يناجي ربه)
5. Rarity terms: `تسجيل نادر`, `لأول مرة`, `كنوز {reciter}`, `تلاوة نادرة`, `إصدار حصري`

### When adding new content
When a new reciter or recitation is added to `json/audio-*.json`:
1. Add 30–50 new keywords to the `keywords` meta tag in `pages/audio.html`
2. Add an `AudioObject` entry to the JSON-LD
3. Update `sitemap.xml` lastmod for audio.html
4. If it's a major release (like Minshawi new recitation), update the meta description title to feature it

## 10. Testing with Playwright

File: `tests/pwa-seo.spec.js`

Run after any SEO change:
```
npx playwright test tests/pwa-seo.spec.js
```

Tests verify:
- Meta title/description/keywords contain expected Arabic content
- JSON-LD is valid and contains expected `AudioObject` entries
- Play Store banner HTML exists on both pages
- `pwa-install.js` loads without 404 errors
- i18n keys are present in all 5 language files
- No 404 resource errors on audio.html

## 11. Checklist

When an AI agent is asked to improve SEO:

- [ ] Update `<title>` to feature the most unique/valuable content first
- [ ] Expand `meta keywords` with 50–100 new long-tail Arabic keywords
- [ ] Verify `meta description` mentions unique selling points (rare recordings, 200+ reciters)
- [ ] Add/update `AudioObject` in JSON-LD for any newly added recitation
- [ ] Ensure OG/Twitter meta tags match the updated title/description
- [ ] Play Store banner present on index.html + audio.html (Android only)
- [ ] PWA install toast script present on both pages
- [ ] i18n keys for install prompts exist in all language files
- [ ] `sitemap.xml` lastmod dates are current and priorities are correct
- [ ] Run full Playwright suite: `npx playwright test`
- [ ] Commit and push: `git add <files> && git commit && git push`
