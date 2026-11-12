const CACHE_NAME = "zad-muslim-v130"; // v130: adhkar — no page pinch-zoom on touch screens again (pinching the dhikr card still resizes its text); v129: audio seek bar back to its thin 5 px look; v128: accessibility — 44 px tap areas on the mushaf, text mushaf, takrar, audio and adhkar controls (no visual change), tappable divs reachable by keyboard and screen readers (js/tap-a11y.js), visible keyboard focus (css/a11y.css), names for unnamed buttons, pinch zoom re-enabled on adhkar; v127: Quran text integrity — the text mushaf is laid out from the app's own verified text and page map (js/quran-text-source.js, data/quran-pages.json): fetched text is shown only when its letters match ayah by ayah, and the page reads with no connection; search/tafsir show remote text as text; tafsir opens offline; data/quran.json checksum-gated in CI; v126: offline — sql.js bundled (js/vendor/, the mushaf no longer needs a CDN), played/bundled audio really cached and served with byte ranges (seeking + iOS offline), precache in parallel batches, tafsir books + bundled audio in «download all», every page registers the SW and shows an offline notice (js/net-status.js), pages cached once regardless of ?query; v125: audio — «المصحف الجديد» (Minshawi) served per surah from mp3quran (GitHub release tracks often timed out) and listed after the murattal; new reciter محمد عبادة; reciter photos as album art (images/reciters/, also on the lock screen and the island, default art as fallback); 217 tracks that silently played another reciter (mp3quran redirects missing files to Minshawi) and 10 cut-off files hidden via `missing`; v124: ثبات — ورد القرآن journeys (daily pages, opens the mushaf at the page, khatma progress, 4-week calendar, make-up for a missed day), sprouts as growth (7 stages, milestone track with the plant of each milestone), «تجاوزت هذه اللحظة» after the ten minutes, new high-quality covers (images/thabat/covers: 1200px banners + 256px thumbnails, new artwork first); surah names shown in the UI font without the Uthmani sukun «ۡ» or the wasla (Tajawal has no glyph for either: they showed as boxes) in ثبات and the mushaf recitation messages; v123: ثبات — long journey names no longer widen the page (the whole page slid sideways on phones), counters in Western digits (Tajawal draws «٠» as a diamond), banner text readable in every theme, new journeys count hours/minutes, hours shown when a milestone is under two days away, library shows 4 then «عرض الكل»; v122: «ثبات» — private journeys of repentance and steadfastness (pages/thabat.html, js/thabat.js, js/thabat-content.js, images/thabat/), card on the home page; v121: azkar — «فضل الذكر» under each dhikr instead of takhreej/grading, taller card + smaller ring, A-/A+ zoom buttons, counts kept for the day with per-dhikr reset and "reset all", prev/next disabled at the ends; v120: azkar grading label shows the strongest ruling (حسن/صحيح), weak fadail ones «يؤخذ بالضعيف في الفضائل»; continuous player survives a host reload (refresh re-shows the framed page, back walks the visited pages instead of sticking on the player); book pages (Nawawi, Qudsi, Hisn, Duaa) menus, player and labels follow the app language (hb_* keys); v119: hadith encyclopedia — 75 corrupted characters repaired in the six books, empty entries hidden, Prophet's words / chain styled, Nawawi & Qudsi open their own pages; v118: بستان الدعاء rebuilt from «الدعاء من الكتاب والسنة» on the book design (assets/duaa-book.json, author's takhreej); honorific ligatures spelled out in hisn/azkar notes; v117: azkar — source, takhreej and grading for every dhikr (azkar.json, salah.json, sleeping-zikr.json) shown under the text; v116: حصن المسلم on the new book design (pages/hisn.html + assets/hisn-matn.json: author's takhreej for all 267, repeat counters, official per-chapter/per-dhikr audio); v115: الأربعون القدسية page (pages/qudsi.html, reviewed text + grading); Nawawi page split into shared css/hadith-book.css + js/hadith-book.js; v114: Nawawi filter chips and share-card audio toggle use SVG icons (no emoji-range characters); v113: Nawawi audio player — compact card, collapsible to a pill; v112: share-card videos can carry a recitation track (Nawawi hadith audio), text timed to it; v111: hadith encyclopedia — corrected An-Nawawi Forty text and takhreej (assets/hadith/nawawi40.json); v110: Nawawi page — corrected takhreej + wording (assets/hadith/nawawi40-matn.json), Prophet's words highlighted, per-hadith recitation player (repeat, auto-next, speed); v109: dedicated An-Nawawi Forty page (pages/nawawi.html: memorization mode, favourites, image/text sharing), prayer cards drop the "next" badge, share card back press no longer closes the modal underneath; v108: home prayer cards (five prayers, upcoming highlighted), sepia secondary text readable; v107: form controls inherit the app font (css/fonts.css), azkar page zoom off again; v106: notifications — 30-day push schedule (Play/TWA has no periodic sync), Play-app guidance when notifications are blocked; v105: audit fixes — Asr (Hanafi/standard) setting, pinch-zoom re-enabled on all pages, quran-text search escaping + API text rendered as text; v104: weekly dhikr stats card (js/dhikr-stats.js: dated history of masbaha/azkar/Quran counters, shared via ShareCard); v103: hadith image cards + silent video export for all share cards (hadith, hisn, duaa, azkar); v102: duaa/dhikr image cards (js/share-card.js) on hisn, duaa and azkar; v101: qibla corrects magnetic→true north (js/wmm.js, WMM2025) and reads the top edge, not the camera, in the 2D compass; v100: all pages load Tajawal + Amiri from bundled fonts via css/fonts.css (no Google Fonts); v99: azkar.html loads Amiri from the bundled fonts/Amiri.ttf (was Google-Fonts-only, fell back to a system font); v98: video maker self-heals a stale cached script (multi-picture switch did nothing with old video-maker.js); v97: video maker multi-picture slideshow (pan/zoom per picture, crossfades on ayah changes); v96: new dark-theme background (images/Background-dark.webp, now used by index.html too); v95: audio island drag-to-dismiss (drop on the bottom ✕ to stop and hide the floating player); v94: video maker "✦ Popular" quick-pick sheet (js/popular-ayat.js); v93: video maker exports a regular fast-start MP4 (MediaRecorder fragmented MP4 showed ~3 s in galleries/WhatsApp); v92: video maker redesign (numbered step cards, searchable surah/reciter sheets, steppers, switches, full-screen preview, Scheherazade canvas font, share caption); v91: ayah video maker (pages/video-maker.html — canvas + MediaRecorder status clips); v90: offline download runs in the page via CacheStorage (fixes wrapped PWA/TWA where the SW message path failed), keeps sw.js as single source for assets + cache name; v89: radio station selector card restored below the player (no pill), page padding trimmed so it still fits without scrolling; v88: radio player fits one screen (art scales with height, stations pill), tap art to pause motion, station title no longer overwritten by late i18n; v87: Sharjah radio via audio-only AAC (itworkscdn) with HLS fallbacks, per-station stream candidates, itworkscdn streams bypass the SW; v86: radio.html UX overhaul (categories, auto-reconnect with host fallback, prev/next, sleep timer, continuous host) + 10 wrong station streams fixed; live radio streams bypass the SW; v85: continuous audio — pages open in a frame over audio.html with a floating island player (js/continuous-player.js), setting in audio.html + index.html; v84: audio.html UX (no silent skip on load/offline, inline error + retry, buffering ring, rich searchable lists, lock-screen seek) + 40 dead audio links fixed/removed in audio-01.json; v83: hadith-viewer RTL swipe (finger → right = next chapter, like duaa/hisn), hadith search ignores invisible RLM marks, viewer shows full result count + "show more", hadith.html scrolls results into view; v82: qibla tilt-compensated heading (back-camera bearing when upright), ignore relative-only orientation, calibration "done" no longer exits the page (BackClose.swap); v81: takrar unit labels strip the basmala + quote the opening, readable selected rows; v80: takrar settings sheet, first-open preferences, ayah-opening unit labels, language button; v79: takrar redesign (player dock, 46 reciters, infinite range loop) + new i18n keys; v78: let GitHub release audio bypass the SW (range requests via SW broke seeking); v77: Minshawi new murattal tracks moved to GitHub release + clean track names; v76: harden offline modal — reply timeouts + graceful recovery when an old SW still controls after update; v75: drop ?v= cache-buster from audio pages, strip dead CSS; v74: unified offline-download.js controller; v73: precache quran-v2 + audio/radio JSONs, hadith books on-demand, ZAD_CACHE_ALL handler
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
  "./icons/duaa.png",
  "./icons/duaa.svg",
  "./icons/settings.svg",
  "./icons/masbaha.png",
  "./icons/masbaha.svg",
  "./icons/radio.png",
  "./icons/radio.svg",
  "./icons/qibla.svg",

  // ===== Background images =====
  "./images/Background-dark.webp",
  "./images/Background-light.webp",
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
        keys.filter(key => key !== CACHE_NAME && key !== AUDIO_CACHE && key !== PUSH_CTX_CACHE && !key.startsWith("quran-offline") && !key.startsWith("quran-pages") && !key.startsWith("quran-mushaf") && !key.startsWith("tarteel-model"))
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
