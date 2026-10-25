// Quran ayah video maker — draws ayat over a background on a <canvas>, times
// each ayah to its per-ayah everyayah.com recitation, and records canvas +
// audio with MediaRecorder into a clip for status / stories / reels.
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
    fontMul: 1,
    color: '#ffffff',
    caption: true,
    branding: true,     // app icon + name at the top
    textPanel: true,    // translucent rounded panel behind the ayah text
    basmala: true,
  };

  let surahs = [];        // [{ n, name, nameEn, ayat: [text...] }]
  let basmalaText = '';
  let reciters = [];
  let bgImages = [];      // filenames from the manifest
  let bgImg = null;       // loaded Image for the current 'i:' background
  let bgVideo = null;     // <video> for the current 'v:' background (muted, looping)
  let bgPoster = null;    // full-size still of that video, drawn until it has a frame
  let move = MOVES[0];    // camera move for the current clip
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
      takrar_no_results: 'لا نتائج', takrar_style_all: 'الكل',
      vm_cat_famous: 'آيات مشهورة', vm_cat_surahs: 'سور قصيرة', vm_cat_duas: 'أدعية قرآنية', vm_cat_comfort: 'طمأنينة وتذكير',
    },
    en: {
      vm_title: 'Ayah Video Maker', vm_preview: 'Preview', vm_stop: 'Stop', vm_done: 'Video ready',
      vm_loading: 'Loading recitation...', vm_keep_open: 'Creating video — keep this screen open',
      vm_max_ayat: 'Maximum {n} ayat per video', vm_err_audio: "Couldn't load the recitation — check your connection",
      vm_err_unsupported: "Your browser can't record video — try a recent Chrome or Safari",
      vm_webm_note: 'Saved as WebM — some apps may require MP4',
      takrar_style_murattal: 'Murattal', takrar_style_mujawwad: 'Mujawwad',
      vm_share_text: 'Made with Zad Al-Muslim App', vm_share_page: 'Make your own',
      takrar_no_results: 'No results', takrar_style_all: 'All',
      vm_cat_famous: 'Famous ayat', vm_cat_surahs: 'Short surahs', vm_cat_duas: 'Quranic duas', vm_cat_comfort: 'Comfort & reminders',
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

  function saveSettings() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
  }
  function loadSettings() {
    try { Object.assign(state, JSON.parse(localStorage.getItem(STORE_KEY)) || {}); } catch (e) { /* ignore */ }
    if (!FORMATS[state.format]) state.format = 'story';
    // Older versions stored a named move; anything but 'none' means motion on.
    if (typeof state.motion !== 'boolean') state.motion = state.motion !== 'none';
  }

  function reciterObj() {
    return reciters.find(r => r.id === state.reciter) || reciters[0];
  }
  function reciterName(r) { return arabicNames() ? r.name : r.en; }
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
  }

  async function loadBackgrounds() {
    try {
      const res = await fetch(BG_DIR + 'manifest.json', { cache: 'no-cache' });
      const list = await res.json();
      if (Array.isArray(list)) bgImages = list.filter(f => typeof f === 'string' && f && !f.endsWith('.thumb.webp'));
    } catch (e) { bgImages = []; }
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
    return [reciterObj().folder, state.surah, state.from, state.to, state.basmala && basmalaApplies()].join('|');
  }

  async function buildTimeline(onProgress) {
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

  // ---------- rendering ----------
  // Camera move for the whole clip: zoom factor + horizontal pan in [-1, 1]
  // (share of the available pan room). Eased so it starts and ends gently.
  function cameraAt(progress) {
    const p = (1 - Math.cos(Math.PI * clamp01(progress))) / 2;
    const m = state.motion ? move : STILL;
    const lerp = ([a, b]) => a + (b - a) * p;
    return { zoom: lerp(m.z), panX: lerp(m.x), panY: lerp(m.y) };
  }

  // New random move per preview/export, never the same one twice in a row.
  function rollMove() {
    const options = MOVES.filter(m => m !== move);
    move = options[Math.floor(Math.random() * options.length)];
  }

  // Cover-fits an image or video frame at the camera position, then darkens
  // it so the text stays readable.
  function drawCover(c, src, sw, sh, w, h, cam) {
    const scale = Math.max(w / sw, h / sh) * cam.zoom;
    const dw = sw * scale, dh = sh * scale;
    const roomX = Math.min((dw - w) / 2, w * PAN_MAX);
    const roomY = Math.min((dh - h) / 2, h * PAN_MAX);
    c.drawImage(src, (w - dw) / 2 + cam.panX * roomX, (h - dh) / 2 + cam.panY * roomY, dw, dh);
    c.fillStyle = 'rgba(0,0,0,0.38)';
    c.fillRect(0, 0, w, h);
  }

  function drawBackground(c, w, h, progress) {
    const cam = cameraAt(progress);
    const zoom = cam.zoom;
    if (state.bg.startsWith('v:') && bgVideo && bgVideo.readyState >= 2) {
      drawCover(c, bgVideo, bgVideo.videoWidth, bgVideo.videoHeight, w, h, cam);
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

  // Wraps + auto-shrinks the ayah so the whole block fits the safe area.
  function layoutText(c, seg, w, h) {
    const key = [seg.surah, seg.ayah, w, h, state.fontMul, state.caption].join('|');
    if (layoutCache.has(key)) return layoutCache.get(key);
    const words = seg.text.split(/\s+/).filter(Boolean);
    // U+06DD (end of ayah) + Arabic-Indic digits renders as the font's ayah
    // medallion; the NBSP keeps the marker from wrapping onto its own line.
    if (seg.num != null && words.length) words[words.length - 1] += '\u00A0\u06DD' + arDigits(seg.num);
    const maxW = w * 0.84;
    const maxH = h * (state.caption ? 0.6 : 0.7);
    let size = Math.min(w, h) * 0.085 * state.fontMul;
    let lines;
    for (;;) {
      c.font = size + 'px QuranFont';
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

  function drawAyah(c, seg, w, h, alpha) {
    if (alpha <= 0) return;
    const L = layoutText(c, seg, w, h);
    c.save();
    c.globalAlpha = alpha;
    c.font = L.size + 'px QuranFont';
    c.direction = 'rtl';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = state.color;
    c.shadowColor = 'rgba(0,0,0,0.65)';
    c.shadowBlur = L.size * 0.3;
    c.shadowOffsetY = L.size * 0.04;
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
      c.fillStyle = 'rgba(0,0,0,0.38)';
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
    L.lines.forEach((ln, i) => c.fillText(ln, w / 2, top + i * L.lh + rise));
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
      c.font = (base * 0.045) + 'px QuranFont';
      c.fillText(s.name, w / 2, y);
    } else {
      c.font = (base * 0.04) + 'px VMTajawal';
      c.fillText('Surah ' + surahLatin(s), w / 2, y);
    }
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.font = (base * 0.03) + 'px VMTajawal';
    c.fillText(reciterName(reciterObj()), w / 2, y + base * 0.055);
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
    drawBackground(c, w, h, tl ? clamp01(t / total) : 0);
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
    const [w, h] = FORMATS[state.format];
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
    renderFrame(ctx, canvas.width, canvas.height, 0, null);
  }

  // ---------- playback / export ----------
  function startSources(tl, out, t0) {
    return tl.items.map(it => {
      const src = audioCtx().createBufferSource();
      src.buffer = it.buffer;
      out.forEach(node => src.connect(node));
      src.start(t0 + it.start);
      return src;
    });
  }

  // The video loops on its own; each tick just draws whatever frame is current.
  // Resolves once frames are actually flowing (or after 3 s) so a recording
  // never opens on a blank background.
  function startBgVideo() {
    const v = bgVideo;
    if (!v || !state.bg.startsWith('v:')) return Promise.resolve();
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
    playing.sources.forEach(s => { try { s.stop(); } catch (e) { /* not started */ } });
    playing = null;
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
    $('vmSummary').textContent = name + ' · ' + range + ' · ' + { story: '9:16', square: '1:1', wide: '16:9' }[state.format];
  }

  // Locks every control while exporting — a mid-recording change would alter the clip.
  let busy = false;
  function setBusy(on) {
    busy = on;
    $('vmExport').disabled = on;
    $('vmPreview').hidden = on;
    document.querySelectorAll('.controls-col input, .controls-col select, .controls-col button').forEach(el => { el.disabled = on; });
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
      setStatus(tr('vm_err_audio'), true);
      return null;
    }
  }

  async function togglePreview() {
    if (playing) { stopPlayback(); return; }
    const ac = audioCtx();
    ac.resume();   // must happen inside the tap, before any await (iOS)
    const tl = await loadTimelineWithUi();
    if (!tl || playing) return;
    sizeCanvas();
    rollMove();
    await startBgVideo();
    if (playing) return;
    const t0 = ac.currentTime + 0.1;
    playing = { sources: startSources(tl, [ac.destination], t0), t0, raf: 0, export: false };
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

  async function exportVideo() {
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

    let wakeLock = null;
    try { if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* optional */ }

    sizeCanvas();
    rollMove();
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
    rec.start(1000);
    const t0 = ac.currentTime + 0.15;
    // Also route to the speakers so the user hears what is being recorded.
    playing = { sources: startSources(tl, [dest, ac.destination], t0), t0, raf: 0, export: true };
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
    const name = `quran-${pad3(state.surah)}-${state.from}-${state.to}.${ext}`;
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
    if (window.BackClose) BackClose.opened(closeResult);
  }
  function closeResult() {
    if ($('vmResult').hidden) return;
    // No-op when Android back already popped the entry (BackClose pops first).
    if (window.BackClose) BackClose.closed();
    $('vmVideo').pause();
    $('vmResult').hidden = true;
    $('vmSheetOverlay').hidden = true;
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

  function openPick(kind) {
    if (pickSheet) return;
    pickSheet = kind;
    $('vm' + kind + 'Search').value = '';
    if (kind === 'Surah') renderSurahList();
    else if (kind === 'Popular') renderPopularList();
    else renderReciterList();
    $('vmPickOverlay').classList.add('active');
    $('vm' + kind + 'Sheet').classList.add('active');
    if (window.BackClose) BackClose.opened(closePick);
    // Long lists jump to the current choice; the popular sheet opens at the top
    // so its search box and category chips stay in view.
    const sel = kind !== 'Popular' && $('vm' + kind + 'List').querySelector('.selected');
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
    if (document.activeElement) document.activeElement.blur();
    pickSheet = null;
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
    const add = (id, styleBg, isVideo) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bg-thumb' + (isVideo ? ' is-video' : '') + (state.bg === id ? ' active' : '');
      b.style.background = styleBg;
      b.style.backgroundSize = 'cover';
      b.style.backgroundPosition = 'center';
      b.dataset.bg = id;
      b.onclick = () => selectBackground(id);
      strip.appendChild(b);
    };
    bgImages.filter(isVideoFile).forEach(f => add('v:' + f, `url("${BG_DIR}${encodeURI(thumbFor(f))}")`, true));
    bgImages.filter(f => !isVideoFile(f)).forEach(f => add('i:' + f, `url("${BG_DIR}${encodeURI(f)}")`));
    GRADIENTS.forEach((g, i) => add('g' + i, `linear-gradient(160deg, ${g.stops.join(', ')})`));
  }

  function selectBackground(id) {
    if (/^[iv]:/.test(id) && !bgImages.includes(id.slice(2))) id = 'g0';
    if (bgVideo && state.bg !== id) {
      bgVideo.pause();
      bgVideo.removeAttribute('src');
      bgVideo.load();   // releases the decoder on mobile
      bgVideo = null;
      bgPoster = null;
    }
    state.bg = id;
    document.querySelectorAll('#vmBgs .bg-thumb').forEach(b => b.classList.toggle('active', b.dataset.bg === id));
    saveSettings();
    if (id.startsWith('i:')) {
      const img = new Image();
      img.onload = () => { if (state.bg === id) { bgImg = img; renderIdle(); } };
      img.onerror = () => { if (state.bg === id) { bgImg = null; renderIdle(); } };
      img.src = BG_DIR + encodeURI(id.slice(2));
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
      v.src = BG_DIR + encodeURI(id.slice(2));
      bgVideo = v;
      const poster = new Image();
      poster.onload = () => { if (state.bg === id) renderIdle(); };
      poster.src = BG_DIR + encodeURI(thumbFor(id.slice(2)));
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
    if (to - from + 1 > MAX_AYAT) {
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
    stopPlayback();
    saveSettings();
    updateSummary();
    renderIdle();
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
    $('vmMotion').onchange = () => { state.motion = $('vmMotion').checked; onChange(); };
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
    $('vmPreview').onclick = togglePreview;
    // Tapping the video itself plays/stops the preview.
    $('vmStage').onclick = () => { if (!busy) togglePreview(); };
    $('vmFullscreen').onclick = e => { e.stopPropagation(); toggleFullscreen(); };
    document.addEventListener('fullscreenchange', syncFullscreenUi);
    document.addEventListener('webkitfullscreenchange', syncFullscreenUi);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') exitPseudoFullscreen(); });
    $('vmStage').onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && !busy) { e.preventDefault(); togglePreview(); } };
    $('vmResultClose').onclick = () => closeResult();
    $('vmSheetOverlay').onclick = () => closeResult();
    $('vmExport').onclick = exportVideo;
    $('vmCancel').onclick = () => { if (cancelExport) cancelExport(); };
    bindPickers();
    if (window.ResizeObserver) new ResizeObserver(layoutStage).observe($('vmStage'));
    else window.addEventListener('resize', layoutStage);
    window.addEventListener('langchange', () => {
      fillSurahs(); fillReciters(); updatePreviewBtn(); updateSummary(); renderIdle();
      if (pickSheet === 'Surah') renderSurahList();
      else if (pickSheet === 'Reciter') renderReciterList();
      else if (pickSheet === 'Popular') renderPopularList();
    });
  }

  function applyStateToControls() {
    $('vmFont').value = state.fontMul;
    $('vmCaption').checked = state.caption;
    $('vmBranding').checked = state.branding;
    $('vmPanel').checked = state.textPanel;
    $('vmBasmala').checked = state.basmala;
    $('vmColor').value = state.color;
    document.querySelectorAll('#vmColors .swatch').forEach(s => s.classList.toggle('active', s.dataset.color === state.color));
    document.querySelectorAll('#vmFormat button').forEach(b => b.classList.toggle('active', b.dataset.fmt === state.format));
    $('vmMotion').checked = state.motion;
    $('vmFrom').value = state.from;
    $('vmTo').value = state.to;
  }

  async function init() {
    if (window.ThemeManager) ThemeManager.init();
    const i18nReady = window.I18n ? I18n.init() : Promise.resolve();
    loadSettings();
    reciters = (window.EVERYAYAH_RECITERS || []).filter(r => STYLES.includes(r.style));
    sizeCanvas();
    try {
      await Promise.all([loadQuran(), loadBackgrounds(), i18nReady]);
    } catch (e) {
      console.error('[video-maker] init failed', e);
      setStatus(tr('vm_err_audio'), true);
      return;
    }
    if (!surahs[state.surah - 1]) state.surah = 1;
    fillSurahs();
    fillReciters();
    fillBackgrounds();
    applyStateToControls();
    clampRange('from');
    bindControls();
    // Canvas text silently falls back to a system font if drawn before the
    // webfont is ready, so wait for both faces before the first frame.
    try { await Promise.all([document.fonts.load('40px QuranFont'), document.fonts.load('40px VMTajawal')]); } catch (e) { /* fall through */ }
    selectBackground(state.bg);
  }

  appIcon.onload = () => renderIdle();

  window.VM = { state, renderFrame, buildTimeline, loadAyahAudio, exportVideo };
  init();
})();
