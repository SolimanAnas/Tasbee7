/* =========================================================================
   share-card.js — turn a duaa / dhikr / hadith into a shareable image card
   or a short silent video

   Usage (any page that loads css/fonts.css + js/i18n.js):
     ShareCard.open({
       text:        'اللَّهُمَّ ...',       // Arabic (required)
       translation: 'O Allah ...',          // optional, toggleable
       title:       'أذكار الصباح',          // optional heading
       source:      'رواه مسلم',             // optional reference line
       repeat:      3,                      // optional, shown when > 1
     });

   Instead of text, a page can draw its own content inside the card panel
   (e.g. a stats chart) — chrome, sizes, export and video stay the same:
     ShareCard.open({ title, source, custom: {
       seconds: 7,                                   // video length of the content
       draw(c, box, anim) { ... },                   // box = {x, y, w, h, base}; anim 0→1 in videos, 1 for stills
     }});

   Opens a bottom sheet with a live preview, background / size / toggle
   options, Share (Web Share API with the PNG) + Download buttons, and a
   video export: the card animates (background motion, text fading in) and
   long texts are split into several screens timed by their word count.
   ========================================================================= */
(function () {
  'use strict';

  const FORMATS = { square: [1080, 1080], portrait: [1080, 1350], story: [1080, 1920] };
  const BRAND = 'Zad Al-Muslim App';
  const PLAY_URL = 'https://play.google.com/store/apps/details?id=io.github.solimananas.twa';
  const STORE_KEY = 'sc_settings';
  const GOLD = '#e6c068';

  // Video timing (seconds)
  const FPS = 30;
  const LEAD = 0.5;          // background-only lead-in
  const FADE = 0.6;          // text fade in / out per screen
  const TAIL = 1.0;          // hold after the last screen
  const MAX_VIDEO = 180;     // longer texts are refused with a message
  const pageSeconds = words => Math.min(16, Math.max(4.5, 1.5 + words * 0.42));

  // Same palette as the ayah video maker, so cards and clips look related.
  const GRADIENTS = [
    { stops: ['#04291f', '#0b4d3a', '#06231b'], glow: 'rgba(230,192,104,0.28)' },
    { stops: ['#050b1f', '#14254f', '#070d24'], glow: 'rgba(120,160,255,0.25)' },
    { stops: ['#1d0b2e', '#4a1d5c', '#120618'], glow: 'rgba(255,160,120,0.22)' },
    { stops: ['#000000', '#141414', '#000000'], glow: 'rgba(255,255,255,0.10)' },
    { stops: ['#032a2e', '#0d5c63', '#021b1e'], glow: 'rgba(160,255,230,0.20)' },
  ];

  // Resolve assets relative to this script so it works from any page depth.
  const SCRIPT_SRC = (document.currentScript && document.currentScript.src) ||
    (document.querySelector('script[src*="share-card.js"]') || {}).src || location.href;
  const ROOT = new URL('../', SCRIPT_SRC).href;
  const BG_DIR = ROOT + 'images/video-maker/';

  // Built-in copies of the UI strings: the SW serves js/i18n/*.js cache-first,
  // so right after an update the cached dictionary can predate these keys.
  const FALLBACK = {
    ar: {
      sc_title: 'مشاركة كصورة أو فيديو', sc_share: 'مشاركة', sc_download: 'حفظ الصورة', sc_close: 'إغلاق',
      sc_format: 'المقاس', sc_fmt_square: 'مربع', sc_fmt_portrait: 'عمودي', sc_fmt_story: 'ستوري',
      sc_background: 'الخلفية', sc_translation: 'الترجمة', sc_source: 'العنوان والمصدر',
      sc_repeat: 'التكرار: {n}', sc_made_with: 'صُنع بتطبيق زاد المسلم',
      sc_make_video: 'إنشاء فيديو', sc_share_video: 'مشاركة الفيديو', sc_save_video: 'حفظ الفيديو',
      sc_cancel: 'إلغاء', sc_recording: 'جارٍ إنشاء الفيديو — أبقِ هذه الشاشة مفتوحة',
      sc_video_ready: 'الفيديو جاهز ({s} ثانية)', sc_video_too_long: 'النص أطول من أن يُعرض في فيديو واحد — شاركه كصورة بمقاس ستوري',
      sc_video_unsupported: 'متصفحك لا يدعم إنشاء الفيديو — جرّب Chrome أو Safari الحديث',
      sc_webm_note: 'حُفظ بصيغة WebM — بعض التطبيقات قد تتطلب MP4',
    },
    en: {
      sc_title: 'Share as image or video', sc_share: 'Share', sc_download: 'Save image', sc_close: 'Close',
      sc_format: 'Size', sc_fmt_square: 'Square', sc_fmt_portrait: 'Portrait', sc_fmt_story: 'Story',
      sc_background: 'Background', sc_translation: 'Translation', sc_source: 'Title & source',
      sc_repeat: 'Repeat: {n}×', sc_made_with: 'Made with Zad Al-Muslim App',
      sc_make_video: 'Create video', sc_share_video: 'Share video', sc_save_video: 'Save video',
      sc_cancel: 'Cancel', sc_recording: 'Creating video — keep this screen open',
      sc_video_ready: 'Video ready ({s} s)', sc_video_too_long: 'This text is too long for one video — share it as a Story-size image instead',
      sc_video_unsupported: "Your browser can't record video — try a recent Chrome or Safari",
      sc_webm_note: 'Saved as WebM — some apps may require MP4',
    },
  };

  const lang = () => (window.I18n ? I18n.getLang() : 'ar');
  const isRtlUi = () => ['ar', 'ckb', 'ur'].includes(lang());
  const hasArabic = s => /[؀-ۿ]/.test(s || '');
  const clamp01 = x => Math.max(0, Math.min(1, x));
  function tr(k, p) {
    let s = window.t ? window.t(k, p) : k;
    if (s === k) {
      const fb = FALLBACK[lang()] || (isRtlUi() ? FALLBACK.ar : FALLBACK.en);
      s = fb[k] || FALLBACK.en[k] || k;
      if (p) Object.keys(p).forEach(n => { s = s.replace(new RegExp('\\{' + n + '\\}', 'g'), p[n]); });
    }
    return s;
  }

  const state = { bg: 'g0', format: 'square', translation: !isRtlUi(), source: true };
  try { Object.assign(state, JSON.parse(localStorage.getItem(STORE_KEY) || '{}')); } catch (e) { /* private mode */ }
  if (!FORMATS[state.format]) state.format = 'square';
  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  let item = null;          // the entry being shared
  let ui = null;            // sheet elements, built on first open
  let photos = null;        // photo filenames from the video-maker manifest
  let recording = null;     // { cancel } while a video is being recorded
  let video = null;         // { blob, name, type, seconds } once recorded
  const imgCache = new Map();
  const appIcon = new Image();
  appIcon.src = ROOT + 'icons/icon-192.png';
  appIcon.onload = () => redraw();

  function redraw() { if (ui && !ui.overlay.hidden && !recording) draw(); }

  // ---------- drawing ----------
  function photo(file) {
    if (!imgCache.has(file)) {
      const img = new Image();
      img.onload = () => { if (state.bg === 'i:' + file) redraw(); };
      img.src = BG_DIR + encodeURI(file);
      imgCache.set(file, img);
    }
    return imgCache.get(file);
  }

  // progress (0..1) drives the slow zoom / glow drift in videos; 0 for stills.
  function drawBackground(c, w, h, progress) {
    const img = state.bg.startsWith('i:') ? photo(state.bg.slice(2)) : null;
    if (img && img.complete && img.naturalWidth) {
      const s = Math.max(w / img.naturalWidth, h / img.naturalHeight) * (1 + 0.08 * progress);
      const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
      c.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      c.fillStyle = 'rgba(0,0,0,0.42)';
      c.fillRect(0, 0, w, h);
    } else {
      const g = GRADIENTS[parseInt(state.bg.slice(1), 10)] || GRADIENTS[0];
      const lin = c.createLinearGradient(0, 0, w * 0.3, h);
      g.stops.forEach((col, i) => lin.addColorStop(i / (g.stops.length - 1), col));
      c.fillStyle = lin;
      c.fillRect(0, 0, w, h);
      const gx = w * (0.5 + 0.18 * Math.sin(progress * Math.PI * 1.5)), gy = h * (0.4 + 0.08 * progress);
      const rad = c.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * 0.65);
      rad.addColorStop(0, g.glow);
      rad.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = rad;
      c.fillRect(0, 0, w, h);
    }
  }

  function wrap(c, text, maxW) {
    const lines = [];
    for (const para of text.split(/\n+/)) {
      let line = '';
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const test = line ? line + ' ' + word : word;
        if (line && c.measureText(test).width > maxW) { lines.push(line); line = word; }
        else line = test;
      }
      if (line) lines.push(line);
    }
    return lines;
  }

  function footerParts() {
    const parts = [];
    if (item.repeat > 1) parts.push(tr('sc_repeat', { n: item.repeat }));
    if (item.source) parts.push(item.source);
    return parts;
  }

  // Header / footer metrics shared by the card and every video frame.
  function frame(c, w, h) {
    const base = w;                       // all formats are 1080 wide
    const meta = state.source;
    let footer = null;
    if (meta && footerParts().length) {
      const fs = base * 0.03;
      c.font = fs + 'px Tajawal';
      let lines = wrap(c, footerParts().join('  •  '), w * 0.86);
      if (lines.length > 2) lines = [lines[0], lines.slice(1).join(' ')];
      footer = { fs, lines, lh: fs * 1.45 };
    }
    const top = base * 0.16 + (meta && item.title ? base * 0.08 : 0);
    const bottom = h - base * 0.1 - (footer ? footer.lines.length * footer.lh + base * 0.03 : 0);
    return { base, meta, footer, top, bottom, maxH: bottom - top - base * 0.08 };
  }

  // Shrinks the Arabic (and translation, at a fixed ratio) until both fit.
  function layoutBody(c, w, maxH) {
    const maxW = w * 0.8;
    const showTr = state.translation && item.translation;
    let size = w * 0.068;
    for (;;) {
      c.font = size + 'px Amiri';
      const ar = wrap(c, item.text, maxW);
      const arLh = size * 1.95;
      let trLines = [], trSize = size * 0.5, trLh = 0;
      if (showTr) {
        c.font = trSize + 'px Tajawal';
        trLines = wrap(c, item.translation, maxW);
        trLh = trSize * 1.5;
      }
      const gap = showTr ? size * 0.9 : 0;
      const total = ar.length * arLh + gap + trLines.length * trLh;
      if (total <= maxH || size < 14) return finishLayout(c, { size, ar, arLh, trSize, trLines, trLh, gap, total });
      size *= 0.95;
    }
  }
  function finishLayout(c, L) {
    c.font = L.size + 'px Amiri';
    L.widest = Math.max(...L.ar.map(l => c.measureText(l).width), 1);
    return L;
  }

  function drawChrome(c, w, h, F, progress) {
    drawBackground(c, w, h, progress);
    const base = F.base;
    c.textAlign = 'center';
    c.textBaseline = 'middle';

    // branding (always LTR English so shared cards read the same everywhere)
    const icon = base * 0.045, bSize = base * 0.028, y0 = base * 0.07;
    c.save();
    c.globalAlpha = 0.85;
    c.direction = 'ltr';
    c.font = '700 ' + bSize + 'px Tajawal';
    const tw = c.measureText(BRAND).width;
    const hasIcon = appIcon.complete && appIcon.naturalWidth;
    let x = (w - tw - (hasIcon ? icon + base * 0.012 : 0)) / 2;
    if (hasIcon) {
      c.save();
      c.beginPath();
      if (c.roundRect) c.roundRect(x, y0 - icon / 2, icon, icon, icon * 0.22); else c.rect(x, y0 - icon / 2, icon, icon);
      c.clip();
      c.drawImage(appIcon, x, y0 - icon / 2, icon, icon);
      c.restore();
      x += icon + base * 0.012;
    }
    c.textAlign = 'left';
    c.fillStyle = '#fff';
    c.fillText(BRAND, x, y0);
    c.restore();

    // title + ornament
    if (F.meta && item.title) {
      c.save();
      c.direction = hasArabic(item.title) ? 'rtl' : 'ltr';
      c.fillStyle = GOLD;
      let ts = base * 0.055;
      c.font = ts + 'px Amiri';   // only regular Amiri ships
      while (c.measureText(item.title).width > w * 0.88 && ts > base * 0.03) { ts *= 0.94; c.font = ts + 'px Amiri'; }
      c.shadowColor = 'rgba(0,0,0,0.5)';
      c.shadowBlur = 10;
      c.fillText(item.title, w / 2, base * 0.165);
      c.restore();
    }
    c.save();
    c.strokeStyle = 'rgba(230,192,104,0.55)';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(w / 2 - base * 0.14, F.top - base * 0.02);
    c.lineTo(w / 2 + base * 0.14, F.top - base * 0.02);
    c.stroke();
    c.restore();

    // footer: repeat count + source (wraps to two lines)
    if (F.footer) {
      const { fs, lines, lh } = F.footer;
      c.save();
      c.direction = isRtlUi() || hasArabic(item.source) ? 'rtl' : 'ltr';
      c.fillStyle = 'rgba(255,255,255,0.78)';
      c.font = fs + 'px Tajawal';
      const y = h - base * 0.1 - (lines.length - 1) * lh;
      lines.forEach((ln, i) => c.fillText(ln, w / 2, y + i * lh));
      c.restore();
    }
  }

  // Translucent panel + Arabic (+ translation). alpha/rise animate videos.
  function drawBody(c, w, F, L, alpha, rise, dots) {
    if (alpha <= 0) return;
    const base = F.base;
    const cy = (F.top + F.bottom) / 2 + rise;
    const pw = Math.min(Math.max(L.widest, w * 0.5) + base * 0.1, w * 0.92);
    const ph = L.total + base * 0.07 + (dots ? base * 0.05 : 0);
    c.save();
    c.globalAlpha = alpha;
    c.fillStyle = 'rgba(0,0,0,0.30)';
    c.strokeStyle = 'rgba(255,255,255,0.12)';
    c.lineWidth = 2;
    c.beginPath();
    if (c.roundRect) c.roundRect((w - pw) / 2, cy - ph / 2, pw, ph, base * 0.04); else c.rect((w - pw) / 2, cy - ph / 2, pw, ph);
    c.fill();
    c.stroke();

    let y = cy - L.total / 2 - (dots ? base * 0.025 : 0);
    c.direction = 'rtl';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#fff';
    c.shadowColor = 'rgba(0,0,0,0.55)';
    c.shadowBlur = L.size * 0.25;
    c.font = L.size + 'px Amiri';
    L.ar.forEach(line => { c.fillText(line, w / 2, y + L.arLh / 2); y += L.arLh; });
    if (L.trLines.length) {
      y += L.gap;
      c.direction = 'ltr';
      c.fillStyle = 'rgba(255,255,255,0.82)';
      c.font = L.trSize + 'px Tajawal';
      L.trLines.forEach(line => { c.fillText(line, w / 2, y + L.trLh / 2); y += L.trLh; });
    }
    // screen indicator for multi-screen videos (RTL: first screen on the right)
    if (dots) {
      c.shadowColor = 'transparent';
      const r = base * 0.007, gap = base * 0.028, dy = cy + ph / 2 - base * 0.04;
      const x0 = w / 2 + (dots.n - 1) * gap / 2;
      for (let i = 0; i < dots.n; i++) {
        c.fillStyle = i === dots.i ? GOLD : 'rgba(255,255,255,0.35)';
        c.beginPath();
        c.arc(x0 - i * gap, dy, i === dots.i ? r * 1.4 : r, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.restore();
  }

  function sizeCanvas() {
    const [w, h] = FORMATS[state.format];
    const cv = ui.canvas;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return [w, h];
  }

  // Caller-drawn content (item.custom) in a panel filling the body area.
  function drawCustom(c, w, F, alpha, rise, anim) {
    if (alpha <= 0) return;
    const base = F.base;
    const pw = w * 0.9, ph = F.bottom - F.top - base * 0.04;
    const x = (w - pw) / 2, y = F.top + base * 0.02 + rise;
    c.save();
    c.globalAlpha = alpha;
    c.fillStyle = 'rgba(0,0,0,0.30)';
    c.strokeStyle = 'rgba(255,255,255,0.12)';
    c.lineWidth = 2;
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, pw, ph, base * 0.04); else c.rect(x, y, pw, ph);
    c.fill();
    c.stroke();
    try { item.custom.draw(c, { x, y, w: pw, h: ph, base }, anim); }
    catch (e) { console.warn('[share-card] custom draw failed', e); }
    c.restore();
  }

  function draw() {
    const [w, h] = sizeCanvas();
    const c = ui.canvas.getContext('2d');
    c.clearRect(0, 0, w, h);
    const F = frame(c, w, h);
    drawChrome(c, w, h, F, 0);
    if (item.custom) drawCustom(c, w, F, 1, 0, 1);
    else drawBody(c, w, F, layoutBody(c, w, F.maxH), 1, 0, null);
  }

  // ---------- video ----------
  // One screen if the whole text fits at a readable size (translation
  // included); otherwise fixed-size Arabic split into screens.
  function videoPlan(c, w, h) {
    const F = frame(c, w, h);
    if (item.custom) {
      const dur = item.custom.seconds || 7;
      return { F, pages: [{ custom: true, start: LEAD, dur }], total: LEAD + dur + TAIL };
    }
    const words = s => s.split(/\s+/).filter(Boolean).length;
    let pages;
    const single = layoutBody(c, w, F.maxH);
    if (single.size >= w * 0.05) {
      pages = [{ L: single, words: words(item.text) + (single.trLines.length ? words(item.translation) * 0.5 : 0) }];
    } else {
      const size = w * 0.056, arLh = size * 1.95;
      c.font = size + 'px Amiri';
      const lines = wrap(c, item.text, w * 0.8);
      const per = Math.max(1, Math.floor((F.maxH - w * 0.05) / arLh));
      pages = [];
      for (let i = 0; i < lines.length; i += per) {
        const ar = lines.slice(i, i + per);
        pages.push({
          L: finishLayout(c, { size, ar, arLh, trSize: 0, trLines: [], trLh: 0, gap: 0, total: ar.length * arLh }),
          words: words(ar.join(' ')),
        });
      }
    }
    let t = LEAD;
    pages.forEach(p => { p.start = t; p.dur = pageSeconds(p.words); t += p.dur; });
    return { F, pages, total: t + TAIL };
  }

  function drawVideoFrame(c, w, h, plan, t) {
    const { F, pages, total } = plan;
    c.clearRect(0, 0, w, h);
    drawChrome(c, w, h, F, clamp01(t / total));
    const last = pages.length - 1;
    pages.forEach((p, i) => {
      const local = t - p.start;
      if (local < 0 || (i < last && local > p.dur)) return;
      const fadeIn = clamp01(local / FADE);
      const fadeOut = i < last ? clamp01((p.dur - local) / FADE) : 1;
      const alpha = Math.min(fadeIn, fadeOut);
      const rise = (1 - fadeIn) * F.base * 0.02;
      // custom content animates in over ~2.2 s (ease-out)
      if (p.custom) { drawCustom(c, w, F, alpha, rise, 1 - Math.pow(1 - clamp01(local / 2.2), 3)); return; }
      drawBody(c, w, F, p.L, alpha, rise, pages.length > 1 ? { n: pages.length, i } : null);
    });
  }

  function pickMime() {
    if (!window.MediaRecorder) return null;
    const list = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4',
      'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    return list.find(m => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || null;
  }

  function loadFastStart() {
    if (window.Mp4FastStart) return Promise.resolve();
    return new Promise(res => {
      const s = document.createElement('script');
      s.src = ROOT + 'js/mp4-faststart.js';
      s.onload = s.onerror = () => res();
      document.head.appendChild(s);
    });
  }

  async function makeVideo() {
    if (recording) return;
    const mime = pickMime();
    if (!mime || !ui.canvas.captureStream) { setStatus(tr('sc_video_unsupported'), true); return; }
    const [w, h] = sizeCanvas();
    const c = ui.canvas.getContext('2d');
    const plan = videoPlan(c, w, h);
    if (plan.total > MAX_VIDEO) { setStatus(tr('sc_video_too_long'), true); return; }

    clearVideo();
    let cancelled = false;
    recording = { cancel: () => { cancelled = true; } };
    syncUi();
    setStatus(tr('sc_recording'));
    let wakeLock = null;
    try { if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* optional */ }

    drawVideoFrame(c, w, h, plan, 0);
    const stream = ui.canvas.captureStream(FPS);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6000000 });
    const chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise(res => { rec.onstop = res; });
    rec.start(1000);
    const t0 = performance.now();
    await new Promise(resolve => {
      const tick = () => {
        const t = (performance.now() - t0) / 1000;
        drawVideoFrame(c, w, h, plan, Math.min(t, plan.total));
        ui.bar.style.width = (clamp01(t / plan.total) * 100).toFixed(1) + '%';
        if (cancelled || t >= plan.total) { resolve(); return; }
        requestAnimationFrame(tick);
      };
      tick();
    });
    rec.stop();
    await stopped;
    stream.getTracks().forEach(tk => tk.stop());
    if (wakeLock) wakeLock.release().catch(() => {});
    recording = null;

    if (cancelled || !ui || ui.overlay.hidden) { setStatus(''); syncUi(); redraw(); return; }
    const type = (rec.mimeType || mime).split(';')[0];
    let blob = new Blob(chunks, { type });
    // MediaRecorder MP4 is fragmented with a 0/partial duration in the header
    // (galleries and WhatsApp show the wrong length) — rewrite it losslessly.
    if (type.includes('mp4')) {
      await loadFastStart();
      if (window.Mp4FastStart) {
        try {
          const fixed = Mp4FastStart.defragment(await blob.arrayBuffer());
          if (fixed) blob = new Blob([fixed], { type: 'video/mp4' });
        } catch (e) { console.warn('[share-card] MP4 remux failed, keeping original', e); }
      }
    }
    const ext = type.includes('mp4') ? 'mp4' : 'webm';
    video = { blob, type, name: fileName(ext), seconds: Math.round(plan.total) };
    setStatus(tr('sc_video_ready', { s: video.seconds }) + (ext === 'webm' ? ' — ' + tr('sc_webm_note') : ''));
    syncUi();
    draw();
  }

  function clearVideo() { video = null; }

  // ---------- export ----------
  function fileName(ext) {
    const slug = (item.title || 'duaa').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || 'duaa';
    return 'zad-' + slug + '.' + ext;
  }
  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  async function shareBlob(blob, name, type) {
    const file = new File([blob], name, { type });
    const text = tr('sc_made_with') + '\nGoogle Play: ' + PLAY_URL;
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text }); } catch (e) { /* user dismissed */ }
    } else {
      saveBlob(blob, name);
    }
  }
  function imageBlob() {
    draw();
    return new Promise(res => ui.canvas.toBlob(res, 'image/png'));
  }
  async function shareImage() { const b = await imageBlob(); if (b) shareBlob(b, fileName('png'), 'image/png'); }
  async function saveImage() { const b = await imageBlob(); if (b) saveBlob(b, fileName('png')); }

  // ---------- UI ----------
  const CSS = `
  .sc-overlay{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center;
    -webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);font-family:'Tajawal',system-ui,sans-serif}
  .sc-overlay[hidden]{display:none}
  .sc-sheet{width:100%;max-width:560px;max-height:96dvh;overflow:auto;background:#0f1a17;color:#f3efe4;border-radius:22px 22px 0 0;
    padding:14px 16px calc(16px + env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(0,0,0,.5);border-top:1px solid rgba(230,192,104,.35)}
  .sc-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
  .sc-head h2{margin:0;font-size:1.1rem;font-weight:700;color:${GOLD}}
  .sc-x{background:rgba(255,255,255,.08);border:0;color:inherit;width:36px;height:36px;border-radius:50%;font-size:1.1rem;cursor:pointer}
  .sc-preview{display:flex;justify-content:center;margin-bottom:12px}
  .sc-preview canvas{max-width:100%;max-height:42dvh;border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.45)}
  .sc-label{font-size:.82rem;opacity:.75;margin:10px 2px 6px}
  .sc-chips{display:flex;gap:8px;flex-wrap:wrap}
  .sc-chip{flex:1;min-width:0;padding:9px 6px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);
    color:inherit;font:inherit;font-size:.9rem;cursor:pointer}
  .sc-chip.active{border-color:${GOLD};background:rgba(230,192,104,.16);color:${GOLD};font-weight:700}
  .sc-bgs{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}
  .sc-bgs::-webkit-scrollbar{display:none}
  .sc-bg{flex:0 0 54px;height:54px;border-radius:12px;border:2px solid transparent;background-size:cover;background-position:center;cursor:pointer;padding:0}
  .sc-bg.active{border-color:${GOLD};box-shadow:0 0 0 2px rgba(230,192,104,.3)}
  .sc-toggles{display:flex;gap:8px;margin-top:4px}
  .sc-actions{display:flex;gap:10px;margin-top:12px}
  .sc-actions[hidden]{display:none}
  .sc-btn{flex:1;padding:13px;border-radius:14px;border:0;font:inherit;font-weight:700;font-size:1rem;cursor:pointer}
  .sc-btn[hidden]{display:none}
  .sc-btn.primary{background:${GOLD};color:#1a1408}
  .sc-btn.ghost{background:rgba(255,255,255,.08);color:inherit;border:1px solid rgba(255,255,255,.14)}
  .sc-btn:disabled{opacity:.45;cursor:default}
  .sc-progress{height:6px;border-radius:3px;background:rgba(255,255,255,.1);overflow:hidden;margin-top:14px}
  .sc-progress[hidden]{display:none}
  .sc-progress > div{height:100%;width:0;background:${GOLD};transition:width .2s linear}
  .sc-status{font-size:.85rem;opacity:.85;margin-top:10px;text-align:center;min-height:1em}
  .sc-status.error{color:#fca5a5;opacity:1}
  .sc-busy .sc-chip,.sc-busy .sc-bg{pointer-events:none;opacity:.5}
  `;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function btn(cls, onClick) {
    const b = el('button', cls);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  function build() {
    const style = el('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const overlay = el('div', 'sc-overlay');
    overlay.hidden = true;
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    const sheet = el('div', 'sc-sheet');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    overlay.appendChild(sheet);

    const head = el('div', 'sc-head');
    const h2 = el('h2');
    const x = btn('sc-x', close);
    x.textContent = '✕';
    head.append(h2, x);

    const preview = el('div', 'sc-preview');
    const canvas = el('canvas');
    preview.appendChild(canvas);

    const fmtLabel = el('div', 'sc-label');
    const fmts = el('div', 'sc-chips');
    const bgLabel = el('div', 'sc-label');
    const bgs = el('div', 'sc-bgs');
    const toggles = el('div', 'sc-toggles');
    const trChip = btn('sc-chip', () => { state.translation = !state.translation; changed(); });
    const srcChip = btn('sc-chip', () => { state.source = !state.source; changed(); });
    toggles.append(trChip, srcChip);

    const imgRow = el('div', 'sc-actions');
    const shareBtn = btn('sc-btn primary', shareImage);
    const dlBtn = btn('sc-btn ghost', saveImage);
    imgRow.append(shareBtn, dlBtn);

    const vidRow = el('div', 'sc-actions');
    const videoBtn = btn('sc-btn ghost', () => { if (recording) recording.cancel(); else makeVideo(); });
    const shareVidBtn = btn('sc-btn primary', () => video && shareBlob(video.blob, video.name, video.type));
    const saveVidBtn = btn('sc-btn ghost', () => video && saveBlob(video.blob, video.name));
    vidRow.append(videoBtn, shareVidBtn, saveVidBtn);

    const progress = el('div', 'sc-progress');
    const bar = el('div');
    progress.appendChild(bar);
    const status = el('div', 'sc-status');

    sheet.append(head, preview, fmtLabel, fmts, bgLabel, bgs, toggles, imgRow, vidRow, progress, status);
    document.body.appendChild(overlay);
    ui = { overlay, sheet, h2, x, canvas, fmtLabel, fmts, bgLabel, bgs, trChip, srcChip,
      shareBtn, dlBtn, videoBtn, shareVidBtn, saveVidBtn, progress, bar, status };
  }

  function setStatus(msg, isError) {
    if (!ui) return;
    ui.status.textContent = msg || '';
    ui.status.classList.toggle('error', !!isError);
  }

  function syncUi() {
    const busy = !!recording;
    ui.sheet.classList.toggle('sc-busy', busy);
    ui.shareBtn.disabled = ui.dlBtn.disabled = busy;
    ui.progress.hidden = !busy;
    if (!busy) ui.bar.style.width = '0';
    ui.videoBtn.textContent = busy ? tr('sc_cancel') : tr('sc_make_video');
    ui.shareVidBtn.hidden = ui.saveVidBtn.hidden = busy || !video;
    ui.shareVidBtn.textContent = tr('sc_share_video');
    ui.saveVidBtn.textContent = tr('sc_save_video');
  }

  // Any option change makes a recorded video stale.
  function changed() {
    if (recording) return;
    if (video) { clearVideo(); setStatus(''); }
    refresh();
  }

  function renderBgs() {
    ui.bgs.textContent = '';
    const add = (id, bgCss) => {
      const b = btn('sc-bg' + (state.bg === id ? ' active' : ''), () => { state.bg = id; changed(); });
      b.style.background = bgCss;
      b.style.backgroundSize = 'cover';
      ui.bgs.appendChild(b);
    };
    GRADIENTS.forEach((g, i) => add('g' + i, `linear-gradient(160deg, ${g.stops.join(', ')})`));
    (photos || []).forEach(f => add('i:' + f, `center/cover url("${BG_DIR}${encodeURI(f)}")`));
  }

  async function loadPhotos() {
    if (photos) return;
    photos = [];
    try {
      const res = await fetch(BG_DIR + 'manifest.json');
      const list = await res.json();
      if (Array.isArray(list)) photos = list.filter(f => typeof f === 'string' && /\.(webp|jpe?g|png)$/i.test(f) && !f.includes('.thumb.'));
    } catch (e) { /* offline: gradients only */ }
    if (ui && !ui.overlay.hidden) renderBgs();
  }

  function refresh() {
    saveState();
    ui.sheet.dir = isRtlUi() ? 'rtl' : 'ltr';
    ui.h2.textContent = tr('sc_title');
    ui.x.setAttribute('aria-label', tr('sc_close'));
    ui.fmtLabel.textContent = tr('sc_format');
    ui.bgLabel.textContent = tr('sc_background');
    ui.fmts.textContent = '';
    Object.keys(FORMATS).forEach(f => {
      const b = btn('sc-chip' + (state.format === f ? ' active' : ''), () => { state.format = f; changed(); });
      b.textContent = tr('sc_fmt_' + f);
      ui.fmts.appendChild(b);
    });
    renderBgs();
    ui.trChip.hidden = !item.translation;
    ui.trChip.textContent = tr('sc_translation');
    ui.trChip.classList.toggle('active', !!state.translation);
    ui.srcChip.hidden = !(item.title || item.source || item.repeat > 1);
    ui.srcChip.textContent = tr('sc_source');
    ui.srcChip.classList.toggle('active', !!state.source);
    ui.shareBtn.textContent = tr('sc_share');
    ui.dlBtn.textContent = tr('sc_download');
    syncUi();
    draw();
  }

  // Source texts carry invisible direction marks, spaces before punctuation
  // and stray punctuation-only lines (e.g. 'تَغْضَبْ" .   \n .').
  function cleanText(s) {
    return String(s).replace(/[\u200E\u200F]/g, '')
      .split('\n')
      .map(l => l.replace(/[ \t\u00A0]+([.,\u060C\u061B:!\u061F])/g, '$1').replace(/[ \t\u00A0]{2,}/g, ' ').trim())
      .filter(l => !/^[\s.,\u060C\u061B:!\u061F]*$/.test(l))
      .join('\n');
  }

  async function open(entry) {
    if (!entry || !(entry.text || (entry.custom && typeof entry.custom.draw === 'function'))) return;
    item = {
      custom: entry.custom || null,
      text: entry.text ? cleanText(entry.text) : '',
      translation: entry.translation ? String(entry.translation).trim() : '',
      title: entry.title ? String(entry.title).trim() : '',
      source: entry.source ? String(entry.source).trim() : '',
      repeat: parseInt(entry.repeat, 10) || 1,
    };
    if (!ui) build();
    clearVideo();
    setStatus('');
    ui.overlay.hidden = false;
    if (window.BackClose) BackClose.opened(close);
    refresh();
    loadPhotos();
    // Draw again once the bundled fonts are ready (first open may predate them).
    if (document.fonts && document.fonts.load) {
      Promise.all(['40px Amiri', '40px Tajawal', '700 40px Tajawal'].map(f => document.fonts.load(f)))
        .then(redraw, () => {});
    }
  }

  function close() {
    if (!ui || ui.overlay.hidden) return;
    if (recording) recording.cancel();
    if (window.BackClose) BackClose.closed();
    ui.overlay.hidden = true;
    clearVideo();
  }

  window.ShareCard = { open, close };
})();
