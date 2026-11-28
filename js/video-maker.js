// Quran ayah video maker — draws ayat over a background on a <canvas>, times
// each ayah to its per-ayah everyayah.com recitation, and records canvas +
// audio with MediaRecorder into a clip for status / stories / reels.
// The "long video" tab (16:9, TV-style templates, whole surahs, fast export) lives
// in js/video-maker-long.js and reuses this file's data, pickers and text drawing.
(function () {
  'use strict';

  const FORMATS = { story: [1080, 1920], square: [1080, 1080], wide: [1920, 1080] };
  const MAX_AYAT = 20;
  const FPS = 30;
  const FADE = 0.5;   // crossfade length at each ayah boundary (s)
  const LEAD = 0.5;   // background-only lead-in before the first ayah (s)
  const TAIL = 1.0;   // hold after the last ayah ends (s)
  const AUDIO_BASE = 'https://everyayah.com/data/';
  const BG_DIR = '../images/video-maker/';
  const BRAND = 'Zad Al-Muslim App';
  const appIcon = new Image();
  appIcon.src = '../icons/icon-192.png';
  const STORE_KEY = 'vm_settings';
  const PAGE_URL = 'https://solimananas.github.io/Tasbee7/pages/video-maker.html';
  const PLAY_URL = 'https://play.google.com/store/apps/details?id=io.github.solimananas.twa';
  const ZOOM = 0.12;      // how far zoom in/out travels over the clip
  const PAN_ZOOM = 1.1;   // pans run slightly zoomed so there is always room to move
  const PAN_MAX = 0.18;   // cap pan travel to this share of the frame size
  // Camera moves for the random-motion toggle: [start, end] for zoom and for
  // pan x/y (in [-1, 1] = share of the available pan room).
  const MOVES = [
    { z: [1, 1 + ZOOM], x: [0, 0], y: [0, 0] },                   // zoom in
    { z: [1 + ZOOM, 1], x: [0, 0], y: [0, 0] },                   // zoom out
    { z: [PAN_ZOOM, PAN_ZOOM], x: [1, -1], y: [0, 0] },           // pan left
    { z: [PAN_ZOOM, PAN_ZOOM], x: [-1, 1], y: [0, 0] },           // pan right
    { z: [1, 1 + ZOOM], x: [0.7, -0.7], y: [0, 0] },              // zoom in, drift left
    { z: [1, 1 + ZOOM], x: [-0.7, 0.7], y: [0, 0] },              // zoom in, drift right
    { z: [1 + ZOOM, 1.03], x: [0, 0], y: [0.7, -0.7] },           // zoom out, drift up
    { z: [PAN_ZOOM, PAN_ZOOM], x: [0, 0], y: [-1, 1] },           // tilt down
  ];
  const STILL = { z: [1, 1], x: [0, 0], y: [0, 0] };
  const MAX_SLIDES = 10;  // pictures in one slideshow
  const XFADE = 0.9;      // crossfade between slideshow pictures (s)
  // Warsh audio doesn't match the Hafs text we render, and muallim repeats
  // every ayah — both would drift from the on-screen text.
  const STYLES = ['murattal', 'mujawwad'];

  const GRADIENTS = [
    { stops: ['#04291f', '#0b4d3a', '#06231b'], glow: 'rgba(230,192,104,0.28)' },
    { stops: ['#050b1f', '#14254f', '#070d24'], glow: 'rgba(120,160,255,0.25)' },
    { stops: ['#1d0b2e', '#4a1d5c', '#120618'], glow: 'rgba(255,160,120,0.22)' },
    { stops: ['#000000', '#141414', '#000000'], glow: 'rgba(255,255,255,0.10)' },
    { stops: ['#032a2e', '#0d5c63', '#021b1e'], glow: 'rgba(160,255,230,0.20)' },
  ];

  const $ = id => document.getElementById(id);
  const canvas = $('vmCanvas');
  const ctx = canvas.getContext('2d');
  canvas.setAttribute('dir', 'rtl');

  const state = {
    surah: 1, from: 1, to: 7,
    reciter: 'afasy',
    bg: 'g0',            // 'g<i>' = built-in gradient, 'i:<file>' = image
    format: 'story',
    motion: true,       // random zoom/pan of the background, re-rolled per clip
    pingPong: false,    // background videos run forward then backward (no cut at the loop point)
    multiBg: false,     // slideshow: several pictures change during the clip
    bgs: [],            // picked pictures in order ('i:<file>'), used when multiBg is on
    fontMul: 1,
    color: '#ffffff',
    caption: true,
    branding: true,     // app icon + name at the top
    textPanel: true,    // translucent rounded panel behind the ayah text
    textFx: 'strokeglow', // ayah text effect: strokeglow | glow | shadow | none
    halo: 'auto',       // colour of that glow / shadow / outline: 'auto' or '#rrggbb'
    basmala: true,
    recSource: 'reciter', // 'reciter' = a reciter from the list, 'own' = the user's own recording
    sheikh: '',         // name shown for the reciter ('' = the reciter's own name / «تلاوتي»)
    fx: null,           // audio effects for the own recording (js/audio-fx.js; set in loadSettings)
    mode: 'short',      // 'short' = shorts / reels (default), 'long' = 16:9 long video, 'khatira' = word by word
    kReciter: 7,        // «خاطرة»: a reciter with word timings (js/khatira.js RECITERS, quran.com id)
    kContent: 'text',   // «خاطرة»: 'text' = the user's own words (kTexts), 'quran' = ayat
    kTexts: [''],       // «خاطرة»: the user's texts, one field each, shown one after the other
    ktAudio: 'none',    // «خاطرة» own words: 'none' (each text for its length) or 'quran' (a recitation of surah / from / to under them, by kReciter)
    kOpts: [],          // «خاطرة»: per text (same index), from a video script: { a, b } its seconds, { font, size } its face and size; null = none
    stickers: [],       // character stickers on the video (js/video-stickers.js): [{ id, x, y, s, flip, from, to, fx }]
    textPos: null,      // where the text sits (its centre, shares of the frame), moved by holding and dragging on the preview; null = the middle
    kStyle: 'line',     // «خاطرة»: how the text shows: 'line' (the whole line, the word recited lit), 'build' (words appear in place as recited), 'word' (one word at a time)
    kFont: 'amiri',     // «خاطرة»: the face of the words (Khatira.FONTS id, or 'u:<id>' for a font from the device)
    tvTemplate: 'dawn', // long mode: template id (js/tv-templates.js)
    tvBg: 'g1',         // long mode: its own background ('g<i>' or 'i:<file>')
  };
  const isLong = () => state.mode === 'long' && !!long;
  // «خاطرة»: the Shorts video (same backgrounds, sizes and export) with the recitation shown
  // word by word, each word as it is recited, large, in a bold face.
  const isKhatira = () => state.mode === 'khatira' && !!window.Khatira;
  // «خاطرة» with the user's own words (text fields) rather than ayat.
  const isKText = () => isKhatira() && state.kContent === 'text';
  // ...over a recitation of ayat (not the user's own recording, which takes the place of any other sound)
  const isKQuran = () => isKText() && state.ktAudio === 'quran' && state.recSource !== 'own';
  const MAX_KTEXTS = 30, MAX_KTEXT = 400;
  const kTextWords = t => String(t || '').split(/\s+/).filter(Boolean);
  let long = null;        // long-mode engine (js/video-maker-long.js)
  let stickers = null;    // the character stickers (js/video-stickers.js)
  let previewT = 0;       // the second the preview last played to (a sticker's "now" button)
  // The user's own recording (js/video-maker-own.js); without it every check is false.
  let own = { active: () => false, has: () => false };
  let recorder = null;    // the in-app recorder (js/video-maker-rec.js)
  let fxUi = null;        // the effects panel (js/video-maker-fx.js)

  let surahs = [];        // [{ n, name, nameEn, ayat: [text...] }]
  let basmalaText = '';
  // Mushaf font + its QPC Hafs text; falls back to Scheherazade + data/quran.json.
  let QFONT = 'QuranFont';
  let reciters = [];
  let bgImages = [];      // filenames from the manifest
  let bgImg = null;       // loaded Image for the current 'i:' background
  let bgVideo = null;     // <video> for the current 'v:' background (muted, looping)
  // Forward-then-backward ("ping-pong") looping, so a short clip repeats without a cut:
  // the built-in clips ship as <name>.pp.mp4 (scripts/gen-pingpong.cjs); a clip the user added
  // gets one made on first use (js/video-pingpong.js) and cached.
  let loopJob = null;     // { id, cancelled, done, pending, p, report, promise }
  let bgPoster = null;    // full-size still of that video, drawn until it has a frame
  let move = MOVES[0];    // camera move for the current clip
  let slideMoves = MOVES.slice();   // one camera move per slideshow picture
  const imgCache = new Map();       // 'i:<file>' -> Image, for slideshow pictures
  let timeline = null;    // last built timeline (reused by preview + export)
  let playing = null;     // { sources, t0, raf, export }
  const layoutCache = new Map();

  // ---------- helpers ----------
  const lang = () => (window.I18n ? I18n.getLang() : 'ar');
  const arabicNames = () => ['ar', 'ckb', 'ur'].includes(lang());
  // Built-in copies of the strings this script sets itself. The SW serves
  // js/i18n/*.js cache-first, so right after an update the cached dictionary
  // can predate these keys — without this, buttons would show 'vm_stop' etc.
  const FALLBACK = {
    ar: {
      vm_title: 'صانع فيديو الآيات', vm_preview: 'معاينة', vm_stop: 'إيقاف', vm_done: 'الفيديو جاهز',
      vm_loading: 'جارٍ تحميل التلاوة...', vm_keep_open: 'جارٍ إنشاء الفيديو — أبقِ هذه الشاشة مفتوحة',
      vm_max_ayat: 'الحد الأقصى {n} آية في الفيديو', vm_err_audio: 'تعذّر تحميل التلاوة — تحقق من الاتصال',
      vm_err_unsupported: 'متصفحك لا يدعم إنشاء الفيديو — جرّب Chrome أو Safari الحديث',
      vm_webm_note: 'حُفظ بصيغة WebM — بعض التطبيقات قد تتطلب MP4',
      takrar_style_murattal: 'مرتل', takrar_style_mujawwad: 'مجوّد',
      vm_share_text: 'صُنع بتطبيق زاد المسلم', vm_share_page: 'اصنع فيديو مثله',
      takrar_no_results: 'لا نتائج', takrar_style_all: 'الكل', vm_max_bgs: 'الحد الأقصى {n} صور',
      vm_cat_famous: 'آيات مشهورة', vm_cat_surahs: 'سور قصيرة', vm_cat_duas: 'أدعية قرآنية', vm_cat_comfort: 'طمأنينة وتذكير',
      vm_bg_add: 'أضف صورة أو فيديو من جهازك', vm_bg_add_short: 'إضافة', vm_bg_delete: 'حذف', vm_bg_adding: 'جارٍ إضافة الخلفية...',
      vm_bg_bad: 'تعذّر فتح هذا الملف — اختر صورة أو فيديو', vm_bg_too_big: 'الفيديو كبير جداً — الحد {n} ميغابايت',
      vm_duration: 'مدة الفيديو', vm_duration_fail: 'تعذّر حساب المدة — تحقق من الاتصال',
      vm_bg_max: 'لديك {n} خلفيات خاصة — احذف واحدة أولاً', vm_bg_no_space: 'لا توجد مساحة كافية على الجهاز',
      vm_halo_color: 'لون التوهج والظل', vm_halo_auto: 'تلقائي',
      vm_src_reciter: 'قارئ من القائمة',
      vm_src_own: 'تسجيلي الخاص',
      vm_own_pick: 'ارفع تسجيلك الصوتي',
      vm_own_replace: 'استبدال التسجيل',
      vm_own_sync: 'ضبط توقيت الآيات',
      vm_own_private: 'تسجيلك يبقى على جهازك ولا يُرفع إلى أي مكان.',
      vm_sheikh_name: 'اسم القارئ المعروض',
      vm_my_recitation: 'تلاوتي',
      vm_own_unsynced: 'لم يُضبط توقيت الآيات لهذا المدى بعد',
      vm_own_unreviewed: '⚠ قُسّم التسجيل تلقائياً — راجع التوقيت قبل إنشاء الفيديو',
      vm_own_synced: '✓ توقيت الآيات مضبوط',
      vm_own_bad: 'تعذّر فتح هذا الملف — اختر ملفاً صوتياً (MP3 أو M4A أو WAV أو OGG)',
      vm_own_big: 'الملف كبير جداً — الحد {n} ميغابايت',
      vm_own_long: 'التسجيل طويل جداً — الحد {n} دقيقة',
      vm_own_decoding: 'جارٍ تحليل التسجيل…',
      vm_sync_title: 'ضبط توقيت الصوت',
      vm_sync_hint: 'Start at the first ayah and listen. When you hear the next ayah begin, tap «Next ayah starts here» — repeat to the end of the recording. Or tap «Next» to check each ayah in turn.',
      vm_sync_all: 'الكل',
      vm_sync_auto: 'تقسيم تلقائي',
      vm_sync_text: 'حسب طول النص',
      vm_sync_done: 'تم',
      vm_sync_end: 'نهاية التلاوة',
      vm_sync_play_here: 'استمع من هنا',
      vm_sync_time: 'الوقت بالثواني',
      vm_sync_set_here: 'ضع العلامة عند موضع التشغيل',
      vm_sync_ok: 'قُسّم التسجيل إلى {n} آية حسب فواصل الصمت — استمع وتأكد من الحدود',
      vm_sync_unsure: 'الفواصل متقاربة فلا يمكن الجزم — استمع وصحّح الحدود',
      vm_sync_by_text: 'لم تُوجد فواصل كافية، فقُسّم الوقت حسب طول كل آية — صحّح الحدود بالاستماع',
      vm_sync_manual: 'عُدّل التوقيت يدوياً',
      vm_loop_preparing: 'جارٍ تجهيز تكرار سلس للخلفية… {p}٪',
      vm_loop_wait: 'جارٍ تجهيز تكرار سلس للخلفية قبل الإنشاء… {p}٪ — يحدث مرة واحدة فقط',
      vm_sync_ayah: 'الآية {i} من {n}',
      vm_sync_prev: 'السابقة',
      vm_sync_next: 'التالية',
      vm_sync_from_start: 'استمع من البداية',
      vm_sync_next_here: 'الآية التالية تبدأ هنا',
      vm_sync_follow: 'زامن الآيات التالية تلقائياً',
      vm_sync_review: 'راجع التالي', vm_sync_undo: 'تراجع', vm_sync_redo: 'إعادة', vm_sync_speed: 'سرعة التشغيل', vm_sync_unsure_chip: 'غير مؤكد', vm_sync_listen_join: 'استمع للفاصل', vm_sync_confirm: 'الفاصل صحيح', vm_unsure_1: 'فاصل واحد غير مؤكد', vm_unsure_2: 'فاصلان غير مؤكدين', vm_unsure_few: '{n} فواصل غير مؤكدة', vm_unsure_many: '{n} فاصلاً غير مؤكد',
      vm_settings_video: 'الفيديو',
      vm_sections: 'أقسام الإعدادات', vm_sec_audio: 'الصوت', vm_sec_look: 'المظهر', vm_sec_text: 'النص',
      vm_close: 'إغلاق',
      vm_step_up: 'زيادة واحد',
      vm_step_down: 'إنقاص واحد',
      vm_bg_picture_n: 'صورة {n}',
      vm_bg_video_n: 'فيديو {n}',
      vm_bg_gradient_n: 'تدرّج لوني {n}',
      vm_bg_my_picture: 'صورتك',
      vm_bg_my_video: 'الفيديو الخاص بك',
      vm_sync_followed: 'ضُبطت الآيات {a}–{b} تلقائياً من هذه العلامة',
      vm_sync_followed_one: 'ضُبطت الآية {a} تلقائياً من هذه العلامة',
      vm_pingpong: 'تكرار الفيديو ذهاباً وإياباً',
      vm_pingpong_desc: 'يعمل الفيديو للأمام ثم للخلف فلا يظهر قطع عند إعادته',
      vm_sync_end_here: 'نهاية التلاوة هنا',
      vm_sync_this_start: 'بداية هذه الآية',
      vm_sync_all_ayat: 'كل الآيات',
      vm_rec_now: 'سجّل الآن',
      vm_rec_title: 'التسجيل',
      vm_rec_start: 'ابدأ التسجيل',
      vm_rec_finish: 'إنهاء',
      vm_rec_next: 'التالي',
      vm_rec_back: 'رجوع',
      vm_rec_cancel: 'إلغاء التسجيل',
      vm_rec_count: 'الآية {i} من {n}',
      vm_rec_hint: 'اقرأ الآية الظاهرة، واضغط «التالي» أو المس النص عندما تبدأ الآية التالية.',
      vm_rec_mic_denied: 'لم يُسمح باستخدام الميكروفون — فعّله من إعدادات المتصفح',
      vm_rec_mic_none: 'لا يوجد ميكروفون متاح',
      vm_rec_unsupported: 'متصفحك لا يدعم التسجيل',
      vm_rec_discard: 'حذف هذا التسجيل؟',
      vm_rec_loud: 'الصوت مرتفع جداً — ابتعد قليلاً عن الميكروفون',
      vm_rec_basmala: 'البسملة',
      vm_sync_live: 'حُدّدت الحدود من ضغطاتك أثناء القراءة — استمع وتأكد',
      vm_fx_title: 'مؤثرات صوتية احترافية',
      vm_fx_master: 'تشغيل المؤثرات',
      vm_fx_polish: 'تحسين الصوت',
      vm_fx_gate: 'إزالة الضوضاء',
      vm_fx_warmth: 'الدفء',
      vm_fx_clarity: 'الوضوح',
      vm_fx_comp: 'توازن الصوت',
      vm_fx_norm: 'رفع الصوت إلى مستوى ثابت',
      vm_fx_reverb: 'صدى المكان',
      vm_fx_room_none: 'بدون',
      vm_fx_room_room: 'غرفة',
      vm_fx_room_mosque: 'مسجد',
      vm_fx_room_hall: 'قاعة',
      vm_fx_room_haram: 'الحرم',
      vm_fx_amount: 'المقدار',
      vm_fx_decay: 'الطول',
      vm_fx_echo: 'الترديد',
      vm_fx_delay: 'التأخير',
      vm_fx_repeats: 'التكرار',
      vm_fx_listen: 'استمع إلى المؤثرات',
      vm_fx_stop: 'إيقاف',
      vm_fx_auto_polish: 'فُعّل تحسين الصوت تلقائياً لتسجيلك — غيّره من «مؤثرات صوتية»',
      vm_mode_short: 'قصير / ريلز', vm_mode_long: 'فيديو طويل', vm_template: 'القالب',
      vm_sec_content: "المحتوى", vm_kc_text: "نص من كتابتك", vm_kc_quran: "آيات من القرآن", vm_kt_add: "أضف نصاً", vm_kt_note: "كل نص يظهر كلمة كلمة. مع تسجيلك يُضبط كل نص على مقطعه من الصوت، وبدون صوت يظهر بقدر طوله.", vm_src_none: "بدون صوت", vm_kt_silent: "بدون صوت: يظهر كل نص بقدر طوله. لتضبطه على صوتك اختر «تسجيلي الخاص» وارفع ملفاً أو سجّل.", vm_kt_name: "الاسم المعروض", vm_kt_label: "النص {i}", vm_kt_ph: "اكتب خاطرتك هنا…", vm_kt_delete: "حذف النص {i}", vm_kt_empty: "خاطرتك", vm_kt_count_1: "نص واحد", vm_kt_count: "{n} نصوص", vm_kt_count_2: "نصّان", vm_kt_count_many: "{n} نصاً", vm_kt_n: "النص {i} من {n}", vm_kt_name_ph: 'اسمك، إن أردت أن يظهر في الفيديو',
      vm_st_title: "ملصقات", vm_st_hint: "اضغط ملصقاً ليُضاف إلى الفيديو، ثم حرّكه على المعاينة أو بالمنزلقات.", vm_st_add_one: "أضف: {name}", vm_st_added: "المضافة", vm_st_empty: "لم تُضف ملصقات بعد", vm_st_size: "الحجم", vm_st_x: "أفقياً", vm_st_y: "رأسياً", vm_st_flip: "قلب", vm_st_front: "للأمام", vm_st_delete: "حذف", vm_st_done: "تم", vm_st_max: "الحد الأقصى {n} ملصقاً", vm_src_quran: "آيات", vm_kq_note: "تُتلى الآيات التي تختارها تحت نصوصك، وتتوزع النصوص على مدة التلاوة ما لم يحدد السيناريو توقيتها.", vm_sc_w_quran: "آيات غير صحيحة في ‎@quran‎: {v}", vm_st_slot: "ملصق {n}", vm_st_slot_pick: "اختر صورة «ملصق {n}» من القائمة", vm_st_slot_left: "بقي {n} بلا صورة: اضغط رقماً ثم اختر صورته", vm_st_slot_done: "اختيرت كل الصور. اضغط رقماً لتغيير صورته.", vm_st_slots: "ملصقات السيناريو", vm_st_with_time: "وقت محدد", vm_st_with_line: "مع النص {n}", vm_st_pack: "تحميل حزمة الملصقات", vm_st_pack_busy: "تجهيز الحزمة… {n} / {of}", vm_st_pack_done: "حُمّلت الحزمة ({n} ملصقاً)", vm_st_pack_err: "تعذر تجهيز الحزمة، تحقق من الاتصال", vm_sc_title: "سيناريو الفيديو", vm_sc_hint: "الفيديو كاملاً في ملف نصي: السطور وتوقيتها وخطوطها وأحجامها وملصقاتها. نزّل القالب وأعطه لمساعد ذكاء اصطناعي مع موضوعك، ثم ارفع ما يكتبه.", vm_sc_upload: "رفع سيناريو", vm_sc_paste: "لصق سيناريو", vm_sc_template: "تحميل القالب", vm_sc_copy: "نسخ القالب للذكاء الاصطناعي", vm_sc_export: "تنزيل سيناريو الفيديو الحالي", vm_sc_paste_ph: "[0:00 - 0:04] نص السطر الأول <sticker 1>", vm_sc_apply: "استيراد", vm_sc_cancel: "إلغاء", vm_sc_empty: "لا نص في السيناريو", vm_sc_replace: "سيحل السيناريو محل نصوصك الحالية. متابعة؟", vm_sc_done: "استُورد {lines} سطراً و{stickers} ملصقاً.", vm_sc_pick: "اختر صورة لكل ملصق من بطاقة الملصقات.", vm_sc_big: "الملف أكبر من أن يكون سيناريو", vm_sc_bad: "تعذرت قراءة الملف", vm_sc_template_done: "حُمّل القالب. أعطه لمساعد ذكاء اصطناعي مع موضوع الفيديو.", vm_sc_copied: "نُسخ القالب. الصقه في مساعد الذكاء الاصطناعي واكتب موضوعك.", vm_sc_copy_err: "تعذر النسخ، استخدم «تحميل القالب»", vm_sc_nothing: "لا نصوص بعد لتنزيلها", vm_sc_opts_clear: "إزالة توقيت النص {i} وخطه وحجمه", vm_sc_w_font: "خط غير معروف: {v}", vm_sc_w_size: "حجم خارج المدى ٠٫٧ – ١٫٤، عُدّل: {v}", vm_sc_w_time: "السطر {n}: النهاية قبل البداية، فتُركت بلا نهاية", vm_sc_w_tag: "وسم ملصق غير مفهوم: {v}", vm_sc_w_lines: "تُرك {n} سطراً بعد الحد (٣٠)", vm_sc_w_stickers: "تُرك {n} ملصقاً بعد الحد (٣٠)", vm_sc_w_long: "السطر {n} طويل فقُصّ", vm_sc_w_other: "إعداد غير مفهوم: {v}", vm_mini_back: "العودة إلى المعاينة", vm_mini_close: "إخفاء المعاينة المصغرة", vm_st_when: "الظهور", vm_st_from: "من", vm_st_to: "إلى", vm_st_end: "النهاية", vm_st_now: "الآن", vm_st_now_aria: "وقت المعاينة الحالي", vm_st_fx: "التأثير", vm_st_fx_pop: "قفزة", vm_st_fx_fade: "تلاشٍ", vm_st_fx_slide: "انزلاق", vm_st_fx_zoom: "تكبير", vm_st_fx_float: "طفو", vm_st_fx_none: "بدون", vm_tpos: "موضع النص", vm_tpos_hint: "اضغط مطولاً على المعاينة ثم اسحب لتحريك النص.", vm_tpos_reset: "إلى الوسط", vm_tpos_moving: "اسحب لتحريك النص",
      vm_ks_label: 'طريقة ظهور النص', vm_ks_line: 'السطر كاملاً', vm_ks_build: 'تظهر الكلمات مع التلاوة', vm_ks_word: 'كلمة كلمة',
      vm_mode_khatira: 'خاطرة', vm_kh_font: 'خط الكلمات', vm_kf_amiri: 'أميري', vm_kf_scheherazade: 'شهرزاد', vm_kf_naskh: 'نسخ', vm_kf_hafs: 'خط المصحف',
      vm_kf_ruqaa: 'رقعة', vm_kf_changa: 'تشانغا', vm_kf_cairo: 'كايرو', vm_kf_jomhuria: 'جمهورية', vm_kf_gulzar: 'گلزار',
      vm_kf_add: 'خط من جهازك', vm_kf_delete: 'حذف الخط', vm_kf_bad: 'تعذّر فتح ملف الخط — اختر ملف TTF أو OTF أو WOFF', vm_kf_private: 'الخطوط التي تضيفها تبقى على جهازك ولا تُرفع إلى أي مكان.',
      vm_kh_reciters: 'قرّاء معهم توقيت لكل كلمة، فتظهر الكلمة حين تُتلى.', vm_kh_own_note: 'في تسجيلك تُوزَّع الكلمات على زمن كل آية بحسب طولها، فتوقيتها تقريبي.',
      vm_long_hint: 'كلما زادت الآيات طال وقت الإنشاء وكبر حجم الملف',
      vm_long_progress: 'جارٍ الإنشاء {p}% — الآية {i} من {n}',
      vm_long_slow: 'متصفحك لا يدعم الإنشاء السريع — سيستغرق الإنشاء مدة الفيديو نفسها، أبقِ الشاشة مفتوحة',
      vm_err_encode: 'تعذّر إنشاء الفيديو — حاول مرة أخرى',
    },
    en: {
      vm_title: 'Ayah Video Maker', vm_preview: 'Preview', vm_stop: 'Stop', vm_done: 'Video ready',
      vm_loading: 'Loading recitation...', vm_keep_open: 'Creating video — keep this screen open',
      vm_max_ayat: 'Maximum {n} ayat per video', vm_err_audio: "Couldn't load the recitation — check your connection",
      vm_err_unsupported: "Your browser can't record video — try a recent Chrome or Safari",
      vm_webm_note: 'Saved as WebM — some apps may require MP4',
      takrar_style_murattal: 'Murattal', takrar_style_mujawwad: 'Mujawwad',
      vm_share_text: 'Made with Zad Al-Muslim App', vm_share_page: 'Make your own',
      takrar_no_results: 'No results', takrar_style_all: 'All', vm_max_bgs: 'Up to {n} pictures',
      vm_cat_famous: 'Famous ayat', vm_cat_surahs: 'Short surahs', vm_cat_duas: 'Quranic duas', vm_cat_comfort: 'Comfort & reminders',
      vm_bg_add: 'Add a picture or video from your device', vm_bg_add_short: 'Add', vm_bg_delete: 'Delete', vm_bg_adding: 'Adding the background…',
      vm_bg_bad: "Couldn't open this file — choose a picture or a video", vm_bg_too_big: 'The video is too large — up to {n} MB',
      vm_duration: 'Video length', vm_duration_fail: "Couldn't work out the length — check your connection",
      vm_bg_max: 'You have {n} backgrounds of your own — delete one first', vm_bg_no_space: 'Not enough storage on this device',
      vm_halo_color: 'Glow & shadow color', vm_halo_auto: 'Automatic',
      vm_src_reciter: 'A reciter from the list',
      vm_src_own: 'My own recording',
      vm_own_pick: 'Upload your audio recording',
      vm_own_replace: 'Replace the recording',
      vm_own_sync: 'Set the ayah timing',
      vm_own_private: 'Your recording stays on your device and is never uploaded.',
      vm_sheikh_name: 'Reciter name shown',
      vm_my_recitation: 'My recitation',
      vm_own_unsynced: 'The ayah timing isn\'t set for this range yet',
      vm_own_unreviewed: '⚠ The recording was split automatically — check the timing before making the video',
      vm_own_synced: '✓ Ayah timing is set',
      vm_own_bad: 'Couldn\'t open this file — choose an audio file (MP3, M4A, WAV or OGG)',
      vm_own_big: 'The file is too large — up to {n} MB',
      vm_own_long: 'The recording is too long — up to {n} minutes',
      vm_own_decoding: 'Analysing the recording…',
      vm_sync_title: 'Set the audio timing',
      vm_st_title: "Stickers", vm_st_hint: "Tap a sticker to add it to the video, then move it on the preview or with the sliders.", vm_st_add_one: "Add: {name}", vm_st_added: "Added", vm_st_empty: "No stickers yet", vm_st_size: "Size", vm_st_x: "Across", vm_st_y: "Up and down", vm_st_flip: "Flip", vm_st_front: "To the front", vm_st_delete: "Delete", vm_st_done: "Done", vm_st_max: "At most {n} stickers", vm_src_quran: "Ayat", vm_kq_note: "The ayat you choose are recited under your texts; the texts spread over the recitation unless the script times them.", vm_sc_w_quran: "Ayat not understood in @quran: {v}", vm_st_slot: "Sticker {n}", vm_st_slot_pick: "Choose the picture for “Sticker {n}” from the list", vm_st_slot_left: "{n} still without a picture: tap a number, then its picture", vm_st_slot_done: "All pictures chosen. Tap a number to change its picture.", vm_st_slots: "Script stickers", vm_st_with_time: "Set times", vm_st_with_line: "With text {n}", vm_st_pack: "Download the sticker pack", vm_st_pack_busy: "Preparing the pack… {n} / {of}", vm_st_pack_done: "Pack downloaded ({n} stickers)", vm_st_pack_err: "Couldn't prepare the pack. Check your connection", vm_sc_title: "Video script", vm_sc_hint: "The whole video in one text file: its lines, their timing, fonts, sizes and stickers. Download the template, give it to an AI assistant with your topic, then upload what it writes.", vm_sc_upload: "Upload a script", vm_sc_paste: "Paste a script", vm_sc_template: "Download the template", vm_sc_copy: "Copy the template for an AI", vm_sc_export: "Download this video's script", vm_sc_paste_ph: "[0:00 - 0:04] The first line <sticker 1>", vm_sc_apply: "Import", vm_sc_cancel: "Cancel", vm_sc_empty: "There's no text in the script", vm_sc_replace: "The script will replace your current texts. Continue?", vm_sc_done: "Imported {lines} lines and {stickers} stickers.", vm_sc_pick: "Choose a picture for each sticker in the stickers card.", vm_sc_big: "The file is too large to be a script", vm_sc_bad: "Couldn't read the file", vm_sc_template_done: "Template downloaded. Give it to an AI assistant with the video's topic.", vm_sc_copied: "Template copied. Paste it into an AI assistant and add your topic.", vm_sc_copy_err: "Couldn't copy. Use “Download the template”", vm_sc_nothing: "No texts to download yet", vm_sc_opts_clear: "Remove the time, font and size of text {i}", vm_sc_w_font: "Unknown font: {v}", vm_sc_w_size: "Size out of the 0.7 – 1.4 range, adjusted: {v}", vm_sc_w_time: "Line {n}: the end is before the start, so it has no end", vm_sc_w_tag: "Sticker tag not understood: {v}", vm_sc_w_lines: "{n} lines past the limit (30) left out", vm_sc_w_stickers: "{n} stickers past the limit (30) left out", vm_sc_w_long: "Line {n} was too long and was cut", vm_sc_w_other: "Setting not understood: {v}", vm_mini_back: "Back to the preview", vm_mini_close: "Hide the mini preview", vm_st_when: "Shows", vm_st_from: "From", vm_st_to: "To", vm_st_end: "the end", vm_st_now: "Now", vm_st_now_aria: "The preview's current time", vm_st_fx: "Effect", vm_st_fx_pop: "Pop", vm_st_fx_fade: "Fade", vm_st_fx_slide: "Slide up", vm_st_fx_zoom: "Zoom", vm_st_fx_float: "Float", vm_st_fx_none: "None", vm_tpos: "Text position", vm_tpos_hint: "Hold on the preview, then drag to move the text.", vm_tpos_reset: "Back to the centre", vm_tpos_moving: "Drag to move the text",
      vm_ks_label: 'How the text shows', vm_ks_line: 'The whole line', vm_ks_build: 'Words appear as recited', vm_ks_word: 'One word at a time',
      vm_sync_hint: 'Listen and move the markers so each ayah starts at its marker. Tap ▶ next to an ayah to hear it, or ⌖ to put the marker at the playhead.',
      vm_sync_all: 'All',
      vm_sync_auto: 'Split automatically',
      vm_sync_text: 'By text length',
      vm_sync_done: 'Done',
      vm_sync_end: 'End of the recitation',
      vm_sync_play_here: 'Listen from here',
      vm_sync_time: 'Time in seconds',
      vm_sync_set_here: 'Put the marker at the playhead',
      vm_sync_ok: 'The recording was split into {n} ayat at the pauses — listen and check the boundaries',
      vm_sync_unsure: 'The pauses are too alike to be sure — listen and correct the boundaries',
      vm_sync_by_text: 'Not enough pauses were found, so the time was shared by the length of each ayah — correct the boundaries by listening',
      vm_sync_manual: 'Timing edited by hand',
      vm_loop_preparing: 'Preparing a seamless loop for the background… {p}%',
      vm_loop_wait: 'Preparing a seamless loop for the background before creating… {p}% — only the first time',
      vm_sync_ayah: 'Ayah {i} of {n}',
      vm_sync_prev: 'Previous',
      vm_sync_next: 'Next',
      vm_sync_from_start: 'Listen from the start',
      vm_sync_next_here: 'Next ayah starts here',
      vm_sync_follow: 'Sync the following ayat automatically',
      vm_sync_review: 'Check the next', vm_sync_undo: 'Undo', vm_sync_redo: 'Redo', vm_sync_speed: 'Playback speed', vm_sync_unsure_chip: 'Unsure', vm_sync_listen_join: 'Listen across it', vm_sync_confirm: 'It is right', vm_unsure_1: '1 boundary to check', vm_unsure_2: '2 boundaries to check', vm_unsure_few: '{n} boundaries to check', vm_unsure_many: '{n} boundaries to check',
      vm_settings_video: 'Video',
      vm_sections: 'Settings sections', vm_sec_audio: 'Audio', vm_sec_look: 'Look', vm_sec_text: 'Text',
      vm_close: 'Close',
      vm_step_up: 'One more',
      vm_step_down: 'One less',
      vm_bg_picture_n: 'Picture {n}',
      vm_bg_video_n: 'Video {n}',
      vm_bg_gradient_n: 'Gradient {n}',
      vm_bg_my_picture: 'Your picture',
      vm_bg_my_video: 'Your video',
      vm_sync_followed: 'Ayat {a}–{b} were synced from this marker',
      vm_sync_followed_one: 'Ayah {a} was synced from this marker',
      vm_pingpong: 'Loop video forward and back',
      vm_pingpong_desc: 'The video plays forward then backward, so there is no cut when it repeats',
      vm_sync_end_here: 'Recitation ends here',
      vm_sync_this_start: 'Start of this ayah',
      vm_sync_all_ayat: 'All ayat',
      vm_rec_now: 'Record now',
      vm_rec_title: 'Recording',
      vm_rec_start: 'Start recording',
      vm_rec_finish: 'Finish',
      vm_rec_next: 'Next',
      vm_rec_back: 'Back',
      vm_rec_cancel: 'Discard the recording',
      vm_rec_count: 'Ayah {i} of {n}',
      vm_rec_hint: 'Read the ayah shown, and tap «Next» or the text as you start the next ayah.',
      vm_rec_mic_denied: 'The microphone isn\'t allowed — turn it on in the browser settings',
      vm_rec_mic_none: 'No microphone is available',
      vm_rec_unsupported: 'Your browser can\'t record audio',
      vm_rec_discard: 'Delete this recording?',
      vm_rec_loud: 'Too loud — move a little away from the microphone',
      vm_rec_basmala: 'Basmala',
      vm_sync_live: 'The boundaries come from your taps while reading — listen and check',
      vm_fx_title: 'Pro audio effects',
      vm_fx_master: 'Effects on',
      vm_fx_polish: 'Voice polish',
      vm_fx_gate: 'Noise reduction',
      vm_fx_warmth: 'Warmth',
      vm_fx_clarity: 'Clarity',
      vm_fx_comp: 'Evenness (compression)',
      vm_fx_norm: 'Even out the loudness',
      vm_fx_reverb: 'Room reverb',
      vm_fx_room_none: 'None',
      vm_fx_room_room: 'Room',
      vm_fx_room_mosque: 'Mosque',
      vm_fx_room_hall: 'Hall',
      vm_fx_room_haram: 'Haram',
      vm_fx_amount: 'Amount',
      vm_fx_decay: 'Length',
      vm_fx_echo: 'Echo',
      vm_fx_delay: 'Delay',
      vm_fx_repeats: 'Repeats',
      vm_fx_listen: 'Listen to the effects',
      vm_fx_stop: 'Stop',
      vm_fx_auto_polish: 'Voice polish was switched on for your recording — change it under «Pro audio effects»',
      vm_mode_short: 'Shorts / Reels', vm_mode_long: 'Long video', vm_template: 'Template',
      vm_sec_content: "Content", vm_kc_text: "Your own words", vm_kc_quran: "Ayat of the Quran", vm_kt_add: "Add a text", vm_kt_note: "Each text shows word by word. With your recording each is timed to its part of the audio; with no audio it shows for as long as it takes to read.", vm_src_none: "No audio", vm_kt_silent: "No audio: each text shows for as long as it takes to read. To time it to your voice, choose «My recording» and upload a file or record.", vm_kt_name: "Name shown", vm_kt_label: "Text {i}", vm_kt_ph: "Write your thought here…", vm_kt_delete: "Delete text {i}", vm_kt_empty: "Your words", vm_kt_count_1: "1 text", vm_kt_count: "{n} texts", vm_kt_count_2: "2 texts", vm_kt_count_many: "{n} texts", vm_kt_n: "Text {i} of {n}", vm_kt_name_ph: 'Your name, if you want it in the video',
      vm_mode_khatira: 'Thoughts', vm_kh_font: 'Typeface', vm_kf_amiri: 'Amiri', vm_kf_scheherazade: 'Scheherazade', vm_kf_naskh: 'Naskh', vm_kf_hafs: 'Mushaf',
      vm_kf_ruqaa: 'Ruqaa', vm_kf_changa: 'Changa', vm_kf_cairo: 'Cairo', vm_kf_jomhuria: 'Jomhuria', vm_kf_gulzar: 'Gulzar',
      vm_kf_add: 'A font from your device', vm_kf_delete: 'Delete the font', vm_kf_bad: "Couldn't open the font file — choose a TTF, OTF or WOFF file", vm_kf_private: 'The fonts you add stay on your device and are never uploaded.',
      vm_kh_reciters: 'Reciters with a timing for every word, so each word shows as it is recited.', vm_kh_own_note: 'In your recording the words share each ayah\'s time by their length, so their timing is approximate.',
      vm_long_hint: 'More ayat take longer to create and make a bigger file',
      vm_long_progress: 'Creating {p}% — ayah {i} of {n}',
      vm_long_slow: "Your browser can't use fast export — creating takes as long as the video itself; keep this screen open",
      vm_err_encode: "Couldn't create the video — please try again",
    },
  };
  function tr(k, p) {
    const out = window.t ? window.t(k, p) : k;
    if (out !== k) return out;
    let str = (arabicNames() ? FALLBACK.ar : FALLBACK.en)[k] || k;
    Object.keys(p || {}).forEach(n => { str = str.split('{' + n + '}').join(p[n]); });
    return str;
  }
  const pad3 = n => String(n).padStart(3, '0');
  const arDigits = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  const clamp01 = x => Math.max(0, Math.min(1, x));
  // Letters only (same as takrar.html) — strips harakat/Quranic marks and wasla.
  const bareLetters = w => w.replace(/[\u064B-\u0670\u06D6-\u06ED]/g, '').replace(/\u0671/g, 'ا');
  const isVideoFile = f => /\.(mp4|webm)$/i.test(f);
  // Each video ships a '<name>.thumb.webp' still for the picker (see scripts/gen-video-bgs.cjs).
  const thumbFor = f => f.replace(/\.(mp4|webm)$/i, '.thumb.webp');

  function setStatus(msg, isError) {
    const el = $('vmStatus');
    el.textContent = msg || '';
    el.classList.toggle('error', !!isError);
  }
  function setProgress(p) {
    $('vmProgress').hidden = p == null;
    if (p != null) $('vmProgressBar').style.width = Math.round(p * 100) + '%';
  }
  function setBadge(text, rec) {
    const b = $('vmBadge');
    b.hidden = !text;
    b.textContent = text || '';
    b.classList.toggle('rec', !!rec);
  }

  const TEXT_FX = ['strokeglow', 'glow', 'shadow', 'none'];

  function saveSettings() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
  }
  function loadSettings() {
    try { Object.assign(state, JSON.parse(localStorage.getItem(STORE_KEY)) || {}); } catch (e) { /* ignore */ }
    if (!FORMATS[state.format]) state.format = 'story';
    // Older versions stored a named move; anything but 'none' means motion on.
    if (typeof state.motion !== 'boolean') state.motion = state.motion !== 'none';
    if (!Array.isArray(state.bgs)) state.bgs = [];
    state.bgs = state.bgs.filter(id => typeof id === 'string' && id.startsWith('i:')).slice(0, MAX_SLIDES);
    state.multiBg = !!state.multiBg;
    state.pingPong = state.pingPong === true;
    if (!TEXT_FX.includes(state.textFx)) state.textFx = 'strokeglow';
    if (state.halo !== 'auto' && !/^#[0-9a-f]{6}$/i.test(String(state.halo))) state.halo = 'auto';
    if (state.mode !== 'long' && state.mode !== 'khatira') state.mode = 'short';
    if (!window.Khatira || !Khatira.RECITERS.some(r => r.id === state.kReciter)) state.kReciter = 7;
    if (state.kContent !== 'quran') state.kContent = 'text';
    if (!['line', 'build', 'word'].includes(state.kStyle)) state.kStyle = 'line';
    state.textPos = cleanTextPos(state.textPos);
    state.kTexts = (Array.isArray(state.kTexts) ? state.kTexts : []).filter(t => typeof t === 'string').slice(0, MAX_KTEXTS).map(t => t.slice(0, MAX_KTEXT));
    if (!state.kTexts.length) state.kTexts = [''];
    if (state.ktAudio !== 'quran') state.ktAudio = 'none';
    state.kOpts = state.kTexts.map((_, i) => cleanKOpt((Array.isArray(state.kOpts) ? state.kOpts : [])[i]));
    if (typeof state.kFont !== 'string' || !(state.kFont.startsWith('u:') || (window.Khatira && Khatira.FONTS.some(f => f.id === state.kFont)))) state.kFont = 'amiri';
    if (state.recSource !== 'own') state.recSource = 'reciter';
    state.sheikh = typeof state.sheikh === 'string' ? state.sheikh.slice(0, 60) : '';
    if (window.AudioFx) {
      const touched = !!(state.fx && state.fx.touched);
      state.fx = Object.assign(AudioFx.sanitize(state.fx || AudioFx.DEFAULTS), { touched });
    }
    if (!(window.TV_TEMPLATES || []).some(t => t.id === state.tvTemplate)) state.tvTemplate = 'dawn';
    if (typeof state.tvBg !== 'string' || !/^(g\d+|i:.+)$/.test(state.tvBg)) state.tvBg = 'g1';
  }

  function reciterObj() {
    if (isKhatira()) return kReciterObj();
    return reciters.find(r => r.id === state.reciter) || reciters[0];
  }
  function kReciterObj() {
    const r = Khatira.RECITERS.find(x => x.id === state.kReciter) || Khatira.RECITERS[0];
    return Object.assign({ kid: r.id, folder: 'qdc-' + r.id }, r);
  }
  function reciterName(r) { return arabicNames() ? r.name : r.en; }
  // The name shown on the video: what the user typed, else «تلاوتي» (own recording),
  // else the reciter's name.
  function displayName() { return own.displayName ? own.displayName() : reciterName(reciterObj()); }
  // Surah, first and last ayah, and whether the basmala is on: what a recording's
  // sync points belong to.
  function rangeKey() {
    // own texts: the sync belongs to how many there are (a typo fixed keeps it)
    if (isKText()) return 'kt|' + segments().length;
    return [state.surah, state.from, state.to, state.basmala && basmalaApplies()].join('|');
  }
  const kTextsSig = () => segments().map(s => s.text + (s.at != null || s.until != null || s.font || s.size ? '\u2028' + [s.at, s.until, s.font, s.size].join(',') : '')).join('\u2029');
  function surahObj() { return surahs[state.surah - 1]; }
  // Undecorated name ("البقرة") from js/surah-map.js — the same list takrar.html shows.
  function surahPlain(s) {
    return (typeof SURAH_MAP !== 'undefined' && SURAH_MAP[s.n - 1] && SURAH_MAP[s.n - 1].name) || s.name;
  }
  function surahLatin(s) { return window.I18n ? I18n.name('surahs', s.n, s.nameEn) : s.nameEn; }
  function basmalaApplies() {
    if (isKhatira()) return false;           // the word timings start at the first ayah
    return state.from === 1 && state.surah !== 1 && state.surah !== 9;
  }

  // ---------- data ----------
  async function loadQuran() {
    const res = await fetch('../data/quran.json');
    const rows = await res.json();
    surahs = [];
    for (const r of rows) {
      let s = surahs[r.surah - 1];
      if (!s) s = surahs[r.surah - 1] = { n: r.surah, name: r.surah_name, nameEn: r.surah_name_en, ayat: [] };
      s.ayat[r.ayah - 1] = String(r.text_uthmani || '').replace(/^﻿/, '').trim();
    }
    basmalaText = surahs[0].ayat[0];
    // quran.json prefixes ayah 1 of most surahs with the basmala, but the
    // everyayah ayah-1 audio doesn't include it — strip it so text matches audio.
    // Compared on bare letters like takrar.html's localAyah(): the diacritic
    // order differs between surahs (an exact match misses 95 and 97).
    for (const s of surahs) {
      if (s.n === 1 || !s.ayat[0]) continue;
      const w = s.ayat[0].split(/\s+/);
      if (w.slice(0, 4).map(bareLetters).join(' ') === 'بسم الله الرحمن الرحيم') s.ayat[0] = w.slice(4).join(' ');
    }
    // The mushaf font (fonts/uthmani-colored.ttf) is made for the King Fahd
    // Complex "QPC Hafs" encoding, so draw that text, exactly as the text mushaf
    // does. data/quran-qpc.json is built and verified letter for letter against
    // data/quran.json by scripts/build-quran-qpc.cjs; it is checked again here
    // (ayah counts and letters) and any mismatch keeps the quran.json text.
    try {
      const res = await fetch('../data/quran-qpc.json');
      const qpc = (await res.json()).surahs;
      const L = window.QuranTextSource && QuranTextSource.letters;
      if (!L || !Array.isArray(qpc) || qpc.length !== 114) throw new Error('qpc');
      surahs.forEach((s, i) => {
        if (!Array.isArray(qpc[i]) || qpc[i].length !== s.ayat.length) throw new Error('qpc');
        s.ayat.forEach((t, j) => { if (L(qpc[i][j]) !== L(t)) throw new Error('qpc ' + (i + 1) + ':' + (j + 1)); });
      });
      surahs.forEach((s, i) => { s.ayat = qpc[i].slice(); });
      basmalaText = qpc[0][0];
      QFONT = 'QuranFont';
    } catch (e) {
      QFONT = 'QuranFallback';
    }
  }

  async function loadBackgrounds() {
    try {
      const res = await fetch(BG_DIR + 'manifest.json', { cache: 'no-cache' });
      const list = await res.json();
      if (Array.isArray(list)) bgImages = list.filter(f => typeof f === 'string' && f && !f.endsWith('.thumb.webp'));
    } catch (e) { bgImages = []; }
  }

  // ---------- the user's own backgrounds ----------
  // Pictures and videos the user adds stay on this device: kept in IndexedDB,
  // shown through blob: URLs, never uploaded anywhere. They take names like
  // 'user:<id>.jpg' / 'user:<id>.mp4' so the rest of this file treats them
  // exactly like the built-in files ('i:' / 'v:' ids, isVideoFile, thumbFor).
  const USER_PREFIX = 'user:';
  const USER_DB = 'vm-user-backgrounds';
  const USER_MAX = 12;                       // own backgrounds kept at once
  const USER_VIDEO_MB = 80;                  // largest video accepted
  const USER_IMAGE_EDGE = 2160;              // pictures are scaled to this long edge (story is 1080×1920)
  const userUrls = new Map();                // name -> blob: URL (also '<name>.thumb.webp' for videos)
  let userBgs = [];                          // names, newest first
  const isUserBg = f => typeof f === 'string' && f.startsWith(USER_PREFIX);
  // Where a background file is read from: the app's folder, or the user's blob.
  const bgSrc = f => (isUserBg(f) ? (userUrls.get(f) || '') : BG_DIR + encodeURI(f));

  function userDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('no IndexedDB')); return; }
      const req = indexedDB.open(USER_DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('files', { keyPath: 'name' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function userTx(mode, fn) {
    return userDb().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction('files', mode);
      const out = fn(tx.objectStore('files'));
      tx.oncomplete = () => { db.close(); resolve(out && 'result' in out ? out.result : undefined); };
      tx.onerror = () => { db.close(); reject(tx.error); };
      tx.onabort = () => { db.close(); reject(tx.error || new Error('aborted')); };
    }));
  }
  function registerUserBg(rec) {
    userUrls.set(rec.name, URL.createObjectURL(rec.blob));
    if (rec.thumb) userUrls.set(thumbFor(rec.name), URL.createObjectURL(rec.thumb));
  }
  async function loadUserBackgrounds() {
    try {
      const all = (await userTx('readonly', store => store.getAll())) || [];
      all.sort((a, b) => (b.at || 0) - (a.at || 0));
      all.forEach(registerUserBg);
      userBgs = all.map(r => r.name);
    } catch { userBgs = []; }
    bgImages = userBgs.concat(bgImages.filter(f => !isUserBg(f)));
  }

  const canvasBlob = (cv, type, q) => new Promise(res => cv.toBlob(res, type, q));
  // A picture, upright (EXIF orientation applied) and no larger than needed.
  // Re-encoding also drops the file's metadata (location, camera).
  async function prepareImage(file) {
    let src;
    try { src = await window.createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch {
      src = await new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });
    }
    const w0 = src.width || src.naturalWidth, h0 = src.height || src.naturalHeight;
    if (!w0 || !h0) throw new Error('empty image');
    const k = Math.min(1, USER_IMAGE_EDGE / Math.max(w0, h0));
    const cv = document.createElement('canvas');
    cv.width = Math.round(w0 * k); cv.height = Math.round(h0 * k);
    cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
    if (src.close) src.close();
    const blob = await canvasBlob(cv, 'image/jpeg', 0.9);
    if (!blob) throw new Error('encode failed');
    return blob;
  }
  // A still from half a second in, for the thumbnail strip and the idle preview.
  function videoThumb(file) {
    return new Promise((resolve, reject) => {
      const v = document.createElement('video');
      const url = URL.createObjectURL(file);
      const done = (fn, arg) => { URL.revokeObjectURL(url); v.removeAttribute('src'); v.load(); fn(arg); };
      v.muted = true; v.playsInline = true; v.preload = 'auto';
      v.onloadeddata = () => { v.currentTime = Math.min(0.5, (v.duration || 1) / 2); };
      v.onseeked = async () => {
        try {
          const k = 640 / Math.max(v.videoWidth, v.videoHeight);
          const cv = document.createElement('canvas');
          cv.width = Math.round(v.videoWidth * k); cv.height = Math.round(v.videoHeight * k);
          cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
          const blob = await canvasBlob(cv, 'image/jpeg', 0.85);
          blob ? done(resolve, blob) : done(reject, new Error('thumb failed'));
        } catch (e) { done(reject, e); }
      };
      v.onerror = () => done(reject, new Error('unreadable video'));
      v.src = url;
    });
  }
  async function addUserFiles(files) {
    const list = Array.from(files || []);
    if (!list.length) return;
    let added = null;
    for (const file of list) {
      if (userBgs.length >= USER_MAX) { setStatus(tr('vm_bg_max', { n: USER_MAX }), true); break; }
      const isVideo = /^video\//.test(file.type);
      if (!isVideo && !/^image\//.test(file.type)) { setStatus(tr('vm_bg_bad'), true); continue; }
      if (isVideo && file.size > USER_VIDEO_MB * 1048576) { setStatus(tr('vm_bg_too_big', { n: USER_VIDEO_MB }), true); continue; }
      setStatus(tr('vm_bg_adding'));
      try {
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const rec = isVideo
          ? { name: USER_PREFIX + id + (/webm/.test(file.type) ? '.webm' : '.mp4'), blob: file, thumb: await videoThumb(file), at: Date.now() }
          : { name: USER_PREFIX + id + '.jpg', blob: await prepareImage(file), at: Date.now() };
        await userTx('readwrite', store => store.put(rec));
        registerUserBg(rec);
        userBgs.unshift(rec.name);
        bgImages = userBgs.concat(bgImages.filter(f => !isUserBg(f)));
        added = rec.name;
        setStatus('');
      } catch (e) {
        console.warn('[video-maker] could not add background', e);
        setStatus(tr(/quota/i.test(String(e && e.name)) ? 'vm_bg_no_space' : 'vm_bg_bad'), true);
      }
    }
    fillBackgrounds();
    if (added) {
      const id = (isVideoFile(added) ? 'v:' : 'i:') + added;
      if (state.multiBg) { if (id.startsWith('i:') && !state.bgs.includes(id)) toggleSlide(id); else markBackgrounds(); }
      else selectBackground(id);
      const tile = document.querySelector('#vmBgs .bg-thumb[data-bg="' + window.CSS.escape(id) + '"]');
      if (tile) tile.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }
  async function deleteUserBg(name) {
    try { await userTx('readwrite', store => store.delete(name)); } catch { /* already gone */ }
    [name, thumbFor(name)].forEach(k => { const u = userUrls.get(k); if (u) URL.revokeObjectURL(u); userUrls.delete(k); });
    userBgs = userBgs.filter(n => n !== name);
    bgImages = bgImages.filter(f => f !== name);
    const ids = ['i:' + name, 'v:' + name];
    ids.forEach(id => imgCache.delete(id));
    if (window.PingPong) PingPong.drop(name);
    const before = state.bgs.length;
    state.bgs = state.bgs.filter(id => !ids.includes(id));
    fillBackgrounds();
    if (ids.includes(state.tvBg)) { state.tvBg = 'g1'; if (long) long.setBackground('g1'); renderIdle(); }
    if (ids.includes(state.bg)) selectBackground('g0');
    else markBackgrounds();
    if (state.bgs.length !== before) onChange(); else saveSettings();
  }

  // ---------- audio ----------
  let actx = null;
  function audioCtx() {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    return actx;
  }
  const audioCache = new Map();
  function loadAyahAudio(surah, ayah, folder) {
    const key = folder + '/' + pad3(surah) + pad3(ayah);
    if (audioCache.has(key)) return audioCache.get(key);
    const p = fetch(AUDIO_BASE + key + '.mp3')
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then(buf => new Promise((res, rej) => audioCtx().decodeAudioData(buf, res, rej)));
    p.catch(() => audioCache.delete(key));
    audioCache.set(key, p);
    if (audioCache.size > 80) audioCache.delete(audioCache.keys().next().value);
    return p;
  }

  // A text's own settings from a script: its seconds, its face and size (any of them), or null.
  function cleanKOpt(o) {
    if (!o || typeof o !== 'object') return null;
    const out = {};
    const sec = v => (v != null && v !== '' && isFinite(+v) ? Math.min(3600, Math.max(0, +v)) : null);
    const a = sec(o.a), b = sec(o.b);
    if (a != null) out.a = a;
    if (b != null && (a == null || b > a)) out.b = b;
    if (typeof o.font === 'string' && /^[a-z]+$/.test(o.font) && window.Khatira && Khatira.FONTS.some(f => f.id === o.font)) out.font = o.font;
    if (isFinite(+o.size) && o.size !== null && o.size !== '') out.size = Math.min(1.4, Math.max(0.7, +o.size));
    return Object.keys(out).length ? out : null;
  }

  // Segments to show, in order (no audio yet).
  function segments() {
    if (isKText()) {
      // the user's texts that have something in them, each a segment of its own (ki: which text)
      const out = [];
      state.kTexts.forEach((t, ki) => {
        const text = t.trim();
        if (!text) return;
        const o = state.kOpts[ki] || {};
        out.push({ surah: 0, ayah: out.length + 1, text, num: out.length + 1, kt: true, ki, at: o.a != null ? o.a : null, until: o.b != null ? o.b : null, font: o.font || null, size: o.size || null });
      });
      return out;
    }
    const s = surahObj();
    const out = [];
    if (state.basmala && basmalaApplies()) out.push({ surah: 1, ayah: 1, text: basmalaText, num: null });
    for (let a = state.from; a <= state.to; a++) out.push({ surah: s.n, ayah: a, text: s.ayat[a - 1], num: a });
    return out;
  }

  function timelineKey() {
    if (isKText()) return ['kt', own.active() ? own.rec.id + '|' + own.sig(own.entryNow()) : isKQuran() ? ['q', state.kReciter, state.surah, state.from, state.to].join(':') : 'paced', kTextsSig()].join('|');
    if (own.active()) return [isKhatira() ? 'k-own' : 'own', own.rec.id, rangeKey(), own.sig(own.entryNow())].join('|');
    if (isKhatira()) return ['k', state.kReciter, state.surah, state.from, state.to].join('|');
    return [reciterObj().folder, state.surah, state.from, state.to, state.basmala && basmalaApplies()].join('|');
  }

  // The user's own recording: every ayah is a slice of the one decoded buffer.
  async function buildOwnTimeline() {
    const p = await own.prepare();
    const key = timelineKey();               // after prepare: it may have just been split
    if (timeline && timeline.key === key) return timeline;
    const segs = segments();
    let t = LEAD;
    const items = segs.map((sg, i) => {
      const s = own.slices(p.entry)[i];
      const it = Object.assign({}, sg, { buffer: p.audio.buffer, offset: s.off, dur: s.dur, start: t, end: t + s.dur });
      if (isKhatira()) {
        // no word timings in a recording: the ayah's time shared by the length of each word
        const ws = sg.kt ? kTextWords(sg.text) : Khatira.wordsOf(sg.text);
        const a = it.start + Math.min(0.15, s.dur * 0.1), b = Math.max(a + 0.1, it.end - Math.min(0.25, s.dur * 0.15));
        it.words = kShare(ws, a, b).map((x, k) => ({ text: ws[k], a: x.a, b: x.b, kt: !!sg.kt }));
      }
      t = it.end;
      return it;
    });
    timeline = { key, items, total: t + TAIL };
    return timeline;
  }

  // ---------- «خاطرة»: a reciter with word timings ----------
  // The timings (quran.com) come per surah, with the surah's recording as one MP3. Only the
  // seconds of the chosen ayat are fetched: a byte range of a constant-bitrate file, its first
  // frame telling the second it starts at (js/khatira.js). Variable-bitrate files come whole.
  const kMetaCache = new Map(), kHeadCache = new Map(), kClipCache = new Map();
  function kMeta(id, surah) {
    const key = id + ':' + surah;
    if (!kMetaCache.has(key)) {
      const p = fetch(Khatira.metaUrl(id, surah))
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(Khatira.parseMeta);
      p.catch(() => kMetaCache.delete(key));
      kMetaCache.set(key, p);
    }
    return kMetaCache.get(key);
  }
  // The bytes a..b of a file (both null = all of it), with progress for a whole file.
  async function kBytes(url, a, b, onProgress) {
    const r = await fetch(url, a == null ? {} : { headers: { Range: 'bytes=' + a + '-' + b } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const whole = r.status !== 206;
    const len = +r.headers.get('content-length') || 0;
    if (!onProgress || !len || !r.body || !r.body.getReader) return { buf: await r.arrayBuffer(), whole };
    const reader = r.body.getReader(), parts = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value); got += value.length;
      onProgress(Math.min(0.95, got / len));
    }
    const out = new Uint8Array(got);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return { buf: out.buffer, whole };
  }
  const kDecode = buf => new Promise((res, rej) => {
    const p = audioCtx().decodeAudioData(buf, res, rej);
    if (p && p.catch) p.catch(rej);
  });
  // Seconds t0..t1 of a surah's recording, decoded: { buffer, base } — base is the second of
  // the surah at which the buffer starts.
  function kClip(meta, t0, t1, onProgress) {
    const key = meta.url + '|' + t0.toFixed(3) + '|' + t1.toFixed(3);
    if (!kClipCache.has(key)) {
      const p = (async () => {
        if (!kHeadCache.has(meta.url)) {
          // the first 16 KB, or past the ID3 tag when it is bigger (cover art)
          const h = kBytes(meta.url, 0, 16383).then(async r => {
            if (r.whole) return { info: null, whole: r.buf };
            let b = new Uint8Array(r.buf);
            const tag = Khatira.id3Size(b);
            if (tag + 8192 > b.length) {
              const more = await kBytes(meta.url, 0, tag + 16383);
              if (more.whole) return { info: null, whole: more.buf };
              b = new Uint8Array(more.buf);
            }
            return { info: Khatira.mp3Info(b), whole: null };
          });
          h.catch(() => kHeadCache.delete(meta.url));
          kHeadCache.set(meta.url, h);
        }
        const head = await kHeadCache.get(meta.url);
        const info = head.info;
        if (info && info.cbr) {
          const a = Math.floor(Khatira.byteAt(info, Math.max(0, t0 - 1.5)));
          const b = Math.ceil(Khatira.byteAt(info, t1 + 1.0));
          const r = await kBytes(meta.url, a, b);
          if (!r.whole) {
            const bytes = new Uint8Array(r.buf);
            const ff = Khatira.firstFrame(bytes, a, info);
            if (ff) return { buffer: await kDecode(r.buf.slice(ff.pos)), base: ff.sec };
          } else {
            return { buffer: await kDecode(r.buf), base: 0 };
          }
        }
        // variable bitrate (or a server without ranges): the whole recording
        const r = head.whole ? { buf: head.whole.slice(0) } : await kBytes(meta.url, null, null, onProgress);
        return { buffer: await kDecode(r.buf), base: 0 };
      })();
      p.catch(() => kClipCache.delete(key));
      kClipCache.set(key, p);
      if (kClipCache.size > 6) kClipCache.delete(kClipCache.keys().next().value);
    }
    return kClipCache.get(key);
  }
  async function buildKhatiraTimeline(onProgress) {
    const key = timelineKey();
    if (timeline && timeline.key === key) return timeline;
    const segs = segments();
    const meta = await kMeta(state.kReciter, state.surah);
    const vs = segs.map(sg => meta.verses[sg.ayah]);
    if (vs.some(v => !v)) throw new Error('no timings');
    const first = vs[0], last = vs[vs.length - 1];
    // a word may start a little before its ayah's own timestamp
    const t0 = Math.min(first.from, ...first.segs.map(x => x[1])) / 1000;
    const t1 = last.to / 1000;
    const clip = await kClip(meta, t0, t1, onProgress);
    const shift = LEAD - t0;                      // video time = surah time + shift
    const items = segs.map((sg, i) => {
      const v = vs[i];
      const a = i === 0 ? t0 : v.from / 1000, b = v.to / 1000;
      const ws = Khatira.wordsOf(sg.text);
      const wt = Khatira.wordTimes(ws, v);
      return Object.assign({}, sg, {
        buffer: clip.buffer, offset: Math.max(0, a - clip.base), dur: Math.max(0.05, b - a), start: a + shift, end: b + shift,
        words: ws.map((w, k) => ({ text: w, a: wt[k].a / 1000 + shift, b: wt[k].b / 1000 + shift })),
      });
    });
    timeline = { key, items, total: t1 + shift + TAIL };
    return timeline;
  }

  // A span a..b shared by words by their length (any script).
  function kShare(words, a, b) {
    const w = words.map(x => Math.max(1, x.replace(/[\s\u064B-\u065F\u0670\u06D6-\u06ED]/g, '').length)), total = w.reduce((x, y) => x + y, 0) || 1;
    let t = a;
    return w.map(k => { const s0 = t; t += (b - a) * k / total; return { a: s0, b: t }; });
  }
  // «خاطرة» with the user's texts and no audio: each text for as long as it takes to read.
  function buildPacedTimeline() {
    const key = timelineKey();
    if (timeline && timeline.key === key) return timeline;
    const items = pacedItems(segments(), 0);
    timeline = { key, items, total: (items.length ? items[items.length - 1].end : LEAD) + TAIL };
    return timeline;
  }
  // The texts' times: a script's seconds where it gives them, else each for as long as it takes to
  // read; `fit` > 0 (a recitation's length) spreads texts with no times over it instead.
  function pacedItems(segs, fit) {
    let t = LEAD;
    const reading = segs.map(sg => {
      const ws = kTextWords(sg.text);
      return Math.min(15, Math.max(1.6, 0.5 + ws.length * 0.3 + ws.join('').length * 0.045));
    });
    const timed = segs.some(sg => sg.at != null || sg.until != null);
    const sum = reading.reduce((a, b) => a + b, 0);
    const k = fit > 0 && !timed && sum > 0 ? fit / sum : 1;
    return segs.map((sg, i) => {
      const ws = kTextWords(sg.text);
      const auto = Math.max(1.2, reading[i] * k);
      // a script's seconds: where it starts (never before the line before ends) and ends (its
      // own end, else where the next line starts, else by its length)
      const start = sg.at != null ? Math.max(t, sg.at) : t;
      const next = segs[i + 1];
      let end = sg.until != null ? sg.until : next && next.at != null && next.at > start ? next.at : start + auto;
      end = Math.min(start + 120, Math.max(start + 0.8, end));
      const it = Object.assign({}, sg, { buffer: null, start, end });
      it.words = kShare(ws, start + 0.15, Math.max(start + 0.3, end - 0.35)).map((x, k) => ({ text: ws[k], a: x.a, b: x.b, kt: true }));
      t = it.end;
      return it;
    });
  }
  // Own words over a recitation: the ayat's audio (one clip, the «خاطرة» reciter's) from the start,
  // the texts over it; the video lasts as long as the longer of the two.
  async function buildKtQuranTimeline(onProgress) {
    const key = timelineKey();
    if (timeline && timeline.key === key) return timeline;
    const meta = await kMeta(state.kReciter, state.surah);
    const vs = [];
    for (let a = state.from; a <= state.to; a++) vs.push(meta.verses[a]);
    if (!vs.length || vs.some(v => !v)) throw new Error('no timings');
    const t0 = Math.min(vs[0].from, ...vs[0].segs.map(x => x[1])) / 1000;
    const t1 = vs[vs.length - 1].to / 1000;
    const clip = await kClip(meta, t0, t1, onProgress);
    const dur = Math.max(0.1, t1 - t0);
    const items = pacedItems(segments(), dur);
    const audio = [{ buffer: clip.buffer, offset: Math.max(0, t0 - clip.base), dur, start: LEAD, end: LEAD + dur }];
    const end = Math.max(LEAD + dur, items.length ? items[items.length - 1].end : 0);
    timeline = { key, items, audio, total: end + TAIL };
    return timeline;
  }

  async function buildTimeline(onProgress) {
    if (isKText() && !own.active()) return isKQuran() ? buildKtQuranTimeline(onProgress) : buildPacedTimeline();
    if (own.active()) return buildOwnTimeline();
    if (isKhatira()) return buildKhatiraTimeline(onProgress);
    const key = timelineKey();
    if (timeline && timeline.key === key) return timeline;
    const folder = reciterObj().folder;
    const segs = segments();
    let done = 0;
    const buffers = new Array(segs.length);
    // Small concurrency limit — everyayah throttles bursts on slow mobile links.
    let next = 0;
    async function worker() {
      while (next < segs.length) {
        const i = next++;
        buffers[i] = await loadAyahAudio(segs[i].surah, segs[i].ayah, folder);
        done++;
        if (onProgress) onProgress(done / segs.length);
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()]);
    let t = LEAD;
    const items = segs.map((sg, i) => {
      const it = Object.assign({}, sg, { buffer: buffers[i], start: t, end: t + buffers[i].duration });
      t = it.end;
      return it;
    });
    timeline = { key, items, total: t + TAIL };
    return timeline;
  }

  // ---------- video length ----------
  // The recitation sets it: each ayah's recording back to back, plus the lead-in and the
  // tail. Worked out from the real recordings (the timeline the preview and the export
  // reuse, so they start at once afterwards), a moment after the last change.
  let durTimer = 0, durFor = '', durTotal = 0;
  function fmtDur(total) {
    const sec = Math.max(1, Math.round(total));
    const mm = Math.floor(sec / 60), ss = String(sec % 60).padStart(2, '0');
    const s = mm >= 60 ? Math.floor(mm / 60) + ':' + String(mm % 60).padStart(2, '0') + ':' + ss : mm + ':' + ss;
    return arabicNames() ? arDigits(s) : s;
  }
  function paintDuration(mode) {          // 'wait' | 'ok' | 'fail'
    const el = $('vmDurValue');
    el.classList.toggle('wait', mode === 'wait');
    el.classList.toggle('fail', mode === 'fail');
    el.textContent = mode === 'ok' ? (durApprox ? '≈ ' : '') + fmtDur(durTotal) : mode === 'fail' ? tr('vm_duration_fail') : '…';
    updateSummary();
  }
  let durApprox = false;   // long mode shows an estimate (file sizes), not decoded lengths
  // What a displayed length belongs to: the recitation and the range. For an own recording
  // this leaves out where its ayat were split (that is made while the length is worked out,
  // and edited later), so a result is only dropped when the range or the source changed.
  function durationKey() {
    if (isKText()) return timelineKey();
    return own.active() ? ['own', own.rec.id, rangeKey()].join('|') : timelineKey();
  }

  function updateDuration() {
    clearTimeout(durTimer);
    if (isLong()) { updateLongDuration(); return; }
    durApprox = false;
    const dkey = durationKey();
    if (timeline && timeline.key === timelineKey()) { durFor = dkey; durTotal = timeline.total; paintDuration('ok'); return; }
    durFor = '';
    paintDuration('wait');
    durTimer = setTimeout(async () => {
      try {
        const tl = await buildTimeline();
        // Switched to the long tab meanwhile: its own estimate owns the display now.
        if (durationKey() === dkey && !isLong()) { durFor = dkey; durTotal = tl.total; paintDuration('ok'); }
      } catch {
        if (durationKey() === dkey && !isLong()) paintDuration('fail');
      }
    }, 400);
  }

  function updateLongDuration() {
    const key = 'L|' + durationKey();
    durFor = '';
    durApprox = !own.active();       // an own recording's length is exact, the reciters' is estimated
    paintDuration('wait');
    durTimer = setTimeout(async () => {
      try {
        const total = await long.estimate(() => 'L|' + durationKey() !== key || !isLong());
        if ('L|' + durationKey() !== key || !isLong()) return;
        if (total == null) { $('vmDurValue').textContent = '—'; return; }
        durFor = key; durTotal = total; paintDuration('ok');
      } catch {
        if ('L|' + durationKey() === key && isLong()) paintDuration('fail');
      }
    }, 400);
  }

  // ---------- rendering ----------
  // Camera move for the whole clip: zoom factor + horizontal pan in [-1, 1]
  // (share of the available pan room). Eased so it starts and ends gently.
  function cameraAt(progress, slideMove) {
    const p = (1 - Math.cos(Math.PI * clamp01(progress))) / 2;
    const m = state.motion ? (slideMove || move) : STILL;
    const lerp = ([a, b]) => a + (b - a) * p;
    return { zoom: lerp(m.z), panX: lerp(m.x), panY: lerp(m.y) };
  }

  // New random move per preview/export, never the same one twice in a row.
  function rollMove() {
    const options = MOVES.filter(m => m !== move);
    move = options[Math.floor(Math.random() * options.length)];
    // Each slideshow picture gets its own move, never repeating the previous one.
    slideMoves = [];
    let prev = null;
    for (let i = 0; i < MAX_SLIDES; i++) {
      const opts = MOVES.filter(m => m !== prev);
      prev = opts[Math.floor(Math.random() * opts.length)];
      slideMoves.push(prev);
    }
  }

  // ---------- slideshow (several pictures) ----------
  const imgReady = img => !!img && img.complete && img.naturalWidth > 0;
  function slideIds() {
    return state.multiBg ? state.bgs.filter(id => bgImages.includes(id.slice(2))) : [];
  }
  function slideImage(id) {
    let img = imgCache.get(id);
    if (!img) {
      img = new Image();
      img.onload = () => renderIdle();
      img.src = bgSrc(id.slice(2));
      imgCache.set(id, img);
    }
    return img;
  }
  // Waits (max 8 s) until every picked picture has loaded, so a recording
  // never shows an empty slide.
  function ensureSlideImages() {
    const imgs = slideIds().map(slideImage).filter(img => !imgReady(img));
    if (!imgs.length) return Promise.resolve();
    return Promise.race([
      Promise.all(imgs.map(img => new Promise(res => { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }); }))),
      new Promise(res => setTimeout(res, 8000)),
    ]);
  }
  // Slide boundaries [0, b1, …, total]: equal shares of the clip, each cut moved
  // onto the nearest ayah change when one is close, so pictures change with the ayat.
  function slideBounds(tl, n) {
    const total = tl ? tl.total : 1;
    const cuts = tl ? tl.items.slice(0, -1).map(it => it.end) : [];
    const out = [0];
    for (let k = 1; k < n; k++) {
      let b = total * k / n;
      if (cuts.length) {
        const near = cuts.reduce((a, x) => (Math.abs(x - b) < Math.abs(a - b) ? x : a), cuts[0]);
        if (Math.abs(near - b) <= total / n / 2 && near - out[out.length - 1] >= 1.5 && total - near >= 1.5) b = near;
      }
      out.push(Math.max(b, out[out.length - 1] + 0.5));
    }
    out.push(total);
    return out;
  }
  function drawSlideshow(c, w, h, t, tl, ids) {
    const n = ids.length;
    const b = slideBounds(tl, n);
    let i = 0;
    while (i < n - 1 && t >= b[i + 1]) i++;
    const local = j => (t - b[j]) / Math.max(0.001, b[j + 1] - b[j]);
    const draw = (j, alpha) => {
      const img = slideImage(ids[j]);
      if (!imgReady(img)) return;
      c.save();
      c.globalAlpha = alpha;
      drawCover(c, img, img.naturalWidth, img.naturalHeight, w, h, cameraAt(local(j), slideMoves[j % slideMoves.length]));
      c.restore();
    };
    c.fillStyle = '#000';
    c.fillRect(0, 0, w, h);
    // Crossfade centred on each cut (the idle still just shows the first picture).
    if (!tl) {
      draw(0, 1);
    } else if (i > 0 && t < b[i] + XFADE / 2) {
      draw(i - 1, 1);
      draw(i, clamp01((t - (b[i] - XFADE / 2)) / XFADE));
    } else if (i < n - 1 && t > b[i + 1] - XFADE / 2) {
      draw(i, 1);
      draw(i + 1, clamp01((t - (b[i + 1] - XFADE / 2)) / XFADE));
    } else {
      draw(i, 1);
    }
  }

  // Cover-fits an image or video frame at the camera position. No full-frame
  // dimming: the text panel and the bottom vignette keep the text readable.
  function drawCover(c, src, sw, sh, w, h, cam) {
    const scale = Math.max(w / sw, h / sh) * cam.zoom;
    const dw = sw * scale, dh = sh * scale;
    const roomX = Math.min((dw - w) / 2, w * PAN_MAX);
    const roomY = Math.min((dh - h) / 2, h * PAN_MAX);
    c.drawImage(src, (w - dw) / 2 + cam.panX * roomX, (h - dh) / 2 + cam.panY * roomY, dw, dh);
  }

  // The last frame the background video showed, for the moments it has none.
  const held = { cv: null, src: '', t: -1 };
  function keepVideoFrame(v) {
    if (held.src === v.currentSrc && held.t === v.currentTime) return;     // nothing new to keep
    if (!held.cv) held.cv = document.createElement('canvas');
    if (held.cv.width !== v.videoWidth || held.cv.height !== v.videoHeight) { held.cv.width = v.videoWidth; held.cv.height = v.videoHeight; }
    held.cv.getContext('2d').drawImage(v, 0, 0);
    held.src = v.currentSrc;
    held.t = v.currentTime;
  }
  const heldFrameFor = v => !!(v && held.cv && held.src && held.src === v.currentSrc);

  function drawBackground(c, w, h, progress, t, tl) {
    const cam = cameraAt(progress);
    const zoom = cam.zoom;
    const ids = slideIds();
    if (ids.length) {
      drawSlideshow(c, w, h, tl ? t : 0, tl, ids);
    } else if (state.bg.startsWith('v:') && bgVideo && bgVideo.readyState >= 2 && !bgVideo.seeking) {
      drawCover(c, bgVideo, bgVideo.videoWidth, bgVideo.videoHeight, w, h, cam);
      keepVideoFrame(bgVideo);
    } else if (state.bg.startsWith('v:') && heldFrameFor(bgVideo)) {
      // The video has no frame for a moment (it jumps back to the start at its loop point,
      // ~50 ms): hold the last one it showed rather than flash the poster.
      drawCover(c, held.cv, held.cv.width, held.cv.height, w, h, cam);
    } else if (state.bg.startsWith('v:') && bgPoster && bgPoster.complete && bgPoster.naturalWidth) {
      drawCover(c, bgPoster, bgPoster.naturalWidth, bgPoster.naturalHeight, w, h, cam);
    } else if (state.bg.startsWith('i:') && bgImg && bgImg.complete && bgImg.naturalWidth) {
      drawCover(c, bgImg, bgImg.naturalWidth, bgImg.naturalHeight, w, h, cam);
    } else {
      const g = GRADIENTS[parseInt(state.bg.slice(1), 10)] || GRADIENTS[0];
      const lin = c.createLinearGradient(0, 0, w * 0.3, h);
      g.stops.forEach((col, i) => lin.addColorStop(i / (g.stops.length - 1), col));
      c.fillStyle = lin;
      c.fillRect(0, 0, w, h);
      // Drifting glow gives the gradients the same sense of motion as photos.
      const gx = w * (0.3 + 0.4 * progress), gy = h * (0.35 + 0.1 * Math.sin(progress * Math.PI));
      const rad = c.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * 0.6 * zoom);
      rad.addColorStop(0, g.glow);
      rad.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = rad;
      c.fillRect(0, 0, w, h);
    }
    // Bottom vignette keeps the caption readable on bright photos.
    const vig = c.createLinearGradient(0, h * 0.7, 0, h);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.45)');
    c.fillStyle = vig;
    c.fillRect(0, h * 0.7, w, h * 0.3);
  }

  function wrapWords(c, words, maxW) {
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (line && c.measureText(test).width > maxW) { lines.push(line); line = word; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  // The ayah's words, the last one carrying the ayah-number medallion.
  function ayahWords(seg) {
    const words = seg.text.split(/\s+/).filter(Boolean);
    // Ayah medallion: the mushaf font draws Arabic-Indic digits as one (as in
    // quran-text.html); Scheherazade needs U+06DD before them. The NBSP keeps the
    // marker from wrapping onto its own line.
    if (seg.num != null && !seg.kt && words.length) words[words.length - 1] += '\u00A0' + (QFONT === 'QuranFont' ? '' : '\u06DD') + arDigits(seg.num);
    return words;
  }

  // Wraps + auto-shrinks the ayah so the whole block fits the safe area.
  function layoutText(c, seg, w, h) {
    const key = [seg.surah, seg.ayah, w, h, state.fontMul, state.caption].join('|');
    if (layoutCache.has(key)) return layoutCache.get(key);
    const words = ayahWords(seg);
    const maxW = w * 0.84;
    const maxH = h * (state.caption ? 0.6 : 0.7);
    let size = Math.min(w, h) * 0.085 * state.fontMul;
    let lines;
    for (;;) {
      c.font = size + 'px ' + QFONT;
      lines = wrapWords(c, words, maxW);
      if (lines.length * size * 1.8 <= maxH || size <= 22) break;
      size *= 0.94;
    }
    const widest = Math.max(...lines.map(ln => c.measureText(ln).width));
    const out = { size, lines, lh: size * 1.8, widest };
    layoutCache.set(key, out);
    if (layoutCache.size > 200) layoutCache.delete(layoutCache.keys().next().value);
    return out;
  }

  // One line of ayah text with the chosen effect that keeps it readable on any photo.
  // Colour of the glow / shadow / outline. 'auto' = black, or white when `light`
  // (dark text on a pale picture, long mode); otherwise the colour the user picked.
  function haloRgb(light) {
    if (state.halo === 'auto') return light ? '255,255,255' : '0,0,0';
    const n = parseInt(state.halo.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(',');
  }
  function fillAyahLine(c, ln, x, y, size, light) {
    const fx = state.textFx;
    const rgb = haloRgb(light);
    const halo = a => 'rgba(' + rgb + ',' + a + ')';
    if (fx === 'none') { c.shadowColor = 'transparent'; c.fillText(ln, x, y); return; }
    if (fx === 'shadow') {
      c.shadowColor = halo(0.65); c.shadowBlur = size * 0.3; c.shadowOffsetY = size * 0.04;
      c.fillText(ln, x, y);
      return;
    }
    c.shadowColor = halo(fx === 'glow' ? 0.9 : 0.8);
    c.shadowBlur = size * (fx === 'glow' ? 0.5 : 0.4);
    c.shadowOffsetY = 0;
    if (fx === 'strokeglow') {
      c.lineJoin = 'round'; c.lineWidth = size * 0.05; c.strokeStyle = halo(0.6);
      c.strokeText(ln, x, y);
      c.fillText(ln, x, y);
    } else {
      c.fillText(ln, x, y);
      c.fillText(ln, x, y);
    }
    c.fillText(ln, x, y);
  }

  // ---------- where the text sits ----------
  // Its centre on a w x h frame: the middle (a little higher above the caption), or where the
  // user dragged it.
  const TEXT_EDGE = 0.06;
  function cleanTextPos(p) {
    if (!p || typeof p !== 'object' || !isFinite(+p.x) || !isFinite(+p.y)) return null;
    const c = v => Math.min(1 - TEXT_EDGE, Math.max(TEXT_EDGE, +v));
    return { x: c(p.x), y: c(p.y) };
  }
  function textCentre(w, h) {
    const p = state.textPos;
    return p ? [p.x * w, p.y * h] : [w / 2, h * (state.caption ? 0.46 : 0.5)];
  }

  function drawAyah(c, seg, w, h, alpha) {
    if (alpha <= 0) return;
    const L = layoutText(c, seg, w, h);
    c.save();
    c.globalAlpha = alpha;
    c.font = L.size + 'px ' + QFONT;
    c.direction = 'rtl';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = state.color;
    const [cx, cy] = textCentre(w, h);
    const top = cy - (L.lines.length - 1) * L.lh / 2;
    // Gentle rise as the ayah fades in.
    const rise = (1 - alpha) * L.size * 0.3;
    if (state.textPanel) {
      // Sized to the text block; fades with the ayah, so consecutive ayat crossfade cleanly.
      const pw = Math.min(L.widest + L.size * 1.4, w * 0.94);
      const ph = L.lines.length * L.lh + L.size * 0.5;
      c.save();
      c.shadowColor = 'transparent';
      c.fillStyle = 'rgba(0,0,0,0.5)';
      c.beginPath();
      const px = cx - pw / 2, py = cy - ph / 2 + rise, r = L.size * 0.55;
      if (c.roundRect) c.roundRect(px, py, pw, ph, r);
      else c.rect(px, py, pw, ph);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.12)';
      c.lineWidth = Math.max(1.5, L.size * 0.025);
      c.stroke();
      c.restore();
    }
    L.lines.forEach((ln, i) => fillAyahLine(c, ln, cx, top + i * L.lh + rise, L.size));
    c.restore();
  }

  function drawCaption(c, w, h) {
    if (!state.caption) return;
    if (isKText()) {                        // own words: just the name the user typed, if any
      const name = String(state.sheikh || '').trim();
      if (!name) return;
      const base = Math.min(w, h);
      c.save();
      c.direction = /[\u0590-\u08FF]/.test(name) ? 'rtl' : 'ltr';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.shadowColor = 'rgba(0,0,0,0.6)';
      c.shadowBlur = 12;
      c.fillStyle = 'rgba(255,255,255,0.9)';
      c.font = (base * 0.036) + 'px VMTajawal';
      c.fillText(name, w / 2, h - base * 0.12);
      c.restore();
      return;
    }
    const s = surahObj();
    const base = Math.min(w, h);
    c.save();
    c.direction = arabicNames() ? 'rtl' : 'ltr';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.shadowColor = 'rgba(0,0,0,0.6)';
    c.shadowBlur = 12;
    const y = h - base * 0.15;
    // Divider ornament above the caption.
    c.strokeStyle = 'rgba(255,255,255,0.45)';
    c.lineWidth = Math.max(2, base * 0.002);
    c.beginPath();
    c.moveTo(w / 2 - base * 0.12, y - base * 0.06);
    c.lineTo(w / 2 + base * 0.12, y - base * 0.06);
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.95)';
    if (arabicNames()) {
      c.font = (base * 0.045) + 'px ' + QFONT;
      c.fillText(s.name, w / 2, y);
    } else {
      c.font = (base * 0.04) + 'px VMTajawal';
      c.fillText('Surah ' + surahLatin(s), w / 2, y);
    }
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.font = (base * 0.03) + 'px VMTajawal';
    c.fillText(displayName(), w / 2, y + base * 0.055);
    c.restore();
  }

  // Small app icon + name at the top, centered as one group. Always the
  // English brand name so shared clips read the same in every UI language.
  function drawBranding(c, w, h) {
    if (!state.branding) return;
    const base = Math.min(w, h);
    const size = base * 0.026;
    const icon = base * 0.042;
    const gap = base * 0.012;
    const y = base * 0.07;
    const hasIcon = appIcon.complete && appIcon.naturalWidth;
    c.save();
    c.globalAlpha = 0.8;
    c.font = size + 'px VMTajawal';
    c.direction = 'ltr';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    const tw = c.measureText(BRAND).width;
    const total = tw + (hasIcon ? icon + gap : 0);
    let x = (w - total) / 2;
    c.shadowColor = 'rgba(0,0,0,0.5)';
    c.shadowBlur = 8;
    if (hasIcon) {
      // Rounded-square clip so it reads as an app icon.
      c.save();
      c.beginPath();
      if (c.roundRect) c.roundRect(x, y - icon / 2, icon, icon, icon * 0.22);
      else c.rect(x, y - icon / 2, icon, icon);
      c.clip();
      c.drawImage(appIcon, x, y - icon / 2, icon, icon);
      c.restore();
      x += icon + gap;
    }
    c.fillStyle = '#fff';
    c.fillText(BRAND, x, y);
    c.restore();
  }

  // ---------- «خاطرة»: the faces ----------
  // The bundled bold faces (js/khatira.js FONTS) and the ones the user adds from the device (kept
  // there, in IndexedDB, like their backgrounds). A word is drawn as the face can draw it: the
  // Uthmani marks a face lacks become their usual equivalents (Khatira.adaptWord).
  let userFonts = [];             // [{ id, name, family, has }]
  const FONT_DB = 'vm-user-fonts';
  const MAX_FONTS = 12, MAX_FONT_BYTES = 20 * 1024 * 1024;
  function kFaces() {
    const bundled = window.Khatira ? Khatira.FONTS.map(f => Object.assign({ has: f.qpc ? null : Khatira.hasIn(f) }, f)) : [];
    return bundled.concat(userFonts.map(u => ({ id: 'u:' + u.id, family: u.family, weight: '', has: u.has, user: u })));
  }
  // The face of the video, or of one line that names its own (a script's {font: ...}).
  function kFace(id) {
    const all = kFaces();
    return (id && all.find(f => f.id === id)) || all.find(f => f.id === state.kFont) || all[0] || { family: null, weight: '', qpc: true };
  }
  function kFont(size, face) {
    const f = face || kFace();
    return f.weight + size + 'px ' + (f.family || QFONT);
  }
  // The word as the chosen face draws it.
  function kText(word) {
    const f = kFace();
    return f.qpc ? word : Khatira.adaptWord(word, f.user ? f.has : f.has || (() => true));
  }
  // The video's face and any a line names, loaded (a face draws nothing until it is).
  function kFontReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const ids = new Set([state.kFont]);
    if (isKText()) state.kOpts.forEach(o => { if (o && o.font) ids.add(o.font); });
    return Promise.all([...ids].map(id => {
      const f = kFace(id);
      return f.family ? document.fonts.load(f.weight + '64px ' + f.family, 'أبجد').catch(() => {}) : null;
    }));
  }
  function fontDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('no IndexedDB')); return; }
      const req = indexedDB.open(FONT_DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('fonts', { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function fontTx(mode, fn) {
    return fontDb().then(d => new Promise((resolve, reject) => {
      const t = d.transaction('fonts', mode);
      const out = fn(t.objectStore('fonts'));
      t.oncomplete = () => { d.close(); resolve(out && 'result' in out ? out.result : undefined); };
      t.onerror = () => { d.close(); reject(t.error); };
    }));
  }
  // A font file as a face: loaded (so a bad file is refused), added to the page, and read for
  // the characters it draws (TrueType / OpenType; unknown for WOFF).
  async function faceOf(rec) {
    const family = 'KhUser' + rec.id;
    const ff = new FontFace(family, rec.data);
    await ff.load();
    document.fonts.add(ff);
    const set = Khatira.cmapOf(rec.data);
    return { id: rec.id, name: rec.name, family, ff, has: set ? (c => set.has(c.codePointAt(0))) : null };
  }
  async function loadUserFonts() {
    let recs = [];
    try { recs = (await fontTx('readonly', st => st.getAll())) || []; } catch (e) { recs = []; }
    recs.sort((a, b) => (a.added || 0) - (b.added || 0));
    userFonts = [];
    for (const r of recs) { try { userFonts.push(await faceOf(r)); } catch (e) { /* a file the browser no longer reads */ } }
    if (state.kFont.startsWith('u:') && !userFonts.some(u => 'u:' + u.id === state.kFont)) state.kFont = 'amiri';
  }
  async function addUserFont(file) {
    if (!file) return;
    if (!/\.(ttf|otf|woff2?)$/i.test(file.name) && !/font/.test(file.type)) { setStatus(tr('vm_kf_bad'), true); return; }
    if (file.size > MAX_FONT_BYTES || userFonts.length >= MAX_FONTS) { setStatus(tr('vm_kf_bad'), true); return; }
    const rec = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: file.name.replace(/\.[^.]+$/, '').slice(0, 40), data: await file.arrayBuffer(), added: Date.now() };
    let face;
    try { face = await faceOf(rec); } catch (e) { setStatus(tr('vm_kf_bad'), true); return; }
    try { await fontTx('readwrite', st => st.put(rec)); } catch (e) { /* kept for this visit only */ }
    userFonts.push(face);
    state.kFont = 'u:' + rec.id;
    setStatus('');
    renderKFonts();
    onChange();
  }
  async function deleteUserFont(id) {
    const i = userFonts.findIndex(u => u.id === id);
    if (i < 0) return;
    try { document.fonts.delete(userFonts[i].ff); } catch (e) { /* gone */ }
    userFonts.splice(i, 1);
    try { await fontTx('readwrite', st => st.delete(id)); } catch (e) { /* not stored */ }
    if (state.kFont === 'u:' + id) state.kFont = 'amiri';
    renderKFonts();
    kFontReady().then(() => onChange());
  }
  // The picker: a sample of «أبجد» in each face, the user's own after the bundled ones, then «+».
  function renderKFonts() {
    const box = $('vmKFonts');
    if (!box || !window.Khatira) return;
    box.innerHTML = '';
    for (const f of kFaces()) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.kfont = f.id;
      const sample = document.createElement('span');
      sample.className = 'kf-sample';
      sample.textContent = 'أبجد';
      sample.style.fontFamily = f.family ? "'" + f.family + "'" : 'QuranFont, QuranFallback';
      if (f.weight) sample.style.fontWeight = f.weight.trim();
      if (f.size) sample.style.fontSize = Math.round(28 * f.size) + 'px';
      const name = document.createElement('span');
      name.className = 'kf-name';
      name.textContent = f.user ? f.user.name : tr('vm_kf_' + f.id);
      if (f.user) name.dir = 'auto';
      b.append(sample, name);
      b.onclick = () => { state.kFont = f.id; markKFonts(); kFontReady().then(() => onChange()); };
      if (f.user) {
        b.classList.add('is-user');
        const del = document.createElement('span');
        del.className = 'kf-del';
        del.setAttribute('role', 'button');
        del.tabIndex = 0;
        del.setAttribute('aria-label', tr('vm_kf_delete'));
        del.title = tr('vm_kf_delete');
        del.textContent = '×';
        const go = e => { e.stopPropagation(); e.preventDefault(); deleteUserFont(f.user.id); };
        del.onclick = go;
        del.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') go(e); };
        b.appendChild(del);
      }
      box.appendChild(b);
    }
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'kf-add';
    add.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span></span>';
    add.querySelector('span').textContent = tr('vm_kf_add');
    add.onclick = () => $('vmKFontFile').click();
    box.appendChild(add);
    markKFonts();
  }

  // ---------- «خاطرة»: the words ----------
  // One word at a time, centred and large, in the chosen bold face; it eases in (a fade and a
  // slight grow) as it is recited, while the one before fades out.
  const kSizeCache = new Map();
  function drawKWord(c, word, w, h, alpha, p, own, seg) {
    if (alpha <= 0.002 || !word) return;
    if (!own) word = kText(word);            // the user's own words are drawn as typed
    const face = kFace(seg && seg.font), mul = (seg && seg.size) || state.fontMul;
    const key = [word, w, h, face.id, mul].join('|');
    let size = kSizeCache.get(key);
    if (!size) {
      size = Math.min(w, h) * (w > h ? 0.2 : 0.19) * mul * (face.size || 1);
      c.font = kFont(size, face);
      const width = c.measureText(word).width;
      if (width > w * 0.86) size *= w * 0.86 / width;
      kSizeCache.set(key, size);
      if (kSizeCache.size > 400) kSizeCache.delete(kSizeCache.keys().next().value);
    }
    const e = 1 - Math.pow(1 - clamp01(p), 3);            // ease out
    c.save();
    c.globalAlpha = alpha * e;
    c.translate(...textCentre(w, h));
    const k = 0.9 + 0.1 * e;
    c.scale(k, k);
    c.font = kFont(size, face);
    c.direction = /[\u0590-\u08FF\uFB1D-\uFEFC]/.test(word) ? 'rtl' : 'ltr';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = state.color;
    fillAyahLine(c, word, 0, 0, size);
    c.restore();
  }
  // The text of a segment (an ayah or one of the user's texts) laid out as lines of words: the
  // largest size at which it fits the safe area, down to a readable minimum, after which it is
  // split into pages of lines. Each word has its place (x from the centre, anchored at its right
  // edge for right-to-left text), so words can light up or appear without anything moving.
  const kLayoutCache = new Map();
  function kLayout(c, tl, si, w, h) {
    const key = [tl.key, si, w, h, state.kFont, state.fontMul, state.caption, userFonts.length].join('|');
    if (kLayoutCache.has(key)) return kLayoutCache.get(key);
    const it = tl.items[si];
    const texts = it.words.map(x => (x.kt ? x.text : kText(x.text)));
    const arabic = (it.text || texts.join(' ')).replace(/[^\u0600-\u06FF]/g, '').length * 2 >= (it.text || texts.join(' ')).replace(/[\s\d\p{P}]/gu, '').length;
    const rtl = it.kt ? arabic : true;
    const face = kFace(it.font), mul = (it.size || state.fontMul) * (face.size || 1);
    const base = Math.min(w, h);
    const maxW = w * 0.86, maxH = h * (state.caption ? 0.5 : 0.62);
    const minSize = base * 0.055 * mul;
    let size = base * (w > h ? 0.15 : 0.14) * mul, lines, space, widths;
    for (;;) {
      c.font = kFont(size, face);
      widths = texts.map(x => c.measureText(x).width);
      space = c.measureText('\u00A0').width;
      lines = [];
      let cur = [], cw = 0;
      widths.forEach((wd, i) => {
        const add = cur.length ? space + wd : wd;
        if (cur.length && cw + add > maxW) { lines.push(cur); cur = [i]; cw = wd; } else { cur.push(i); cw += add; }
      });
      if (cur.length) lines.push(cur);
      if (lines.length * size * 1.8 <= maxH || size <= minSize) break;
      size = Math.max(minSize, size * 0.94);
    }
    const lh = size * 1.8, perPage = Math.max(1, Math.floor(maxH / lh));
    const pages = [];
    for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
    const xs = [], ys = [], pageOf = [];
    pages.forEach((pg, pi) => pg.forEach((ln, li) => {
      const lw = ln.reduce((n, i) => n + widths[i], 0) + space * (ln.length - 1);
      let x = rtl ? lw / 2 : -lw / 2;
      ln.forEach(i => {
        xs[i] = x; ys[i] = (li - (pg.length - 1) / 2) * lh; pageOf[i] = pi;
        x += rtl ? -(widths[i] + space) : widths[i] + space;
      });
    }));
    const out = { texts, rtl, size, lh, pages, xs, ys, pageOf, space, face };
    kLayoutCache.set(key, out);
    if (kLayoutCache.size > 200) kLayoutCache.delete(kLayoutCache.keys().next().value);
    return out;
  }
  // The colour of the word being recited: warm gold, or white when the text itself is gold.
  function kHighlight() {
    const n = parseInt(String(state.color).slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return r > 200 && g > 170 && b < 150 ? [255, 255, 255] : [255, 213, 74];
  }
  function kMix(f) {
    const n = parseInt(String(state.color).slice(1), 16), hl = kHighlight();
    const a = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return 'rgb(' + a.map((v, i) => Math.round(v + (hl[i] - v) * f)).join(',') + ')';
  }
  // One segment's line(s): 'line' lights the word being recited (the rest at half strength, the
  // ones already said full), 'build' draws only the words recited so far. `t` null = a still: all lit.
  function drawKSegment(c, w, h, tl, si, t, alpha) {
    const L = kLayout(c, tl, si, w, h);
    const words = tl.items[si].words;
    let cur = words.length - 1;
    if (t != null) { cur = -1; for (let i = 0; i < words.length && words[i].a <= t; i++) cur = i; }
    const page = cur >= 0 ? L.pageOf[cur] : 0;
    const [cx, cy] = textCentre(w, h), style = state.kStyle;
    c.save();
    c.direction = L.rtl ? 'rtl' : 'ltr';
    c.textAlign = L.rtl ? 'right' : 'left';
    c.textBaseline = 'middle';
    c.font = kFont(L.size, L.face);
    words.forEach((wd, i) => {
      if (L.pageOf[i] !== page) return;
      let a = alpha, hl = 0;
      if (t != null) {
        const p = clamp01((t - wd.a) / 0.18);
        if (style === 'build') a *= 1 - Math.pow(1 - p, 3);
        else a *= 0.5 + 0.5 * p;
        if (style === 'line') hl = i === cur ? p : i === cur - 1 ? 1 - clamp01((t - words[cur].a) / 0.2) : 0;
      }
      if (a < 0.01) return;
      c.globalAlpha = a;
      c.fillStyle = hl > 0.01 ? kMix(hl) : state.color;
      fillAyahLine(c, L.texts[i], cx + L.xs[i], cy + L.ys[i], L.size);
    });
    c.restore();
  }
  // Every word of a timeline in order, each knowing which segment it belongs to.
  const kWordList = tl => tl.words || (tl.words = tl.items.flatMap((it, si) => (it.words || []).map(x => Object.assign(x, { seg: si }))));
  function drawWords(c, w, h, t, tl) {
    const words = kWordList(tl);
    let k = -1;
    for (let i = 0; i < words.length && words[i].a <= t; i++) k = i;
    const out = clamp01((tl.total - t) / FADE);          // the last word fades with the end
    if (state.kStyle === 'word') {
      if (k < 0) return;
      const p = clamp01((t - words[k].a) / 0.22);
      if (p < 1 && k > 0) drawKWord(c, words[k - 1].text, w, h, (1 - p) * out, 1, words[k - 1].kt, tl.items[words[k - 1].seg]);
      drawKWord(c, words[k].text, w, h, out, p, words[k].kt, tl.items[words[k].seg]);
      return;
    }
    // the line of the word being recited; the next line shows from 0.35 s before its first word
    const next = k + 1 < words.length ? words[k + 1] : null;
    let si = k >= 0 ? words[k].seg : -1;
    if (next && next.seg !== si && t >= next.a - 0.35) si = next.seg;
    if (si < 0) return;
    const first = tl.items[si].words[0];
    drawKSegment(c, w, h, tl, si, t, clamp01((t - (first.a - 0.35)) / 0.3) * out);
  }
  // Which word shows at video time t (for the tests and the summary).
  function khatiraWordAt(t) {
    const tl = timeline;
    if (!tl || !tl.items[0] || !tl.items[0].words) return null;
    const words = kWordList(tl);
    let k = -1;
    for (let i = 0; i < words.length && words[i].a <= t; i++) k = i;
    return k < 0 ? null : Object.assign({ index: k }, words[k]);
  }

  // When each script line shows in a timeline (stickers that go with a line): line -> [start,
  // end], null when the line is not in it; undefined (not own words) = stickers use from / to.
  function lineSpanIn(tl) {
    if (!isKText() || !tl.items.length || tl.items[0].ki == null) return undefined;
    return line => {
      const it = tl.items.find(x => x.ki === line);
      return it ? [it.words && it.words[0] ? Math.min(it.start, it.words[0].a - 0.35) : it.start, it.end] : null;
    };
  }

  // t = seconds into the clip. With no timeline, draws a still of the first segment.
  function renderFrame(c, w, h, t, tl) {
    const total = tl ? tl.total : 1;
    drawBackground(c, w, h, tl ? clamp01(t / total) : 0, t, tl);
    if (isKhatira()) {
      if (tl && tl.items[0] && tl.items[0].words) drawWords(c, w, h, t, tl);
      else {
        const segs = segments();
        if (segs.length && state.kStyle !== 'word') {
          // a still of the first line, all of it lit
          const sg = segs[0], ws = sg.kt ? kTextWords(sg.text) : Khatira.wordsOf(sg.text);
          const still = { key: 'still|' + sg.text, items: [Object.assign({}, sg, { words: ws.map(x => ({ text: x, a: 0, kt: !!sg.kt })) })] };
          drawKSegment(c, w, h, still, 0, null, 1);
        } else if (segs.length) drawKWord(c, segs[0].kt ? kTextWords(segs[0].text)[0] : Khatira.wordsOf(segs[0].text)[0], w, h, 1, 1, segs[0].kt, segs[0]);
        else if (isKText()) drawKWord(c, tr('vm_kt_empty'), w, h, 0.55, 1, true);    // nothing written yet
      }
    } else if (!tl) {
      const segs = segments();
      if (segs.length) drawAyah(c, segs[0], w, h, 1);
    } else {
      const items = tl.items;
      items.forEach((it, i) => {
        // Display windows overlap by FADE so consecutive ayat crossfade;
        // the last one holds through the tail and fades out at the very end.
        const showStart = i === 0 ? it.start - FADE : it.start - FADE / 2;
        const showEnd = i === items.length - 1 ? total : it.end + FADE / 2;
        const a = Math.min(clamp01((t - showStart) / FADE), clamp01((showEnd - t) / FADE));
        drawAyah(c, it, w, h, a);
      });
    }
    if (stickers) stickers.draw(c, w, h, tl ? t : null, total, tl ? lineSpanIn(tl) : undefined);
    drawCaption(c, w, h);
    drawBranding(c, w, h);
  }

  function sizeCanvas() {
    const [w, h] = isLong() ? [long.W, long.H] : FORMATS[state.format];
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    layoutStage();
  }

  // Fits the canvas inside the stage box and pins the play button to the
  // video's own bottom-left corner — positioned against the stage it would land
  // outside the picture in square/wide formats.
  function layoutStage() {
    const stage = $('vmStage');
    const W = stage.clientWidth, H = stage.clientHeight;
    if (!W || !H) return;
    const ar = canvas.width / canvas.height;
    let cw = W, ch = W / ar;
    if (ch > H) { ch = H; cw = H * ar; }
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    const play = $('vmStagePlay');
    const inset = 14;
    play.style.left = ((W - cw) / 2 + inset) + 'px';
    play.style.top = ((H - ch) / 2 + ch - 52 - inset - 4) + 'px';
    const fsBtn = $('vmFullscreen');
    fsBtn.style.left = ((W + cw) / 2 - 40 - inset) + 'px';
    fsBtn.style.top = ((H - ch) / 2 + ch - 40 - inset - 10) + 'px';
    if (stickers) stickers.placeBox();
  }

  // ---------- full screen preview ----------
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  function isFullscreen() { return !!fsElement() || $('vmStage').classList.contains('pseudo-fs'); }
  function syncFullscreenUi() {
    $('vmStage').classList.toggle('is-fs', isFullscreen());
    layoutStage();
    miniUpdate();
  }
  function enterFullscreen() {
    const stage = $('vmStage');
    const req = stage.requestFullscreen || stage.webkitRequestFullscreen;
    if (req) {
      Promise.resolve(req.call(stage)).catch(() => enterPseudoFullscreen());
    } else {
      enterPseudoFullscreen();
    }
  }
  // iPhone Safari only allows <video> to go full screen, so cover the viewport instead.
  function enterPseudoFullscreen() {
    $('vmStage').classList.add('pseudo-fs');
    document.body.classList.add('vm-pseudo-fs');
    document.body.style.overflow = 'hidden';
    if (window.BackClose) BackClose.opened(exitPseudoFullscreen);
    syncFullscreenUi();
  }
  function exitPseudoFullscreen() {
    const stage = $('vmStage');
    if (!stage.classList.contains('pseudo-fs')) return;
    if (window.BackClose) BackClose.closed();
    stage.classList.remove('pseudo-fs');
    document.body.classList.remove('vm-pseudo-fs');
    document.body.style.overflow = '';
    syncFullscreenUi();
  }
  function toggleFullscreen() {
    if (fsElement()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else if ($('vmStage').classList.contains('pseudo-fs')) exitPseudoFullscreen();
    else enterFullscreen();
  }

  // ---------- the floating mini preview ----------
  // While the preview is scrolled out of view (on a phone, under the settings), a small copy of
  // it floats in a corner so every change shows as it is made: tap it to go back up, ▶ to play.
  let miniOn = false, miniRaf = 0, miniLast = 0, miniClosed = false, miniAr = 0, miniPos = null;
  function bindMiniPreview() {
    const box = $('vmMini'), mc = $('vmMiniCanvas'), stage = $('vmStage');
    try { miniClosed = sessionStorage.getItem('vmMiniClosed') === '1'; } catch (e) { /* storage blocked */ }
    let stageSeen = true;
    const update = () => {
      const show = !stageSeen && !miniClosed && !isFullscreen() && $('vmResult').hidden;
      if (show === miniOn) return;
      miniOn = show;
      box.hidden = !show;
      if (show) {
        miniSize();
        miniLoop();
        if (miniPos) { const p = miniPos; miniPos = null; requestAnimationFrame(() => placeAt(p.left, p.top)); }
      } else cancelAnimationFrame(miniRaf);
    };
    if (window.IntersectionObserver) {
      new IntersectionObserver(es => { stageSeen = es[es.length - 1].intersectionRatio > 0.25; update(); }, { threshold: [0, 0.25, 0.5] }).observe(stage);
    }
    $('vmMiniView').onclick = () => {
      if (Date.now() - miniDragEnd < 400) return;           // the end of a drag, not a tap
      stage.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
    // drag it anywhere out of the way; it settles at the nearer side, where it was let go
    let drag = null, miniDragEnd = 0;
    const view = $('vmMiniView');
    const placeAt = (x, y) => {
      const r = box.getBoundingClientRect(), W = innerWidth, H = innerHeight;
      box.style.left = Math.min(W - r.width - 8, Math.max(8, x)) + 'px';
      box.style.top = Math.min(H - r.height - 8, Math.max(8, y)) + 'px';
      box.style.right = 'auto'; box.style.bottom = 'auto'; box.style.insetInlineStart = 'auto';
    };
    view.addEventListener('pointerdown', ev => {
      const r = box.getBoundingClientRect();
      drag = { x: ev.clientX, y: ev.clientY, dx: ev.clientX - r.left, dy: ev.clientY - r.top, moved: false, id: ev.pointerId };
    });
    view.addEventListener('pointermove', ev => {
      if (!drag || ev.pointerId !== drag.id) return;
      if (!drag.moved && Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) < 8) return;
      if (!drag.moved) { drag.moved = true; try { view.setPointerCapture(ev.pointerId); } catch (e) { /* not supported */ } }
      ev.preventDefault();
      placeAt(ev.clientX - drag.dx, ev.clientY - drag.dy);
    });
    const endDrag = () => {
      if (drag && drag.moved) {
        miniDragEnd = Date.now();
        const r = box.getBoundingClientRect();
        placeAt(r.left + r.width / 2 < innerWidth / 2 ? 12 : innerWidth - r.width - 12, r.top);
        try { sessionStorage.setItem('vmMiniPos', JSON.stringify({ left: parseFloat(box.style.left), top: parseFloat(box.style.top) })); } catch (e) { /* storage blocked */ }
      }
      drag = null;
    };
    view.addEventListener('pointerup', endDrag);
    view.addEventListener('pointercancel', endDrag);
    view.addEventListener('touchmove', e => { if (drag && drag.moved) e.preventDefault(); }, { passive: false });
    view.style.touchAction = 'none';
    try {
      const pos = JSON.parse(sessionStorage.getItem('vmMiniPos') || 'null');
      if (pos) miniPos = pos;
    } catch (e) { /* storage blocked */ }
    $('vmMiniPlay').onclick = () => { if (!busy) togglePreview(); };
    $('vmMiniClose').onclick = () => {
      miniClosed = true;
      try { sessionStorage.setItem('vmMiniClosed', '1'); } catch (e) { /* storage blocked */ }
      update();
    };
    miniUpdate = update;
    // the picture: copied from the preview a few times a second (every frame while it plays)
    function miniLoop() {
      cancelAnimationFrame(miniRaf);
      const step = now => {
        if (!miniOn) return;
        if (playing || now - miniLast > 120) {
          miniLast = now;
          if (miniAr !== canvas.width / canvas.height) miniSize();     // the size (format) changed
          const x = mc.getContext('2d');
          x.drawImage(canvas, 0, 0, mc.width, mc.height);
        }
        box.classList.toggle('playing', !!playing);
        miniRaf = requestAnimationFrame(step);
      };
      miniRaf = requestAnimationFrame(step);
    }
    function miniSize() {
      // the video's own shape, about as large as a thumb's reach allows
      const ar = canvas.width / canvas.height;
      miniAr = ar;
      const w = Math.round(ar < 1 ? 112 : ar === 1 ? 140 : 184), h = Math.round(w / ar);
      const view = $('vmMiniView');
      view.style.width = w + 'px';
      view.style.height = h + 'px';
      mc.width = w * 2;
      mc.height = h * 2;
    }
  }
  let miniUpdate = () => {};

  // ---------- moving the text: hold on the preview, then drag ----------
  // A tap still plays the preview, and a finger that moves at once still scrolls the page: only a
  // press held still for a moment (or a mouse drag) picks the text up. Stickers keep their own drag.
  let textDrag = null;
  let textDragEnd = 0;     // when a hold ended: the click that follows must not start the preview
  function bindTextDrag() {
    const cv = canvas, stage = $('vmStage'), HOLD = 380, SLOP = 10;
    const frac = ev => { const r = cv.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height }; };
    const finish = () => {
      if (!textDrag) return;
      clearTimeout(textDrag.timer);
      if (textDrag.armed) { textDragEnd = Date.now(); saveSettings(); setStatus(''); renderTextPos(); }
      textDrag = null;
      stage.classList.remove('text-drag');
    };
    const arm = () => {
      if (!textDrag || textDrag.armed || playing || busy) return;
      textDrag.armed = true;
      stage.classList.add('text-drag');
      try { cv.setPointerCapture(textDrag.id); } catch (e) { /* not supported */ }
      if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) { /* not allowed */ }
      setStatus(tr('vm_tpos_moving'));
    };
    cv.addEventListener('pointerdown', ev => {
      if (busy || playing || isLong() || ev.button > 0 || textDrag) return;
      if (stickers) {
        const r = cv.getBoundingClientRect();
        if (stickers.hit({ x: (ev.clientX - r.left) / r.width * cv.width, y: (ev.clientY - r.top) / r.height * cv.height }) >= 0) return;
      }
      const [x0, y0] = textCentre(1, 1);
      textDrag = { id: ev.pointerId, mouse: ev.pointerType === 'mouse', cx: ev.clientX, cy: ev.clientY, p0: frac(ev), x0, y0, armed: false };
      textDrag.timer = setTimeout(arm, HOLD);
    });
    cv.addEventListener('pointermove', ev => {
      if (!textDrag || ev.pointerId !== textDrag.id) return;
      if (!textDrag.armed) {
        const d = Math.hypot(ev.clientX - textDrag.cx, ev.clientY - textDrag.cy);
        if (textDrag.mouse && d > 6) arm();
        else if (d > SLOP) { finish(); return; }    // a swipe: the page scrolls
        if (!textDrag || !textDrag.armed) return;
      }
      const p = frac(ev);
      state.textPos = cleanTextPos({ x: textDrag.x0 + p.x - textDrag.p0.x, y: textDrag.y0 + p.y - textDrag.p0.y });
      renderIdle();
    });
    cv.addEventListener('pointerup', finish);
    cv.addEventListener('pointercancel', finish);
    // once the text is held, the finger moves it rather than the page
    cv.addEventListener('touchmove', e => { if (textDrag && textDrag.armed) e.preventDefault(); }, { passive: false });
    cv.addEventListener('contextmenu', e => { if (!isLong()) e.preventDefault(); });
    $('vmTextPosReset').onclick = () => { state.textPos = null; saveSettings(); renderIdle(); renderTextPos(); };
    renderTextPos();
  }
  function renderTextPos() {
    const b = $('vmTextPosReset');
    if (b) b.disabled = !state.textPos;
  }

  function renderIdle() {
    if (playing || !surahs.length) return;
    sizeCanvas();
    if (isLong()) { long.drawStill(ctx); return; }
    renderFrame(ctx, canvas.width, canvas.height, 0, null);
  }

  // ---------- playback / export ----------
  function startSources(tl, out, t0) {
    // the segments' own audio, and a sound of the whole video (a recitation under own words)
    return tl.items.concat(tl.audio || []).filter(it => it.buffer).map(it => {
      const src = audioCtx().createBufferSource();
      src.buffer = it.buffer;
      out.forEach(node => src.connect(node));
      // The user's own recording: play just this ayah's slice of it.
      if (it.offset != null) src.start(t0 + it.start, it.offset, it.dur);
      else src.start(t0 + it.start);
      return src;
    });
  }

  // ---------- forward-then-backward looping of the background video ----------
  const ppSrc = f => BG_DIR + encodeURI(f.replace(/\.(mp4|webm)$/i, '.pp.mp4'));
  const pct = p => { const n = String(Math.round(Math.max(0, Math.min(1, p)) * 100)); return arabicNames() ? arDigits(n) : n; };
  // Starts making the forward-and-back clip of a video the user added (or takes it from the cache).
  function loopFor(id, file, v) {
    if (!window.PingPong || !PingPong.supported()) return;
    const job = { id, cancelled: false, done: false, pending: null, p: 0, report: null, promise: null };
    loopJob = job;
    let shown = '';
    job.promise = PingPong.get(bgSrc(file), file, {
      onProgress: p => {
        job.p = p;
        if (job.report) job.report(p);
        else if (!busy && !job.cancelled && p < 1) { shown = tr('vm_loop_preparing', { p: pct(p) }); setStatus(shown); }
      },
      isCancelled: () => job.cancelled || state.bg !== id,
    }).then(r => {
      if (r && !job.cancelled && state.bg === id && bgVideo === v) { job.pending = r.blob; applyLoop(job); }
    }).catch(e => console.warn('[video-maker] loop failed', e)).finally(() => {
      job.done = true;
      if (shown && $('vmStatus').textContent === shown) setStatus('');
    });
  }
  // Swaps in the finished clip, unless something is playing (it waits for the next stop / start).
  function applyLoop(job) {
    const v = bgVideo;
    if (!job || !job.pending || !v || state.bg !== job.id || playing) return false;
    const old = v.__ppUrl;
    v.__ppUrl = URL.createObjectURL(job.pending);
    job.pending = null;
    v.src = v.__ppUrl;                 // 'loadeddata' shows the idle still again
    v.load();
    if (old) URL.revokeObjectURL(old);
    return true;
  }
  // An export records the seamless clip: it waits for it (once, a few seconds), and can be cancelled.
  async function waitLoop() {
    const job = loopJob;
    if (!job || job.cancelled || state.bg !== job.id) return true;
    if (!job.done) {
      let abort = false;
      cancelExport = () => { abort = true; };
      const say = p => setStatus(tr('vm_loop_wait', { p: pct(p) }));
      job.report = say;
      say(job.p);
      await new Promise(resolve => {
        const t = setInterval(() => { if (abort) { clearInterval(t); resolve(); } }, 150);
        job.promise.then(() => { clearInterval(t); resolve(); });
      });
      job.report = null;
      cancelExport = null;
      if (abort) { setStatus(''); return false; }
      setStatus('');
    }
    applyLoop(job);
    if (bgVideo && bgVideo.readyState < 2) await new Promise(r => { bgVideo.addEventListener('loadeddata', r, { once: true }); setTimeout(r, 4000); });
    return true;
  }

  // The video loops on its own; each tick just draws whatever frame is current.
  // Resolves once frames are actually flowing (or after 3 s) so a recording
  // never opens on a blank background.
  function startBgVideo() {
    const v = bgVideo;
    if (!v || !state.bg.startsWith('v:') || slideIds().length) return Promise.resolve();
    if (loopJob && loopJob.pending) applyLoop(loopJob);       // a clip finished while something played
    return new Promise(resolve => {
      const done = () => { clearTimeout(timer); v.removeEventListener('playing', done); resolve(); };
      const timer = setTimeout(done, 3000);
      v.addEventListener('playing', done);
      if (v.currentTime > 0) v.currentTime = 0;
      v.play().catch(done);
    });
  }
  function stopBgVideo() {
    if (bgVideo) bgVideo.pause();
  }

  function stopPlayback() {
    stopBgVideo();
    if (!playing) return;
    cancelAnimationFrame(playing.raf);
    if (playing.ctl) playing.ctl.stop();
    playing.sources.forEach(s => { try { s.stop(); } catch (e) { /* not started */ } });
    if (playing.dispose) setTimeout(playing.dispose, 50);
    const wasListening = !!playing.listen;
    playing = null;
    if (loopJob && loopJob.pending) applyLoop(loopJob);
    if (wasListening && fxUi) fxUi.render();
    setBadge('');
    updatePreviewBtn();
    renderIdle();
  }

  function updatePreviewBtn() {
    const on = playing && !playing.export;
    $('vmPreviewIcon').textContent = on ? '■' : '▶';
    $('vmPreviewLabel').textContent = tr(on ? 'vm_stop' : 'vm_preview');
    $('vmStagePlay').hidden = !!playing;
    if (stickers) stickers.placeBox();
    if (!playing) setStageProgress(0);
  }
  function setStageProgress(p) { $('vmStageBar').style.width = (p * 100).toFixed(2) + '%'; }

  // "Al-Baqarah · 1–7 · 9:16" under the preview.
  function updateSummary() {
    const s = surahObj();
    if (!s) return;
    if (isKText()) {
      const n = segments().length;
      const fmt = { story: '9:16', square: '1:1', wide: '16:9' }[state.format];
      const num = x => (arabicNames() ? arDigits(x) : String(x));
      const durKey = durationKey();
      $('vmSummary').textContent = tr('vm_mode_khatira') + ' · ' + tr(n === 1 ? 'vm_kt_count_1' : n === 2 ? 'vm_kt_count_2' : n >= 11 ? 'vm_kt_count_many' : 'vm_kt_count', { n: num(n) }) + ' · ' + fmt +
        (durFor && durFor === durKey ? ' · ' + fmtDur(durTotal) : '');
      return;
    }
    const num = n => (arabicNames() ? arDigits(n) : String(n));
    const range = state.from === state.to ? num(state.from) : num(state.from) + '–' + num(state.to);
    const name = arabicNames() ? surahPlain(s) : surahLatin(s);
    const fmt = isLong() ? '16:9 · 1080p' : { story: '9:16', square: '1:1', wide: '16:9' }[state.format];
    const durKey = (isLong() ? 'L|' : '') + durationKey();
    $('vmSummary').textContent = name + ' · ' + range + ' · ' + fmt +
      (durFor && durFor === durKey ? ' · ' + (durApprox ? '≈ ' : '') + fmtDur(durTotal) : '');
  }

  // Locks every control while exporting — a mid-recording change would alter the clip.
  let busy = false;
  function setBusy(on) {
    busy = on;
    $('vmExport').disabled = on;
    $('vmPreview').hidden = on;
    document.querySelectorAll('.controls-col input, .controls-col select, .controls-col button:not([role="tab"]), #vmModeTabs button').forEach(el => { el.disabled = on; });
    if (!on) $('vmCancel').hidden = true;
  }

  async function loadTimelineWithUi() {
    setStatus(tr('vm_loading'));
    setProgress(0);
    try {
      const tl = await buildTimeline(p => setProgress(p));
      setStatus('');
      setProgress(null);
      return tl;
    } catch (e) {
      console.warn('[video-maker] audio load failed', e);
      setProgress(null);
      setStatus(own.active() ? tr('vm_own_bad') : tr('vm_err_audio'), true);
      return null;
    }
  }

  async function togglePreview() {
    if (!playing) flushKTexts();
    if (playing) { stopPlayback(); return; }
    const ac = audioCtx();
    ac.resume();   // must happen inside the tap, before any await (iOS)
    if (isLong()) { previewLong(); return; }
    const tl = await loadTimelineWithUi();
    if (!tl || playing) return;
    sizeCanvas();
    rollMove();
    await ensureSlideImages();
    await startBgVideo();
    if (playing) return;
    const route = await fxRoute([ac.destination]);
    if (playing) { route.dispose(); return; }
    const t0 = ac.currentTime + 0.1;
    playing = { sources: startSources(tl, route.outs, t0), t0, raf: 0, export: false, dispose: route.dispose };
    updatePreviewBtn();
    const tick = () => {
      if (!playing) return;
      const t = ac.currentTime - playing.t0;
      renderFrame(ctx, canvas.width, canvas.height, Math.max(0, t), tl);
      previewT = Math.min(tl.total, Math.max(0, t));
      setStageProgress(clamp01(t / tl.total));
      if (t >= tl.total) { stopPlayback(); return; }
      playing.raf = requestAnimationFrame(tick);
    };
    tick();
  }

  // Long mode streams the recitation ayah by ayah instead of loading it all first.
  async function previewLong() {
    sizeCanvas();
    await long.ensureAssets();
    if (playing) return;
    setStatus('');
    const ctl = long.play({
      c: ctx,
      outputs: [audioCtx().destination],
      onTick: (t, total) => { if (total) setStageProgress(clamp01(t / total)); },
      onEnd: () => stopPlayback(),
      onError: e => { console.warn('[video-maker] audio load failed', e); stopPlayback(); setStatus(tr('vm_err_audio'), true); },
    });
    playing = { sources: [], ctl, raf: 0, export: false };
    updatePreviewBtn();
  }

  // ---------- audio effects (own recording) ----------
  const fxActive = () => own.active() && !!window.AudioFx && AudioFx.active(state.fx);
  // Where sources connect: straight to `outs`, or into the effects chain that feeds them.
  async function fxRoute(outs) {
    if (!fxActive()) return { outs, dispose() {} };
    const chain = await AudioFx.build(audioCtx(), state.fx, own.levels());
    outs.forEach(n => chain.output.connect(n));
    return { outs: [chain.input], dispose: chain.dispose };
  }
  const listening = () => !!(playing && playing.listen);
  // «استمع إلى المؤثرات»: a few seconds of the recording through the current effects.
  async function listenFx(from) {
    if (listening() && from == null) { stopPlayback(); return; }
    stopPlayback();
    const ac = audioCtx();
    ac.resume();
    let p;
    try { p = await own.prepare(); } catch (e) { setStatus(tr('vm_own_bad'), true); return; }
    const route = await fxRoute([ac.destination]);
    if (playing) { route.dispose(); return; }
    const start = from != null ? from : p.entry.m[0];
    const len = Math.max(0.5, Math.min(12, p.entry.end - start));
    const src = ac.createBufferSource();
    src.buffer = p.audio.buffer;
    route.outs.forEach(n => src.connect(n));
    const at = ac.currentTime + 0.05;
    src.start(at, start, len);
    playing = { sources: [src], t0: at, raf: 0, export: false, listen: true, from: start, dispose: route.dispose };
    src.onended = () => { if (playing && playing.sources[0] === src) stopPlayback(); };
    if (fxUi) fxUi.render();
  }
  // A setting changed: keep listening (from where it was) with the new sound; a
  // running preview restarts with it.
  function fxChanged() {
    saveSettings();
    if (listening()) {
      const pos = playing.from + (audioCtx().currentTime - playing.t0);
      listenFx(Math.min(pos, own.entryNow() ? own.entryNow().end - 0.5 : pos));
      return;
    }
    if (playing && !playing.export) stopPlayback();
    if (long) long.invalidate();
  }
  // A new take from the recorder: the voice polish is switched on for it (raw phone
  // recordings gain the most), unless the user has already set the effects themselves.
  function recorded() {
    if (!window.AudioFx || !own.active() || state.fx.touched) return;
    state.fx.on = true;
    state.fx.polish.on = true;
    saveSettings();
    if (fxUi) fxUi.render();
    setStatus(tr('vm_fx_auto_polish'));
  }

  function pickMime() {
    if (!window.MediaRecorder) return null;
    const list = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4;codecs=avc1,mp4a',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    return list.find(m => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || null;
  }

  let cancelExport = null;

  async function exportLong() {
    stopPlayback();
    const ac = audioCtx();
    ac.resume();
    closeResult();
    const cfgs = await long.fastConfigs();
    const mime = cfgs ? null : pickMime();
    if (!cfgs && (!mime || !canvas.captureStream)) { setStatus(tr('vm_err_unsupported'), true); return; }
    setBusy(true);
    $('vmCancel').hidden = false;
    let cancelled = false;
    cancelExport = () => { cancelled = true; };
    let wakeLock = null;
    try { if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* optional */ }
    sizeCanvas();
    setBadge(' ', true);
    setProgress(0);
    setStatus(cfgs ? '' : tr('vm_long_slow'));
    const num = n => (arabicNames() ? arDigits(n) : String(n));
    const onProgress = (p, i, n) => {
      setProgress(p);
      setStageProgress(p);
      $('vmBadge').textContent = Math.round(p * 100) + '%';
      if (cfgs) setStatus(tr('vm_long_progress', { p: num(Math.round(p * 100)), i: num(i), n: num(n) }));
    };
    let out = null;
    try {
      await long.ensureAssets();
      if (cfgs) {
        out = await long.exportFast(cfgs, {
          onProgress,
          isCancelled: () => cancelled,
          // Shows how far the export has got without slowing it down.
          onPreview: cv => ctx.drawImage(cv, 0, 0, canvas.width, canvas.height),
        });
      } else {
        playing = { sources: [], raf: 0, export: true };
        out = await long.exportRealtime({ canvas, mime, onProgress, isCancelled: () => cancelled });
      }
    } catch (e) {
      console.warn('[video-maker] long export failed', e);
      out = null;
      if (!cancelled) setStatus(/HTTP|fetch|network|decode/i.test(String(e && e.message)) ? tr('vm_err_audio') : tr('vm_err_encode'), true);
      cancelled = true;
    }
    if (wakeLock) wakeLock.release().catch(() => {});
    cancelExport = null;
    playing = null;
    setBusy(false);
    setBadge('');
    setProgress(null);
    setStageProgress(0);
    renderIdle();
    if (!out) { if (!$('vmStatus').classList.contains('error')) setStatus(''); return; }
    let blob = out.blob;
    if (!out.fast && out.type.includes('mp4') && window.Mp4FastStart) {
      try {
        const fixed = Mp4FastStart.defragment(await blob.arrayBuffer());
        if (fixed) blob = new Blob([fixed], { type: 'video/mp4' });
      } catch (e) { console.warn('[video-maker] MP4 remux failed, keeping original', e); }
    }
    showResult(blob, out.type);
  }

  async function exportVideo() {
    flushKTexts();
    if (isLong()) { exportLong(); return; }
    const mime = pickMime();
    if (!mime || !canvas.captureStream) { setStatus(tr('vm_err_unsupported'), true); return; }
    stopPlayback();
    const ac = audioCtx();
    ac.resume();
    closeResult();
    setBusy(true);
    $('vmCancel').hidden = false;
    const tl = await loadTimelineWithUi();
    if (!tl) { setBusy(false); return; }
    if (!(await waitLoop())) { setBusy(false); return; }

    let wakeLock = null;
    try { if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* optional */ }

    sizeCanvas();
    rollMove();
    await ensureSlideImages();
    renderFrame(ctx, canvas.width, canvas.height, 0, tl);
    const dest = ac.createMediaStreamDestination();
    const stream = new MediaStream([
      ...canvas.captureStream(FPS).getVideoTracks(),
      ...dest.stream.getAudioTracks(),
    ]);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8000000, audioBitsPerSecond: 128000 });
    const chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise(res => { rec.onstop = res; });
    let cancelled = false;
    cancelExport = () => { cancelled = true; };

    await startBgVideo();
    // Also route to the speakers so the user hears what is being recorded.
    const route = await fxRoute([dest, ac.destination]);
    rec.start(1000);
    const t0 = ac.currentTime + 0.15;
    playing = { sources: startSources(tl, route.outs, t0), t0, raf: 0, export: true, dispose: route.dispose };
    setBadge(' ', true);
    setStatus(tr('vm_keep_open'));
    setProgress(0);

    await new Promise(resolve => {
      const tick = () => {
        const t = ac.currentTime - t0;
        renderFrame(ctx, canvas.width, canvas.height, Math.max(0, t), tl);
        setProgress(clamp01(t / tl.total));
        setStageProgress(clamp01(t / tl.total));
        $('vmBadge').textContent = Math.round(clamp01(t / tl.total) * 100) + '%';
        if (cancelled || t >= tl.total) { resolve(); return; }
        const id = requestAnimationFrame(tick);
        if (playing) playing.raf = id;
      };
      tick();
    });

    rec.stop();
    await stopped;
    stream.getTracks().forEach(tk => tk.stop());
    if (wakeLock) wakeLock.release().catch(() => {});
    cancelExport = null;
    stopPlayback();
    setBusy(false);
    setProgress(null);

    if (cancelled) { setStatus(''); return; }
    const type = (rec.mimeType || mime).split(';')[0];
    let blob = new Blob(chunks, { type });
    // MediaRecorder MP4 is fragmented with a 0/partial duration in the header,
    // so galleries and WhatsApp show ~3 s for a 1-minute clip. Rewrite it into
    // a regular fast-start MP4 (lossless; js/mp4-faststart.js).
    if (type.includes('mp4') && window.Mp4FastStart) {
      try {
        const fixed = Mp4FastStart.defragment(await blob.arrayBuffer());
        if (fixed) blob = new Blob([fixed], { type: 'video/mp4' });
      } catch (e) { console.warn('[video-maker] MP4 remux failed, keeping original', e); }
    }
    showResult(blob, type);
  }

  let resultUrl = null;
  function showResult(blob, type) {
    const ext = type.includes('mp4') ? 'mp4' : 'webm';
    const stamp = (() => { const d = new Date(), p2 = n => String(n).padStart(2, '0'); return d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '-' + p2(d.getHours()) + p2(d.getMinutes()); })();
    const name = isKText() ? `khatira-${stamp}.${ext}` : `quran-${isLong() ? 'long-' : isKhatira() ? 'khatira-' : ''}${pad3(state.surah)}-${state.from}-${state.to}.${ext}`;
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = URL.createObjectURL(blob);
    $('vmVideo').src = resultUrl;
    const dl = $('vmDownload');
    dl.href = resultUrl;
    dl.download = name;
    $('vmFormatNote').textContent = ext === 'webm' ? tr('vm_webm_note') : '';
    const file = new File([blob], name, { type });
    const s = surahObj();
    // Shared alongside the clip (WhatsApp/Telegram use it as the caption).
    const text = (arabicNames() ? 'سورة ' + surahPlain(s) : 'Surah ' + surahLatin(s)) + ' (' + state.from +
      (state.to !== state.from ? '–' + state.to : '') + ')\n\n' + tr('vm_share_text') +
      '\nGoogle Play: ' + PLAY_URL + '\n' + tr('vm_share_page') + ': ' + PAGE_URL;
    const shareBtn = $('vmShare');
    const canShare = navigator.canShare && navigator.canShare({ files: [file], text });
    shareBtn.hidden = !canShare;
    shareBtn.onclick = () => {
      navigator.share({ files: [file], title: tr('vm_title'), text }).catch(() => { /* user dismissed */ });
    };
    $('vmShareNote').textContent = PLAY_URL;
    openResult();
    setStatus(tr('vm_done'));
  }

  function openResult() {
    $('vmSheetOverlay').hidden = false;
    $('vmResult').hidden = false;
    miniUpdate();
    focusDialog($('vmResult'));
    if (window.BackClose) BackClose.opened(closeResult);
  }
  function closeResult() {
    if ($('vmResult').hidden) return;
    // No-op when Android back already popped the entry (BackClose pops first).
    if (window.BackClose) BackClose.closed();
    $('vmVideo').pause();
    $('vmResult').hidden = true;
    miniUpdate();
    $('vmSheetOverlay').hidden = true;
    restoreFocus();
  }

  // ---------- controls ----------
  function fillSurahs() {
    const sel = $('vmSurah');
    sel.innerHTML = '';
    surahs.forEach(s => {
      const o = document.createElement('option');
      o.value = s.n;
      o.textContent = s.n + '. ' + (arabicNames() ? surahPlain(s) : surahLatin(s));
      sel.appendChild(o);
    });
    sel.value = state.surah;
    renderPickerButtons();
  }

  function fillReciters() {
    const sel = $('vmReciter');
    sel.innerHTML = '';
    STYLES.forEach(style => {
      const g = document.createElement('optgroup');
      g.label = tr('takrar_style_' + style);
      reciters.filter(r => r.style === style).forEach(r => {
        const o = document.createElement('option');
        o.value = r.id;
        o.textContent = reciterName(r);
        g.appendChild(o);
      });
      sel.appendChild(g);
    });
    if (!reciters.some(r => r.id === state.reciter)) state.reciter = reciters[0].id;
    sel.value = state.reciter;
    renderPickerButtons();
  }

  // ---------- surah / reciter sheets (same look and behaviour as takrar.html) ----------
  const esc = str => String(str).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
  // Search ignores harakat and alef/ya/ta-marbuta variants (takrar.html's normalize()).
  const normalize = str => (str || '').replace(/[\u064B-\u065F\u0670]/g, '').replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ـ/g, '').toLowerCase();
  let pickSheet = null;     // 'Surah' | 'Reciter' while a sheet is open
  let reciterFilter = 'all';

  function surahLabel(s) { return arabicNames() ? surahPlain(s) : surahLatin(s); }
  function reciterHtml(r) {
    return '<span class="rc-text"><span class="rc-name">' + esc(reciterName(r)) + '</span>' +
      '<span class="rc-style">' + esc(tr('takrar_style_' + r.style)) + '</span></span>';
  }
  function renderPickerButtons() {
    const s = surahObj();
    if (s) $('vmSurahLabel').innerHTML = '<span class="item-num">' + s.n + '.</span>' + esc(surahLabel(s));
    const r = reciterObj();
    if (r) $('vmReciterLabel').innerHTML = reciterHtml(r);
  }

  function renderSurahList() {
    const q = normalize($('vmSurahSearch').value.trim());
    const num = parseInt(q, 10);
    const rows = surahs.filter(s => !q || s.n === num ||
      normalize(surahPlain(s)).includes(q) || normalize(surahLatin(s)).includes(q));
    $('vmSurahList').innerHTML = rows.map(s =>
      '<button type="button" class="sheet-item' + (s.n === state.surah ? ' selected' : '') + '" data-surah="' + s.n + '">' +
      '<span class="item-num">' + s.n + '.</span>' + esc(surahLabel(s)) + '</button>'
    ).join('') || '<div class="sheet-empty">' + esc(tr('takrar_no_results')) + '</div>';
  }
  function renderReciterList() {
    const q = normalize($('vmReciterSearch').value.trim());
    document.querySelectorAll('#vmReciterFilter .filter-chip').forEach(b => b.classList.toggle('active', b.dataset.style === reciterFilter));
    if (isKhatira()) {            // only the reciters with word timings
      const rows = Khatira.RECITERS.filter(r => (reciterFilter === 'all' || r.style === reciterFilter) &&
        (!q || normalize(r.name).includes(q) || r.en.toLowerCase().includes(q)));
      $('vmReciterList').innerHTML = rows.map(r =>
        '<button type="button" class="sheet-item' + (r.id === state.kReciter ? ' selected' : '') + '" data-kreciter="' + r.id + '">' +
        reciterHtml(r) + '</button>'
      ).join('') || '<div class="sheet-empty">' + esc(tr('takrar_no_results')) + '</div>';
      return;
    }
    const rows = reciters.filter(r => (reciterFilter === 'all' || r.style === reciterFilter) &&
      (!q || normalize(r.name).includes(q) || (r.en + ' ' + r.folder).toLowerCase().includes(q)));
    $('vmReciterList').innerHTML = rows.map(r =>
      '<button type="button" class="sheet-item' + (r.id === state.reciter ? ' selected' : '') + '" data-reciter="' + esc(r.id) + '">' +
      reciterHtml(r) + '</button>'
    ).join('') || '<div class="sheet-empty">' + esc(tr('takrar_no_results')) + '</div>';
  }

  // ---------- dialogs (the bottom sheets and the result sheet) ----------
  // Focus moves into a sheet when it opens (to its title, so the phone keyboard doesn't pop up),
  // Tab stays inside it, Escape closes it, and focus goes back to what opened it.
  let dialogOpener = null;
  function focusDialog(sheet) {
    const a = document.activeElement;
    dialogOpener = a && a !== document.body && !sheet.contains(a) ? a : null;
    const title = sheet.querySelector('.sheet-header h2, .sheet-title');
    if (!title) return;
    title.tabIndex = -1;
    requestAnimationFrame(() => { if (sheet.classList.contains('active') || !sheet.hidden) title.focus({ preventScroll: true }); });
  }
  function restoreFocus() {
    const o = dialogOpener;
    dialogOpener = null;
    if (o && document.contains(o) && !o.closest('[hidden]')) o.focus({ preventScroll: true });
    else if (document.activeElement) document.activeElement.blur();
  }
  function openDialog() {
    if (pickSheet) return $('vm' + pickSheet + 'Sheet');
    return $('vmResult').hidden ? null : $('vmResult');
  }
  function trapTab(e, sheet) {
    const items = [...sheet.querySelectorAll('button, [href], input, select, textarea, video[controls], summary, [tabindex]:not([tabindex="-1"])')]
      .filter(el => !el.disabled && !el.closest('[hidden]') && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    const inside = sheet.contains(document.activeElement);
    if (e.shiftKey && (!inside || document.activeElement === first || document.activeElement === sheet.querySelector('[tabindex="-1"]'))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (!inside || document.activeElement === last)) { e.preventDefault(); first.focus(); }
  }

  // ---------- section tabs ----------
  // The settings come in four parts (ayat, audio, look, text), one shown at a time and picked
  // in any order. The create bar stays in place whichever is open.
  const SECS = ['ayat', 'audio', 'look', 'text'];
  let secNow = 'ayat';
  function showSection(name, opts) {
    if (!SECS.includes(name)) return;
    secNow = name;
    document.querySelectorAll('#vmSecTabs [role="tab"]').forEach(t => {
      const on = t.dataset.sec === name;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
    document.querySelectorAll('.controls-col > section[data-sec]').forEach(sec => sec.classList.toggle('sec-off', sec.dataset.sec !== name));
    // If the bar is stuck at the top, start the new part right under it (not halfway down).
    const bar = $('vmSecTabs');
    if (opts && opts.scroll && bar.getBoundingClientRect().top <= parseFloat(getComputedStyle(bar).top) + 1) {
      const top = bar.parentElement.getBoundingClientRect().top + scrollY - 6;
      scrollTo({ top, behavior: 'auto' });
    }
    if (opts && opts.focus) $('vmTab-' + name).focus();
  }
  function bindSections() {
    document.querySelectorAll('#vmSecTabs [role="tab"]').forEach(t => { t.onclick = () => showSection(t.dataset.sec, { scroll: true }); });
    $('vmSecTabs').addEventListener('keydown', e => {
      const i = SECS.indexOf(secNow);
      const rtl = document.documentElement.dir === 'rtl';
      let j = -1;
      if (e.key === 'ArrowLeft') j = rtl ? i + 1 : i - 1;
      else if (e.key === 'ArrowRight') j = rtl ? i - 1 : i + 1;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = SECS.length - 1;
      if (j < 0 && e.key !== 'Home') return;
      e.preventDefault();
      showSection(SECS[(j + SECS.length) % SECS.length], { scroll: true, focus: true });
    });
    showSection('ayat');
  }

  // ---------- settings sheet + theme button (header) ----------
  function renderSettings() {
    const lang = window.I18n ? I18n.getLang() : 'ar';
    const names = { ar: 'العربية', en: 'English', ckb: 'کوردی', tr: 'Türkçe', ur: 'اردو' };
    $('vmLangSub').textContent = names[lang] || lang;
    $('vmPingPong').checked = state.pingPong;
  }
  function markThemeBtn() {
    const t = window.ThemeManager ? ThemeManager.get() : 'light';
    $('vmThemeBtn').setAttribute('data-t', ['light', 'dark', 'sepia'].includes(t) ? t : 'light');
  }

  function openPick(kind) {
    if (pickSheet) return;
    pickSheet = kind;
    const searchBox = $('vm' + kind + 'Search');
    if (searchBox) searchBox.value = '';
    if (kind === 'Sync') own.openSync();
    else if (kind === 'Rec') recorder.open();
    else if (kind === 'Surah') renderSurahList();
    else if (kind === 'Popular') renderPopularList();
    else if (kind === 'Search') renderSearchList();
    else if (kind === 'Settings') renderSettings();
    else renderReciterList();
    $('vmPickOverlay').classList.add('active');
    $('vm' + kind + 'Sheet').classList.add('active');
    focusDialog($('vm' + kind + 'Sheet'));
    if (window.BackClose) BackClose.opened(closePick);
    // Long lists jump to the current choice; the popular sheet opens at the top
    // so its search box and category chips stay in view.
    const list = $('vm' + kind + 'List');
    const sel = kind !== 'Popular' && kind !== 'Sync' && list && list.querySelector('.selected');
    if (sel) sel.scrollIntoView({ block: 'center' });
  }
  // ---------- "✦ Popular" quick picks (js/popular-ayat.js) ----------
  const POP_CATS = ['famous', 'surahs', 'duas', 'comfort'];
  let popularCat = 'all';
  const popularList = () => (window.POPULAR_AYAT || []).filter(p => surahs[p.s - 1] && p.to <= surahs[p.s - 1].ayat.length);
  const popTitle = p => (arabicNames() ? p.ar : p.en);
  function popRange(p) {
    const num = n => (arabicNames() ? arDigits(n) : String(n));
    return p.from === p.to ? num(p.from) : num(p.from) + '–' + num(p.to);
  }
  // First words of the opening ayah, so the row shows exactly what will be recited.
  function popOpening(p) {
    const words = (surahs[p.s - 1].ayat[p.from - 1] || '').replace(/^۞\s*/, '').split(/\s+/).filter(Boolean);
    return words.slice(0, 6).join(' ') + (words.length > 6 ? ' …' : '');
  }
  function popRowHtml(p) {
    const sel = p.s === state.surah && p.from === state.from && p.to === state.to;
    return '<button type="button" class="sheet-item pop-row' + (sel ? ' selected' : '') + '" data-pop="' +
      p.s + ':' + p.from + ':' + p.to + '">' +
      '<span class="pop-title">' + esc(popTitle(p)) + '</span>' +
      '<span class="pop-meta">' + esc(surahLabel(surahs[p.s - 1])) + ' · ' + popRange(p) + '</span>' +
      '<span class="pop-text">' + esc(popOpening(p)) + '</span></button>';
  }
  function renderPopularList() {
    const q = normalize($('vmPopularSearch').value.trim());
    document.querySelectorAll('#vmPopularFilter .filter-chip').forEach(b => b.classList.toggle('active', b.dataset.cat === popularCat));
    const rows = popularList().filter(p => (popularCat === 'all' || p.cat === popularCat) &&
      (!q || normalize(p.ar).includes(q) || p.en.toLowerCase().includes(q) ||
        normalize(surahPlain(surahs[p.s - 1])).includes(q) || normalize(surahs[p.s - 1].ayat[p.from - 1]).includes(q)));
    let html;
    if (popularCat === 'all' && !q) {
      // Arranged by category with a heading per group.
      html = POP_CATS.map(cat => {
        const group = rows.filter(p => p.cat === cat);
        return group.length ? '<div class="sheet-group-title">' + esc(tr('vm_cat_' + cat)) + '</div>' + group.map(popRowHtml).join('') : '';
      }).join('');
    } else {
      html = rows.map(popRowHtml).join('');
    }
    $('vmPopularList').innerHTML = html || '<div class="sheet-empty">' + esc(tr('takrar_no_results')) + '</div>';
  }
  // ---------- 🔎 search the whole Quran (local text, works offline) ----------
  const SEARCH_MAX = 60;
  let searchIndex = null;
  const searchNorm = t => normalize(bareLetters(t || '')).replace(/[\u06D6-\u06ED]/g, '').replace(/\s+/g, ' ').trim();
  function buildSearchIndex() {
    searchIndex = [];
    for (const s of surahs) s.ayat.forEach((t, i) => { if (t) searchIndex.push({ s: s.n, a: i + 1, t, n: searchNorm(t) }); });
  }
  function renderSearchList() {
    const q = searchNorm($('vmSearchSearch').value);
    const box = $('vmSearchList');
    if (!q) { box.innerHTML = '<div class="sheet-empty">' + esc(tr('vm_search_quran_hint')) + '</div>'; return; }
    if (!searchIndex) buildSearchIndex();
    const hits = [];
    let total = 0;
    for (const r of searchIndex) {
      if (r.n.includes(q)) { total++; if (hits.length < SEARCH_MAX) hits.push(r); }
    }
    if (!hits.length) { box.innerHTML = '<div class="sheet-empty">' + esc(tr('takrar_no_results')) + '</div>'; return; }
    const num = n => (arabicNames() ? arDigits(n) : String(n));
    box.innerHTML = hits.map(r => {
      const words = r.t.split(/\s+/);
      const text = words.map(w => esc(w)).map((w, i) => (searchNorm(words[i]) && q.split(' ').some(p => p && searchNorm(words[i]).includes(p))) ? '<mark class="search-hl">' + w + '</mark>' : w).join(' ');
      return '<button type="button" class="sheet-item pop-row" data-pop="' + r.s + ':' + r.a + ':' + r.a + '">' +
        '<span class="pop-meta">' + esc(surahLabel(surahs[r.s - 1])) + ' · ' + num(r.a) + '</span>' +
        '<span class="pop-text" style="white-space:normal;">' + text + '</span></button>';
    }).join('') + (total > hits.length ? '<div class="sheet-empty">' + esc(total + ' / ' + hits.length) + '</div>' : '');
  }
  function choosePopular(key) {
    const [s, from, to] = key.split(':').map(Number);
    closePick();
    state.surah = s;
    $('vmSurah').value = s;
    $('vmFrom').value = from;
    $('vmTo').value = to;
    clampRange('from');
    renderPickerButtons();
    onChange();
  }

  function closePick() {
    if (!pickSheet) return;
    if (window.BackClose) BackClose.closed();
    $('vmPickOverlay').classList.remove('active');
    $('vm' + pickSheet + 'Sheet').classList.remove('active', 'searching');
    restoreFocus();
    const was = pickSheet;
    pickSheet = null;
    if (was === 'Sync') own.closeSync();
    else if (was === 'Rec' && recorder) recorder.close();
  }
  // Picking writes the hidden <select> and fires its change handler, so all
  // range/summary/preview logic stays in one place.
  function choose(selectId, value) {
    const sel = $(selectId);
    sel.value = value;
    closePick();
    sel.dispatchEvent(new Event('change'));
    renderPickerButtons();
  }

  // Keep sheets above the on-screen keyboard and let a sheet grow while its
  // search box is focused (same approach as takrar.html).
  function syncViewport() {
    const vv = window.visualViewport;
    if (!vv) return;
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty('--vvh', vv.height + 'px');
    document.documentElement.style.setProperty('--kb', kb + 'px');
  }

  function bindPickers() {
    $('vmSurahBtn').onclick = () => openPick('Surah');
    $('vmReciterBtn').onclick = () => openPick('Reciter');
    $('vmPopularBtn').onclick = () => openPick('Popular');
    $('vmSearchBtn').onclick = () => openPick('Search');
    let searchTimer = null;
    $('vmSearchSearch').oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(renderSearchList, 150); };
    $('vmSearchList').onclick = e => { const b = e.target.closest('[data-pop]'); if (b) choosePopular(b.dataset.pop); };
    $('vmPopularSearch').oninput = renderPopularList;
    $('vmPopularList').onclick = e => { const b = e.target.closest('[data-pop]'); if (b) choosePopular(b.dataset.pop); };
    document.querySelectorAll('#vmPopularFilter .filter-chip').forEach(b => {
      b.onclick = () => { popularCat = b.dataset.cat; renderPopularList(); };
    });
    $('vmPickOverlay').onclick = closePick;
    document.querySelectorAll('[data-close-pick]').forEach(b => { b.onclick = closePick; });
    $('vmSurahSearch').oninput = renderSurahList;
    $('vmReciterSearch').oninput = renderReciterList;
    $('vmSurahList').onclick = e => { const b = e.target.closest('[data-surah]'); if (b) choose('vmSurah', b.dataset.surah); };
    $('vmReciterList').onclick = e => {
      const k = e.target.closest('[data-kreciter]');
      if (k) { state.kReciter = +k.dataset.kreciter; closePick(); renderPickerButtons(); onChange(); return; }
      const b = e.target.closest('[data-reciter]');
      if (b) choose('vmReciter', b.dataset.reciter);
    };
    // «خاطرة»: how the text shows
    document.querySelectorAll('#vmKStyle [data-ks]').forEach(b => { b.onclick = () => { state.kStyle = b.dataset.ks; markKStyle(); onChange(); }; });
    // «خاطرة»: your own words or ayat, and the text fields
    document.querySelectorAll('#vmKContent [data-kc]').forEach(b => { b.onclick = () => { if (b.dataset.kc !== state.kContent) setKContent(b.dataset.kc); }; });
    $('vmKTextAdd').onclick = () => {
      if (state.kTexts.length >= MAX_KTEXTS) return;
      state.kTexts.push('');
      state.kOpts.push(null);
      renderKTexts();
      saveSettings();
      const last = $('vmKText' + (state.kTexts.length - 1));
      if (last) last.focus();
    };
    // «خاطرة»: a font from the device (the picker's buttons are made by renderKFonts)
    $('vmKFontFile').onchange = e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; addUserFont(f); };
    document.querySelectorAll('#vmReciterFilter .filter-chip').forEach(b => {
      b.onclick = () => { reciterFilter = b.dataset.style; renderReciterList(); };
    });
    document.addEventListener('focusin', e => {
      if (e.target.classList && e.target.classList.contains('sheet-search')) e.target.closest('.bottom-sheet').classList.add('searching');
    });
    document.addEventListener('focusout', e => {
      if (e.target.classList && e.target.classList.contains('sheet-search')) {
        const sheet = e.target.closest('.bottom-sheet');
        setTimeout(() => { if (!sheet.contains(document.activeElement)) sheet.classList.remove('searching'); }, 150);
      }
    });
    if (window.visualViewport) {
      visualViewport.addEventListener('resize', syncViewport);
      visualViewport.addEventListener('scroll', syncViewport);
      syncViewport();
    }
  }

  function fillBackgrounds() {
    const strip = $('vmBgs');
    strip.innerHTML = '';
    let nPic = 0, nVid = 0, nGrad = 0;
    const add = (id, styleBg, isVideo, label) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', label);
      b.className = 'bg-thumb' + (isVideo ? ' is-video' : '') + (state.bg === id ? ' active' : '');
      b.setAttribute('aria-pressed', state.bg === id ? 'true' : 'false');
      b.style.background = styleBg;
      b.style.backgroundSize = 'cover';
      b.style.backgroundPosition = 'center';
      b.dataset.bg = id;
      b.onclick = () => tapBackground(id);
      strip.appendChild(b);
    };
    // "+": add a picture or video from the device.
    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'bg-thumb bg-add';
    plus.title = tr('vm_bg_add');
    plus.setAttribute('aria-label', tr('vm_bg_add'));
    plus.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>' + esc(tr('vm_bg_add_short')) + '</span>';
    plus.onclick = () => $('vmBgFile').click();
    strip.appendChild(plus);
    const cssUrl = u => `url("${String(u).replace(/["\\]/g, '\\$&')}")`;
    // The user's own, newest first, each with a delete control.
    userBgs.forEach(f => {
      const video = isVideoFile(f);
      add((video ? 'v:' : 'i:') + f, cssUrl(bgSrc(video ? thumbFor(f) : f)), video, tr(video ? 'vm_bg_my_video' : 'vm_bg_my_picture'));
      const tile = strip.lastElementChild;
      tile.classList.add('is-user');
      const del = document.createElement('span');
      del.className = 'bg-del';
      del.setAttribute('role', 'button');
      del.setAttribute('aria-label', tr('vm_bg_delete'));
      del.title = tr('vm_bg_delete');
      del.tabIndex = 0;
      del.textContent = '×';
      del.onclick = e => { e.stopPropagation(); deleteUserBg(f); };
      del.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); deleteUserBg(f); } };
      tile.appendChild(del);
    });
    const builtIn = bgImages.filter(f => !isUserBg(f));
    const n = k => (arabicNames() ? arDigits(k) : String(k));
    builtIn.filter(isVideoFile).forEach(f => add('v:' + f, `url("${BG_DIR}${encodeURI(thumbFor(f))}")`, true, tr('vm_bg_video_n', { n: n(++nVid) })));
    builtIn.filter(f => !isVideoFile(f)).forEach(f => add('i:' + f, `url("${BG_DIR}${encodeURI(f)}")`, false, tr('vm_bg_picture_n', { n: n(++nPic) })));
    GRADIENTS.forEach((g, i) => add('g' + i, `linear-gradient(160deg, ${g.stops.join(', ')})`, false, tr('vm_bg_gradient_n', { n: n(++nGrad) })));
  }

  // Order numbers / ✓ on the thumbnails; videos and gradients are dimmed in multi mode.
  function markBackgrounds() {
    const multi = state.multiBg && !isLong();
    const order = multi ? slideIds() : [];
    document.querySelectorAll('#vmBgs .bg-thumb[data-bg]').forEach(b => {
      const n = order.indexOf(b.dataset.bg);
      b.classList.toggle('active', multi ? n >= 0 : b.dataset.bg === (isLong() ? state.tvBg : state.bg));
      b.setAttribute('aria-pressed', b.classList.contains('active') ? 'true' : 'false');
      if (n >= 0) b.dataset.order = n + 1; else delete b.dataset.order;
      // Long mode takes pictures and gradients (a looping clip would undo the fast export).
      b.classList.toggle('off-in-multi', multi ? !b.dataset.bg.startsWith('i:') : isLong() && b.dataset.bg.startsWith('v:'));
    });
  }
  function toggleSlide(id) {
    const i = state.bgs.indexOf(id);
    if (i >= 0) state.bgs.splice(i, 1);
    else if (state.bgs.length >= MAX_SLIDES) { setStatus(tr('vm_max_bgs', { n: MAX_SLIDES })); return; }
    else { state.bgs.push(id); slideImage(id); }
    setStatus('');
    markBackgrounds();
    onChange();
  }
  function setMultiBg(on) {
    state.multiBg = on;
    if (on) {
      // Start the set with the current picture, if it is one.
      if (!state.bgs.length && state.bg.startsWith('i:')) state.bgs = [state.bg];
      if (bgVideo) bgVideo.pause();
      slideIds().forEach(slideImage);
      // Videos come first in the strip but can't be picked here — scroll to the pictures.
      const firstPic = document.querySelector('#vmBgs .bg-thumb[data-bg^="i:"]');
      if (firstPic) firstPic.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    } else if (state.bgs.length) {
      selectBackground(state.bgs[0]);
    }
    markBackgrounds();
    onChange();
  }

  // Thumbnail taps: toggle pictures in multi mode, otherwise pick the single background.
  // (selectBackground itself never toggles — init re-applies the saved single choice.)
  function tapBackground(id) {
    if (isLong()) {
      if (id.startsWith('v:')) return;
      state.tvBg = id;
      long.setBackground(id);
      markBackgrounds();
      onChange();
      return;
    }
    if (state.multiBg) { if (id.startsWith('i:')) toggleSlide(id); return; }
    selectBackground(id);
  }

  function selectBackground(id, reload) {
    if (/^[iv]:/.test(id) && !bgImages.includes(id.slice(2))) id = 'g0';
    if (bgVideo && (state.bg !== id || reload)) {
      if (loopJob) loopJob.cancelled = true;
      bgVideo.pause();
      bgVideo.removeAttribute('src');
      bgVideo.load();   // releases the decoder on mobile
      if (bgVideo.__ppUrl) URL.revokeObjectURL(bgVideo.__ppUrl);
      bgVideo = null;
      bgPoster = null;
    }
    state.bg = id;
    markBackgrounds();
    saveSettings();
    if (id.startsWith('i:')) {
      const img = new Image();
      img.onload = () => { if (state.bg === id) { bgImg = img; renderIdle(); } };
      img.onerror = () => { if (state.bg === id) { bgImg = null; renderIdle(); } };
      img.src = bgSrc(id.slice(2));
      bgImg = null;
    } else if (id.startsWith('v:') && !bgVideo) {
      const v = document.createElement('video');
      v.muted = true;
      v.defaultMuted = true;
      v.loop = true;
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.preload = 'auto';
      // Show a still from half a second in while idle — frame 0 is often a fade from black.
      v.addEventListener('loadeddata', () => { if (state.bg === id && !playing) v.currentTime = 0.5; renderIdle(); });
      v.addEventListener('seeked', renderIdle);
      const file = id.slice(2);
      if (!state.pingPong) {
        v.src = bgSrc(file);                  // the plain loop (the setting is off)
      } else if (isUserBg(file)) {
        v.src = bgSrc(file);
        loopFor(id, file, v);                 // its forward-and-back clip is made in the background
      } else {
        // the shipped forward-and-back clip; without it the original simply loops
        v.src = ppSrc(file);
        v.__pp = true;
        v.addEventListener('error', () => { if (v.__pp) { v.__pp = false; v.src = bgSrc(file); } });
      }
      bgVideo = v;
      const poster = new Image();
      poster.onload = () => { if (state.bg === id) renderIdle(); };
      poster.src = bgSrc(thumbFor(id.slice(2)));
      bgPoster = poster;
    }
    renderIdle();
  }

  function clampRange(changed) {
    const count = surahObj().ayat.length;
    let from = Math.max(1, Math.min(count, parseInt($('vmFrom').value, 10) || 1));
    let to = Math.max(1, Math.min(count, parseInt($('vmTo').value, 10) || from));
    if (to < from) { if (changed === 'from') to = from; else from = to; }
    let msg = '';
    // Long mode: the whole surah (its hint says longer = slower and bigger).
    if (!isLong() && to - from + 1 > MAX_AYAT) {
      if (changed === 'from') to = from + MAX_AYAT - 1; else from = to - MAX_AYAT + 1;
      msg = tr('vm_max_ayat', { n: MAX_AYAT });
    }
    state.from = from; state.to = to;
    $('vmFrom').value = from; $('vmTo').value = to;
    $('vmFrom').max = count; $('vmTo').max = count;
    $('vmBasmalaRow').hidden = !basmalaApplies();
    setStatus(msg);
    updateSummary();
  }

  // A face that loads after a layout was measured (with the fallback's wider or narrower words)
  // would leave wrong gaps between the words: measure again once any font finishes loading.
  function fontsLoaded() {
    layoutCache.clear();
    kSizeCache.clear();
    kLayoutCache.clear();
    if (long && long.invalidate) long.invalidate();
    renderIdle();
  }

  function onChange() {
    layoutCache.clear();
    kSizeCache.clear();
    kLayoutCache.clear();
    markKContent();
    if (long) long.invalidate();
    stopPlayback();
    saveSettings();
    updateSummary();
    updateDuration();
    renderIdle();
    if (own.renderBox) own.renderBox();
    if (fxUi) fxUi.render();
    if (isLong()) refreshTemplateThumbs();
  }

  // ---------- shorts / long video tabs ----------
  // ---------- «خاطرة»: the user's texts ----------
  let kTextTimer = 0;
  // Typing refreshes the preview a moment later; a preview or an export started meanwhile takes
  // the text as it is now (and is not stopped by that refresh).
  function flushKTexts() {
    if (!kTextTimer) return;
    clearTimeout(kTextTimer);
    kTextTimer = 0;
    onChange();
  }
  function renderKTexts() {
    const list = $('vmKTexts');
    if (!list) return;
    list.innerHTML = '';
    const num = x => (arabicNames() ? arDigits(x) : String(x));
    state.kTexts.forEach((t, i) => {
      const row = document.createElement('div');
      row.className = 'kt-row';
      const id = 'vmKText' + i;
      const label = document.createElement('label');
      label.className = 'kt-label';
      label.htmlFor = id;
      label.textContent = tr('vm_kt_label', { i: num(i + 1) });
      const ta = document.createElement('textarea');
      ta.id = id;
      ta.dir = 'auto';
      ta.rows = 2;
      ta.maxLength = MAX_KTEXT;
      ta.placeholder = tr('vm_kt_ph');
      ta.value = t;
      ta.oninput = () => {
        state.kTexts[i] = ta.value.slice(0, MAX_KTEXT);
        saveSettings();
        clearTimeout(kTextTimer);
        kTextTimer = setTimeout(() => { kTextTimer = 0; onChange(); }, 350);   // the preview follows as you type
      };
      row.append(label, ta);
      const o = state.kOpts[i];
      if (o) {
        // what a script set for this text: its time, face and size, with a × to drop them
        const tag = document.createElement('div');
        tag.className = 'kt-opts';
        const txt = document.createElement('span');
        // each part in its own run, so times and numbers read right in Arabic too
        const bit = (t, dir) => { if (txt.childNodes.length) txt.append(' · '); const b = document.createElement('bdi'); if (dir) b.dir = dir; b.textContent = t; txt.appendChild(b); };
        if (o.a != null || o.b != null) bit((o.a != null ? VMScript.clock(o.a) : '…') + ' – ' + (o.b != null ? VMScript.clock(o.b) : '…'), 'ltr');
        if (o.font) bit(tr('vm_kf_' + o.font));
        if (o.size) bit('×' + o.size, 'ltr');
        const x = document.createElement('button');
        x.type = 'button';
        x.className = 'kt-opts-x';
        x.textContent = '×';
        x.setAttribute('aria-label', tr('vm_sc_opts_clear', { i: num(i + 1) }));
        x.title = x.getAttribute('aria-label');
        x.onclick = () => { state.kOpts[i] = null; saveSettings(); renderKTexts(); onChange(); };
        tag.append(txt, x);
        row.appendChild(tag);
      }
      if (state.kTexts.length > 1) {
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'kt-del';
        del.textContent = '×';
        del.setAttribute('aria-label', tr('vm_kt_delete', { i: num(i + 1) }));
        del.title = del.getAttribute('aria-label');
        del.onclick = () => {
          state.kTexts.splice(i, 1);
          state.kOpts.splice(i, 1);
          // stickers that went with a later line move up with it; this line's own go
          if (stickers) {
            state.stickers = state.stickers.filter(st => st.line !== i);
            state.stickers.forEach(st => { if (st.line != null && st.line > i) st.line--; });
            stickers.render();
          }
          renderKTexts(); onChange();
        };
        row.appendChild(del);
      }
      list.appendChild(row);
    });
    $('vmKTextAdd').disabled = state.kTexts.length >= MAX_KTEXTS;
  }
  // ---------- a video script (js/video-script.js): the whole video in one text file ----------
  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  // The template, with the faces and stickers this version has: for the user to give to an AI.
  function scriptTemplate() {
    return VMScript.template({
      lang: lang(),
      stickers: stickers ? stickers.catalog() : [],
      fonts: Khatira.FONTS.filter(f => !f.qpc).map(f => f.id),
    });
  }
  // The video as it is, written as a script (to edit, or keep).
  function currentScript() {
    const rows = [];
    state.kTexts.forEach((t, i) => { if (t.trim()) rows.push({ i, text: t.trim(), o: state.kOpts[i] || {} }); });
    const at = new Map(rows.map((r, n) => [r.i, n]));
    return VMScript.serialize({
      settings: {
        font: /^[a-z]+$/.test(state.kFont) ? state.kFont : null,
        size: state.fontMul !== 1 ? state.fontMul : null,
        style: state.kStyle, color: state.color, format: state.format, name: state.sheikh || null,
        quran: isKQuran() ? { surah: state.surah, from: state.from, to: state.to } : null,
      },
      lines: rows.map(r => ({ text: r.text, a: r.o.a != null ? r.o.a : null, b: r.o.b != null ? r.o.b : null, font: r.o.font, size: r.o.size })),
      stickers: state.stickers.filter(st => st.line == null || at.has(st.line)).map(st => ({
        line: st.line == null ? null : at.get(st.line), slot: st.id ? null : st.slot, id: st.id, fx: st.fx, flip: st.flip, x: st.x, y: st.y, s: st.s,
      })),
    });
  }
  function scriptWarning(w) {
    const k = { quran: 'vm_sc_w_quran', font: 'vm_sc_w_font', size: 'vm_sc_w_size', time: 'vm_sc_w_time', tag: 'vm_sc_w_tag', lines: 'vm_sc_w_lines', stickers: 'vm_sc_w_stickers', long: 'vm_sc_w_long' }[w.code] || 'vm_sc_w_other';
    return tr(k, { v: w.detail, n: /^\d+$/.test(w.detail) ? (arabicNames() ? arDigits(+w.detail) : w.detail) : w.detail });
  }
  // Read a script into the video: «خاطرة» with own words, its texts (with their seconds, faces
  // and sizes), its settings and its stickers. Returns whether it was read.
  function importScript(text) {
    const r = VMScript.parse(text, { ids: stickers ? stickers.ids : [] });
    const warn = $('vmScWarn');
    if (!r.lines.length) { setStatus(tr('vm_sc_empty'), true); warn.hidden = true; return false; }
    if (state.kTexts.some(t => t.trim()) && !confirm(tr('vm_sc_replace'))) return false;
    if (playing) stopPlayback();
    clearTimeout(kTextTimer);
    kTextTimer = 0;
    state.kTexts = r.lines.map(l => l.text);
    state.kOpts = r.lines.map(l => cleanKOpt({ a: l.a, b: l.b, font: l.font, size: l.size }));
    const st = r.settings;
    if (st.font) state.kFont = st.font;
    if (st.size) state.fontMul = st.size;
    if (st.style) state.kStyle = st.style;
    if (st.color) state.color = st.color;
    if (st.format) state.format = st.format;
    if (st.name != null) { state.sheikh = st.name; if (st.name) state.caption = true; }
    state.kContent = 'text';
    if (st.quran && surahs.some(x => x.n === st.quran.surah)) {
      // the recitation it names, under the texts
      state.surah = st.quran.surah; state.from = st.quran.from; state.to = st.quran.to;
      state.ktAudio = 'quran';
      if (state.recSource === 'own') state.recSource = 'reciter';
    }
    let placed = { added: 0, dropped: 0 };
    if (stickers) placed = stickers.fromScript(r.stickers);
    const warnings = r.warnings.slice();
    if (placed.dropped) warnings.push({ code: 'stickers', detail: String(placed.dropped) });
    if (isKhatira()) { markKContent(); renderPickerButtons(); } else setMode('khatira');
    applyStateToControls();
    if (st.quran) { clampRange('from'); renderPickerButtons(); }
    renderKTexts();
    if (own.renderBox) own.renderBox();
    saveSettings();
    onChange();
    kFontReady().then(() => renderIdle());
    // what was read, and what was not
    const n = x => (arabicNames() ? arDigits(x) : String(x));
    const waiting = stickers && stickers.slotSel != null;
    setStatus(tr('vm_sc_done', { lines: n(r.lines.length), stickers: n(placed.added) }) + (waiting ? ' ' + tr('vm_sc_pick') : ''), false);
    warn.innerHTML = '';
    warnings.forEach(w => { const li = document.createElement('li'); li.textContent = scriptWarning(w); warn.appendChild(li); });
    warn.hidden = !warnings.length;
    // pictures to choose for the script's sticker numbers: the stickers card, ready to pick
    if (waiting) {
      showSection('look');
      const card = $('vmStickerCard');
      if (card && card.scrollIntoView) setTimeout(() => card.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60);
    }
    return true;
  }
  function bindScript() {
    if (!window.VMScript) { $('vmScBox').hidden = true; return; }
    const file = $('vmScFile');
    $('vmScUpload').onclick = () => file.click();
    file.onchange = async () => {
      const f = file.files && file.files[0];
      file.value = '';
      if (!f) return;
      if (f.size > 512 * 1024) { setStatus(tr('vm_sc_big'), true); return; }
      try { importScript(await f.text()); } catch (e) { console.warn('[video-maker] script', e); setStatus(tr('vm_sc_bad'), true); }
    };
    const paste = $('vmScPaste');
    $('vmScPasteBtn').onclick = () => {
      paste.hidden = !paste.hidden;
      $('vmScPasteBtn').setAttribute('aria-expanded', paste.hidden ? 'false' : 'true');
      if (!paste.hidden) $('vmScText').focus();
    };
    $('vmScApply').onclick = () => {
      if (importScript($('vmScText').value)) { $('vmScText').value = ''; paste.hidden = true; $('vmScPasteBtn').setAttribute('aria-expanded', 'false'); }
    };
    $('vmScCancel').onclick = () => { paste.hidden = true; $('vmScPasteBtn').setAttribute('aria-expanded', 'false'); };
    $('vmScTemplate').onclick = () => {
      saveBlob(new Blob([scriptTemplate()], { type: 'text/plain;charset=utf-8' }), 'zad-video-script-template.txt');
      setStatus(tr('vm_sc_template_done'));
    };
    $('vmScCopy').onclick = async () => {
      try { await navigator.clipboard.writeText(scriptTemplate()); setStatus(tr('vm_sc_copied')); } catch (e) { setStatus(tr('vm_sc_copy_err'), true); }
    };
    $('vmScExport').onclick = () => {
      flushKTexts();
      if (!state.kTexts.some(t => t.trim())) { setStatus(tr('vm_sc_nothing'), true); return; }
      saveBlob(new Blob([currentScript()], { type: 'text/plain;charset=utf-8' }), 'zad-video-script.txt');
    };
  }

  // Own words over a recitation: the surah and ayat fields move to «الصوت», under the choice of
  // sound (they are what is heard there); back to «المحتوى» otherwise.
  let kqHome = null;
  function placeKq() {
    const box = $('vmKqBox'), f = $('vmSurahField'), r = $('vmRangeRow');
    if (!box || !f || !r) return;
    if (!kqHome) { kqHome = document.createComment('surah fields'); f.parentNode.insertBefore(kqHome, f); }
    if (isKQuran()) { if (f.parentNode !== box) box.append(f, r); } else if (f.parentNode === box) kqHome.after(f, r);
  }
  function setKtAudio(v) {
    state.ktAudio = v === 'quran' ? 'quran' : 'none';
    markKContent();
    renderPickerButtons();
    if (isKQuran()) clampRange('from');
  }

  function markKContent() {
    document.querySelectorAll('#vmKContent [data-kc]').forEach(b => {
      const on = b.dataset.kc === state.kContent;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.body.classList.toggle('kh-text', isKText());
    document.body.classList.toggle('kh-own', isKText() && state.recSource === 'own');
    document.body.classList.toggle('kt-quran', isKQuran());
    placeKq();
  }
  function setKContent(kc) {
    state.kContent = kc === 'quran' ? 'quran' : 'text';
    markKContent();
    renderPickerButtons();
    if (own.renderBox) own.renderBox();
    onChange();
  }

  function markKStyle() {
    document.querySelectorAll('#vmKStyle [data-ks]').forEach(b => {
      const on = b.dataset.ks === state.kStyle;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function markKFonts() {
    document.querySelectorAll('#vmKFonts [data-kfont]').forEach(b => {
      const on = b.dataset.kfont === state.kFont;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function setMode(mode) {
    state.mode = mode === 'long' && long ? 'long' : mode === 'khatira' && window.Khatira ? 'khatira' : 'short';
    document.body.classList.toggle('mode-long', isLong());
    document.body.classList.toggle('mode-khatira', isKhatira());
    markKContent();
    renderPickerButtons();
    if (isKhatira()) kFontReady().then(() => renderIdle());
    document.querySelectorAll('#vmModeTabs button').forEach(b => {
      const on = b.dataset.mode === state.mode;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (isLong()) { long.setBackground(state.tvBg); fillTemplates(); }
    updateSteps();
    clampRange('from');
    markBackgrounds();
    if (!isLong()) selectBackground(state.bg);
    onChange();
  }

  function fillTemplates() {
    const box = $('vmTemplates');
    if (box.childElementCount !== long.templates.length) {
      box.innerHTML = '';
      long.templates.forEach(t => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tpl-thumb';
        b.dataset.tpl = t.id;
        const cv = document.createElement('canvas');
        cv.width = 320; cv.height = 180;
        const label = document.createElement('span');
        b.append(cv, label);
        b.onclick = () => { state.tvTemplate = t.id; markTemplates(); updateSteps(); onChange(); };
        box.appendChild(b);
      });
    }
    markTemplates();
    refreshTemplateThumbs();
  }
  // A painted template brings its own picture, so the background step goes away.
  function updateSteps() {
    const ownBg = isLong() && !!long.template().background;
    $('vmBgCard').hidden = ownBg;
    $('vmBgNum').textContent = isLong() ? '4' : '3';
    $('vmStyleNum').textContent = !isLong() ? '5' : ownBg ? '4' : '5';
  }
  function markTemplates() {
    document.querySelectorAll('#vmTemplates .tpl-thumb').forEach(b => {
      const t = long.templates.find(x => x.id === b.dataset.tpl);
      b.classList.toggle('active', b.dataset.tpl === state.tvTemplate);
      b.setAttribute('aria-pressed', b.dataset.tpl === state.tvTemplate ? 'true' : 'false');
      b.lastElementChild.textContent = arabicNames() ? t.name.ar : t.name.en;
    });
  }
  let thumbTimer = 0;
  function refreshTemplateThumbs() {
    clearTimeout(thumbTimer);
    thumbTimer = setTimeout(() => {
      document.querySelectorAll('#vmTemplates .tpl-thumb canvas').forEach(cv => {
        long.drawThumb(cv.getContext('2d'), cv.parentElement.dataset.tpl);
      });
    }, 60);
  }

  function bindControls() {
    $('vmSurah').onchange = () => {
      state.surah = parseInt($('vmSurah').value, 10);
      $('vmFrom').value = 1;
      $('vmTo').value = Math.min(surahObj().ayat.length, 7);
      clampRange('from');
      onChange();
    };
    $('vmFrom').onchange = () => { clampRange('from'); onChange(); };
    $('vmTo').onchange = () => { clampRange('to'); onChange(); };
    $('vmBasmala').onchange = () => { state.basmala = $('vmBasmala').checked; onChange(); };
    $('vmReciter').onchange = () => { state.reciter = $('vmReciter').value; renderPickerButtons(); onChange(); };
    $('vmFont').oninput = () => { state.fontMul = parseFloat($('vmFont').value); onChange(); };
    $('vmCaption').onchange = () => { state.caption = $('vmCaption').checked; onChange(); };
    $('vmBranding').onchange = () => { state.branding = $('vmBranding').checked; onChange(); };
    $('vmPanel').onchange = () => { state.textPanel = $('vmPanel').checked; onChange(); };
    document.querySelectorAll('#vmTextFx button').forEach(b => {
      b.onclick = () => {
        state.textFx = b.dataset.fx;
        document.querySelectorAll('#vmTextFx button').forEach(x => x.classList.toggle('active', x === b));
        markHalo();
        onChange();
      };
    });
    $('vmMotion').onchange = () => { state.motion = $('vmMotion').checked; onChange(); };
    bindSections();
    $('vmSettingsBtn').onclick = () => openPick('Settings');
    $('vmLangRow').onclick = () => {
      closePick();
      setTimeout(() => { if (window.I18n) I18n.openLangSheet(); }, 180);
    };
    markThemeBtn();
    $('vmThemeBtn').onclick = () => { if (window.ThemeManager) ThemeManager.cycle(); markThemeBtn(); };
    window.addEventListener('themechange', markThemeBtn);
    $('vmPingPong').onchange = () => {
      state.pingPong = $('vmPingPong').checked;
      saveSettings();
      if (state.bg.startsWith('v:')) selectBackground(state.bg, true);
    };
    $('vmBgFile').onchange = e => { addUserFiles(e.target.files); e.target.value = ''; };
    $('vmMultiBg').onchange = () => setMultiBg($('vmMultiBg').checked);
    document.querySelectorAll('.stepper button').forEach(b => {
      b.onclick = () => {
        const input = $(b.dataset.for);
        input.value = (parseInt(input.value, 10) || 1) + parseInt(b.dataset.step, 10);
        clampRange(b.dataset.for === 'vmFrom' ? 'from' : 'to');
        onChange();
      };
    });
    document.querySelectorAll('#vmFormat button').forEach(b => {
      b.onclick = () => {
        state.format = b.dataset.fmt;
        document.querySelectorAll('#vmFormat button').forEach(x => x.classList.toggle('active', x === b));
        onChange();
      };
    });
    const setColor = col => {
      state.color = col;
      $('vmColor').value = col;
      document.querySelectorAll('#vmColors .swatch').forEach(s => s.classList.toggle('active', s.dataset.color === col));
      onChange();
    };
    document.querySelectorAll('#vmColors .swatch').forEach(s => { s.onclick = () => setColor(s.dataset.color); });
    $('vmColor').oninput = () => setColor($('vmColor').value);
    const setHalo = col => {
      state.halo = col;
      markHalo();
      onChange();
    };
    document.querySelectorAll('#vmHalos .swatch').forEach(s => { s.onclick = () => setHalo(s.dataset.halo); });
    $('vmHalo').oninput = () => setHalo($('vmHalo').value);
    $('vmPreview').onclick = togglePreview;
    // Tapping the video itself plays/stops the preview.
    $('vmStage').onclick = () => { if (stickers && stickers.clickAfterDrag()) return; if (Date.now() - textDragEnd < 400) return; if (!busy) togglePreview(); };
    bindTextDrag();
    bindScript();
    if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', fontsLoaded);
    bindMiniPreview();
    $('vmFullscreen').onclick = e => { e.stopPropagation(); toggleFullscreen(); };
    document.addEventListener('fullscreenchange', syncFullscreenUi);
    document.addEventListener('webkitfullscreenchange', syncFullscreenUi);
    document.addEventListener('keydown', e => {
      const sheet = openDialog();
      if (e.key === 'Escape') {
        if (pickSheet) closePick();
        else if (sheet) closeResult();
        else exitPseudoFullscreen();
      } else if (e.key === 'Tab' && sheet) trapTab(e, sheet);
    });
    $('vmStage').onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && !busy) { e.preventDefault(); togglePreview(); } };
    $('vmResultClose').onclick = () => closeResult();
    $('vmSheetOverlay').onclick = () => closeResult();
    $('vmExport').onclick = exportVideo;
    $('vmCancel').onclick = () => { if (cancelExport) cancelExport(); };
    document.querySelectorAll('#vmModeTabs button').forEach(b => {
      b.onclick = () => { if (!busy && b.dataset.mode !== state.mode) setMode(b.dataset.mode); };
    });
    bindPickers();
    if (window.ResizeObserver) new ResizeObserver(layoutStage).observe($('vmStage'));
    else window.addEventListener('resize', layoutStage);
    window.addEventListener('langchange', () => {
      fillSurahs(); fillReciters(); updatePreviewBtn(); updateSummary(); updateDuration(); renderIdle();
      if (own.renderBox) own.renderBox();
      if (fxUi) fxUi.render();
      if (isLong()) { markTemplates(); refreshTemplateThumbs(); }
      if (pickSheet === 'Surah') renderSurahList();
      else if (pickSheet === 'Reciter') renderReciterList();
      else if (pickSheet === 'Popular') renderPopularList();
    });
  }

  function markHalo() {
    document.querySelectorAll('#vmHalos .swatch').forEach(s => s.classList.toggle('active', s.dataset.halo === state.halo));
    if (state.halo !== 'auto') $('vmHalo').value = state.halo;
    // No effect, nothing to colour.
    $('vmHaloField').hidden = state.textFx === 'none';
  }

  function applyStateToControls() {
    $('vmFont').value = state.fontMul;
    markKFonts();
    markKStyle();
    $('vmCaption').checked = state.caption;
    $('vmBranding').checked = state.branding;
    $('vmPanel').checked = state.textPanel;
    document.querySelectorAll('#vmTextFx button').forEach(b => b.classList.toggle('active', b.dataset.fx === state.textFx));
    $('vmBasmala').checked = state.basmala;
    $('vmColor').value = state.color;
    markHalo();
    document.querySelectorAll('#vmColors .swatch').forEach(s => s.classList.toggle('active', s.dataset.color === state.color));
    document.querySelectorAll('#vmFormat button').forEach(b => b.classList.toggle('active', b.dataset.fmt === state.format));
    $('vmMotion').checked = state.motion;
    $('vmPingPong').checked = state.pingPong;
    $('vmMultiBg').checked = state.multiBg;
    $('vmFrom').value = state.from;
    $('vmTo').value = state.to;
  }

  async function init() {
    if (window.ThemeManager) ThemeManager.init();
    const i18nReady = window.I18n ? I18n.init() : Promise.resolve();
    loadSettings();
    reciters = (window.EVERYAYAH_RECITERS || []).filter(r => STYLES.includes(r.style));
    if (window.VMStickers) {
      stickers = VMStickers({
        state, $, tr, lang, canvas, num: n => (arabicNames() ? arDigits(n) : String(n)),
        playing: () => !!playing, busy: () => busy, redraw: () => renderIdle(), save: saveSettings, now: () => previewT,
        lines: () => (isKText() ? segments().map(sg => ({ i: sg.ki, n: sg.ki + 1, text: sg.text })) : []),
        lineSpan: k => { const f = timeline && lineSpanIn(timeline); return f ? f(k) : null; }, download: saveBlob,
        say: (m, err) => setStatus(m, err),
      });
      stickers.sanitize();
    }
    if (window.VMOwn && window.OwnRecitation) {
      own = VMOwn({
        state, $, tr, esc, arabicNames, arDigits, segments, ayahWords, rangeKey, reciterObj, reciterName,
        setStatus, onChange: () => onChange(), renderFx: () => { if (fxUi) fxUi.render(); },
        openSync: () => openPick('Sync'), closeSync: () => closePick(), isKText: () => isKText(),
        ktQuran: () => isKText() && state.ktAudio === 'quran', setKtAudio: v => setKtAudio(v),
      });
    }
    if (window.VMRec && own.addRecorded) {
      recorder = VMRec({
        $, tr, arabicNames, arDigits, segments, ayahWords, qfont: () => QFONT, audioCtx, own, setStatus,
        openSheet: () => openPick('Rec'), closeSheet: () => closePick(), recorded: () => recorded(),
      });
    }
    if (window.VMFxUi && window.AudioFx) {
      fxUi = VMFxUi({ $, state, tr, arabicNames, arDigits, own, fxChanged, listenFx: () => listenFx(), listening });
    }
    if (window.VMLong && window.TV_TEMPLATES) {
      long = VMLong({
        state, GRADIENTS, BRAND, appIcon, AUDIO_BASE, own, displayName, fxRoute, fxActive,
        tr, lang, arabicNames, arDigits, surahObj, reciterObj, reciterName, surahLatin,
        qfont: () => QFONT, segments, ayahWords, wrapWords, fillAyahLine, audioCtx, bgSrc,
        onAsset: () => { renderIdle(); if (isLong()) refreshTemplateThumbs(); },
      });
    }
    if (!long && state.mode === 'long') state.mode = 'short';
    document.body.classList.toggle('mode-long', isLong());
    document.body.classList.toggle('mode-khatira', isKhatira());
    document.body.classList.toggle('kh-text', isKText());
    sizeCanvas();
    try {
      await Promise.all([loadQuran(), loadBackgrounds(), i18nReady]);
      await loadUserBackgrounds();
      await loadUserFonts();
      if (own.init) await own.init();
    } catch (e) {
      console.error('[video-maker] init failed', e);
      setStatus(tr('vm_err_audio'), true);
      return;
    }
    if (!surahs[state.surah - 1]) state.surah = 1;
    // Opened for a given ayah (e.g. from the text mushaf): ?s=2&a=255[&to=257].
    try {
      const q = new URLSearchParams(location.search);
      const s = parseInt(q.get('s'), 10), a = parseInt(q.get('a'), 10), to = parseInt(q.get('to'), 10);
      if (surahs[s - 1] && a >= 1 && a <= surahs[s - 1].ayat.length) {
        state.surah = s; state.from = a;
        state.to = to >= a && to <= surahs[s - 1].ayat.length ? to : a;
      }
    } catch { /* no preset */ }
    fillSurahs();
    fillReciters();
    fillBackgrounds();
    renderKFonts();
    renderKTexts();
    markKContent();
    applyStateToControls();
    clampRange('from');
    bindControls();
    if (own.bindUi) own.bindUi();
    if (stickers) { stickers.bindUi(); stickers.render(); }
    if (recorder) recorder.bindUi();
    if (fxUi) { fxUi.bindUi(); fxUi.render(); }
    // Canvas text silently falls back to a system font if drawn before the
    // webfont is ready, so wait for both faces before the first frame.
    try { await Promise.all([document.fonts.load('40px ' + QFONT), document.fonts.load('40px VMTajawal')]); } catch (e) { /* fall through */ }
    if (isLong()) setMode('long');
    else if (isKhatira()) { setMode('khatira'); await kFontReady(); renderIdle(); }
    else selectBackground(state.bg);
    updateDuration();          // the length of the saved reciter + ayat, as soon as the page opens
  }

  appIcon.onload = () => renderIdle();

  // Bump BUILD whenever pages/video-maker.html starts depending on new script
  // features; the page reloads once with a fresh copy if it gets an older one.
  const BUILD = 13;   // 13: UI/UX audit (contrast of filled and green text, 44 px targets, text from 12 px, layouts measured again when a face loads); 12: video scripts (js/video-script.js: upload, paste, template for an AI, export), sticker numbers to fill and stickers with a line, the sticker pack as a ZIP (js/zip-store.js), «آيات» (a recitation) under own words, the floating mini preview; 11: sticker timing and effects, the high-resolution sticker pack, text moved by holding and dragging; 10: character stickers (js/video-stickers.js), 9: «خاطرة» tab (js/khatira.js), 8: in-app recorder + audio effects, 7: own recording («تسجيلي») + editable reciter name, 6: long video tab (js/video-maker-long.js), 5: user's own backgrounds, 4: mushaf font + QPC Hafs text, 3: Quran search sheet (2: multi-picture slideshow)
  window.VM = { khatiraLayout: (si, w, h) => { const tl = timeline, c = document.createElement('canvas').getContext('2d'); const L = kLayout(c, tl, si, w, h); return { size: L.size, rtl: L.rtl, pages: L.pages.map(pg => pg.map(ln => ln.length)) }; }, get own() { return own; }, khatiraWordAt, kText, get userFonts() { return userFonts.map(u => ({ id: u.id, name: u.name, known: !!u.has })); }, get timeline() { return timeline; }, showSection, get section() { return secNow; }, build: BUILD, state, renderFrame, buildTimeline, loadAyahAudio, exportVideo, get bgVideo() { return bgVideo; }, get loopJob() { return loopJob; }, importScript, currentScript, scriptTemplate, get stickers() { return stickers; } };
  init();
})();
