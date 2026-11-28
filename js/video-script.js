// A video script for the «خاطرة» video maker: the whole video in one plain-text file, line by
// line, each with its time, its font and size, and the stickers shown with it. Written by hand
// or by an AI from the template this module writes (instructions, fonts, sizes, stickers).
//
//   @font: changa              settings for the whole video (all optional)
//   @size: 1.1
//   [0:00 - 0:04] الصبر مفتاح الفرج <sticker 1 left fade>
//   [0:04 - 0:09] ومن يتق الله يجعل له مخرجاً {font: ruqaa, size: 1.3} <sticker 2>
//
// Subtitle files (SRT / WebVTT) read as scripts too. <sticker N> is a placeholder: the user picks
// the picture for each number after the upload; <sticker h05> names a picture directly.
// Used by js/video-maker.js; also loads in Node for the tests (tests/node/video-script.test.cjs).
(function (root) {
  'use strict';

  const LIMITS = { lines: 30, chars: 400, stickers: 30, slots: 30, size: [0.7, 1.4], spacing: [1.1, 2.4], seconds: 3600 };
  const STYLES = ['line', 'build', 'word'];
  const FORMATS = ['story', 'square', 'wide'];
  const FX = ['pop', 'fade', 'slide', 'zoom', 'float', 'none'];
  // the background's colour looks (js/video-maker.js LOOKS)
  const LOOKS = ['none', 'warm', 'cool', 'vivid', 'cinematic', 'golden', 'matte', 'dreamy', 'night', 'vintage', 'bw', 'noir'];
  // The faces a script can name (js/khatira.js FONTS; the mushaf face is for ayat only), and what
  // they look like, for the AI choosing one.
  const FONTS = [
    ['amiri', 'Amiri: classic, elegant Naskh (book style). A safe default.'],
    ['scheherazade', 'Scheherazade New: classic Naskh, very readable, slightly rounder.'],
    ['naskh', 'Noto Naskh Arabic (bold): clean modern Naskh, plain and clear.'],
    ['ruqaa', 'Aref Ruqaa (bold): Ruqaa handwriting, warm and personal. Short lines.'],
    ['changa', 'Changa ExtraBold: modern geometric display, strong headlines.'],
    ['cairo', 'Cairo Black: heavy modern sans, punchy and very legible.'],
    ['jomhuria', 'Jomhuria: very bold poster display, best for 1 to 4 words.'],
    ['gulzar', 'Gulzar: Nastaliq calligraphy (Urdu style), decorative.'],
  ];
  const FONT_IDS = FONTS.map(f => f[0]);

  // Arabic-Indic and Persian digits as ASCII (times, numbers in tags).
  const ascii = s => String(s).replace(/[٠-٩]/g, d => d.charCodeAt(0) - 0x660).replace(/[۰-۹]/g, d => d.charCodeAt(0) - 0x6F0);
  const D = '[0-9\\u0660-\\u0669\\u06F0-\\u06F9]';
  const T = `${D}{1,3}(?::${D}{1,2}){0,2}(?:[.,]${D}{1,3})?`;
  const SEP = '(?:-->|->|→|–|—|-|to|إلى)';
  const BRACKET = new RegExp(`^\\[\\s*(${T})\\s*(?:${SEP}\\s*(${T}))?\\s*\\]\\s*[|:]?\\s*(.*)$`, 'i');
  // without brackets: a range of clock times (0:04 - 0:09), or a subtitle line (00:00:04,000 --> ...)
  const BARE = new RegExp(`^(${D}{1,3}:${T}|${T})\\s*(-->|->|→|–|—|-)\\s*(${T})(?:\\s+[|:]?\\s*(.*))?$`);
  const INDEX = new RegExp(`^${D}+$`);

  function seconds(s) {
    const t = ascii(s).replace(',', '.');
    return t.split(':').reduce((n, p) => n * 60 + parseFloat(p), 0);
  }
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const round = (v, k = 1000) => Math.round(v * k) / k;

  // A time prefix: { a, b, rest } or null.
  function timeOf(line) {
    let m = BRACKET.exec(line);
    if (m) return { a: seconds(m[1]), b: m[2] ? seconds(m[2]) : null, rest: m[3] || '' };
    m = BARE.exec(line);
    // a bare range must be clock-like (a colon in each time, or the subtitle arrow), so that
    // a line beginning "3 - 4 ..." stays text
    if (m && (m[2] === '-->' || (m[1].includes(':') && m[3].includes(':')))) {
      return { a: seconds(m[1]), b: seconds(m[3]), rest: (m[4] || '').replace(/^(?:[\w-]+:\S+\s*)+$/, '') };
    }
    return null;
  }

  const POS = {
    left: ['x', 0.24], 'يسار': ['x', 0.24], right: ['x', 0.76], 'يمين': ['x', 0.76], center: ['x', 0.5], centre: ['x', 0.5], 'وسط': ['x', 0.5],
    top: ['y', 0.2], 'أعلى': ['y', 0.2], middle: ['y', 0.5], bottom: ['y', 0.75], 'أسفل': ['y', 0.75],
    small: ['s', 0.3], 'صغير': ['s', 0.3], medium: ['s', 0.46], 'متوسط': ['s', 0.46], large: ['s', 0.66], 'كبير': ['s', 0.66],
  };
  // <sticker 1 left fade> -> { slot: 1 } / { id: 'h05' } with its options, or null (not a sticker tag)
  function stickerTag(inner, ids) {
    const toks = ascii(inner).trim().split(/[\s,;]+/).filter(Boolean);
    if (!toks.length) return null;
    let head = toks.shift();
    const m = /^(?:sticker|ملصق|st)[#:-]?(.*)$/i.exec(head);
    if (!m) return null;
    let ref = m[1];
    if (!ref) ref = toks.shift() || '';
    ref = ref.replace(/^#/, '').toLowerCase();
    const st = { slot: null, id: null, fx: null, flip: false, all: false, until: null };
    if (/^\d{1,3}$/.test(ref) && +ref >= 1) st.slot = +ref;
    else if (ids.includes(ref)) st.id = ref;
    else return { bad: ref || '?' };
    for (const raw of toks) {
      const k = raw.toLowerCase();
      if (POS[k] || POS[raw]) { const [key, v] = POS[k] || POS[raw]; st[key] = v; } else if (FX.includes(k)) st.fx = k;
      else if (k === 'flip' || raw === 'معكوس') st.flip = true;
      else if (k === 'all' || k === 'whole' || raw === 'كامل') st.all = true;
      else if (k === 'next') st.until = 'next';           // stays until the next sticker shows
      else if (k === 'end') st.until = 'end';             // stays to the end of the video
    }
    return st;
  }
  // {font: ruqaa, size: 1.3} / {ruqaa 1.3}
  function lineOpts(inner, warn) {
    const o = {};
    for (const tok of ascii(inner).split(/[,;]+|\s+(?=[a-z]+\s*[:=])/i)) {
      const kv = /^\s*([a-z]+)\s*[:=]\s*(\S+)\s*$/i.exec(tok);
      const words = kv ? [[kv[1].toLowerCase(), kv[2]]] : tok.trim().split(/\s+/).filter(Boolean).map(w => [null, w]);
      for (const [k, v0] of words) {
        const v = String(v0).toLowerCase();
        if ((k === 'font' || k === null) && FONT_IDS.includes(v)) o.font = v;
        else if ((k === 'size' || k === null) && isFinite(parseFloat(v))) {
          const n = parseFloat(v);
          o.size = round(clamp(n, LIMITS.size[0], LIMITS.size[1]), 100);
          if (o.size !== n) warn('size', v0);
        } else if (k === 'font' || (k === null && /^[a-z-]+$/.test(v))) warn('font', v0);
      }
    }
    return o;
  }

  function directive(line, out, warn) {
    const m = /^@\s*([a-z]+)\s*[:=]?\s*(.*)$/i.exec(line);
    if (!m) return;
    const key = m[1].toLowerCase(), raw = m[2].trim(), v = ascii(raw).toLowerCase();
    if (key === 'font') { if (FONT_IDS.includes(v)) out.font = v; else warn('font', raw); }
    else if (key === 'size') {
      const n = parseFloat(v);
      if (!isFinite(n)) { warn('size', raw); return; }
      out.size = round(clamp(n, LIMITS.size[0], LIMITS.size[1]), 100);
      if (out.size !== n) warn('size', raw);
    } else if (key === 'look') {
      if (LOOKS.includes(v)) out.look = v; else warn('look', raw);
    } else if (key === 'position') {
      const p = { top: 'top', middle: 'middle', center: 'middle', centre: 'middle', bottom: 'bottom', 'أعلى': 'top', 'وسط': 'middle', 'الوسط': 'middle', 'أسفل': 'bottom' }[v];
      // or a height: 0 (top) … 1 (bottom), or 0% … 100%
      const n = /^(\d+(?:\.\d+)?)\s*%$/.test(v) ? parseFloat(v) / 100 : /^\d*\.?\d+$/.test(v) ? parseFloat(v) : NaN;
      if (p) out.position = p;
      else if (isFinite(n) && n >= 0 && n <= 1) out.position = round(n, 100);
      else warn('position', raw);
    } else if (key === 'spacing') {
      const n = parseFloat(v);
      if (!isFinite(n)) { warn('spacing', raw); return; }
      out.spacing = round(clamp(n, LIMITS.spacing[0], LIMITS.spacing[1]), 100);
      if (out.spacing !== n) warn('spacing', raw);
    } else if (key === 'style') { if (STYLES.includes(v)) out.style = v; else warn('style', raw); }
    else if (key === 'format') { if (FORMATS.includes(v)) out.format = v; else warn('format', raw); }
    else if (key === 'color' || key === 'colour') { if (/^#[0-9a-f]{6}$/.test(v)) out.color = v; else warn('color', raw); }
    else if (key === 'name') out.name = raw.slice(0, 60);
    else if (key === 'quran') {
      // a recitation under the text: surah:from-to (at most 20 ayat), e.g. 94:5-6
      const q = /^(\d{1,3})\s*[:：]\s*(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?$/.exec(v);
      const n = q ? [+q[1], +q[2], +(q[3] || q[2])] : null;
      if (n && n[0] >= 1 && n[0] <= 114 && n[1] >= 1 && n[2] >= n[1] && n[2] - n[1] < 20) out.quran = { surah: n[0], from: n[1], to: n[2] };
      else warn('quran', raw);
    }
    else warn('directive', key);
  }

  // The script -> { settings, lines: [{ text, a, b, font, size }], stickers: [...], warnings }.
  // a / b: seconds or null (b null: until the next line, or by its length).
  function parse(text, opts) {
    const ids = (opts && opts.ids) || [];
    const settings = {}, lines = [], stickers = [], warnings = [];
    const warn = (code, detail) => { if (warnings.length < 50) warnings.push({ code, detail: detail == null ? '' : String(detail) }); };
    const src = String(text || '').replace(/^﻿/, '').split(/\r\n|\r|\n/);
    let pendingTime = null;   // a subtitle cue's time, waiting for its text on the next line(s)
    let block = -1;           // the line a subtitle cue's text is being gathered into
    let orphan = [];          // stickers before the first line of text
    let dropped = 0, droppedSt = 0;
    const addSticker = (st, line) => {
      if (stickers.length >= LIMITS.stickers) { droppedSt++; return; }
      if (st.slot != null && st.slot > LIMITS.slots) { warn('tag', 'sticker ' + st.slot); return; }
      stickers.push({ auto: st.y == null && st.s == null, line: st.all ? null : line, slot: st.slot, id: st.id, x: st.x, y: st.y, s: st.s, fx: st.fx || 'pop', flip: st.flip, until: st.until || 'line' });
    };
    for (let i = 0; i < src.length; i++) {
      const l = src[i].trim();
      if (!l) { block = -1; pendingTime = null; continue; }
      if (l[0] === '#' || l.startsWith('//') || /^WEBVTT\b/.test(l) || /^NOTE\b/.test(l)) continue;
      if (l[0] === '@') { directive(l, settings, warn); continue; }
      // a subtitle cue number, right before its time
      if (INDEX.test(l) && src[i + 1] && timeOf(src[i + 1].trim())) continue;
      let body = l, time = null;
      const tm = timeOf(l);
      if (tm) {
        if (!tm.rest.trim()) { pendingTime = { a: tm.a, b: tm.b }; block = -1; continue; }
        time = { a: tm.a, b: tm.b }; body = tm.rest; block = -1; pendingTime = null;
      } else if (pendingTime) { time = pendingTime; pendingTime = null; }
      // the tags and options, out of the text
      const tags = [], o = {};
      body = body.replace(/<([^<>]*)>/g, (all, inner) => {
        const st = stickerTag(inner, ids);
        if (!st) return all;
        if (st.bad) { warn('tag', inner.trim()); return ' '; }
        tags.push(st);
        return ' ';
      }).replace(/\{([^{}]*)\}/g, (all, inner) => { Object.assign(o, lineOpts(inner, warn)); return ' '; });
      const words = body.replace(/\s+/g, ' ').trim();
      // more text of the same subtitle cue
      if (block >= 0 && !time && words) {
        const ln = lines[block];
        ln.text = (ln.text + ' ' + words).slice(0, LIMITS.chars);
        Object.assign(ln, o);
        tags.forEach(st => addSticker(st, block));
        continue;
      }
      if (!words) {
        // a line of stickers only: they go with the line before (or the first one)
        if (lines.length) tags.forEach(st => addSticker(st, lines.length - 1));
        else orphan = orphan.concat(tags);
        continue;
      }
      if (lines.length >= LIMITS.lines) { dropped++; continue; }
      if (words.length > LIMITS.chars) warn('long', lines.length + 1);
      const ln = { text: words.slice(0, LIMITS.chars), a: null, b: null };
      if (time) {
        ln.a = round(clamp(time.a, 0, LIMITS.seconds));
        if (time.b != null) {
          const b = round(clamp(time.b, 0, LIMITS.seconds));
          if (b > ln.a) ln.b = b; else warn('time', lines.length + 1);
        }
      }
      if (o.font) ln.font = o.font;
      if (o.size) ln.size = o.size;
      lines.push(ln);
      if (time && pendingTime === null && !tm) block = lines.length - 1;   // a subtitle cue's first text line
      tags.forEach(st => addSticker(st, lines.length - 1));
      if (orphan.length) { orphan.forEach(st => addSticker(st, 0)); orphan = []; }
    }
    orphan.forEach(st => addSticker(st, null));
    if (dropped) warn('lines', dropped);
    if (droppedSt) warn('stickers', droppedSt);
    place(stickers);
    return { settings, lines, stickers, warnings };
  }

  // Where each sticker goes: as its options say; else the ones of a line side by side, low on the
  // video (clear of the text in the middle).
  function place(stickers) {
    const groups = new Map();
    stickers.forEach(s => { const k = s.line == null ? 'all' : s.line; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); });
    for (const g of groups.values()) {
      const free = g.filter(s => s.x == null);
      const xs = free.length === 1 ? [0.5] : free.length === 2 ? [0.27, 0.73] : free.map((_, i) => 0.18 + 0.64 * i / Math.max(1, free.length - 1));
      free.forEach((s, i) => { s.x = round(xs[i]); });
      g.forEach(s => {
        if (s.y == null) s.y = 0.75;
        if (s.s == null) s.s = g.length > 1 ? 0.38 : 0.46;
      });
    }
  }

  const two = n => String(n).padStart(2, '0');
  function clock(sec) {
    const s = Math.max(0, sec), m = Math.floor(s / 60), r = s - m * 60;
    const whole = Math.floor(r), frac = Math.round((r - whole) * 10);
    return m + ':' + two(whole) + (frac ? '.' + frac : '');
  }

  // The script of a video as it is (to edit and upload again).
  function serialize(v) {
    const out = ['# Zad Al-Muslim video script', ''];
    const s = v.settings || {};
    for (const k of ['font', 'size', 'spacing', 'position', 'style', 'color', 'look', 'format', 'name']) if (s[k] != null && s[k] !== '') out.push('@' + k + ': ' + s[k]);
    if (s.quran) out.push('@quran: ' + s.quran.surah + ':' + s.quran.from + (s.quran.to !== s.quran.from ? '-' + s.quran.to : ''));
    if (out.length > 2) out.push('');
    // a place and size as the nearest words (the format has no numbers for them)
    const near = (v, opts) => (v == null ? null : opts.reduce((m, o) => (Math.abs(o[1] - v) < Math.abs(m[1] - v) ? o : m)));
    const where = st => {
      const w = [];
      const x = near(st.x, [['left', 0.24], ['center', 0.5], ['right', 0.76]]);
      const y = near(st.y, [['top', 0.2], ['middle', 0.5], ['bottom', 0.75]]);
      const s = near(st.s, [['small', 0.3], ['medium', 0.46], ['large', 0.66]]);
      if (x && x[0] !== 'center') w.push(x[0]);
      if (y && y[0] !== 'bottom') w.push(y[0]);
      if (s && st.s !== 0.38 && s[0] !== 'medium') w.push(s[0]);
      return w.length ? ' ' + w.join(' ') : '';
    };
    const tag = st => '<sticker ' + (st.slot != null ? st.slot : st.id) + where(st) + (st.fx && st.fx !== 'pop' ? ' ' + st.fx : '') + (st.flip ? ' flip' : '') + (st.line == null ? ' all' : st.until === 'next' || st.until === 'end' ? ' ' + st.until : '') + '>';
    v.lines.forEach((ln, i) => {
      let row = '';
      if (ln.a != null) row += '[' + clock(ln.a) + (ln.b != null ? ' - ' + clock(ln.b) : '') + '] ';
      row += ln.text;
      const o = [];
      if (ln.font) o.push('font: ' + ln.font);
      if (ln.size) o.push('size: ' + ln.size);
      if (o.length) row += ' {' + o.join(', ') + '}';
      (v.stickers || []).filter(st => st.line === i).forEach(st => { row += ' ' + tag(st); });
      out.push(row);
    });
    const all = (v.stickers || []).filter(st => st.line == null);
    if (all.length) out.push(all.map(tag).join(' '));
    return out.join('\n') + '\n';
  }

  // The template: what the format is, for a person and for an AI asked to write one, with the
  // fonts, the size range and the stickers there are, and an example.
  function template(o) {
    const opts = o || {};
    const ar = opts.lang === 'ar';
    const fonts = FONTS.filter(f => !opts.fonts || opts.fonts.includes(f[0]));
    const st = opts.stickers || [];
    const L = [];
    L.push('# ==============================================================');
    L.push('# Zad Al-Muslim | video script template  ·  قالب سيناريو فيديو «خاطرة»');
    L.push('# ==============================================================');
    L.push('# للمستخدم: أعطِ هذا الملف لمساعد ذكاء اصطناعي واكتب له موضوع الفيديو، مثلاً:');
    L.push('#   «اكتب سيناريو فيديو قصير عن الصبر بهذا القالب».');
    L.push('#   ثم احفظ ما يكتبه في ملف ‎.txt‎ وارفعه في صانع الفيديو ← خاطرة ← نص من كتابتك ← «رفع سيناريو»');
    L.push('#   (أو الصقه هناك). بعد الرفع اختر صورة لكل ملصق: ملصق ١، ملصق ٢ ...');
    L.push('# For the user: give this file to an AI assistant with your topic, e.g. "Write a short video');
    L.push('#   script about patience using this template". Save its answer as a .txt file and upload it in');
    L.push('#   the video maker → «خاطرة» → «نص من كتابتك» → upload script (or paste it). Then choose a');
    L.push('#   picture for each sticker number.');
    L.push('#');
    L.push('# ---------------- INSTRUCTIONS FOR THE AI ----------------');
    L.push('# You write the script of a short vertical video (a "khatira": a reminder or reflection, about');
    L.push('# 20 to 60 seconds) on the topic the user gives, in the user\'s language (Arabic unless asked');
    L.push('# otherwise). The text appears on screen word by word over a calm background.');
    L.push('# Reply with ONLY the script, in one plain-text code block, in exactly this format. No other text.');
    L.push('#');
    L.push('# 1) SETTINGS (optional), one per row, at the top:');
    L.push('#    @font: <font id>        the font of the whole video (list below)');
    L.push(`#    @size: <number>         text size, from ${LIMITS.size[0]} (small) to ${LIMITS.size[1]} (large); 1 = normal`);
    L.push(`#    @spacing: <number>      space between lines, from ${LIMITS.spacing[0]} (tight) to ${LIMITS.spacing[1]} (airy); 1.45 = normal`);
    L.push('#    @position: top | middle | bottom, or a height 0 … 1 (0.3 = a little above the middle)');
    L.push('#            where the text sits (default top, with a sticker below it)');
    L.push('#    @style: line | build | word');
    L.push('#            line  = the whole line shows, the word being read is lit (default)');
    L.push('#            build = the words appear one by one in place');
    L.push('#            word  = one big word at a time (good for short, strong lines)');
    L.push('#    @color: #rrggbb         text colour, e.g. #ffffff (white), #f5e6b8 (cream), #e6c068 (gold)');
    L.push('#    @look: ' + LOOKS.join(' | '));
    L.push('#            the colours of the background picture / video (a mood: warm = hope, night = worry,');
    L.push('#            cinematic = a story, golden = gratitude, bw / noir = grief or warning). Default none.');
    L.push('#    @format: story | square | wide     9:16 (default), 1:1, 16:9');
    L.push('#    @name: <text>           a small name shown at the bottom (author / channel), optional');
    L.push('#    @quran: <surah>:<from>-<to>   a recitation of these ayat as the sound under the text');
    L.push('#            (optional; at most 20 ayat, e.g. @quran: 94:5-6). Choose ayat that fit the topic,');
    L.push('#            quote them exactly. Lines without times are then spread over the recitation.');
    L.push('#            Without @quran the video is silent (the user may add a recording).');
    L.push('#');
    L.push('# 2) LINES: one row per line of text, in order:');
    L.push('#    [start - end] the text of the line {font: <id>, size: <number>} <sticker N options>');
    L.push('#    - Times are seconds from the start of the video: 12, 12.5, or minutes:seconds 0:12.');
    L.push('#      Lines follow each other with no overlap. Give each line about 0.35 s per word + 1 s.');
    L.push('#      The time is optional: a line without one is timed by its length; [0:04] gives only the start.');
    L.push(`#    - At most ${LIMITS.lines} lines; keep each short (3 to 12 words, at most ${LIMITS.chars} characters).`);
    L.push('#    - {font: ..., size: ...} is optional: that line only, overriding @font / @size.');
    L.push('#      Use it for emphasis (a key line larger, or in a calligraphic font), not on every line.');
    L.push('#    - Rows starting with # are comments and are ignored. Do not put quotes around the text.');
    L.push('#');
    L.push('# 3) STICKERS: pictures of one character (a bearded man in a white thobe, his face left blank)');
    L.push('#    shown with a line of text. PICK THEM YOURSELF from the list below: put <sticker ID> at the end');
    L.push('#    of the line it goes with, choosing the picture whose pose and mood fit that line');
    L.push('#    (a question → a thinking one, a dua → hands raised, a verse → the mushaf ...).');
    L.push('#    Use a sticker on about half the lines, not every one; repeat one when the mood repeats.');
    L.push('#    At most ' + LIMITS.stickers + ' in all. (<sticker 1>, <sticker 2> ... are placeholders the user fills in later.)');
    L.push('#    Options inside the tag, any order:');
    L.push('#      where:  left | center | right    and    top | middle | bottom   (default: centred, standing on the bottom edge, large)');
    L.push('#      size:   small | medium | large');
    L.push('#      effect: ' + FX.join(' | ') + '   (how it comes in and goes out; default pop)');
    L.push('#      flip    (mirror it)        all    (show it for the whole video, not just that line)');
    L.push('#      next    (stays until the next sticker shows)    end    (stays from its line to the end)');
    L.push('#    e.g.  <sticker h05 fade>   <sticker s13 right small>   <sticker h01 all top float>');
    L.push('#    The text sits at the top: one sticker per line, at the bottom, is the clearest.');
    if (st.length) {
      L.push('#    THE STICKERS (id · what it shows · what it fits · its Arabic name):');
      st.forEach(s => L.push('#      ' + s.id + '  ' + (s.about || s.en) + (s.ar ? '  ·  ' + s.ar : '')));
    }
    L.push('#');
    L.push('# FONTS (ids for @font and {font: ...}):');
    fonts.forEach(([id, d]) => L.push('#    ' + id.padEnd(13) + d));
    L.push('#    Arabic fonts; for long lines prefer amiri, scheherazade, naskh or cairo.');
    L.push('# ---------------------------------------------------------');
    L.push('');
    L.push('# Example (replace it with the new script):');
    // the example names pictures by id when the list is there, else by placeholder number
    const has = id => st.some(x => x.id === id);
    const pickId = (id, n) => (has(id) ? id : String(n));
    if (ar) {
      L.push('@font: amiri', '@size: 1', '@style: line', '');
      L.push('[0:00 - 0:04] هل ضاقت بك الدنيا يوماً؟ <sticker ' + pickId('h10', 1) + ' fade>');
      L.push('[0:04 - 0:09] تذكّر أن بعد العسر يسراً');
      L.push('[0:09 - 0:14] فإن مع العسر يسراً {font: ruqaa, size: 1.3} <sticker ' + pickId('h06', 3) + '>');
      L.push('[0:14 - 0:19] ارفع يديك وقل: يا رب <sticker ' + pickId('h05', 2) + ' float>');
      L.push('[0:19 - 0:23] فإنه قريب يجيب دعوة الداعي');
    } else {
      L.push('@font: cairo', '@size: 1', '@style: build', '');
      L.push('[0:00 - 0:04] Has the world ever felt too narrow? <sticker ' + pickId('h10', 1) + ' fade>');
      L.push('[0:04 - 0:09] Remember: after hardship comes ease');
      L.push('[0:09 - 0:14] Indeed, with hardship comes ease {font: changa, size: 1.3} <sticker ' + pickId('h06', 3) + '>');
      L.push('[0:14 - 0:19] Raise your hands and say: O my Lord <sticker ' + pickId('h05', 2) + ' float>');
      L.push('[0:19 - 0:23] He is near, He answers the one who calls');
    }
    return L.join('\n') + '\n';
  }

  const api = { parse, serialize, template, clock, LIMITS, FONTS: FONT_IDS, STYLES, FORMATS, FX, LOOKS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VMScript = api;
})(typeof window !== 'undefined' ? window : this);
