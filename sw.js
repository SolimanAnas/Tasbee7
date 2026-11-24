const CACHE_NAME = "zad-muslim-v166"; // v166: text mushaf — offline translations from Tanzil (data/translations: en.sahih, tr.diyanet, ur.junagarhi, ku.asan, ar.muyassar; fetched on first use, kept in quran-offline-translations-v1), one per app language by default, translation under every ayah (reading mode), ayah menu shows the chosen one with its translator; v165: text mushaf — offline search (local verified text, common spellings find Uthmani ones), recitation repeat (ayah ×n / page) + speed + previous/next + now-playing line + lock-screen metadata, share an ayah as an image card or open it in the video maker (?s=&a=), the whole page in the app language (qt_* keys in ar/en/tr/ur/ckb, incl. quran-common.js and the tasmee engine), language row in settings; v164: text mushaf — offline Madinah font uses the local QPC Hafs text (data/quran-qpc.json, letter-checked; the Tanzil text drew dotted circles), pause marks stay on their word (no &nbsp; + span), pinch / ctrl+wheel resize the text instead of zooming the page; v163: takrar — ayah text in the mushaf font (fonts/uthmani-colored.ttf) with its QPC Hafs text (data/quran-qpc.json) and ayah medallion, Amiri + quran.json as fallback; v162: video maker — ayat drawn in the mushaf font (fonts/uthmani-colored.ttf) with its QPC Hafs text (data/quran-qpc.json, verified against data/quran.json), the mushaf ayah medallions; v161: video maker — 🔎 search the Quran to pick the ayah; v160: home — prayer card ~12 % shorter (94 rows of open water taken out of images/prayer-frame-*.webp, now 1200 × 536; the times start at the waterline, tighter chips, no gap under the header), light and dark tiles 7 % more opaque with a finer shadow; v159: v159: home — glass cards in every theme (light: white glass / sky-blue accent, purple: indigo glass / violet, sepia: cream glass / gold, black: faint white glass / emerald), no blur and no wash so the background stays as it is, shorter cards (58 px list, 80 px 4-per-row, 40 / 36 px icons), matching glass nav bar per theme; v158: v158: home, sepia — glass cards: a pale wash over the bokeh, frosted cream glass cards with a bright edge and soft shadow, gold gradient accents (section bars, layout switch, upcoming-prayer pill), matching glass nav bar, solid surfaces when reduced transparency is requested; v157: v157: home — floating pill bottom navigation (rounded bar with a soft shadow, a tinted pill that slides to the tab whose panel is open, muted inactive tabs, theme colours for light / purple / sepia / black, RTL and LTR), nav icons in one 24 px box with optical balance (translate scaled down, bars scaled up); the 18 card icons re-cut from the source sheet and optically balanced (outline size and painted mass), shown at 44 px; new sepia background (golden bokeh, images/background-sepia.*); v156: v156: home — the feature cards show the 3D icons on their own (no tile box; icons/home/*.webp, one set for every theme); the accent follows the theme: sky blue (light), violet (dark), gold-bronze (sepia), emerald (plain-dark) for the section bars, layout switch and upcoming-prayer pill; the full Tajawal family (regular + bold) instead of the bold-only face, a type scale (17 / 14 / 11 px) and one grid rhythm (cards 64 px / 92 px high, 10 px gaps, 20 px between sections); v155: home — the feature cards use 3D picture tiles (icons/home/<theme>/*.webp: sky blue for light, purple for dark, caramel for sepia, emerald for plain-dark) in place of the outline SVGs, all tiles the same size, swapped with the theme; v154: audio and radio — the layout button only on big screens (foldables, tablets, car head units, computers), not on regular phones; v153: audio and radio — a header button switches between the wide and the vertical layout (it turns the screen where the app may, or switches in place when the screen is wide enough, e.g. an unfolded foldable held upright; remembered in playerLayout, set before the first paint); the seek bar paints played / buffered on its track (the taller landscape slider showed a grey block); audio wide layout: the seek bar runs along the bottom of the player, under both columns; v152: audio and radio on wide landscape screens (car head units 800×480 to 1920×720, tablets, phones sideways) — one screen with no scrolling: the player card in two columns with a line between (the title and big controls on the reading side, the art beside them, the reciter under it), the pickers in one row, repeat / download / favourite / shuffle / speed as one segmented bar, the title wrapping instead of scrolling, lists as a centred panel; refined: balanced columns, larger art, a stronger title (the reciter / category secondary), the transport and the lighter secondary bar set apart, alike pickers (an icon tile, label and value, a chevron), radio's live indicator above the station name; the shuffle icon redrawn as 🔀 (two arrows swapping lanes) on the audio pages; v151: home — the prayer times card is a framed picture (gold frame with an arch, minarets and a lake scene: night, day, golden hour; images/prayer-frame-{dark,light,sepia}.webp) in place of the SVG arch and outline (images/prayer-scene*.webp removed); drawn in three bands so it never distorts, the times on the water; v149: home — the saved theme and reading direction are set in <head> before the first paint (the page showed the dark default, right-to-left, until the load event and then switched), the prayer card's arch drawn right after its markup (it showed as a plain rectangle until the scripts at the end of the page had loaded); the same early theme and direction on azkar, radio, audio, audio-download, audio2, audio3, about, howto and privacy (each with its own rule; they showed their default theme until the load event); v148: radio — live Holy Quran Radio from Cairo (radiojar) first in the station list; the old «القاهرة» entry was Mustafa Ismail's stream: now «إذاعة مصطفى إسماعيل» at #5 (the duplicate further down removed); radiojar streams bypass the SW; adhkar — the «1 من 31» badge opens a list of the whole set to jump to any dhikr (done ✓, part-way n/N, repeats ×N; the current one highlighted); the translate button moved from the adhkar header into Settings (first row), the Settings ✕ at the far edge; adhkar auto-fit — a button on the card (and a switch in Settings) sizes the text so the whole dhikr fits the card (short ones up to 40 px, long ones down to 16), refits when the card changes size; sizing by hand turns it off; smallest size 22 → 16 px; v147: adhkar — the top bar sits below the status bar / notch (safe-area inset instead of a fixed 30 px on iOS), the page keeps clear of the bottom buttons whatever their real height (gesture bar / home indicator, mini player): the counter ring no longer runs under «تلقائي», A-/A+ have their own strip at the top of the card (the text no longer scrolls under them), English shows Previous on the left and Next on the right; v146: masbaha — «الأكثر استخدامًا» (سبحان الله، الحمد لله، لا إله إلا الله) at the top of the picker, add your own dhikr from the picker, the bookmark beside «تغيير الذكر» (it covered the text), a meaning with its source for every dhikr, ﷺ drawn with Amiri where Tajawal lacks it; v145: masbaha — ring fills clockwise as a thick arc with a knob (no bead dots); the dhikr in a gold cartouche (drawn to size) with previous / next arrows, swipe and a favourites bookmark (favourites first in the picker); frosted patterned disc in the ring; the lake-and-mosques scene in every theme (images/masbaha-scene-{light,dark,sepia}.webp: dusk, night, golden); tasbih mark and ornament on the title; leaf icon for power saving; the virtue title as a tab on the card; v144: masbaha redesign — the dhikr shown in full above the counter (tap to change), a 33-bead misbaha ring with the imam bead and rounds, the whole counter area counts a tap, labelled actions (undo, target, reset, power saving), a target sheet (3 / 7 / 10 / 33 / 99 / 100 / 1000 or any number), the virtue with its source on its own line, keyboard counting and screen-reader announcements, settings regrouped (statistics most-said first, folded); undo also corrects the weekly stats (DhikrStats.untap); v143: masbaha — power-saving mode: the exit ring appears under the finger only on a held press (grows, turns red), a held or exiting press no longer counts; the virtue card sits higher above the bottom edge; top bar and toast kept 14 px below the notch / status bar; v142: masbaha — light, dark and sepia themes (follows the app theme, selector in settings), dhikr picker as a searchable grouped sheet like the other menus, 8 more adhkar with their virtue and source, settings restyled like the other pages; v141: audio — saved mark is a floppy disk, shown on saved surahs too (was «محفوظ» text there); v140: audio — a saved recitation opens from «المصاحف المحفوظة» at its surah list, saved reciters listed first with a small download-done mark; v139: home — shorter prayer times card (201 → 165 px: lower arch, mosque gap and chip padding trimmed); v138: app icon — navy version: gold arch, lantern and open Quran under a blue sky with a mosque (all icon sizes, maskable on solid navy, full-bleed apple-touch-icon); v136: new light app icon — gold arch, lantern and open Quran on a sky background (icons/icon-192.png, icon_512.png, icon_1024.png, icon-512-maskable.png, new icons/apple-touch-icon.png: full-bleed for iOS); v135: home — continue-reading card redesigned on an arch, lantern and Quran picture per theme (night blue, sky, honey; images/quran-hero-{dark,light,sepia}[-ltr].webp), no arrow button (the whole card opens the mushaf), the home page no longer pinch-zooms on touch screens; v134: home — greeting header removed (prayer card at the top), shorter Quran card, one light sweep shared by both cards, clearer sepia bottom bar, Quran-and-lantern picture on the continue-reading card (images/quran-hero-*.webp); v133: home — prayer times card redesigned as an arched night scene with a mosque (images/prayer-scene*.webp: night for dark themes, day for light, golden hour for sepia); v132: full-mushaf download — card on the player under the selectors, short surahs first, a progress bar per surah, overall progress by size; v131: audio — «تحميل المصحف كاملاً»: a whole recitation saved for offline listening (js/audio-offline.js, cache quran-audio-offline-v1, never trimmed); v130: adhkar — no page pinch-zoom on touch screens again (pinching the dhikr card still resizes its text); v129: audio seek bar back to its thin 5 px look; v128: accessibility — 44 px tap areas on the mushaf, text mushaf, takrar, audio and adhkar controls (no visual change), tappable divs reachable by keyboard and screen readers (js/tap-a11y.js), visible keyboard focus (css/a11y.css), names for unnamed buttons, pinch zoom re-enabled on adhkar; v127: Quran text integrity — the text mushaf is laid out from the app's own verified text and page map (js/quran-text-source.js, data/quran-pages.json): fetched text is shown only when its letters match ayah by ayah, and the page reads with no connection; search/tafsir show remote text as text; tafsir opens offline; data/quran.json checksum-gated in CI; v126: offline — sql.js bundled (js/vendor/, the mushaf no longer needs a CDN), played/bundled audio really cached and served with byte ranges (seeking + iOS offline), precache in parallel batches, tafsir books + bundled audio in «download all», every page registers the SW and shows an offline notice (js/net-status.js), pages cached once regardless of ?query; v125: audio — «المصحف الجديد» (Minshawi) served per surah from mp3quran (GitHub release tracks often timed out) and listed after the murattal; new reciter محمد عبادة; reciter photos as album art (images/reciters/, also on the lock screen and the island, default art as fallback); 217 tracks that silently played another reciter (mp3quran redirects missing files to Minshawi) and 10 cut-off files hidden via `missing`; v124: ثبات — ورد القرآن journeys (daily pages, opens the mushaf at the page, khatma progress, 4-week calendar, make-up for a missed day), sprouts as growth (7 stages, milestone track with the plant of each milestone), «تجاوزت هذه اللحظة» after the ten minutes, new high-quality covers (images/thabat/covers: 1200px banners + 256px thumbnails, new artwork first); surah names shown in the UI font without the Uthmani sukun «ۡ» or the wasla (Tajawal has no glyph for either: they showed as boxes) in ثبات and the mushaf recitation messages; v123: ثبات — long journey names no longer widen the page (the whole page slid sideways on phones), counters in Western digits (Tajawal draws «٠» as a diamond), banner text readable in every theme, new journeys count hours/minutes, hours shown when a milestone is under two days away, library shows 4 then «عرض الكل»; v122: «ثبات» — private journeys of repentance and steadfastness (pages/thabat.html, js/thabat.js, js/thabat-content.js, images/thabat/), card on the home page; v121: azkar — «فضل الذكر» under each dhikr instead of takhreej/grading, taller card + smaller ring, A-/A+ zoom buttons, counts kept for the day with per-dhikr reset and "reset all", prev/next disabled at the ends; v120: azkar grading label shows the strongest ruling (حسن/صحيح), weak fadail ones «يؤخذ بالضعيف في الفضائل»; continuous player survives a host reload (refresh re-shows the framed page, back walks the visited pages instead of sticking on the player); book pages (Nawawi, Qudsi, Hisn, Duaa) menus, player and labels follow the app language (hb_* keys); v119: hadith encyclopedia — 75 corrupted characters repaired in the six books, empty entries hidden, Prophet's words / chain styled, Nawawi & Qudsi open their own pages; v118: بستان الدعاء rebuilt from «الدعاء من الكتاب والسنة» on the book design (assets/duaa-book.json, author's takhreej); honorific ligatures spelled out in hisn/azkar notes; v117: azkar — source, takhreej and grading for every dhikr (azkar.json, salah.json, sleeping-zikr.json) shown under the text; v116: حصن المسلم on the new book design (pages/hisn.html + assets/hisn-matn.json: author's takhreej for all 267, repeat counters, official per-chapter/per-dhikr audio); v115: الأربعون القدسية page (pages/qudsi.html, reviewed text + grading); Nawawi page split into shared css/hadith-book.css + js/hadith-book.js; v114: Nawawi filter chips and share-card audio toggle use SVG icons (no emoji-range characters); v113: Nawawi audio player — compact card, collapsible to a pill; v112: share-card videos can carry a recitation track (Nawawi hadith audio), text timed to it; v111: hadith encyclopedia — corrected An-Nawawi Forty text and takhreej (assets/hadith/nawawi40.json); v110: Nawawi page — corrected takhreej + wording (assets/hadith/nawawi40-matn.json), Prophet's words highlighted, per-hadith recitation player (repeat, auto-next, speed); v109: dedicated An-Nawawi Forty page (pages/nawawi.html: memorization mode, favourites, image/text sharing), prayer cards drop the "next" badge, share card back press no longer closes the modal underneath; v108: home prayer cards (five prayers, upcoming highlighted), sepia secondary text readable; v107: form controls inherit the app font (css/fonts.css), azkar page zoom off again; v106: notifications — 30-day push schedule (Play/TWA has no periodic sync), Play-app guidance when notifications are blocked; v105: audit fixes — Asr (Hanafi/standard) setting, pinch-zoom re-enabled on all pages, quran-text search escaping + API text rendered as text; v104: weekly dhikr stats card (js/dhikr-stats.js: dated history of masbaha/azkar/Quran counters, shared via ShareCard); v103: hadith image cards + silent video export for all share cards (hadith, hisn, duaa, azkar); v102: duaa/dhikr image cards (js/share-card.js) on hisn, duaa and azkar; v101: qibla corrects magnetic→true north (js/wmm.js, WMM2025) and reads the top edge, not the camera, in the 2D compass; v100: all pages load Tajawal + Amiri from bundled fonts via css/fonts.css (no Google Fonts); v99: azkar.html loads Amiri from the bundled fonts/Amiri.ttf (was Google-Fonts-only, fell back to a system font); v98: video maker self-heals a stale cached script (multi-picture switch did nothing with old video-maker.js); v97: video maker multi-picture slideshow (pan/zoom per picture, crossfades on ayah changes); v96: new dark-theme background (images/Background-dark.webp, now used by index.html too); v95: audio island drag-to-dismiss (drop on the bottom ✕ to stop and hide the floating player); v94: video maker "✦ Popular" quick-pick sheet (js/popular-ayat.js); v93: video maker exports a regular fast-start MP4 (MediaRecorder fragmented MP4 showed ~3 s in galleries/WhatsApp); v92: video maker redesign (numbered step cards, searchable surah/reciter sheets, steppers, switches, full-screen preview, Scheherazade canvas font, share caption); v91: ayah video maker (pages/video-maker.html — canvas + MediaRecorder status clips); v90: offline download runs in the page via CacheStorage (fixes wrapped PWA/TWA where the SW message path failed), keeps sw.js as single source for assets + cache name; v89: radio station selector card restored below the player (no pill), page padding trimmed so it still fits without scrolling; v88: radio player fits one screen (art scales with height, stations pill), tap art to pause motion, station title no longer overwritten by late i18n; v87: Sharjah radio via audio-only AAC (itworkscdn) with HLS fallbacks, per-station stream candidates, itworkscdn streams bypass the SW; v86: radio.html UX overhaul (categories, auto-reconnect with host fallback, prev/next, sleep timer, continuous host) + 10 wrong station streams fixed; live radio streams bypass the SW; v85: continuous audio — pages open in a frame over audio.html with a floating island player (js/continuous-player.js), setting in audio.html + index.html; v84: audio.html UX (no silent skip on load/offline, inline error + retry, buffering ring, rich searchable lists, lock-screen seek) + 40 dead audio links fixed/removed in audio-01.json; v83: hadith-viewer RTL swipe (finger → right = next chapter, like duaa/hisn), hadith search ignores invisible RLM marks, viewer shows full result count + "show more", hadith.html scrolls results into view; v82: qibla tilt-compensated heading (back-camera bearing when upright), ignore relative-only orientation, calibration "done" no longer exits the page (BackClose.swap); v81: takrar unit labels strip the basmala + quote the opening, readable selected rows; v80: takrar settings sheet, first-open preferences, ayah-opening unit labels, language button; v79: takrar redesign (player dock, 46 reciters, infinite range loop) + new i18n keys; v78: let GitHub release audio bypass the SW (range requests via SW broke seeking); v77: Minshawi new murattal tracks moved to GitHub release + clean track names; v76: harden offline modal — reply timeouts + graceful recovery when an old SW still controls after update; v75: drop ?v= cache-buster from audio pages, strip dead CSS; v74: unified offline-download.js controller; v73: precache quran-v2 + audio/radio JSONs, hadith books on-demand, ZAD_CACHE_ALL handler
const AUDIO_CACHE = "audio-cache-v1";
const PUSH_CTX_CACHE = "push-ctx-v1"; // schedule context written by js/notifications.js

// adhan + the shared schedule builder so periodicsync can rebuild the 30-day
// push schedule while the app is closed (same code the page runs).
importScripts("./data/adhan.js", "./js/prayer-service.js", "./js/schedule-builder.js");

// Recitation files are ~1–10 MB each; 120 entries keeps the cache roughly
// under ~500 MB worst-case instead of growing forever.
const AUDIO_CACHE_MAX_ENTRIES = 120;

async function trimAudioCache(cache) {
  const keys = await cache.keys(); // insertion order → oldest first
  for (let i = 0; i < keys.length - AUDIO_CACHE_MAX_ENTRIES; i++) {
    await cache.delete(keys[i]);
  }
}

const STATIC_ASSETS = [
  // ===== App Shell (HTML) =====
  "./",
  "./index.html",
  "./404.html",
  "./pages/quran.html",
  "./pages/quran_v2.html",
  "./pages/quran-v2.html",
  "./pages/quran-text.html",
  "./pages/audio.html",
  "./pages/radio.html",
  "./pages/azkar.html",
  "./pages/masbaha.html",
  "./pages/hisn.html",
  "./pages/duaa.html",
  "./pages/hadith.html",
  "./pages/qibla.html",
  "./pages/notifications.html",
  "./pages/takrar.html",
  "./pages/howto.html",
  "./pages/about.html",
  "./pages/privacy.html",
  "./pages/tasmee-dashboard.html",
  "./pages/tasmee-review.html",
  "./pages/hadith-viewer.html",
  "./pages/nawawi.html",
  "./pages/qudsi.html",
  "./pages/thabat.html",
  "./pages/salah.html",
  "./pages/sleeping.html",
  "./pages/audio-download.html",
  "./pages/audio2.html",
  "./pages/audio3.html",
  "./pages/radio2.html",
  "./pages/video.html",
  "./pages/video-maker.html",

  // ===== Config =====
  "./manifest.json",

  // ===== Styles =====
  "./css/style.css",
  "./css/svg-theme.css",
  "./css/fonts.css",
  "./css/hadith-book.css",
  "./css/thabat.css",
  "./js/svg-injector.js",
  "./css/quran-v4.css",
  "./css/tasmee.css",
  "./css/tasmee-pro-v2.css",
  "./css/_masbaha.css",

  // ===== Core JS =====
  "./data/cities.js",
  "./data/adhan.js",
  "./js/quran-structure.js",
  "./js/native-init.js",
  "./js/notifications.js",
  "./js/schedule-builder.js",
  "./js/prayer-service.js",
  "./js/theme-manager.js",
  "./js/toast.js",
  "./js/back-close.js",
  "./js/wmm.js",
  "./js/share-card.js",
  "./js/hadith-book.js",
  "./js/thabat.js",
  "./js/thabat-content.js",
  "./images/thabat/hero.webp",
  "./images/thabat/covers/ember-s.webp",
  "./images/thabat/covers/new-start-s.webp",
  "./images/thabat/covers/dawn-s.webp",
  "./images/thabat/covers/lutf-s.webp",
  "./images/thabat/covers/path-s.webp",
  "./images/thabat/covers/mushaf-s.webp",
  "./images/thabat/covers/c1-s.webp",
  "./images/thabat/covers/c2-s.webp",
  "./images/thabat/covers/c3-s.webp",
  "./images/thabat/covers/c4-s.webp",
  "./images/thabat/covers/c5-s.webp",
  "./images/thabat/covers/c6-s.webp",
  "./images/thabat/covers/c7-s.webp",
  "./images/thabat/covers/c8-s.webp",
  "./images/thabat/growth/g1.webp",
  "./images/thabat/growth/g2.webp",
  "./images/thabat/growth/g3.webp",
  "./images/thabat/growth/g4.webp",
  "./images/thabat/growth/g5.webp",
  "./images/thabat/growth/g6.webp",
  "./images/thabat/growth/g7.webp",
  "./images/thabat/covers/mushaf.webp",
  "./js/dhikr-stats.js",
  "./js/continuous-player.js",
  "./js/sw-update.js",
  "./js/net-status.js",
  "./js/audio-offline.js",
  "./js/tap-a11y.js",
  "./css/a11y.css",
  "./js/vendor/sql-wasm.js",
  "./js/vendor/sql-wasm.wasm",
  "./js/offline-download.js",
  "./js/pwa-install.js",
  "./js/plugins/capacitor-core.js",
  "./js/plugins/capacitor-shim.js",
  "./js/plugins/local-notifications.js",
  "./js/quran-common.js",
  "./js/quran-text-source.js",
  "./js/tasmee-engine.js",
  "./js/tasmee-matcher.js",
  "./js/tasmee-store.js",
  "./js/juz-map.js",
  "./js/masbaha.js",
  "./js/medina2.data.js",
  "./js/quran-app.js",
  "./js/quranpages.data.js",
  "./js/radio-stations.js",
  "./js/reciters.js",
  "./js/video-maker.js",
  "./js/mp4-faststart.js",
  "./js/popular-ayat.js",
  "./js/surah-map.js",
  "./js/tarteel-worker.js",

  // ===== i18n engine + locale dictionaries =====
  "./js/i18n.js",
  "./js/i18n/names.js",
  "./js/i18n/ar.js",
  "./js/i18n/en.js",
  "./js/i18n/tr.js",
  "./js/i18n/ckb.js",
  "./js/i18n/ur.js",

  // ===== Extracted Quran modules =====
  "./js/quran/state.js",
  "./js/quran/navigation.js",
  "./js/quran/highlights.js",
  "./js/quran/audio.js",
  "./js/quran/audio-cache.js",
  "./js/quran/tafsir.js",
  "./js/quran/settings.js",
  "./js/quran/ui.js",
  "./js/quran/search.js",
  "./js/quran/download.js",
  "./js/quran/init.js",
  "./js/quran/tasmee.js",
  "./js/quran/tasmee-pro-v2.js",
  "./js/quran/tasmee-pro-v3.js",
  "./js/quran/tasmee-dashboard.js",
  "./js/quran/tasmee-review.js",
  "./js/quran/local-search.js",
  "./js/quran/ui-extras.js",

  // ===== Offline Quran text (word-by-word Tasmee) =====
  "./data/quran.json",
  "./data/quran-pages.json",
  "./data/quran-qpc.json",
  "./data/vocab.json",
  "./json/medina2_coords.json",

  // ===== Audio / radio track indexes (small JSON — needed by audio & radio pages) =====
  "./json/audio-01.json",
  "./json/audio-02.json",
  "./json/radio-01.json",

  // ===== Fonts =====
  "./fonts/Tajawal.ttf",
  "./fonts/Tajawal-Bold.ttf",
  "./fonts/Scheherazade.ttf",
  "./fonts/uthmani-colored.ttf",
  "./fonts/UthmanicHafs_V20.ttf",
  "./fonts/UthmanicHafs.otf",
  "./fonts/Amiri.ttf",
  "./fonts/almushaf.ttf",
  "./fonts/qortoba.ttf",
  "./fonts/naskh.otf",
  "./fonts/me_quran.ttf",
  "./fonts/basmalah.ttf",

  // ===== Assets =====
  "./assets/audio.json",
  "./assets/azkar.json",
  "./assets/husn.pdf",
  "./assets/hisn-matn.json",
  "./assets/duaa-book.json",
  "./assets/salah.json",
  "./assets/sleeping-zikr.json",
  "./assets/part1.json",
  "./assets/part2.json",
  "./assets/part3.json",
  "./assets/part4.json",
  "./assets/part5.json",
  "./assets/hadith/Index-translated.json",
  "./assets/hadith/rand-hadith.json",

  // ===== Icons (incl. every size/purpose referenced by manifest.json) =====
  "./icons/icon-192.png",
  "./icons/icon_512.png",
  "./icons/icon-512-maskable.png",
  "./icons/icon_1024.png",
  "./icons/apple-touch-icon.png",
  "./icons/duaa.png",
  "./icons/duaa.svg",
  "./icons/settings.svg",
  "./icons/masbaha.png",
  "./icons/masbaha.svg",
  "./icons/radio.png",
  "./icons/radio.svg",
  "./icons/qibla.svg",
  // Home feature-card icons (3D artwork, shared by every theme)
  "./icons/home/audio.webp",
  "./icons/home/duaa.webp",
  "./icons/home/hadith.webp",
  "./icons/home/hisn.webp",
  "./icons/home/masbaha.webp",
  "./icons/home/morning.webp",
  "./icons/home/nawawi.webp",
  "./icons/home/night.webp",
  "./icons/home/prayer.webp",
  "./icons/home/qibla.webp",
  "./icons/home/qudsi.webp",
  "./icons/home/radio.webp",
  "./icons/home/ruqyah.webp",
  "./icons/home/salah.webp",
  "./icons/home/sleeping.webp",
  "./icons/home/takrar.webp",
  "./icons/home/thabat.webp",
  "./icons/home/video.webp",

  // ===== Background images =====
  "./images/Background-dark.webp",
  "./images/Background-light.webp",
  "./images/prayer-frame-dark.webp",
  "./images/prayer-frame-light.webp",
  "./images/prayer-frame-sepia.webp",
  "./images/quran-hero-dark.webp",
  "./images/quran-hero-dark-ltr.webp",
  "./images/quran-hero-light.webp",
  "./images/quran-hero-light-ltr.webp",
  "./images/quran-hero-sepia.webp",
  "./images/quran-hero-sepia-ltr.webp",
  "./images/masbaha-scene-light.webp",
  "./images/masbaha-scene-dark.webp",
  "./images/masbaha-scene-sepia.webp",
  "./images/background-sepia.webp",
  "./images/album.png",

  // ===== PWA install / splash screenshots (manifest.json) =====
  "./poster.webp",
  "./poster-wide.webp",

  // ===== Hadith book thumbnails =====
  "./assets/thumbnails/6/ImamBukhari1.webp",
  "./assets/thumbnails/6/ImamMuslim1.webp",
  "./assets/thumbnails/6/Abu Dawwod.webp",
  "./assets/thumbnails/6/Imam_al-Trimdhi.webp",
  "./assets/thumbnails/6/Nasa'ie.webp",
  "./assets/thumbnails/6/Ibn majah.webp",
  "./assets/thumbnails/others/رياض الصالحين.webp",
  "./assets/thumbnails/others/بلوغ المرام.webp",
  "./assets/thumbnails/others/مشكاة المصابيح2.webp",
  "./assets/thumbnails/others/الادب المفرد2.webp",
  "./assets/thumbnails/others/الشمائل المحمدية.webp",
  "./assets/thumbnails/others/متن الأربعون النووية2.webp",
  "./assets/thumbnails/others/الأربعون القدسية.webp",

  // ===== Quran page images =====
  "./img/text-container.png",
  "./img/text-container_txt.png",
  "./img/frame.png",
  "./img/Sura_border.svg",
  "./img/Basmala.svg",

  // ===== SVG Icons =====
  "./img/SVG/activity.svg",
  "./img/SVG/alert-triangle.svg",
  "./img/SVG/arrow-left.svg",
  "./img/SVG/arrow-right.svg",
  "./img/SVG/at-sign.svg",
  "./img/SVG/award.svg",
  "./img/SVG/azkar.svg",
  "./img/SVG/bar-chart.svg",
  "./img/SVG/battery.svg",
  "./img/SVG/bell.svg",
  "./img/SVG/book-open.svg",
  "./img/SVG/book.svg",
  "./img/SVG/books.svg",
  "./img/SVG/bookmark.svg",
  "./img/SVG/calendar-check.svg",
  "./img/SVG/calendar-minus.svg",
  "./img/SVG/calendar-plus.svg",
  "./img/SVG/calendar-x.svg",
  "./img/SVG/calendar.svg",
  "./img/SVG/camera.svg",
  "./img/SVG/check-circle.svg",
  "./img/SVG/check-double.svg",
  "./img/SVG/check-square.svg",
  "./img/SVG/check.svg",
  "./img/SVG/chevron-down.svg",
  "./img/SVG/chevron-left.svg",
  "./img/SVG/chevron-right.svg",
  "./img/SVG/circle-filled.svg",
  "./img/SVG/circle.svg",
  "./img/SVG/clock-countdown.svg",
  "./img/SVG/clock.svg",
  "./img/SVG/close.svg",
  "./img/SVG/cloud.svg",
  "./img/SVG/code.svg",
  "./img/SVG/coffee.svg",
  "./img/SVG/compass-rose.svg",
  "./img/SVG/compass.svg",
  "./img/SVG/copy.svg",
  "./img/SVG/download.svg",
  "./img/SVG/downloads.svg",
  "./img/SVG/edit.svg",
  "./img/SVG/external-link.svg",
  "./img/SVG/file-text.svg",
  "./img/SVG/filter.svg",
  "./img/SVG/flag.svg",
  "./img/SVG/folder.svg",
  "./img/SVG/gauge.svg",
  "./img/SVG/globe.svg",
  "./img/SVG/grid.svg",
  "./img/SVG/hadith.svg",
  "./img/SVG/hard-drive.svg",
  "./img/SVG/hash.svg",
  "./img/SVG/headphones.svg",
  "./img/SVG/heart.svg",
  "./img/SVG/history.svg",
  "./img/SVG/home.svg",
  "./img/SVG/image.svg",
  "./img/SVG/info.svg",
  "./img/SVG/key.svg",
  "./img/SVG/layers.svg",
  "./img/SVG/lightbulb.svg",
  "./img/SVG/link.svg",
  "./img/SVG/list-checks.svg",
  "./img/SVG/list.svg",
  "./img/SVG/location.svg",
  "./img/SVG/lock.svg",
  "./img/SVG/map-pin.svg",
  "./img/SVG/menu.svg",
  "./img/SVG/message-circle.svg",
  "./img/SVG/mic.svg",
  "./img/SVG/minus.svg",
  "./img/SVG/monitor.svg",
  "./img/SVG/moon.svg",
  "./img/SVG/more-vertical.svg",
  "./img/SVG/music.svg",
  "./img/SVG/note.svg",
  "./img/SVG/palette.svg",
  "./img/SVG/pause.svg",
  "./img/SVG/pen.svg",
  "./img/SVG/pin.svg",
  "./img/SVG/play.svg",
  "./img/SVG/plus.svg",
  "./img/SVG/prayer.svg",
  "./img/SVG/printer.svg",
  "./img/SVG/quran.svg",
  "./img/SVG/radio.svg",
  "./img/SVG/refresh.svg",
  "./img/SVG/repeat-1.svg",
  "./img/SVG/repeat.svg",
  "./img/SVG/save-db.svg",
  "./img/SVG/save.svg",
  "./img/SVG/scissors.svg",
  "./img/SVG/search.svg",
  "./img/SVG/send.svg",
  "./img/SVG/settings.svg",
  "./img/SVG/share.svg",
  "./img/SVG/shield.svg",
  "./img/SVG/skip-back.svg",
  "./img/SVG/skip-forward.svg",
  "./img/SVG/sliders.svg",
  "./img/SVG/smartphone.svg",
  "./img/SVG/sort.svg",
  "./img/SVG/square.svg",
  "./img/SVG/star.svg",
  "./img/SVG/sun.svg",
  "./img/SVG/target.svg",
  "./img/SVG/tasbih.svg",
  "./img/SVG/terminal.svg",
  "./img/SVG/text.svg",
  "./img/SVG/trash.svg",
  "./img/SVG/trending-up.svg",
  "./img/SVG/user.svg",
  "./img/SVG/volume-x.svg",
  "./img/SVG/volume.svg",
  "./img/SVG/wifi-off.svg",
  "./img/SVG/wifi.svg",
  "./img/SVG/x.svg",
  "./img/SVG/x-circle.svg",
  "./img/SVG/zap.svg"
];

// ===== Optional heavy content (NOT precached on install) =====
// The full hadith books (~58 MB), the tafsir books (~60 MB) and the bundled
// recordings (~70 MB) are too heavy to force on every visitor at install.
// Instead they are fetched on demand — either lazily when first opened (the
// fetch handler caches them), or in bulk via the "Download for offline" modal
// in index.html (js/offline-download.js reads this list straight from here).
const OPTIONAL_ASSETS = [
  "./assets/hadith/bukhari.json",
  "./assets/hadith/muslim.json",
  "./assets/hadith/abudawud.json",
  "./assets/hadith/tirmidhi.json",
  "./assets/hadith/nasai.json",
  "./assets/hadith/ibnmajah.json",
  "./assets/hadith/riyad_assalihin.json",
  "./assets/hadith/bulugh_almaram.json",
  "./assets/hadith/mishkat_almasabih.json",
  "./assets/hadith/aladab_almufrad.json",
  "./assets/hadith/shamail_muhammadiyah.json",
  "./assets/hadith/nawawi40.json",
  "./assets/hadith/nawawi40-matn.json",
  "./assets/hadith/qudsi40-matn.json",
  "./assets/hadith/qudsi40.json",

  // Tafsir books (SQLite, ~60 MB) — opened from the tafsir sheet of the mushaf.
  "./db/tafsir-saadi.db",
  "./db/tafsir-baghawi.db",
  "./db/tafsir-qortobi.db",
  "./db/tafsir-ibn-kathir.db",

  // Bundled recordings (~70 MB): adhan, morning/evening azkar, ruqyah, sleep azkar.
  "./assets/azan.mp3",
  "./assets/media/Azkar-morning.mp3",
  "./assets/media/Azkar-night.mp3",
  "./assets/media/rokia06.mp3",
  "./assets/media/sleep-zikr/ar_99.mp3",
  "./assets/media/sleep-zikr/ar_100.mp3",
  "./assets/media/sleep-zikr/ar_101.mp3",
  "./assets/media/sleep-zikr/ar_102.mp3",
  "./assets/media/sleep-zikr/ar_103.mp3",
  "./assets/media/sleep-zikr/ar_104.mp3",
  "./assets/media/sleep-zikr/ar_105.mp3",
  "./assets/media/sleep-zikr/ar_106.mp3",
  "./assets/media/sleep-zikr/ar_107.mp3",
  "./assets/media/sleep-zikr/ar_108.mp3",
  "./assets/media/sleep-zikr/ar_109.mp3",
  "./assets/media/sleep-zikr/ar_110.mp3",
  "./assets/media/sleep-zikr/ar_111.mp3"
];

// Everything the "Download for offline" modal pulls: the full app shell plus the
// heavy books. Kept here so sw.js stays the single source of truth for what a
// complete offline install contains.
const FULL_OFFLINE_ASSETS = STATIC_ASSETS.concat(OPTIONAL_ASSETS);

// ===== Cross-origin runtime dependencies =====
// The app pulls a few libraries and web-fonts from CDNs. These can't be
// listed in STATIC_ASSETS the same way (opaque/cors), and the previous
// fetch handler only cached same-origin ("basic") responses — so anything
// from these hosts silently failed offline. We now cache them at runtime
// (cache-first) so every important page works fully offline after one visit.
const CACHEABLE_CDN_HOSTS = [
  "fonts.googleapis.com",   // @font-face CSS (Tajawal / Amiri)
  "fonts.gstatic.com",      // the actual font files referenced by that CSS
  "cdnjs.cloudflare.com",   // sql.js (offline Quran / tafsir / mushaf DBs)
  "cdn.jsdelivr.net"        // hls.js (radio player)
];

function isCacheableCrossOrigin(url) {
  return CACHEABLE_CDN_HOSTS.some(h => url.hostname === h || url.hostname.endsWith("." + h));
}

const DEEP_LINKS = {
  prayer: "./pages/quran.html",
  azkar: "./pages/azkar.html",
  kahf: "./pages/quran.html?surah=18",
  masbaha: "./pages/masbaha.html",
  hisn: "./pages/hisn.html",
  radio: "./pages/radio.html",
  default: "./index.html"
};

// ===== Install: cache static assets =====
// Fetched in small parallel batches (one-by-one took minutes on a slow link,
// and an install that never finishes means no offline layer at all).
// "no-cache" revalidates against the HTTP cache, so a new version never
// precaches a stale copy and unchanged files cost a 304, not a download.
const PRECACHE_CONCURRENCY = 8;

async function precacheOne(cache, asset) {
  try {
    const response = await fetch(asset, { cache: "no-cache" });
    if (response.ok) {
      await cache.put(asset, response);
      return true;
    }
    console.warn(`⚠️ Failed to cache: ${asset} (Status: ${response.status})`);
  } catch (err) {
    console.warn(`🚨 Network error while caching: ${asset}`, err);
  }
  return false;
}

async function precacheAll(cache, assets) {
  let next = 0;
  let failed = [];
  const worker = async () => {
    while (next < assets.length) {
      const asset = assets[next++];
      if (!(await precacheOne(cache, asset))) failed.push(asset);
    }
  };
  await Promise.all(Array.from({ length: PRECACHE_CONCURRENCY }, worker));
  // One more pass for whatever a flaky connection dropped.
  const retry = failed;
  failed = [];
  for (const asset of retry) {
    if (!(await precacheOne(cache, asset))) failed.push(asset);
  }
  return failed;
}

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      const failed = await precacheAll(cache, STATIC_ASSETS);
      console.log(`✅ Precache done: ${STATIC_ASSETS.length - failed.length}/${STATIC_ASSETS.length}`);
    })
  );
});

// ===== Activate: clean old caches =====
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME && key !== AUDIO_CACHE && key !== PUSH_CTX_CACHE && !key.startsWith("quran-offline") && !key.startsWith("quran-audio-offline") && !key.startsWith("quran-pages") && !key.startsWith("quran-mushaf") && !key.startsWith("tarteel-model"))
          .map(key => caches.delete(key))
      )
    )
  );
  console.log("✅ SW activated");
  return self.clients.claim();
});

// ===== Audio: offline playback =====
// <audio> asks for byte ranges ("Range: bytes=0-", then more on every seek).
// The Cache API can't store the 206 answers, so before this the audio cache
// stayed empty and nothing played offline. Now:
//   • a cached full copy answers any range itself (206 slices — Safari refuses
//     to play without them, and seeking needs them everywhere);
//   • a readable response that carries the whole file — a plain 200, or the
//     usual 206 for "bytes=0-" — is stored as a full copy while it plays.
// Cross-origin audio requested without CORS is opaque and can't be stored
// here; pages that download a track put it in AUDIO_CACHE themselves.
async function findCachedAudio(href) {
  const opts = { ignoreVary: true };
  const audioCache = await caches.open(AUDIO_CACHE);
  let hit = await audioCache.match(href, opts);
  // Also the app cache ("download all" stores bundled recordings there) and
  // any download cache a page keeps.
  if (!hit) hit = await caches.match(href, opts);
  if (!hit) {
    // Retry URLs carry a throw-away "_r=" parameter (pages/audio.html).
    const clean = href.replace(/([?&])_r=\d+(&|$)/, (m, a, b) => (b ? a : ""));
    if (clean !== href) hit = (await audioCache.match(clean, opts)) || (await caches.match(clean, opts));
  }
  // Only a complete, readable body can be sliced.
  return hit && hit.status === 200 && hit.type !== "opaque" ? hit : null;
}

async function rangeResponse(full, rangeHeader) {
  const blob = await full.blob();
  const size = blob.size;
  const m = /^bytes=(\d*)-(\d*)$/.exec((rangeHeader || "").trim());
  if (!m || (m[1] === "" && m[2] === "")) return new Response(blob, { status: 200, headers: full.headers });

  let start, end;
  if (m[1] === "") {                       // "bytes=-500": the last 500 bytes
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) {
    return new Response("", { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }

  const type = full.headers.get("Content-Type") || "audio/mpeg";
  return new Response(blob.slice(start, end + 1, type), {
    status: 206,
    statusText: "Partial Content",
    headers: {
      "Content-Type": type,
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes"
    }
  });
}

// A 206 that starts at byte 0 and runs to the end is the whole file.
function isWholeFile206(res) {
  const m = /^bytes 0-(\d+)\/(\d+)$/.exec(res.headers.get("Content-Range") || "");
  return !!m && Number(m[1]) + 1 === Number(m[2]);
}

async function storeFullAudio(href, res) {
  try {
    const headers = new Headers();
    const type = res.headers.get("Content-Type");
    if (type) headers.set("Content-Type", type);
    const cache = await caches.open(AUDIO_CACHE);
    // Stored as a plain 200 keyed by URL; the put fails (and nothing is kept)
    // if the download is cut short, so a partial file is never served later.
    await cache.put(href, new Response(res.body, { status: 200, headers }));
    await trimAudioCache(cache);
  } catch (_) { /* aborted download, quota… — play from the network next time */ }
}

async function handleAudio(event) {
  const req = event.request;
  const range = req.headers.get("range");

  const cached = await findCachedAudio(req.url);
  if (cached) return range ? rangeResponse(cached, range) : cached;

  try {
    const response = await fetch(req);
    if (response.type !== "opaque" &&
        (response.status === 200 || (response.status === 206 && isWholeFile206(response)))) {
      event.waitUntil(storeFullAudio(req.url, response.clone()));
    }
    return response;
  } catch (_) {
    return new Response("", { status: 503, statusText: "Offline" });
  }
}

// ===== Fetch handler =====
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // --- GitHub release audio: leave to the browser ---
  // Release downloads redirect to short-lived signed URLs on the asset hosts,
  // and the browser then sends range requests to those directly. Answered from
  // the SW they come back opaque (so never cached) and seeking breaks playback.
  if ((url.hostname === "github.com" && url.pathname.includes("/releases/download/")) ||
      url.hostname === "release-assets.githubusercontent.com" ||
      url.hostname === "objects.githubusercontent.com") {
    return;
  }

  // --- Audio files: cache-first, byte ranges served from the cached copy ---
  if (url.pathname.endsWith(".mp3") ||
      url.hostname.includes("mp3quran") ||
      url.hostname.includes("archive.org")) {
    event.respondWith(handleAudio(event));
    return;
  }

  // --- API calls: network-first, no caching (let client handle) ---
  // Live radio streams never end and can't be cached: let the browser talk to
  // the stream hosts directly instead of piping them through the SW.
  if (url.hostname === "qurango.net" || url.hostname.endsWith(".qurango.net") ||
      url.hostname.endsWith(".itworkscdn.net") ||
      url.hostname === "radiojar.com" || url.hostname.endsWith(".radiojar.com") ||
      url.hostname === "quran-stream-proxy.solimananas2012.workers.dev") {
    return;
  }

  if (url.hostname.includes("api.alquran.cloud") ||
      url.pathname.endsWith(".m3u8") ||
      url.pathname.endsWith(".onnx")) {
    return;
  }

  // --- HTML pages: stale-while-revalidate ---
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        // Pages are static files: "azkar.html?type=morning" and "azkar.html"
        // are the same document. One cache entry per page (keyed without the
        // query) — deep links hit the precached copy offline, and the cache
        // doesn't fill up with a copy per ?surah=/?page= value.
        const pageKey = url.origin === self.location.origin ? url.origin + url.pathname : req.url;
        const save = res => {
          if (res && res.ok && !res.redirected) return cache.put(pageKey, res);
        };

        let cached = await cache.match(pageKey);
        if (!cached) cached = await cache.match(req, { ignoreSearch: true });

        if (cached) {
          // Serve the cached copy immediately; revalidate in the background.
          event.waitUntil(fetch(req).then(save).catch(() => {}));
          return cached;
        }

        try {
          const res = await fetch(req);
          event.waitUntil(Promise.resolve(save(res.clone())).catch(() => {}));
          return res;
        } catch (e) {
          // Offline with nothing cached for this URL — show the styled
          // fallback page (it explains the connection is down) instead of a
          // bare browser error.
          return (await cache.match("./404.html")) ||
            new Response("Offline", { status: 503, statusText: "Service Unavailable", headers: { "Content-Type": "text/plain" } });
        }
      })
    );
    return;
  }

  // --- Static assets: cache-first, network fallback ---
  event.respondWith(
    // Exact match first, then ignore the query string. Some pages request
    // assets with a cache-busting suffix (e.g. json/audio-01.json?v=169…),
    // which would otherwise never match the precached copy and would fail
    // hard when offline.
    caches.match(req).then(exact => exact || caches.match(req, { ignoreSearch: true }))
      .then(cacheRes => cacheRes ||
      fetch(req).then(networkRes => {
        // Cache same-origin assets (basic) AND the allow-listed CDN/font
        // hosts. CDN <script>/<link>/font requests are no-cors, so they come
        // back "opaque" (status 0) — cache those too so the app's libraries
        // and web-fonts survive going offline after the first visit.
        const cacheable = networkRes && (
          (networkRes.status === 200 && networkRes.type === "basic") ||
          (isCacheableCrossOrigin(url) && (networkRes.ok || networkRes.type === "opaque")));
        if (cacheable) {
          const copy = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return networkRes;
      }).catch(() => new Response("Offline", { status: 503, statusText: "Service Unavailable", headers: { "Content-Type": "text/plain" } }))
    )
  );
});

// ===== Bulk offline download (driven by the modal in index.html) =====
// The page opens a MessageChannel and posts { type: "ZAD_CACHE_ALL" } (or
// "ZAD_CACHE_STATUS"). Progress and completion are reported back on the same
// port so the UI can render a live progress bar. Doing the fetching here keeps
// the full asset list in one place (sw.js) and lets downloads continue briefly
// even while the user navigates between the app's pages.
self.addEventListener("message", event => {
  const msg = event.data || {};
  const reply = m => {
    if (event.ports && event.ports[0]) event.ports[0].postMessage(m);
  };

  if (msg.type === "ZAD_CACHE_STATUS") {
    event.waitUntil(reportCacheStatus(reply));
    return;
  }

  if (msg.type === "ZAD_CACHE_ALL") {
    event.waitUntil(cacheAllOffline(reply));
    return;
  }

  // Legacy hook kept for any caller still asking the SW to activate immediately.
  if (msg.type === "SKIP_WAITING") self.skipWaiting();
});

async function reportCacheStatus(reply) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const results = await Promise.all(
      FULL_OFFLINE_ASSETS.map(async url => {
        const m = (await cache.match(url)) || (await cache.match(url, { ignoreSearch: true }));
        return m ? 1 : 0;
      })
    );
    const cached = results.reduce((a, b) => a + b, 0);
    reply({ type: "ZAD_CACHE_STATUS_RESULT", cached, total: FULL_OFFLINE_ASSETS.length });
  } catch (e) {
    reply({ type: "ZAD_CACHE_STATUS_RESULT", cached: 0, total: FULL_OFFLINE_ASSETS.length, error: e.message });
  }
}

async function cacheAllOffline(reply) {
  const cache = await caches.open(CACHE_NAME);
  const assets = FULL_OFFLINE_ASSETS;
  const total = assets.length;
  let done = 0;
  let failed = 0;
  let bytes = 0;

  reply({ type: "ZAD_CACHE_PROGRESS", done, total, failed, bytes });

  for (const url of assets) {
    try {
      // Reuse an already-cached copy instead of re-downloading it.
      let res = await cache.match(url);
      if (!res) {
        res = await fetch(url, { cache: "no-cache" });
        if (res && res.ok) {
          await cache.put(url, res.clone());
        } else {
          failed++;
        }
      }
      if (res) {
        const len = Number(res.headers.get("content-length"));
        if (!Number.isNaN(len) && len > 0) bytes += len;
      }
    } catch (_) {
      failed++;
    }
    done++;
    reply({ type: "ZAD_CACHE_PROGRESS", done, total, failed, bytes, url });
  }

  // Note: storage persistence must be requested from the page (Window context),
  // which the modal does before starting — StorageManager.persist() is not
  // available inside a service worker.
  reply({ type: "ZAD_CACHE_DONE", done, total, failed, bytes });
}

// ===== Periodic schedule refresh =====
// Wakes ~daily (Chromium, installed PWAs) to re-upload a fresh 30-day schedule
// from the context the page persisted — so pushes keep flowing even if the
// user doesn't open the app past the schedule horizon.
self.addEventListener("periodicsync", event => {
  if (event.tag === "refresh-push-schedule") {
    event.waitUntil(refreshPushSchedule());
  }
});

async function refreshPushSchedule() {
  try {
    const cache = await caches.open(PUSH_CTX_CACHE);
    const res = await cache.match("./__push-ctx");
    if (!res) return;
    const ctx = await res.json();
    if (!ctx || !ctx.serverUrl) return;

    const subscription = await self.registration.pushManager.getSubscription();
    if (!subscription) return;

    const schedule = (typeof buildNotificationSchedule === "function")
      ? buildNotificationSchedule(ctx, ctx.scheduleDays || 30) : [];
    if (!schedule.length) return; // disabled or no location — nothing to refresh

    await fetch(`${ctx.serverUrl}/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription,
        userId: ctx.userId,
        tzOffset: new Date().getTimezoneOffset(),
        schedule
      })
    });
    console.log(`🔄 periodicsync: schedule refreshed (${schedule.length} events)`);
  } catch (e) {
    console.warn("periodicsync refresh failed:", e.message);
  }
}

// ===== Push notification receive =====
self.addEventListener("push", event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "🔔 Zad Al-Muslim", body: "تذكير جديد" };
  }

  const notificationData = data.data || {};
  const targetUrl = notificationData.url || DEEP_LINKS[notificationData.type] || DEEP_LINKS.default;

  // Contextual primary action — the schedule tags double as the type
  // (prayer-fajr, pre-asr, azkar-morning, friday-kahf, …).
  const type = notificationData.type || data.tag || "default";
  let openTitle = "فتح";
  if (type.startsWith("azkar")) openTitle = "📿 اقرأ الأذكار";
  else if (type.startsWith("prayer") || type.startsWith("pre-")) openTitle = "🕌 مواقيت الصلاة";
  else if (type.includes("kahf")) openTitle = "📖 اقرأ سورة الكهف";

  const options = {
    body: data.body || "زاد المسلم",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    vibrate: [200, 100, 200],
    tag: data.tag || "zad-muslim",
    renotify: true,
    data: {
      url: targetUrl,
      type: type
    },
    actions: [
      { action: "open", title: openTitle },
      { action: "dismiss", title: "إغلاق" }
    ]
  };

  console.log("📨 Push received:", data.title);
  event.waitUntil(
    self.registration.showNotification(data.title || "🔔 Zad Al-Muslim", options)
  );
});

// ===== Notification click handler =====
self.addEventListener("notificationclick", event => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const targetUrl = event.notification.data?.url || DEEP_LINKS.default;
  const fullTargetUrl = new URL(targetUrl, self.location.href).href;

  console.log("👆 Notification clicked, opening:", fullTargetUrl);

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      const targetPath = new URL(fullTargetUrl).pathname;
      for (const client of clientList) {
        const clientPath = new URL(client.url).pathname;
        if (clientPath === targetPath) {
          client.navigate(fullTargetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(fullTargetUrl);
    })
  );
});

console.log("✅ Service Worker " + CACHE_NAME + " loaded");
