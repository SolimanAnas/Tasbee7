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
  const STORE_KEY = 'vm_settings';
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
    fontMul: 1,
    color: '#ffffff',
    caption: true,
    basmala: true,
  };

  let surahs = [];        // [{ n, name, nameEn, ayat: [text...] }]
  let basmalaText = '';
  let reciters = [];
  let bgImages = [];      // filenames from the manifest
  let bgImg = null;       // loaded Image for the current 'i:' background
  let bgVideo = null;     // <video> for the current 'v:' background (muted, looping)
  let timeline = null;    // last built timeline (reused by preview + export)
  let playing = null;     // { sources, t0, raf, export }
  const layoutCache = new Map();

  // ---------- helpers ----------
  const tr = (k, p) => (window.t ? window.t(k, p) : k);
  const lang = () => (window.I18n ? I18n.getLang() : 'ar');
  const arabicNames = () => ['ar', 'ckb', 'ur'].includes(lang());
  const pad3 = n => String(n).padStart(3, '0');
  const arDigits = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  const clamp01 = x => Math.max(0, Math.min(1, x));
  const isVideoFile = f => /.(mp4|webm)$/i.test(f);
  // Each video ships a '<name>.thumb.webp' still for the picker (see scripts/gen-video-bgs.cjs).
  const thumbFor = f => f.replace(/.(mp4|webm)$/i, '.thumb.webp');

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
  }

  function reciterObj() {
    return reciters.find(r => r.id === state.reciter) || reciters[0];
  }
  function reciterName(r) { return arabicNames() ? r.name : r.en; }
  function surahObj() { return surahs[state.surah - 1]; }
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
    for (const s of surahs) {
      if (s.n === 1) continue;
      if (s.ayat[0] && s.ayat[0].startsWith(basmalaText)) s.ayat[0] = s.ayat[0].slice(basmalaText.length).trim();
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
  // Cover-fits an image or video frame, then darkens it so the text stays readable.
  function drawCover(c, src, sw, sh, w, h, zoom) {
    const scale = Math.max(w / sw, h / sh) * zoom;
    const dw = sw * scale, dh = sh * scale;
    c.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
    c.fillStyle = 'rgba(0,0,0,0.38)';
    c.fillRect(0, 0, w, h);
  }

  function drawBackground(c, w, h, progress) {
    const zoom = 1 + 0.08 * progress;   // slow Ken Burns push-in
    if (state.bg.startsWith('v:') && bgVideo && bgVideo.readyState >= 2) {
      drawCover(c, bgVideo, bgVideo.videoWidth, bgVideo.videoHeight, w, h, zoom);
    } else if (state.bg.startsWith('i:') && bgImg && bgImg.complete && bgImg.naturalWidth) {
      drawCover(c, bgImg, bgImg.naturalWidth, bgImg.naturalHeight, w, h, zoom);
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
    // UthmanicHafs draws its own ayah-end ornament around Arabic-Indic digits,
    // so no ﴿﴾ brackets; the NBSP keeps the marker from wrapping onto its own line.
    if (seg.num != null && words.length) words[words.length - 1] += ' ' + arDigits(seg.num);
    const maxW = w * 0.84;
    const maxH = h * (state.caption ? 0.6 : 0.7);
    let size = Math.min(w, h) * 0.085 * state.fontMul;
    let lines;
    for (;;) {
      c.font = size + 'px QuranHafs';
      lines = wrapWords(c, words, maxW);
      if (lines.length * size * 1.8 <= maxH || size <= 22) break;
      size *= 0.94;
    }
    const out = { size, lines, lh: size * 1.8 };
    layoutCache.set(key, out);
    if (layoutCache.size > 200) layoutCache.delete(layoutCache.keys().next().value);
    return out;
  }

  function drawAyah(c, seg, w, h, alpha) {
    if (alpha <= 0) return;
    const L = layoutText(c, seg, w, h);
    c.save();
    c.globalAlpha = alpha;
    c.font = L.size + 'px QuranHafs';
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
      c.font = (base * 0.045) + 'px QuranHafs';
      c.fillText(s.name, w / 2, y);
    } else {
      c.font = (base * 0.04) + 'px VMTajawal';
      c.fillText('Surah ' + surahLatin(s), w / 2, y);
    }
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.font = (base * 0.03) + 'px VMTajawal';
    c.fillText(reciterName(reciterObj()), w / 2, y + base * 0.055);
    c.fillStyle = 'rgba(255,255,255,0.5)';
    c.font = (base * 0.024) + 'px VMTajawal';
    c.fillText(tr('app_name'), w / 2, base * 0.07);
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
  }

  function sizeCanvas() {
    const [w, h] = FORMATS[state.format];
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
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
  function startBgVideo() {
    if (bgVideo && state.bg.startsWith('v:')) {
      bgVideo.currentTime = 0;
      bgVideo.play().catch(() => {});
    }
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
  }

  // Locks every control while exporting — a mid-recording change would alter the clip.
  function setBusy(busy) {
    ['vmExport', 'vmPreview'].forEach(id => { $(id).disabled = busy; });
    document.querySelectorAll('.controls-col input, .controls-col select, .controls-col button').forEach(el => { el.disabled = busy; });
    if (!busy) $('vmCancel').hidden = true;
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
    const t0 = ac.currentTime + 0.1;
    startBgVideo();
    playing = { sources: startSources(tl, [ac.destination], t0), t0, raf: 0, export: false };
    updatePreviewBtn();
    const tick = () => {
      if (!playing) return;
      const t = ac.currentTime - playing.t0;
      renderFrame(ctx, canvas.width, canvas.height, Math.max(0, t), tl);
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
    $('vmResult').hidden = true;
    setBusy(true);
    const tl = await loadTimelineWithUi();
    if (!tl) { setBusy(false); return; }

    let wakeLock = null;
    try { if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* optional */ }

    sizeCanvas();
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
    $('vmCancel').hidden = false;

    startBgVideo();
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
    showResult(new Blob(chunks, { type }), type);
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
    const shareBtn = $('vmShare');
    const canShare = navigator.canShare && navigator.canShare({ files: [file] });
    shareBtn.hidden = !canShare;
    shareBtn.onclick = () => {
      navigator.share({ files: [file], title: tr('vm_title') }).catch(() => { /* user dismissed */ });
    };
    $('vmResult').hidden = false;
    setStatus(tr('vm_done'));
    $('vmResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ---------- controls ----------
  function fillSurahs() {
    const sel = $('vmSurah');
    sel.innerHTML = '';
    surahs.forEach(s => {
      const o = document.createElement('option');
      o.value = s.n;
      o.textContent = s.n + '. ' + (arabicNames() ? s.name : surahLatin(s));
      sel.appendChild(o);
    });
    sel.value = state.surah;
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
  }

  function onChange() {
    layoutCache.clear();
    stopPlayback();
    saveSettings();
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
    $('vmReciter').onchange = () => { state.reciter = $('vmReciter').value; onChange(); };
    $('vmFont').oninput = () => { state.fontMul = parseFloat($('vmFont').value); onChange(); };
    $('vmCaption').onchange = () => { state.caption = $('vmCaption').checked; onChange(); };
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
    $('vmExport').onclick = exportVideo;
    $('vmCancel').onclick = () => { if (cancelExport) cancelExport(); };
    window.addEventListener('langchange', () => { fillSurahs(); fillReciters(); updatePreviewBtn(); renderIdle(); });
  }

  function applyStateToControls() {
    $('vmFont').value = state.fontMul;
    $('vmCaption').checked = state.caption;
    $('vmBasmala').checked = state.basmala;
    $('vmColor').value = state.color;
    document.querySelectorAll('#vmColors .swatch').forEach(s => s.classList.toggle('active', s.dataset.color === state.color));
    document.querySelectorAll('#vmFormat button').forEach(b => b.classList.toggle('active', b.dataset.fmt === state.format));
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
    try { await Promise.all([document.fonts.load('40px QuranHafs'), document.fonts.load('40px VMTajawal')]); } catch (e) { /* fall through */ }
    selectBackground(state.bg);
  }

  window.VM = { state, renderFrame, buildTimeline, loadAyahAudio, exportVideo };
  init();
})();
