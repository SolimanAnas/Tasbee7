// Character stickers for the video maker (pages/video-maker.html): 49 pictures of the character
// (images/stickers/h01..h10.webp, the high-resolution pack, shown first, then s01..s39, cut from
// the supplied sheets) the user can put on a video: tap one in the picker to add it, then move it
// on the preview (drag, or the sliders), resize, flip, bring to the front or delete it. Each one
// shows from / to a second of the video (the whole video by default) and comes in and goes out
// with an effect. They are drawn by renderFrame, so the preview, the mini preview and the
// exported video all show them.
//
// Created by js/video-maker.js, which passes in what it shares (the settings, the canvas, the
// stage, translations and how to redraw).
(function () {
  'use strict';

  const DIR = '../images/stickers/';
  const MAX = 12;                       // stickers on one video
  const SIZE = { min: 0.08, max: 1.3 }; // width as a share of the shorter side of the video
  const FX = ['pop', 'fade', 'slide', 'zoom', 'float', 'none'];   // how a sticker comes in and goes out
  const FX_DUR = 0.5;                   // seconds the effect takes
  const MAX_T = 3600;                   // a time beyond any video

  // The high-resolution pack, first in the picker: [Arabic, English].
  const HD = [
    ['يتأمل السماء', 'Looking up, thinking'], ['فكرة على اللابتوب', 'An idea at the laptop'], ['يتساءل', 'Wondering why'],
    ['يكتب بين الكتب', 'Writing among books'], ['يدعو', 'Making dua'], ['يقرأ المصحف', 'Reading the mushaf'],
    ['يدعو بيده على صدره', 'Inviting, hand on heart'], ['يفكر', 'Thinking'], ['يده على قلبه', 'Hand on heart, open hand'],
    ['مهموم', 'Worried, head in hand'],
  ];

  // What each picture shows: [Arabic, English] (the other languages read the English).
  const LABELS = [
    ['متأمل وعلامة استفهام', 'Wondering'], ['متحمس', 'Excited'], ['يبكي', 'Crying'], ['إعجاب', 'Thumbs up'],
    ['يتثاءب', 'Yawning'], ['مندهش', 'Surprised'], ['يدعو وتألق', 'Dua with sparkles'], ['يحتضن المصحف', 'Hugging the Quran'],
    ['يستريح عند الغروب', 'Resting at sunset'], ['يده على صدره', 'Hand on heart'], ['همّ وعاصفة', 'Storm of worry'], ['يدعو وشمس', 'Dua and sun'],
    ['فكرة', 'Idea'], ['يفتح يديه بمحبة', 'Open hands, with love'], ['يضغط على صدغيه', 'Headache'], ['يتنفس براحة', 'Sigh of relief'],
    ['تأمل وطريق', 'Thinking of the road'], ['يدعو والمسجد', 'Dua and the mosque'], ['حيرة وتشتت', 'Overthinking'], ['غضب', 'Angry'],
    ['ألم في الرأس', 'Head in hands'], ['سجود', 'Sujood'], ['يدعو رافعاً يديه', 'Dua, hands raised'], ['تسبيح', 'Tasbeeh'],
    ['يقرأ القرآن', 'Reading the Quran'], ['تذكير والمصحف على الرحل', 'Reminder, Quran on its stand'], ['جلسة هادئة', 'Quiet sitting'],
    ['مصحف وإشارة', 'Quran and pointing'], ['رحل وفانوس', 'Quran stand and lantern'], ['يقرأ بين الكتب', 'Reading among books'],
    ['فكرة ولابتوب', 'Idea at the laptop'], ['يستمع إلى القرآن', 'Listening to the Quran'], ['يكتب', 'Writing'], ['انتبه', 'Attention'],
    ['تساؤل', 'A question'], ['يفتح يديه', 'Open hands'], ['دعاء هادئ', 'Quiet dua'], ['يقرأ', 'Reading'], ['يستمع', 'Listening'],
  ];
  const pad = i => String(i + 1).padStart(2, '0');
  const ALL = HD.concat(LABELS);
  const ids = HD.map((_, i) => 'h' + pad(i)).concat(LABELS.map((_, i) => 's' + pad(i)));

  window.VMStickers = function (api) {
    const S = api.state;
    const $ = api.$;
    const tr = api.tr;
    const imgs = new Map();            // id -> HTMLImageElement
    let sel = -1;                      // the chosen sticker (index in S.stickers), or -1
    let gesture = null;                // a drag in progress
    let swallowClick = 0;              // the click that ends a drag must not start the preview

    const label = id => {
      const i = ids.indexOf(id);
      if (i < 0) return id;
      return (api.lang() === 'ar' ? ALL[i][0] : ALL[i][1]);
    };
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const list = () => S.stickers;
    function image(id) {
      let im = imgs.get(id);
      if (!im) {
        im = new Image();
        im.onload = () => api.redraw();
        im.src = DIR + id + '.webp';
        imgs.set(id, im);
      }
      return im;
    }

    // ---- settings ----
    function sanitize() {
      const src = Array.isArray(S.stickers) ? S.stickers : [];
      S.stickers = src.filter(s => s && ids.includes(s.id)).slice(0, MAX).map(s => ({
        id: s.id,
        x: clamp(+s.x || 0.5, 0, 1),
        y: clamp(+s.y || 0.5, 0, 1),
        s: clamp(+s.s || 0.45, SIZE.min, SIZE.max),
        flip: !!s.flip,
        from: clamp(+s.from || 0, 0, MAX_T),
        // null = to the end of the video
        to: s.to == null || s.to === '' || !isFinite(+s.to) ? null : clamp(+s.to, 0, MAX_T),
        fx: FX.includes(s.fx) ? s.fx : 'pop',
      }));
      S.stickers.forEach(s => { if (s.to != null && s.to <= s.from) s.to = null; });
      if (sel >= S.stickers.length) sel = -1;
    }

    // ---- drawing ----
    // Where a sticker sits on a w x h video: its centre and size in pixels.
    function box(s, w, h) {
      const im = image(s.id);
      const ratio = im.naturalWidth ? im.naturalHeight / im.naturalWidth : 1;
      const bw = s.s * Math.min(w, h);
      return { cx: s.x * w, cy: s.y * h, w: bw, h: bw * ratio };
    }
    // How far in a sticker is at video time t: { a: opacity, k: scale, dy: offset (share of its
    // height) }, or null while it is off. `t` null = a still (the editor): every sticker, as placed.
    const easeOut = x => 1 - Math.pow(1 - x, 3);
    const easeBack = x => { const k = 1.70158; return 1 + (k + 1) * Math.pow(x - 1, 3) + k * Math.pow(x - 1, 2); };
    function look(s, t, total) {
      if (t == null) return { a: 1, k: 1, dy: 0 };
      const end = s.to == null ? (total || MAX_T) : Math.min(s.to, total || MAX_T);
      if (t < s.from || t > end) return null;
      const d = Math.min(FX_DUR, (end - s.from) / 2);
      // in: 0 -> 1 over the first d seconds; out: 1 -> 0 over the last d (only when it leaves
      // before the end: at the end the whole video fades)
      const pin = d > 0 && s.from > 0 ? Math.min(1, (t - s.from) / d) : 1;
      const pout = d > 0 && s.to != null && s.to < (total || MAX_T) ? Math.min(1, (end - t) / d) : 1;
      const p = Math.max(0, Math.min(pin, pout));
      const e = easeOut(p);
      const r = { a: 1, k: 1, dy: 0 };
      switch (s.fx) {
        case 'fade': r.a = e; break;
        case 'pop': r.a = Math.min(1, p * 3); r.k = Math.max(0.01, easeBack(p)); break;
        case 'slide': r.a = e; r.dy = (1 - e) * 0.6; break;
        case 'zoom': r.a = e; r.k = 0.25 + 0.75 * e; break;
        case 'float': r.a = e; r.dy = (1 - e) * 0.15 + Math.sin((t - s.from) * 2.2) * 0.025; break;
        default: break;
      }
      return r.a > 0.003 ? r : null;
    }
    function draw(c, w, h, t, total) {
      for (const s of list()) {
        const im = image(s.id);
        if (!im.complete || !im.naturalWidth) continue;
        const v = look(s, t == null ? null : t, total);
        if (!v) continue;
        const b = box(s, w, h);
        c.save();
        c.globalAlpha *= v.a;
        c.translate(b.cx, b.cy + v.dy * b.h);
        if (v.k !== 1) c.scale(v.k, v.k);
        if (s.flip) c.scale(-1, 1);
        c.shadowColor = 'rgba(0,0,0,0.35)';
        c.shadowBlur = b.w * 0.04;
        c.shadowOffsetY = b.w * 0.012;
        c.drawImage(im, -b.w / 2, -b.h / 2, b.w, b.h);
        c.restore();
      }
    }

    // ---- the selection frame over the preview (a DOM element: it is never in the video) ----
    function placeBox() {
      const frame = $('vmStickerBox');
      if (!frame) return;
      const cv = api.canvas, stage = $('vmStage');
      const s = list()[sel];
      if (!s || api.playing() || stage.classList.contains('is-fs')) { frame.hidden = true; return; }
      const cr = cv.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      if (!cr.width) { frame.hidden = true; return; }
      const k = cr.width / cv.width;
      const b = box(s, cv.width, cv.height);
      frame.hidden = false;
      frame.style.left = (cr.left - sr.left + (b.cx - b.w / 2) * k) + 'px';
      frame.style.top = (cr.top - sr.top + (b.cy - b.h / 2) * k) + 'px';
      frame.style.width = b.w * k + 'px';
      frame.style.height = b.h * k + 'px';
    }
    const changed = () => { api.save(); api.redraw(); placeBox(); renderControls(); };

    // ---- the card ----
    function renderGrid() {
      const grid = $('vmStGrid');
      if (!grid || grid.childElementCount) return;
      ids.forEach(id => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'st-tile';
        b.dataset.sticker = id;
        const im = document.createElement('img');
        im.src = DIR + id + '.webp';
        im.alt = '';
        im.loading = 'lazy';
        im.decoding = 'async';
        b.appendChild(im);
        b.onclick = () => add(id);
        grid.appendChild(b);
      });
      relabel();
    }
    function relabel() {
      document.querySelectorAll('#vmStGrid .st-tile').forEach(b => {
        const t = tr('vm_st_add_one', { name: label(b.dataset.sticker) });
        b.setAttribute('aria-label', t);
        b.title = t;
      });
    }
    function renderAdded() {
      const box = $('vmStAdded');
      if (!box) return;
      box.innerHTML = '';
      list().forEach((s, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'st-chip' + (i === sel ? ' active' : '');
        b.setAttribute('aria-pressed', i === sel ? 'true' : 'false');
        b.setAttribute('aria-label', label(s.id));
        b.title = label(s.id);
        const im = document.createElement('img');
        im.src = DIR + s.id + '.webp';
        im.alt = '';
        b.appendChild(im);
        b.onclick = () => select(i === sel ? -1 : i);
        box.appendChild(b);
      });
      $('vmStEmpty').hidden = list().length > 0;
      $('vmStCount').textContent = list().length ? api.num(list().length) + ' / ' + api.num(MAX) : '';
    }
    function renderControls() {
      renderAdded();
      const s = list()[sel];
      $('vmStControls').hidden = !s;
      api.canvas.style.touchAction = s ? 'none' : '';
      if (!s) return;
      $('vmStName').textContent = label(s.id);
      const set = (id, v) => { const el = $(id); if (document.activeElement !== el) el.value = v; };
      set('vmStSize', s.s); set('vmStX', s.x); set('vmStY', s.y);
      set('vmStFrom', s.from ? +s.from.toFixed(1) : '');
      set('vmStTo', s.to == null ? '' : +s.to.toFixed(1));
      document.querySelectorAll('#vmStFx [data-fx]').forEach(b => {
        const on = b.dataset.fx === s.fx;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
    function select(i) {
      sel = i;
      placeBox();
      renderControls();
    }
    function add(id) {
      if (list().length >= MAX) { api.say(tr('vm_st_max', { n: api.num(MAX) }), true); return; }
      const n = list().length;
      // new ones start low on the video (clear of the text) and a little apart
      S.stickers.push({ id, x: clamp(0.5 + ((n % 3) - 1) * 0.12, 0.1, 0.9), y: clamp(0.76 - (n % 4) * 0.03, 0.1, 0.9), s: 0.46, flip: false, from: 0, to: null, fx: 'pop' });
      api.say('', false);
      sel = S.stickers.length - 1;
      changed();
    }
    function remove() {
      if (sel < 0) return;
      S.stickers.splice(sel, 1);
      sel = Math.min(sel, S.stickers.length - 1);
      changed();
    }

    // ---- moving it on the preview ----
    function toCanvas(ev) {
      const cv = api.canvas, r = cv.getBoundingClientRect();
      return { x: (ev.clientX - r.left) / r.width * cv.width, y: (ev.clientY - r.top) / r.height * cv.height };
    }
    function hit(p) {
      const cv = api.canvas;
      for (let i = list().length - 1; i >= 0; i--) {
        const b = box(list()[i], cv.width, cv.height);
        if (Math.abs(p.x - b.cx) <= b.w / 2 && Math.abs(p.y - b.cy) <= b.h / 2) return i;
      }
      return -1;
    }
    function bindStage() {
      const cv = api.canvas;
      cv.addEventListener('pointerdown', ev => {
        if (api.busy() || api.playing() || !list().length) return;
        const p = toCanvas(ev), i = hit(p);
        if (i < 0) return;
        ev.stopPropagation();
        select(i);
        const s = list()[i];
        gesture = { kind: 'move', dx: p.x - s.x * cv.width, dy: p.y - s.y * cv.height, moved: false };
        try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* not supported */ }
        ev.preventDefault();
      });
      cv.addEventListener('pointermove', ev => {
        if (!gesture || gesture.kind !== 'move') return;
        const s = list()[sel];
        if (!s) return;
        const p = toCanvas(ev);
        s.x = clamp((p.x - gesture.dx) / cv.width, 0, 1);
        s.y = clamp((p.y - gesture.dy) / cv.height, 0, 1);
        gesture.moved = true;
        changed();
      });
      const end = () => { if (gesture && gesture.moved) swallowClick = Date.now(); gesture = null; };
      cv.addEventListener('pointerup', end);
      cv.addEventListener('pointercancel', end);
      // the corner handle resizes: the sticker's width follows its distance from the centre
      const handle = $('vmStHandle');
      handle.addEventListener('pointerdown', ev => {
        const s = list()[sel];
        if (!s) return;
        ev.stopPropagation(); ev.preventDefault();
        const p = toCanvas(ev), b = box(s, cv.width, cv.height);
        gesture = { kind: 'size', s0: s.s, d0: Math.hypot(p.x - b.cx, p.y - b.cy) || 1, moved: false };
        try { handle.setPointerCapture(ev.pointerId); } catch (e) { /* not supported */ }
      });
      handle.addEventListener('pointermove', ev => {
        if (!gesture || gesture.kind !== 'size') return;
        const s = list()[sel];
        if (!s) return;
        const p = toCanvas(ev), b = box(s, cv.width, cv.height);
        s.s = clamp(gesture.s0 * Math.hypot(p.x - b.cx, p.y - b.cy) / gesture.d0, SIZE.min, SIZE.max);
        gesture.moved = true;
        changed();
      });
      const endH = () => { if (gesture && gesture.moved) swallowClick = Date.now(); gesture = null; };
      handle.addEventListener('pointerup', endH);
      handle.addEventListener('pointercancel', endH);
      handle.addEventListener('click', e => e.stopPropagation());
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && sel >= 0 && !document.querySelector('.bottom-sheet.active') && $('vmResult').hidden) select(-1);
      });
      addEventListener('resize', placeBox);
    }
    // a drag that ends over the video is not a tap on it
    const clickAfterDrag = () => Date.now() - swallowClick < 400;

    function bindUi() {
      renderGrid();
      bindStage();
      const num = (id, key, lo, hi) => { $(id).oninput = () => { const s = list()[sel]; if (!s) return; s[key] = clamp(parseFloat($(id).value), lo, hi); changed(); }; };
      num('vmStSize', 's', SIZE.min, SIZE.max);
      num('vmStX', 'x', 0, 1);
      num('vmStY', 'y', 0, 1);
      $('vmStFlip').onclick = () => { const s = list()[sel]; if (s) { s.flip = !s.flip; changed(); } };
      $('vmStFront').onclick = () => { if (sel >= 0) { S.stickers.push(S.stickers.splice(sel, 1)[0]); sel = S.stickers.length - 1; changed(); } };
      $('vmStDel').onclick = remove;
      // when it shows: seconds from the start; an empty "to" = until the end
      const time = () => {
        const s = list()[sel];
        if (!s) return;
        const f = parseFloat($('vmStFrom').value), e = parseFloat($('vmStTo').value);
        s.from = isFinite(f) ? clamp(f, 0, MAX_T) : 0;
        s.to = isFinite(e) && e > s.from ? clamp(e, 0, MAX_T) : null;
        api.save(); api.redraw();
      };
      $('vmStFrom').onchange = time;
      $('vmStTo').onchange = time;
      $('vmStFromNow').onclick = () => { const s = list()[sel]; if (!s) return; $('vmStFrom').value = +api.now().toFixed(1); time(); renderControls(); };
      $('vmStToNow').onclick = () => { const s = list()[sel]; if (!s) return; $('vmStTo').value = +api.now().toFixed(1); time(); renderControls(); };
      document.querySelectorAll('#vmStFx [data-fx]').forEach(b => {
        b.onclick = () => { const s = list()[sel]; if (!s) return; s.fx = b.dataset.fx; changed(); };
      });
      $('vmStDone').onclick = () => select(-1);
    }
    function render() {
      sanitize();
      renderGrid();
      relabel();
      renderControls();
      placeBox();
    }

    return {
      bindUi, render, draw, placeBox, clickAfterDrag, sanitize, look, hit: p => hit(p),
      get selected() { return sel; },
      get ids() { return ids.slice(); },
    };
  };
})();
