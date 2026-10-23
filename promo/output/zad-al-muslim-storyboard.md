# Zad Al-Muslim — "Make Space for What Matters"

**Format:** 45 s hero commercial · 1920×1080 master, 1080×1920 reel, 1080×1080 square · 30 fps
**Idea:** the noise of everyday life gives way to stillness, then to remembrance and the Quran. Every app screen shown is a genuine capture of the real app (see `promo/assets/screens/`).

**Look:** midnight/deep emerald, warm ivory type, restrained gold. Cormorant Garamond for headlines, Manrope for small caps. Original pointed-arch and eight-point-star lattice motif. Volumetric dawn light, a soft top spotlight, slow bokeh, light film grain.

**Sound:** an original score synthesised in code (felt piano, warm pads, filtered-noise textures) in D minor, resolving to F major on the end card. Neural TTS narration (Piper, `en_US-joe-medium`, CC0 dataset). Music is ducked under the voice. Mixed to −14 LUFS, −1.5 dBTP. No Quran recitation is used as a sound effect.

---

| # | Time | Visual | On-screen text | Voiceover | Sound |
|---|---|---|---|---|---|
| 1 | 0.0–4.3 | Near-black emerald. Dawn light grows through an arched lattice window, and a volumetric beam with dust motes falls across the floor. From 2.3 s a storm of abstract notification cards, red badges and speed streaks builds, then implodes to black at 4.24 s. | *Among life's endless distractions…* | 0.7 "Life moves quickly." · 2.55 "But some moments deserve our full attention." | Low drone and air. Irregular ticking, pings and a noise riser, then cut to silence (the hush). |
| 2 | 4.3–8.0 | A single point of light stretches into an anamorphic line. The phone emerges from darkness under a top spotlight, with a slow push-in and yaw settling from −30° to −8°. The **Home** screen is shown. At 7.3 s a tap ripple lands on "The Noble Quran" and the Mushaf slides up. | *Make space for what matters.* | 5.45 "Make space for what matters." | A single piano note at 4.4 s (the "space"), then a pad enters. |
| 3 | 8.0–15.0 | Genuine **Mushaf** (Al-Fatiha, page 1). A defocused macro of the Mushaf sits behind it. At 10.0 s the page turns (RTL) to page 2 (Al-Baqarah). At 11 s the **Quran Audio** player phone glides in and soft rings radiate behind it. | *Your connection with the Quran.* · chips: 5 Mushaf styles · Tafsir & bookmarks → Multiple reciters · Background playback | 8.4 "Reconnect with the words of the Quran," · 11.4 "and listen to beautiful recitation." | Piano arpeggios (Bb maj7 → F/A). |
| 4 | 15.0–22.0 | A 3D carousel: **Morning adhkar** → **Hisn Al-Muslim** → **Masbaha**, counting 30→33 with real taps and its own completion celebration → **Takrar** (memorisation). The active phone comes forward, and its neighbours recede, blur and dim. | *Remember. Reflect. Grow.* (word by word) · labels: Daily Adhkar · Hisn Al-Muslim · Smart Tasbeeh · Memorization | 15.25 "Keep remembrance close. Daily adhkar, a smart tasbeeh, and tools to help you memorise." | Pulse added. Gm9 → Bb → Csus2. |
| 5 | 22.0–29.0 | Three phones rise in sequence: **Hadith**, **Qibla** (live compass, "You are facing the Qibla", 4,794 km from London) and **Quran Radio**. At 26.2 s a fan of five **Home** screens appears: English, Kurdish, Arabic, Urdu, Turkish. | *More ways to stay connected.* → *In your own language.* · chips: Arabic · English · Turkish · Kurdish · Urdu · Works offline | 22.3 "Explore hadith, find the qibla, and tune in to Quran radio, in your own language." | Brighter pad, piano an octave higher. |
| 6 | 29.0–35.0 | The phone lies on a warm stone desk beside amber prayer beads. Arched window light slides across, which reads as time passing. At about 32 s dusk falls: cool light, and the screen changes from **Home** (prayer times) to **Adhkar before sleep**, with the screen's glow on the desk. | *Made for your everyday journey.* · captions: Dawn — Prayer times & morning remembrance · Night — Adhkar before sleep | 29.4 "Beautifully designed for your everyday journey." | Music thins out to quarter notes. |
| 7 | 35.0–45.0 | End card. A real app icon resolves from blur with a gold light sweep and slow rays. Then come "Zad Al-Muslim", زاد المسلم, the tagline, and the benefits one by one. At 39.4 s the brand block slides aside. The CTA appears with a **QR code** (from 40.6 s; it decodes to the Play URL), the official **Google Play badge** (42.4 s) and the URL. It holds to the end. | **Zad Al-Muslim** · زاد المسلم · YOUR ALL-IN-ONE ISLAMIC COMPANION · FREE • AD-FREE • WORKS OFFLINE · *Download on Google Play* · SCAN TO INSTALL · play.google.com/store/apps/details?id=io.github.solimananas.twa | 35.5 "Meet Zad Al-Muslim. Your all-in-one Islamic companion." · 39.7 "Free. Ad-free. And it works offline." · 42.45 "Download it on Google Play." | Low bloom and shimmer at the reveal. A rolled F add9 resolving chord at 43.6 s, with its tail ending at 45 s. |

## Vertical and square adaptations

These are not crops. Each scene has its own 9:16 and 1:1 layout (`pick({l, v, s})` in `src/scenes.js`):

- **Vertical:** headlines sit at the top, phones sit in the middle third, and labels and chips go into the lower third. The arch window is centred above the opening line. The carousel shows one hero phone with partial neighbours. The end card is stacked: brand, then CTA, then QR, then badge, then URL.
- **Square:** headlines are centred at the top, and the end card uses two columns like the master. The URL wraps onto two lines.

## Claims used, and their source

- *Free · Ad-free · Works offline · 5 languages*: from the project README ("Free · No ads · No tracking · Works offline", "Supports 5 languages").
- *5 Mushaf styles, tafsir, bookmarks*, *multi-reciter audio with background playback*, *Takrar verse repetition*, *Hisn Al-Muslim*, *24/7 radio*: from the README feature tables.
- *Daily targets and lifetime statistics* (Tasbeeh): from the app's own Google Play screenshot captions (`scripts/google-play-shots.cjs`).
- No ratings, download counts or testimonials are shown.

## Arabic cut (`zad-al-muslim-hero-ar.mp4`)

The beats and timings are the same as the English cut. The composition is mirrored right-to-left, and every screen is the app's Arabic UI. The narrator is VoxCPM2 with a designed voice (Apache-2.0).

| # | On-screen text | Voiceover (start s) |
|---|---|---|
| 1 | وسطَ مشاغلِ الحياةِ / *التي لا تنتهي…* | 0.70 الحياةُ تمضي سريعًا. · 2.55 لكنَّ بعضَ اللحظاتِ تستحقُّ كلَّ اهتمامِنا. |
| 2 | اِمنحْ قَلْبَكَ مساحةً / *لما يهمُّ حقًّا.* | 5.45 امنحْ قَلْبَكَ مساحةً لما يهمُّ حقًّا. |
| 3 | صِلَتُكَ / *بالقرآنِ الكريم.* · ٥ أنماط للمصحف · التفاسير والعلامات · قرّاء متعدّدون · تشغيل في الخلفية | 8.40 جدِّدْ صِلَتَكَ بكتابِ الله، · 11.40 واستمعْ إلى أجملِ التلاوات. |
| 4 | تذكَّرْ. تأمَّلْ. *اِرتقِ.* · أذكار اليوم · حصن المسلم · المسبحة الذكية · الحفظ | 15.25 اجعلِ الذِّكرَ رَفِيقَكَ: أذكارُ اليوم، ومسبحةٌ ذكيّة، وأدواتٌ تُعِينُكَ على الحفظ. |
| 5 | طرقٌ أكثرُ / *لتبقى قريبًا.* → بِلُغَتِكَ *المفضّلة.* · الحديث · القبلة · إذاعة القرآن · يعمل دون إنترنت | 22.30 تصفّحِ الأحاديث، واعرفِ اتجاهَ القبلة، واستمعْ إلى إذاعةِ القرآن، بِلُغَتِكَ المفضّلة. |
| 6 | رَفِيقُكَ / *في كلِّ يوم.* · الفجر: مواقيت الصلاة وأذكار الصباح · الليل: أذكار النوم | 29.40 رَفِيقُكَ في كلِّ يوم، من الفجرِ حتى الليل. |
| 7 | زادُ المسلم · Zad Al-Muslim · رَفِيقُكَ الإسلاميّ المتكامل · مَجّاني • بلا إعلانات • يعمل دون إنترنت · حمِّله الآن من *Google Play* · امسح الرمز للتثبيت · Arabic Google Play badge · QR | 35.50 زادُ المسلم. رَفِيقُكَ الإسلاميُّ المتكامل. · 39.35 مَجّاني، بلا إعلانات، ويعمل دون إنترنت. · 42.90 حمِّلْه الآن من جوجل بلاي. |

In scene 5 the Qibla is shown on its Arabic start screen (see README: "Qibla in the Arabic cut").
