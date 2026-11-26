// Long (16:9, TV-style) mode of the ayah video maker — pages/video-maker.html.
//
// The short mode (js/video-maker.js) records the canvas in real time, which is
// fine for a 20-ayah clip but means a one-hour surah takes an hour. This mode is
// built for length and speed:
//   - Everything that never changes during the video (background, ornaments,
//     surah and reciter plates, logo) is drawn once into a base layer.
//   - Each ayah page is drawn once into its own text layer; a frame is just
//     base + text layer with an alpha, so Arabic is never re-shaped per frame.
//   - Export uses WebCodecs + an MP4 muxer (js/vendor/mp4-muxer.js) and runs
//     faster than real time: full frame rate only during the short fades, one
//     frame a second while the picture holds still (variable frame rate).
//   - Audio is fetched, decoded and encoded one ayah at a time, so memory stays
//     flat however long the range is.
// Browsers without WebCodecs fall back to real-time recording (MediaRecorder).
//
// Created by js/video-maker.js, which passes in the shared helpers (Quran text,
// reciters, text effect, audio context) as `api`.
(function () {
  'use strict';

  const W = 1920, H = 1080;
  const ORN_DIR = '../images/tv-maker/ornaments/';
  const BG_DIR = '../images/tv-maker/backgrounds/';
  const FPS = 30;
  const FADE = 0.3;       // text fade out / in at each page change (s)
  const LEAD = 0.6;       // background-only lead-in (s)
  const TAIL = 1.2;       // hold after the last ayah (s)
  const HOLD = 1;         // frame spacing while nothing moves (s)
  const KEY_EVERY = 4;    // keyframe at least this often (s) so players can seek
  const SR = 48000;       // audio sample rate of the export
  const LH = 1.8;         // ayah line height, in font sizes (same as the short mode)
  const clamp01 = x => Math.max(0, Math.min(1, x));
  const pct = (v, total) => v * total / 100;

  window.VMLong = function (api) {
    const S = api.state;
    const templates = window.TV_TEMPLATES || [];
    const template = () => templates.find(t => t.id === S.tvTemplate) || templates[0];

    // ---------- pictures ----------
    let assetVer = 0;
    const ornaments = new Map();
    function ornament(name) {
      let img = ornaments.get(name);
      if (!img) {
        img = new Image();
        img.onload = () => { assetVer++; api.onAsset(); };
        img.src = ORN_DIR + name + '.webp';
        ornaments.set(name, img);
      }
      return img;
    }
    const ready = img => !!img && img.complete && img.naturalWidth > 0;
    // A painted template's own picture: full size for the preview and the export,
    // a small copy (thumbs/) for the picker.
    const painted = new Map();
    function paintedBg(tpl, small) {
      const url = BG_DIR + (small ? 'thumbs/' + tpl.background.replace(/\.\w+$/, '.webp') : tpl.background);
      let img = painted.get(url);
      if (!img) {
        img = new Image();
        img.onload = () => { assetVer++; api.onAsset(); };
        img.src = url;
        painted.set(url, img);
      }
      return img;
    }
    // Waits (max 8 s) for the pictures the current template + background need,
    // so an export never opens on a frame without its ornaments.
    function ensureAssets() {
      const tpl = template();
      const names = tpl.overlays.map(o => o.src)
        .concat([tpl.surah.plate, tpl.reciter.plate].filter(Boolean));
      const own = tpl.background ? [paintedBg(tpl)] : (bgImg ? [bgImg] : []);
      const imgs = names.map(ornament).concat(own).filter(img => !ready(img));
      if (!imgs.length) return Promise.resolve();
      return Promise.race([
        Promise.all(imgs.map(img => new Promise(res => {
          img.addEventListener('load', res, { once: true });
          img.addEventListener('error', res, { once: true });
        }))),
        new Promise(res => setTimeout(res, 8000)),
      ]);
    }

    let bgImg = null, bgId = '';
    function setBackground(id) {
      if (id === bgId) return;
      bgId = id;
      bgImg = null;
      if (id.startsWith('i:')) {
        const img = new Image();
        img.onload = () => { if (bgId === id) { bgImg = img; assetVer++; api.onAsset(); } };
        img.src = api.bgSrc(id.slice(2));
        bgImg = img;
      }
      assetVer++;
    }

    // ---------- base layer: everything that holds still ----------
    function cover(c, img, w, h) {
      const sw = img.naturalWidth, sh = img.naturalHeight;
      const k = Math.max(w / sw, h / sh);
      c.drawImage(img, (w - sw * k) / 2, (h - sh * k) / 2, sw * k, sh * k);
    }
    function drawBg(c, w, h, tpl, small) {
      if (tpl.background) {
        const img = paintedBg(tpl, small);
        if (ready(img)) { cover(c, img, w, h); return; }
        c.fillStyle = '#0b1830';
        c.fillRect(0, 0, w, h);
        return;
      }
      if (bgId.startsWith('i:') && ready(bgImg)) { cover(c, bgImg, w, h); return; }
      const g = api.GRADIENTS[parseInt(bgId.slice(1), 10)] || api.GRADIENTS[1];
      const lin = c.createLinearGradient(0, 0, w * 0.3, h);
      g.stops.forEach((col, i) => lin.addColorStop(i / (g.stops.length - 1), col));
      c.fillStyle = lin;
      c.fillRect(0, 0, w, h);
      const rad = c.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, Math.max(w, h) * 0.6);
      rad.addColorStop(0, g.glow);
      rad.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = rad;
      c.fillRect(0, 0, w, h);
    }

    // Box of a picture placed by centre + width, keeping its own aspect ratio.
    function placed(o, img, w, h, fallbackRatio) {
      const bw = pct(o.w, w);
      const ratio = ready(img) ? img.naturalHeight / img.naturalWidth : (fallbackRatio || 0.12);
      const bh = bw * ratio;
      return { x: pct(o.cx, w) - bw / 2, y: pct(o.cy, h) - bh / 2, w: bw, h: bh };
    }

    function drawLabel(c, spec, text, family, w, h) {
      let box;
      if (spec.plate) {
        const img = ornament(spec.plate);
        const b = placed(spec, img, w, h, 0.12);
        if (ready(img)) c.drawImage(img, b.x, b.y, b.w, b.h);
        const [l, t, r, bt] = spec.inset || [0.12, 0.2, 0.12, 0.2];
        box = { x: b.x + b.w * l, y: b.y + b.h * t, w: b.w * (1 - l - r), h: b.h * (1 - t - bt) };
      } else {
        box = { x: pct(spec.cx - spec.w / 2, w), y: pct(spec.cy - spec.h / 2, h), w: pct(spec.w, w), h: pct(spec.h, h) };
      }
      if (!text) return;
      // The mushaf font's marks reach far above and below the letters.
      let size = box.h * (family === 'VMTajawal' ? 0.8 : 1.05);
      c.save();
      c.direction = api.arabicNames() ? 'rtl' : 'ltr';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      for (;;) {
        c.font = size + 'px ' + family;
        if (c.measureText(text).width <= box.w || size < 8) break;
        size *= 0.94;
      }
      const x = box.x + box.w / 2, y = box.y + box.h / 2;
      c.fillStyle = spec.color || '#fff';
      if (spec.fx !== 'none') {
        c.shadowColor = 'rgba(0,0,0,0.7)';
        c.shadowBlur = size * 0.3;
        if (!spec.plate && !spec.baked) {
          // Straight on the background: same thin outline as the ayah text.
          c.lineJoin = 'round';
          c.lineWidth = size * 0.06;
          c.strokeStyle = 'rgba(0,0,0,0.55)';
          c.strokeText(text, x, y);
        }
      }
      c.fillText(text, x, y);
      c.restore();
    }

    // App icon + name in the lower right corner: the name, then the icon at the edge,
    // both with an outer glow in the template's own colour.
    function drawBranding(c, w, h, tpl) {
      const glow = tpl.glow || '#ffffff';
      const base = h;
      const size = base * 0.026, icon = base * 0.046, gap = base * 0.012;
      const right = w * 0.978, y = h * 0.952;
      const hasIcon = ready(api.appIcon);
      c.save();
      c.globalAlpha = 0.92;
      c.font = size + 'px VMTajawal';
      c.direction = 'ltr';
      c.textAlign = 'right';
      c.textBaseline = 'middle';
      c.shadowColor = glow;
      c.shadowBlur = icon * 0.6;
      let x = right;
      if (hasIcon) {
        // The glow comes from a rounded square drawn under the icon.
        c.save();
        c.fillStyle = glow;
        c.beginPath();
        if (c.roundRect) c.roundRect(x - icon, y - icon / 2, icon, icon, icon * 0.22);
        else c.rect(x - icon, y - icon / 2, icon, icon);
        c.fill();
        c.fill();
        c.restore();
        c.save();
        c.shadowColor = 'transparent';
        c.beginPath();
        if (c.roundRect) c.roundRect(x - icon, y - icon / 2, icon, icon, icon * 0.22);
        else c.rect(x - icon, y - icon / 2, icon, icon);
        c.clip();
        c.drawImage(api.appIcon, x - icon, y - icon / 2, icon, icon);
        c.restore();
        x -= icon + gap;
      }
      c.fillStyle = '#fff';
      c.fillText(api.BRAND, x, y);
      c.fillText(api.BRAND, x, y);   // twice: a stronger glow
      // A thin dark edge keeps the white name readable on bright floors.
      c.shadowColor = 'transparent';
      c.lineJoin = 'round';
      c.lineWidth = size * 0.12;
      c.strokeStyle = 'rgba(0,0,0,0.45)';
      c.strokeText(api.BRAND, x, y);
      c.fillText(api.BRAND, x, y);
      c.restore();
    }

    function drawBase(c, w, h, tpl, small) {
      drawBg(c, w, h, tpl, small);
      tpl.overlays.forEach(o => {
        const img = ornament(o.src);
        if (!ready(img)) return;
        const b = placed(o, img, w, h);
        c.drawImage(img, b.x, b.y, b.w, b.h);
      });
      const s = api.surahObj(), r = api.reciterObj();
      const ar = api.arabicNames();
      // Plates are part of the design, so they stay even with the names turned off.
      drawLabel(c, tpl.surah, S.caption && s ? (ar ? s.name : 'Surah ' + api.surahLatin(s)) : '', ar ? api.qfont() : 'VMTajawal', w, h);
      drawLabel(c, tpl.reciter, S.caption && r ? api.reciterName(r) : '', 'VMTajawal', w, h);
      if (S.branding) drawBranding(c, w, h, tpl);
    }

    let base = null, baseKey = '';
    function baseLayer() {
      const tpl = template();
      const key = [tpl.id, bgId, assetVer, S.surah, S.reciter, S.caption, S.branding, api.lang(), api.qfont()].join('|');
      if (base && baseKey === key) return base;
      if (!base) { base = document.createElement('canvas'); base.width = W; base.height = H; }
      const c = base.getContext('2d');
      c.clearRect(0, 0, W, H);
      drawBase(c, W, H, tpl);
      baseKey = key;
      return base;
    }

    // ---------- ayah text: fitted, paged, drawn once ----------
    const measure = document.createElement('canvas').getContext('2d');
    const pageCache = new Map();
    // Lines of the ayah split into pages that fit the template's ayah box.
    // Shrinks the font first; only when it would get too small does a long ayah
    // run over several pages (broken between lines, never inside a word).
    function pagesFor(seg) {
      const tpl = template();
      const a = tpl.ayah;
      const key = [seg.surah, seg.ayah, tpl.id, S.fontMul, api.qfont()].join('|');
      if (pageCache.has(key)) return pageCache.get(key);
      const words = api.ayahWords(seg);
      const rw = pct(a.w, W), rh = pct(a.h, H);
      const maxLines = a.maxLines || 4;
      const start = H * 0.08 * S.fontMul;
      const pageSize = Math.max(H * 0.042, start * 0.72);
      let size = start, lines;
      const wrapAt = sz => { measure.font = sz + 'px ' + api.qfont(); return api.wrapWords(measure, words, rw); };
      let fits = false;
      for (;;) {
        lines = wrapAt(size);
        if (lines.length <= maxLines && lines.length * size * LH <= rh) { fits = true; break; }
        if (size * 0.95 < pageSize) break;
        size *= 0.95;
      }
      let pages;
      if (fits) {
        pages = [lines];
      } else {
        size = pageSize;
        lines = wrapAt(size);
        const per = Math.max(1, Math.min(maxLines, Math.floor(rh / (size * LH))));
        const n = Math.ceil(lines.length / per);
        const even = Math.ceil(lines.length / n);    // balanced, no lonely last line
        pages = [];
        for (let i = 0; i < lines.length; i += even) pages.push(lines.slice(i, i + even));
      }
      const weights = pages.map(p => p.join(' ').replace(/\s+/g, '').length || 1);
      const sum = weights.reduce((x, y) => x + y, 0);
      const out = { size, pages, shares: weights.map(x => x / sum) };
      pageCache.set(key, out);
      if (pageCache.size > 400) pageCache.delete(pageCache.keys().next().value);
      return out;
    }

    const layerCache = new Map();
    function textLayer(seg, pageIdx) {
      const tpl = template();
      const L = pagesFor(seg);
      const key = [seg.surah, seg.ayah, pageIdx, tpl.id, S.fontMul, S.color, S.textFx, S.halo, api.qfont()].join('|');
      // Pale painted pictures: white (the default colour) becomes the template's
      // dark ink with a light halo; any other colour the user picked is kept.
      const light = !!tpl.ink && S.color.toLowerCase() === '#ffffff';
      let cv = layerCache.get(key);
      if (cv) return cv;
      const a = tpl.ayah;
      const rw = pct(a.w, W), rh = pct(a.h, H);
      const pad = Math.ceil(L.size * 0.8);            // room for the glow
      cv = document.createElement('canvas');
      cv.width = Math.ceil(rw + pad * 2);
      cv.height = Math.ceil(rh + pad * 2);
      const c = cv.getContext('2d');
      c.font = L.size + 'px ' + api.qfont();
      c.direction = 'rtl';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = light ? tpl.ink : S.color;
      const lines = L.pages[pageIdx];
      const lh = L.size * LH;
      const top = pad + rh / 2 - (lines.length - 1) * lh / 2;
      if (tpl.panel) {
        // Busy pictures: a soft panel behind just this block of text.
        const widest = Math.max(...lines.map(ln => c.measureText(ln).width));
        const pw = Math.min(widest + L.size * 1.2, cv.width - 4);
        const ph = lines.length * lh + L.size * 0.3;
        const px = (cv.width - pw) / 2, py = top - lh / 2 - L.size * 0.15;
        c.save();
        c.fillStyle = 'rgba(6,24,40,0.5)';
        c.beginPath();
        if (c.roundRect) c.roundRect(px, py, pw, ph, L.size * 0.5);
        else c.rect(px, py, pw, ph);
        c.fill();
        c.restore();
      }
      lines.forEach((ln, i) => api.fillAyahLine(c, ln, cv.width / 2, top + i * lh, L.size, light));
      cv.pad = pad;
      layerCache.set(key, cv);
      // Only the current and next pages are ever needed.
      if (layerCache.size > 6) layerCache.delete(layerCache.keys().next().value);
      return cv;
    }

    // ---------- timeline ----------
    // items: [{ seg, start, end }] in seconds of the video. Each ayah's time is
    // shared between its pages by text length (there are no word timings).
    function windowsOf(items) {
      const out = [];
      items.forEach(it => {
        const L = pagesFor(it.seg);
        let t = it.start;
        L.shares.forEach((sh, p) => {
          const e = p === L.shares.length - 1 ? it.end : t + (it.end - it.start) * sh;
          out.push({ seg: it.seg, page: p, s: t, e });
          t = e;
        });
      });
      return out;
    }

    // Draws the frame at time t. `wins` from windowsOf(); `total` is the full length
    // when known (the last page holds through the tail and fades at the very end).
    function drawFrame(c, t, wins, total) {
      c.drawImage(baseLayer(), 0, 0, c.canvas.width, c.canvas.height);
      if (!wins.length) return;
      let k = wins.findIndex(wd => t < wd.e);
      if (k < 0) k = wins.length - 1;
      const wd = wins[k];
      const isFirst = k === 0;
      const isLast = k === wins.length - 1 && total != null;
      const s = isFirst ? wd.s - FADE : wd.s;
      const e = isLast ? total : wd.e;
      const alpha = Math.min(clamp01((t - s) / FADE), clamp01((e - t) / FADE));
      if (alpha <= 0) return;
      const layer = textLayer(wd.seg, wd.page);
      const a = template().ayah;
      const kx = c.canvas.width / W, ky = c.canvas.height / H;
      c.save();
      c.globalAlpha = alpha;
      c.drawImage(layer, (pct(a.x, W) - layer.pad) * kx, (pct(a.y, H) - layer.pad) * ky, layer.width * kx, layer.height * ky);
      c.restore();
    }

    // Idle preview: the first page of the first ayah.
    function drawStill(c) {
      const segs = api.segments();
      // A long span so the sample moment sits well inside the first page.
      const wins = segs.length ? windowsOf([{ seg: segs[0], start: 0, end: 1000 }]).slice(0, 1) : [];
      drawFrame(c, 0.5, wins, null);
    }

    // Template picker thumbnail.
    function drawThumb(c, tplId) {
      const tpl = templates.find(t => t.id === tplId) || templates[0];
      const w = c.canvas.width, h = c.canvas.height;
      c.clearRect(0, 0, w, h);
      drawBase(c, w, h, tpl, true);
      const a = tpl.ayah;
      c.fillStyle = 'rgba(255,255,255,0.85)';
      const lh = h * 0.035;
      [0.78, 0.62, 0.7].forEach((f, i) => {
        const lw = pct(a.w, w) * f * 0.8;
        c.fillRect((w - lw) / 2, pct(a.y + a.h / 2, h) + (i - 1) * lh * 2 - lh / 2, lw, lh * 0.55);
      });
    }

    // ---------- audio ----------
    const pad3 = n => String(n).padStart(3, '0');
    const urlOf = seg => api.AUDIO_BASE + api.reciterObj().folder + '/' + pad3(seg.surah) + pad3(seg.ayah) + '.mp3';
    async function fetchBytes(url) {
      let err;
      for (let i = 0; i < 3; i++) {
        try {
          const r = await fetch(url);
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return await r.arrayBuffer();
        } catch (e) { err = e; await new Promise(res => setTimeout(res, 600 * (i + 1))); }
      }
      throw err;
    }
    // Downloads a few ayat ahead of the one being used.
    function prefetcher(segs, ahead) {
      const jobs = new Map();
      const get = i => {
        for (let j = i; j < Math.min(segs.length, i + ahead + 1); j++) {
          if (!jobs.has(j)) { const p = fetchBytes(urlOf(segs[j])); p.catch(() => {}); jobs.set(j, p); }
        }
        const p = jobs.get(i);
        jobs.delete(i);
        return p;
      };
      return { get };
    }
    function decode(ctxLike, bytes) {
      return new Promise((res, rej) => ctxLike.decodeAudioData(bytes, res, rej));
    }

    // Length without downloading the recitation: HEAD requests give each file's
    // size, and everyayah folder names carry the bitrate (Alafasy_128kbps).
    const sizeCache = new Map();
    async function estimate(isStale) {
      const segs = api.segments();
      const m = /(\d+)kbps/i.exec(api.reciterObj().folder);
      if (!m) return null;
      const kbps = parseInt(m[1], 10);
      let next = 0, bytes = 0;
      async function worker() {
        while (next < segs.length) {
          if (isStale()) return;
          const url = urlOf(segs[next++]);
          let n = sizeCache.get(url);
          if (n == null) {
            const r = await fetch(url, { method: 'HEAD' });
            n = parseInt(r.headers.get('content-length'), 10);
            if (!r.ok || !n) throw new Error('size');
            sizeCache.set(url, n);
          }
          bytes += n;
        }
      }
      await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
      if (isStale()) return null;
      return LEAD + bytes * 8 / (kbps * 1000) + TAIL;
    }

    // ---------- playback (preview and the real-time fallback) ----------
    // Streams the recitation: decodes an ayah or two ahead of what is playing and
    // lets go of each one once it has been heard.
    function play({ c, outputs, onTick, onEnd, onError }) {
      const ac = api.audioCtx();
      const segs = api.segments();
      const pre = prefetcher(segs, 3);
      const items = [];
      let wins = [];
      let total = null, stopped = false, raf = 0;
      const sources = new Set();
      const t0 = ac.currentTime + 0.3;
      const now = () => ac.currentTime - t0;

      (async () => {
        let next = LEAD;
        for (let i = 0; i < segs.length && !stopped; i++) {
          // Keep no more than ~25 s scheduled ahead.
          while (!stopped && next - now() > 25) await new Promise(res => setTimeout(res, 250));
          let buf;
          try { buf = await decode(ac, await pre.get(i)); } catch (e) { if (!stopped) onError(e); return; }
          if (stopped) return;
          const start = Math.max(next, now() + 0.15);   // a late download shifts the rest
          const src = ac.createBufferSource();
          src.buffer = buf;
          outputs.forEach(n => src.connect(n));
          src.onended = () => { sources.delete(src); try { src.disconnect(); } catch (e) { /* gone */ } };
          src.start(t0 + start);
          sources.add(src);
          items.push({ seg: segs[i], start, end: start + buf.duration });
          wins = windowsOf(items);
          next = start + buf.duration;
        }
        total = next + TAIL;
      })();

      const ctl = {
        stop() {
          if (stopped) return;
          stopped = true;
          cancelAnimationFrame(raf);
          sources.forEach(s => { try { s.stop(); } catch (e) { /* not started */ } });
          sources.clear();
        },
      };
      const tick = () => {
        if (stopped) return;
        const t = Math.max(0, now());
        drawFrame(c, t, wins, total);
        onTick(t, total, items.length, segs.length);
        if (total != null && t >= total) { ctl.stop(); onEnd(); return; }
        raf = requestAnimationFrame(tick);
      };
      drawFrame(c, 0, wins, total);
      raf = requestAnimationFrame(tick);
      return ctl;
    }

    // ---------- fast export (WebCodecs) ----------
    async function pickVideoConfig() {
      if (!window.VideoEncoder) return null;
      for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.42E028']) {
        for (const hw of ['prefer-hardware', 'no-preference']) {
          const cfg = { codec, width: W, height: H, bitrate: 4000000, framerate: FPS, hardwareAcceleration: hw, avc: { format: 'avc' } };
          try { if ((await VideoEncoder.isConfigSupported(cfg)).supported) return cfg; } catch (e) { /* next */ }
        }
      }
      return null;
    }
    async function pickAudioConfig() {
      if (!window.AudioEncoder) return null;
      // AAC plays everywhere; Opus-in-MP4 is the fallback where the OS has no AAC
      // encoder (Linux) — YouTube and Chrome play it, some phone galleries may not.
      for (const [codec, mux] of [['mp4a.40.2', 'aac'], ['opus', 'opus']]) {
        const cfg = { codec, sampleRate: SR, numberOfChannels: 2, bitrate: 128000 };
        try { if ((await AudioEncoder.isConfigSupported(cfg)).supported) return { cfg, mux }; } catch (e) { /* next */ }
      }
      return null;
    }
    async function fastConfigs() {
      if (!window.Mp4Muxer || !window.VideoFrame || !window.AudioData || !window.OfflineAudioContext) return null;
      const [v, a] = await Promise.all([pickVideoConfig(), pickAudioConfig()]);
      return v && a ? { v, a } : null;
    }

    // Resolves once the encoder's queue is short again.
    function drain(enc, max) {
      if (enc.encodeQueueSize <= max) return Promise.resolve();
      return new Promise(res => {
        if ('ondequeue' in enc) {
          const f = () => { if (enc.encodeQueueSize <= max) { enc.removeEventListener('dequeue', f); res(); } };
          enc.addEventListener('dequeue', f);
        } else {
          const poll = () => (enc.encodeQueueSize <= max ? res() : setTimeout(poll, 4));
          poll();
        }
      });
    }

    async function exportFast(cfgs, { onProgress, isCancelled, onPreview }) {
      const segs = api.segments();
      const pre = prefetcher(segs, 4);
      const decoder = new OfflineAudioContext(2, SR, SR);   // decodes straight to 48 kHz
      const target = new Mp4Muxer.ArrayBufferTarget();
      const muxer = new Mp4Muxer.Muxer({
        target,
        video: { codec: 'avc', width: W, height: H, frameRate: FPS },
        audio: { codec: cfgs.a.mux, sampleRate: SR, numberOfChannels: 2 },
        fastStart: false,
        firstTimestampBehavior: 'offset',
      });
      let failure = null;
      const ve = new VideoEncoder({ output: (ch, meta) => muxer.addVideoChunk(ch, meta), error: e => { failure = e; } });
      ve.configure(cfgs.v);
      const ae = new AudioEncoder({ output: (ch, meta) => muxer.addAudioChunk(ch, meta), error: e => { failure = e; } });
      ae.configure(cfgs.a.cfg);
      const check = () => { if (failure) throw failure; };
      const closeAll = () => { [ve, ae].forEach(enc => { try { if (enc.state !== 'closed') enc.close(); } catch (e) { /* closed */ } }); };
      try {
        return await encodeAll();
      } catch (e) {
        closeAll();
        throw e;
      }

      async function encodeAll() {

        const cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        const c = cv.getContext('2d', { alpha: false });

        let samples = 0;     // audio frames written so far
        async function pushAudio(ch0, ch1, n0, n1) {
          const CH = 4096;
          for (let off = n0; off < n1; off += CH) {
            const n = Math.min(CH, n1 - off);
            const data = new Float32Array(n * 2);
            if (ch0) { data.set(ch0.subarray(off, off + n), 0); data.set(ch1.subarray(off, off + n), n); }
            const ad = new AudioData({ format: 'f32-planar', sampleRate: SR, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(samples / SR * 1e6), data });
            ae.encode(ad);
            ad.close();
            samples += n;
            await drain(ae, 16);
            check();
          }
        }

        const items = [];
        let wins = [];
        let tv = 0, lastKey = -Infinity;
        // Fades need every frame; the rest of the time one frame a second is enough.
        function nextFrameTime(t, total) {
          const step = 1 / FPS;
          let nextFade = Infinity;
          for (let k = 0; k < wins.length; k++) {
            const wd = wins[k];
            const s = k === 0 ? wd.s - FADE : wd.s;
            const e = k === wins.length - 1 && total != null ? total : wd.e;
            const zones = [[s, s + FADE], [e - FADE, e]];
            for (const [z0, z1] of zones) {
              if (t >= z0 - 1e-6 && t < z1) return t + step;
              if (z0 > t && z0 < nextFade) nextFade = z0;
            }
          }
          return Math.min(t + HOLD, nextFade);
        }
        async function videoUntil(tEnd, total) {
          let shown = 0;
          while (tv < tEnd - 1e-6) {
            if (isCancelled()) return;
            const next = Math.min(nextFrameTime(tv, total), tEnd);
            drawFrame(c, tv, wins, total);
            const frame = new VideoFrame(cv, { timestamp: Math.round(tv * 1e6), duration: Math.max(1, Math.round((next - tv) * 1e6)) });
            const key = tv - lastKey >= KEY_EVERY - 1e-6;
            if (key) lastKey = tv;
            ve.encode(frame, { keyFrame: key });
            frame.close();
            await drain(ve, 6);
            check();
            if (++shown % 15 === 0) onPreview(cv);
            tv = next;
          }
        }

        await pushAudio(null, null, 0, Math.round(LEAD * SR));      // silent lead-in
        for (let i = 0; i < segs.length; i++) {
          if (isCancelled()) break;
          const buf = await decode(decoder, await pre.get(i));
          const ch0 = buf.getChannelData(0);
          const ch1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : ch0;
          const start = samples / SR;
          await pushAudio(ch0, ch1, 0, buf.length);
          items.push({ seg: segs[i], start, end: samples / SR });
          wins = windowsOf(items);
          // Everything before this ayah's end is final now (the last ayah instead
          // holds through the tail, drawn below once the total is known).
          if (i < segs.length - 1) await videoUntil(items[i].end, null);
          onProgress((i + 1) / segs.length, i + 1, segs.length);
          onPreview(cv);
        }
        if (isCancelled()) { closeAll(); return null; }
        const total = samples / SR + TAIL;
        await videoUntil(total, total);
        await ve.flush();
        await ae.flush();
        check();
        muxer.finalize();
        closeAll();
        return { blob: new Blob([target.buffer], { type: 'video/mp4' }), type: 'video/mp4', fast: true };
      }
    }

    // ---------- real-time fallback (MediaRecorder) ----------
    async function exportRealtime({ canvas, mime, onProgress, isCancelled }) {
      const ac = api.audioCtx();
      const dest = ac.createMediaStreamDestination();
      const stream = new MediaStream([...canvas.captureStream(FPS).getVideoTracks(), ...dest.stream.getAudioTracks()]);
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6000000, audioBitsPerSecond: 128000 });
      const chunks = [];
      rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      const stopped = new Promise(res => { rec.onstop = res; });
      rec.start(1000);
      let error = null;
      await new Promise(resolve => {
        const ctl = play({
          c: canvas.getContext('2d'),
          outputs: [dest, ac.destination],
          onTick: (t, total, done, n) => {
            if (isCancelled()) { ctl.stop(); resolve(); return; }
            onProgress(total ? clamp01(t / total) : done / n * 0.99, Math.min(done, n), n);
          },
          onEnd: resolve,
          onError: e => { error = e; ctl.stop(); resolve(); },
        });
      });
      rec.stop();
      await stopped;
      stream.getTracks().forEach(tk => tk.stop());
      if (error) throw error;
      if (isCancelled()) return null;
      const type = (rec.mimeType || mime).split(';')[0];
      return { blob: new Blob(chunks, { type }), type, fast: false };
    }

    return {
      W, H,
      template, templates,
      setBackground,
      ensureAssets,
      drawStill,
      drawThumb,
      estimate,
      play,
      fastConfigs,
      exportFast,
      exportRealtime,
      invalidate() { layerCache.clear(); pageCache.clear(); baseKey = ''; },
    };
  };
})();
