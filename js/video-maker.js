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
    mode: 'short',      // 'short' = shorts / reels (default), 'long' = 16:9 long video
    tvTemplate: 'dawn', // long mode: template id (js/tv-templates.js)
    tvBg: 'g1',         // long mode: its own background ('g<i>' or 'i:<file>')
  };
  const isLong = () => state.mode === 'long' && !!long;
  let long = null;        // long-mode engine (js/video-maker-long.js)
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
      vm_sync_title: 'ضبط توقيت الآيات',
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
      vm_mode_short: 'مقاطع قصيرة / ريلز', vm_mode_long: 'فيديو طويل', vm_template: 'القالب',
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
      vm_sync_title: 'Set the ayah timing',
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
    if (state.mode !== 'long') state.mode = 'short';
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
    return reciters.find(r => r.id === state.reciter) || reciters[0];
  }
  function reciterName(r) { return arabicNames() ? r.name : r.en; }
  // The name shown on the video: what the user typed, else «تلاوتي» (own recording),
  // else the reciter's name.
  function displayName() { return own.displayName ? own.displayName() : reciterName(reciterObj()); }
  // Surah, first and last ayah, and whether the basmala is on: what a recording's
  // sync points belong to.
  function rangeKey() { return [state.surah, state.from, state.to, state.basmala && basmalaApplies()].join('|'); }
  function surahObj() { return surahs[state.surah - 1]; }
  // Undecorated name ("البقرة") from js/surah-map.js — the same list takrar.html shows.
  function surahPlain(s) {
    return (typeof SURAH_MAP !== 'undefined' && SURAH_MAP[s.n - 1] && SURAH_MAP[s.n - 1].name) || s.name;
  }
  function surahLatin(s) { return window.I18n ? I18n.name('surahs', s.n, s.nameEn) : s.nameEn; }
  function basmalaApplies() {
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

  // Segments to show, in order (no audio yet).
  function segments() {
    const s = surahObj();
    const out = [];
    if (state.basmala && basmalaApplies()) out.push({ surah: 1, ayah: 1, text: basmalaText, num: null });
    for (let a = state.from; a <= state.to; a++) out.push({ surah: s.n, ayah: a, text: s.ayat[a - 1], num: a });
    return out;
  }

  function timelineKey() {
    if (own.active()) return ['own', own.rec.id, rangeKey(), own.sig(own.entryNow())].join('|');
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
      t = it.end;
      return it;
    });
    timeline = { key, items, total: t + TAIL };
    return timeline;
  }

  async function buildTimeline(onProgress) {
    if (own.active()) return buildOwnTimeline();
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
    if (seg.num != null && words.length) words[words.length - 1] += '\u00A0' + (QFONT === 'QuranFont' ? '' : '\u06DD') + arDigits(seg.num);
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
    const cy = h * (state.caption ? 0.46 : 0.5);
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
      const px = (w - pw) / 2, py = cy - ph / 2 + rise, r = L.size * 0.55;
      if (c.roundRect) c.roundRect(px, py, pw, ph, r);
      else c.rect(px, py, pw, ph);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.12)';
      c.lineWidth = Math.max(1.5, L.size * 0.025);
      c.stroke();
      c.restore();
    }
    L.lines.forEach((ln, i) => fillAyahLine(c, ln, w / 2, top + i * L.lh + rise, L.size));
    c.restore();
  }

  function drawCaption(c, w, h) {
    if (!state.caption) return;
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

  // t = seconds into the clip. With no timeline, draws a still of the first segment.
  function renderFrame(c, w, h, t, tl) {
    const total = tl ? tl.total : 1;
    drawBackground(c, w, h, tl ? clamp01(t / total) : 0, t, tl);
    if (!tl) {
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
  }

  // ---------- full screen preview ----------
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  function isFullscreen() { return !!fsElement() || $('vmStage').classList.contains('pseudo-fs'); }
  function syncFullscreenUi() {
    $('vmStage').classList.toggle('is-fs', isFullscreen());
    layoutStage();
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

  function renderIdle() {
    if (playing || !surahs.length) return;
    sizeCanvas();
    if (isLong()) { long.drawStill(ctx); return; }
    renderFrame(ctx, canvas.width, canvas.height, 0, null);
  }

  // ---------- playback / export ----------
  function startSources(tl, out, t0) {
    return tl.items.map(it => {
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
    if (!playing) setStageProgress(0);
  }
  function setStageProgress(p) { $('vmStageBar').style.width = (p * 100).toFixed(2) + '%'; }

  // "Al-Baqarah · 1–7 · 9:16" under the preview.
  function updateSummary() {
    const s = surahObj();
    if (!s) return;
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
    const name = `quran-${isLong() ? 'long-' : ''}${pad3(state.surah)}-${state.from}-${state.to}.${ext}`;
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
    focusDialog($('vmResult'));
    if (window.BackClose) BackClose.opened(closeResult);
  }
  function closeResult() {
    if ($('vmResult').hidden) return;
    // No-op when Android back already popped the entry (BackClose pops first).
    if (window.BackClose) BackClose.closed();
    $('vmVideo').pause();
    $('vmResult').hidden = true;
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
    $('vmReciterList').onclick = e => { const b = e.target.closest('[data-reciter]'); if (b) choose('vmReciter', b.dataset.reciter); };
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

  function onChange() {
    layoutCache.clear();
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
  function setMode(mode) {
    state.mode = mode === 'long' && long ? 'long' : 'short';
    document.body.classList.toggle('mode-long', isLong());
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
    $('vmStyleNum').textContent = !isLong() ? '4' : ownBg ? '4' : '5';
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
    $('vmStage').onclick = () => { if (!busy) togglePreview(); };
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
    if (window.VMOwn && window.OwnRecitation) {
      own = VMOwn({
        state, $, tr, esc, arabicNames, arDigits, segments, ayahWords, rangeKey, reciterObj, reciterName,
        setStatus, onChange: () => onChange(), renderFx: () => { if (fxUi) fxUi.render(); },
        openSync: () => openPick('Sync'), closeSync: () => closePick(),
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
    if (!long) state.mode = 'short';
    document.body.classList.toggle('mode-long', isLong());
    sizeCanvas();
    try {
      await Promise.all([loadQuran(), loadBackgrounds(), i18nReady]);
      await loadUserBackgrounds();
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
    applyStateToControls();
    clampRange('from');
    bindControls();
    if (own.bindUi) own.bindUi();
    if (recorder) recorder.bindUi();
    if (fxUi) { fxUi.bindUi(); fxUi.render(); }
    // Canvas text silently falls back to a system font if drawn before the
    // webfont is ready, so wait for both faces before the first frame.
    try { await Promise.all([document.fonts.load('40px ' + QFONT), document.fonts.load('40px VMTajawal')]); } catch (e) { /* fall through */ }
    if (isLong()) setMode('long');
    else selectBackground(state.bg);
    updateDuration();          // the length of the saved reciter + ayat, as soon as the page opens
  }

  appIcon.onload = () => renderIdle();

  // Bump BUILD whenever pages/video-maker.html starts depending on new script
  // features; the page reloads once with a fresh copy if it gets an older one.
  const BUILD = 8;   // 8: in-app recorder + audio effects, 7: own recording («تسجيلي») + editable reciter name, 6: long video tab (js/video-maker-long.js), 5: user's own backgrounds, 4: mushaf font + QPC Hafs text, 3: Quran search sheet (2: multi-picture slideshow)
  window.VM = { get own() { return own; }, showSection, get section() { return secNow; }, build: BUILD, state, renderFrame, buildTimeline, loadAyahAudio, exportVideo, get bgVideo() { return bgVideo; }, get loopJob() { return loopJob; } };
  init();
})();
