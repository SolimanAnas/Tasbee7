/* =========================================================================
   share-card.js — turn a duaa / dhikr into a shareable image card

   Usage (any page that loads css/fonts.css + js/i18n.js):
     ShareCard.open({
       text:        'اللَّهُمَّ ...',       // Arabic (required)
       translation: 'O Allah ...',          // optional, toggleable
       title:       'أذكار الصباح',          // optional heading
       source:      'رواه مسلم',             // optional reference line
       repeat:      3,                      // optional, shown when > 1
     });

   Opens a bottom sheet with a live preview, background / size / toggle
   options and Share (Web Share API with the PNG) + Download buttons.
   ========================================================================= */
(function () {
  'use strict';

  const FORMATS = { square: [1080, 1080], portrait: [1080, 1350], story: [1080, 1920] };
  const BRAND = 'Zad Al-Muslim App';
  const PLAY_URL = 'https://play.google.com/store/apps/details?id=io.github.solimananas.twa';
  const STORE_KEY = 'sc_settings';
  const GOLD = '#e6c068';

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
      sc_title: 'مشاركة كصورة', sc_share: 'مشاركة', sc_download: 'حفظ الصورة', sc_close: 'إغلاق',
      sc_format: 'المقاس', sc_fmt_square: 'مربع', sc_fmt_portrait: 'عمودي', sc_fmt_story: 'ستوري',
      sc_background: 'الخلفية', sc_translation: 'الترجمة', sc_source: 'العنوان والمصدر',
      sc_repeat: 'التكرار: {n}', sc_made_with: 'صُنع بتطبيق زاد المسلم',
    },
    en: {
      sc_title: 'Share as image', sc_share: 'Share', sc_download: 'Save image', sc_close: 'Close',
      sc_format: 'Size', sc_fmt_square: 'Square', sc_fmt_portrait: 'Portrait', sc_fmt_story: 'Story',
      sc_background: 'Background', sc_translation: 'Translation', sc_source: 'Title & source',
      sc_repeat: 'Repeat: {n}×', sc_made_with: 'Made with Zad Al-Muslim App',
    },
  };

  const lang = () => (window.I18n ? I18n.getLang() : 'ar');
  const isRtlUi = () => ['ar', 'ckb', 'ur'].includes(lang());
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
  const imgCache = new Map();
  const appIcon = new Image();
  appIcon.src = ROOT + 'icons/icon-192.png';
  appIcon.onload = () => { if (ui && !ui.overlay.hidden) draw(); };

  // ---------- drawing ----------
  function photo(file) {
    if (!imgCache.has(file)) {
      const img = new Image();
      img.onload = () => { if (ui && !ui.overlay.hidden && state.bg === 'i:' + file) draw(); };
      img.src = BG_DIR + encodeURI(file);
      imgCache.set(file, img);
    }
    return imgCache.get(file);
  }

  function drawBackground(c, w, h) {
    const img = state.bg.startsWith('i:') ? photo(state.bg.slice(2)) : null;
    if (img && img.complete && img.naturalWidth) {
      const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
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
      const rad = c.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, Math.max(w, h) * 0.65);
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
      if (total <= maxH || size < 14) {
        c.font = size + 'px Amiri';
        const widest = Math.max(...ar.map(l => c.measureText(l).width));
        return { size, ar, arLh, trSize, trLines, trLh, gap, total, widest };
      }
      size *= 0.95;
    }
  }

  function draw() {
    const [w, h] = FORMATS[state.format];
    const cv = ui.canvas;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const c = cv.getContext('2d');
    c.clearRect(0, 0, w, h);
    drawBackground(c, w, h);

    const base = w;                       // all formats are 1080 wide
    const showMeta = state.source;
    const top = base * 0.16 + (showMeta && item.title ? base * 0.08 : 0);
    const bottom = h - base * 0.1 - (showMeta && (item.source || item.repeat > 1) ? base * 0.08 : 0);

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
    if (showMeta && item.title) {
      c.save();
      c.direction = /[؀-ۿ]/.test(item.title) ? 'rtl' : 'ltr';
      c.fillStyle = GOLD;
      c.font = (base * 0.055) + 'px Amiri';   // only regular Amiri ships
      c.shadowColor = 'rgba(0,0,0,0.5)';
      c.shadowBlur = 10;
      c.fillText(item.title, w / 2, base * 0.165);
      c.restore();
    }
    c.save();
    c.strokeStyle = 'rgba(230,192,104,0.55)';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(w / 2 - base * 0.14, top - base * 0.02);
    c.lineTo(w / 2 + base * 0.14, top - base * 0.02);
    c.stroke();
    c.restore();

    // body: translucent panel, Arabic, optional translation
    const L = layoutBody(c, w, bottom - top - base * 0.08);
    const cy = (top + bottom) / 2;
    const pw = Math.min(Math.max(L.widest, w * 0.5) + base * 0.1, w * 0.92);
    const ph = L.total + base * 0.07;
    c.save();
    c.fillStyle = 'rgba(0,0,0,0.30)';
    c.strokeStyle = 'rgba(255,255,255,0.12)';
    c.lineWidth = 2;
    c.beginPath();
    if (c.roundRect) c.roundRect((w - pw) / 2, cy - ph / 2, pw, ph, base * 0.04); else c.rect((w - pw) / 2, cy - ph / 2, pw, ph);
    c.fill();
    c.stroke();
    c.restore();

    let y = cy - L.total / 2;
    c.save();
    c.direction = 'rtl';
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
    c.restore();

    // footer: repeat count + source
    if (showMeta) {
      const parts = [];
      if (item.repeat > 1) parts.push(tr('sc_repeat', { n: item.repeat }));
      if (item.source) parts.push(item.source);
      if (parts.length) {
        c.save();
        c.direction = isRtlUi() || /[؀-ۿ]/.test(item.source || '') ? 'rtl' : 'ltr';
        c.fillStyle = 'rgba(255,255,255,0.78)';
        let fs = base * 0.03;
        const textLine = parts.join('  •  ');
        c.font = fs + 'px Tajawal';
        while (c.measureText(textLine).width > w * 0.86 && fs > 16) { fs *= 0.94; c.font = fs + 'px Tajawal'; }
        c.fillText(textLine, w / 2, h - base * 0.11);
        c.restore();
      }
    }
  }

  // ---------- export ----------
  function toBlob() {
    return new Promise(res => ui.canvas.toBlob(res, 'image/png'));
  }
  function fileName() {
    const slug = (item.title || 'duaa').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || 'duaa';
    return 'zad-' + slug + '.png';
  }
  async function download() {
    const blob = await toBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  async function share() {
    const blob = await toBlob();
    if (!blob) return;
    const file = new File([blob], fileName(), { type: 'image/png' });
    const text = tr('sc_made_with') + '\nGoogle Play: ' + PLAY_URL;
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text }); } catch (e) { /* user dismissed */ }
    } else {
      download();
    }
  }

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
  .sc-actions{display:flex;gap:10px;margin-top:16px}
  .sc-btn{flex:1;padding:13px;border-radius:14px;border:0;font:inherit;font-weight:700;font-size:1rem;cursor:pointer}
  .sc-btn.primary{background:${GOLD};color:#1a1408}
  .sc-btn.ghost{background:rgba(255,255,255,.08);color:inherit;border:1px solid rgba(255,255,255,.14)}
  `;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
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
    const x = el('button', 'sc-x', '✕');
    x.type = 'button';
    x.addEventListener('click', close);
    head.append(h2, x);

    const preview = el('div', 'sc-preview');
    const canvas = el('canvas');
    preview.appendChild(canvas);

    const fmtLabel = el('div', 'sc-label');
    const fmts = el('div', 'sc-chips');
    const bgLabel = el('div', 'sc-label');
    const bgs = el('div', 'sc-bgs');
    const toggles = el('div', 'sc-toggles');
    const trChip = el('button', 'sc-chip');
    const srcChip = el('button', 'sc-chip');
    trChip.type = srcChip.type = 'button';
    trChip.addEventListener('click', () => { state.translation = !state.translation; refresh(); });
    srcChip.addEventListener('click', () => { state.source = !state.source; refresh(); });
    toggles.append(trChip, srcChip);

    const actions = el('div', 'sc-actions');
    const shareBtn = el('button', 'sc-btn primary');
    const dlBtn = el('button', 'sc-btn ghost');
    shareBtn.type = dlBtn.type = 'button';
    shareBtn.addEventListener('click', share);
    dlBtn.addEventListener('click', download);
    actions.append(shareBtn, dlBtn);

    sheet.append(head, preview, fmtLabel, fmts, bgLabel, bgs, toggles, actions);
    document.body.appendChild(overlay);
    ui = { overlay, sheet, h2, x, canvas, fmtLabel, fmts, bgLabel, bgs, trChip, srcChip, shareBtn, dlBtn };
  }

  function renderBgs() {
    ui.bgs.textContent = '';
    const add = (id, bgCss) => {
      const b = el('button', 'sc-bg' + (state.bg === id ? ' active' : ''));
      b.type = 'button';
      b.style.background = bgCss;
      b.style.backgroundSize = 'cover';
      b.addEventListener('click', () => { state.bg = id; refresh(); });
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
      const b = el('button', 'sc-chip' + (state.format === f ? ' active' : ''), tr('sc_fmt_' + f));
      b.type = 'button';
      b.addEventListener('click', () => { state.format = f; refresh(); });
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
    draw();
  }

  async function open(entry) {
    if (!entry || !entry.text) return;
    item = {
      text: String(entry.text).trim(),
      translation: entry.translation ? String(entry.translation).trim() : '',
      title: entry.title ? String(entry.title).trim() : '',
      source: entry.source ? String(entry.source).trim() : '',
      repeat: parseInt(entry.repeat, 10) || 1,
    };
    if (!ui) build();
    ui.overlay.hidden = false;
    if (window.BackClose) BackClose.opened(close);
    refresh();
    loadPhotos();
    // Draw again once the bundled fonts are ready (first open may predate them).
    if (document.fonts && document.fonts.load) {
      Promise.all(['40px Amiri', '40px Tajawal', '700 40px Tajawal'].map(f => document.fonts.load(f)))
        .then(() => { if (!ui.overlay.hidden) draw(); }, () => {});
    }
  }

  function close() {
    if (!ui || ui.overlay.hidden) return;
    if (window.BackClose) BackClose.closed();
    ui.overlay.hidden = true;
  }

  window.ShareCard = { open, close };
})();
