// Character stickers for the video maker (pages/video-maker.html): 49 pictures of the character
// (images/stickers/h01..h10.webp, the high-resolution pack, shown first, then s01..s39, cut from
// the supplied sheets) the user can put on a video: tap one in the picker to add it, then move it
// on the preview (drag, or the sliders), resize, flip, bring to the front or delete it. Each one
// shows from / to a second of the video (the whole video by default) and comes in and goes out
// with an effect. They are drawn by renderFrame, so the preview, the mini preview and the
// exported video all show them.
//
// A video script (js/video-script.js) adds stickers too: each shows with its line of text
// (`line`, the index of the text) and may be a numbered placeholder (`slot`, no picture yet)
// until the user picks a picture for that number. The whole pack downloads as one ZIP.
//
// The user's own stickers (pictures from the device, ids 'u:<id>') are kept as they are (no
// re-encoding) in the device's storage (IndexedDB 'vm-user-stickers') and listed first.
//
// Created by js/video-maker.js, which passes in what it shares (the settings, the canvas, the
// stage, translations and how to redraw).
(function () {
  'use strict';

  const DIR = '../images/stickers/';
  const MAX = 30;                       // stickers on one video
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
  // What each picture shows and what it suits, for an AI choosing them (the script template).
  const ABOUT = {
    h01: 'Sitting on the floor against a cushion, hugging his knees, looking up. Fits: hope, waiting, quiet reflection, contentment.',
    h02: 'At a laptop, a finger on his temple, a lightbulb above. Fits: an idea, insight, learning, work.',
    h03: 'Hand on his chin, a big blue question mark. Fits: a question to the viewer, wondering, "have you ever...?".',
    h04: 'Writing in an open notebook beside a stack of books. Fits: study, writing, knowledge, planning.',
    h05: 'Standing, both hands raised in dua. Fits: supplication, asking Allah, hope.',
    h06: 'Standing, reading an open mushaf. Fits: reading the Quran, guidance, a verse.',
    h07: 'One hand on his heart, the other held out to the viewer. Fits: sincere advice, an invitation, "my brother...".',
    h08: 'Thinking, chin in hand, arm folded. Fits: contemplation, weighing something, calm thought.',
    h09: 'Hand on his heart, the other hand open. Fits: speaking from the heart, gratitude, sincerity.',
    h10: 'Sitting, head in his hand, eyes down. Fits: grief, worry, exhaustion, a heavy burden.',
    s01: 'Hand on chin, a question mark in a thought bubble. Fits: wondering, puzzled.',
    s02: 'Both fists raised in excitement. Fits: joy, motivation, good news.',
    s03: 'Sitting, covering his face, a tear. Fits: sadness, crying, regret.',
    s04: 'Two thumbs up with sparkles. Fits: approval, well done, good deeds.',
    s05: 'Yawning, "zzz" above. Fits: tiredness, sleepiness, laziness, late nights.',
    s06: 'Hands on his cheeks, shocked, red exclamation marks. Fits: shock, surprise, alarm.',
    s07: 'Hands raised in dua with sparkles. Fits: hopeful dua, blessings.',
    s08: 'Hugging the mushaf, a red heart. Fits: love of the Quran.',
    s09: 'Leaning back, hands behind his head, a sunset. Fits: rest, peace, calm after effort.',
    s10: 'Both hands on his chest, eyes closed. Fits: gratitude, peace of heart, humility.',
    s11: 'Sitting, head in his hand, a storm cloud above. Fits: worry, distress, hard times.',
    s12: 'Making dua, the sun coming out from a cloud. Fits: hope after hardship, relief coming.',
    s13: 'Thinking, a lightbulb above. Fits: an idea, a realization.',
    s14: 'Both hands open, a heart. Fits: love, kindness, generosity, welcome.',
    s15: 'Hands on his temples, red stress waves. Fits: headache, pressure, stress.',
    s16: 'Hand on his chest, eyes closed, breathing out. Fits: relief, calm, tranquility.',
    s17: 'Chin in hand, dreaming of a road at sunset. Fits: the path ahead, the future, the journey of life.',
    s18: 'Making dua, a mosque and a lantern at night. Fits: night prayer, Ramadan, the mosque.',
    s19: 'Sitting, head in his hand, a tangled scribble above. Fits: overthinking, confusion, anxiety.',
    s20: 'Clenched fists, an angry red mark. Fits: anger, frustration.',
    s21: 'Holding his head with both hands, red jagged lines. Fits: overwhelmed, pain, panic.',
    s22: 'In sujood on a prayer mat. Fits: prayer, prostration, humility, closeness to Allah.',
    s23: 'Standing, hands raised in dua, looking up. Fits: supplication, asking.',
    s24: 'Holding prayer beads. Fits: dhikr, remembrance, tasbeeh.',
    s25: 'Sitting cross-legged, reading the mushaf. Fits: reading the Quran, study.',
    s26: 'Sitting at a mushaf on a stand, a finger raised. Fits: a reminder, a lesson from the Quran.',
    s27: 'Sitting against a cushion, hugging his knees, looking up. Fits: quiet waiting, reflection.',
    s28: 'Holding a mushaf, a finger raised. Fits: "Allah says...", pointing to a verse.',
    s29: 'A mushaf on a stand beside a lantern. Fits: Ramadan nights, recitation, tranquility.',
    s30: 'Reading a book among books, against a cushion. Fits: reading, knowledge.',
    s31: 'At a laptop, a lightbulb above. Fits: an idea, learning online.',
    s32: 'Headphones on, reading the mushaf, sound waves. Fits: listening to the Quran.',
    s33: 'Writing in a notebook beside books. Fits: writing, taking notes, planning.',
    s34: 'A finger raised, attention lines. Fits: attention, an important point, "note this".',
    s35: 'Chin in hand, a question mark. Fits: a question, asking the viewer.',
    s36: 'Both hands open, held forward. Fits: explaining, presenting, offering.',
    s37: 'Quiet dua, hands together, head bowed. Fits: humble supplication.',
    s38: 'Reading an open mushaf. Fits: reading the Quran.',
    s39: 'Headphones on. Fits: listening to the Quran, a lecture or a talk.',
  };
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
    let slotSel = null;                // the script's sticker number a picture is being chosen for

    // the user's own stickers: id -> { name, url, blob }
    const own = new Map();
    const OWN_MAX = 60, OWN_BYTES = 15 * 1024 * 1024;
    const isOwn = id => typeof id === 'string' && /^u:[a-z0-9]+$/.test(id);
    const srcOf = id => (isOwn(id) ? (own.get(id) || {}).url || '' : DIR + id + '.webp');
    const known = id => ids.includes(id) || isOwn(id);
    const slotName = n => tr('vm_st_slot', { n: api.num(n) });
    const label = (id, slot) => {
      if (!id) return slot ? slotName(slot) : '';
      if (isOwn(id)) return own.has(id) ? own.get(id).name : tr('vm_st_own_missing');
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
        const src = srcOf(id);
        if (!src) return im;                 // one of the user's, not read from storage yet
        im.src = src;
        imgs.set(id, im);
      }
      return im;
    }

    // ---- settings ----
    function sanitize() {
      const src = Array.isArray(S.stickers) ? S.stickers : [];
      const slotOf = s => (Number.isInteger(+s.slot) && +s.slot >= 1 && +s.slot <= 99 ? +s.slot : null);
      S.stickers = src.filter(s => s && (known(s.id) || (s.id == null && slotOf(s)))).slice(0, MAX).map(s => ({
        id: known(s.id) ? s.id : null,
        slot: slotOf(s),
        // shown with a line of the script (index of the text), or null: from / to
        line: Number.isInteger(+s.line) && s.line !== null && +s.line >= 0 && +s.line < 100 ? +s.line : null,
        x: clamp(+s.x || 0.5, 0, 1),
        y: clamp(+s.y || 0.5, 0, 1),
        s: clamp(+s.s || 0.45, SIZE.min, SIZE.max),
        flip: !!s.flip,
        from: clamp(+s.from || 0, 0, MAX_T),
        // null = to the end of the video
        to: s.to == null || s.to === '' || !isFinite(+s.to) ? null : clamp(+s.to, 0, MAX_T),
        fx: FX.includes(s.fx) ? s.fx : 'pop',
        // with a line: until the line ends ('line'), the next sticker shows ('next'), the video ends ('end'), or a second
        until: ['line', 'next', 'end'].includes(s.until) ? s.until : isFinite(+s.until) && s.until !== null && s.until !== '' && +s.until >= 0 ? Math.min(MAX_T, +s.until) : 'line',
      }));
      S.stickers.forEach(s => { if (s.to != null && s.to <= s.from) s.to = null; });
      if (sel >= S.stickers.length) sel = -1;
      if (slotSel != null && !slots().includes(slotSel)) slotSel = null;
    }
    // the placeholder numbers of the script, in order, and the picture chosen for each (or null)
    const slots = () => [...new Set(list().filter(s => s.slot != null).map(s => s.slot))].sort((a, b) => a - b);
    const slotId = n => { const s = list().find(x => x.slot === n && x.id); return s ? s.id : null; };

    // ---- drawing ----
    // Where a sticker sits on a w x h video: its centre and size in pixels.
    function box(s, w, h) {
      const im = s.id ? image(s.id) : null;
      const ratio = im && im.naturalWidth ? im.naturalHeight / im.naturalWidth : 1;
      const bw = s.s * Math.min(w, h);
      return { cx: s.x * w, cy: s.y * h, w: bw, h: bw * ratio };
    }
    // How far in a sticker is at video time t: { a: opacity, k: scale, dy: offset (share of its
    // height) }, or null while it is off. `t` null = a still (the editor): every sticker, as placed.
    const easeOut = x => 1 - Math.pow(1 - x, 3);
    const easeBack = x => { const k = 1.70158; return 1 + (k + 1) * Math.pow(x - 1, 3) + k * Math.pow(x - 1, 2); };
    // span(line) -> [start, end] of a script line in the timeline, null when that line is not in
    // it (an emptied text), undefined when there are no lines (not own words): then from / to.
    // when a sticker shows: [from, to] (to null = the end), or null when its line is not there
    function spanOf(s, span) {
      if (s.line != null && span) {
        const sp = span(s.line);
        if (sp === null) return null;
        if (sp) {
          const u = s.until;
          return [sp[0], u === 'end' || u === 'next' ? null : typeof u === 'number' ? (u > sp[0] ? u : sp[1]) : sp[1]];
        }
      }
      return [s.from, s.to];
    }
    // 'next': until the first sticker after it begins (or the end)
    function nextStart(s, from, span) {
      let best = null;
      for (const o of list()) {
        if (o === s || !o.id) continue;
        const sp = spanOf(o, span);
        if (sp && sp[0] > from + 0.01 && (best == null || sp[0] < best)) best = sp[0];
      }
      return best;
    }
    function look(s, t, total, span) {
      if (t == null) return { a: 1, k: 1, dy: 0 };
      const all = total || MAX_T;
      const sp = spanOf(s, span);
      if (!sp) return null;
      let [from, to] = sp;
      if (s.line != null && span && s.until === 'next') to = nextStart(s, from, span);
      const end = to == null ? all : Math.min(to, all);
      if (t < from || t > end) return null;
      const d = Math.min(FX_DUR, (end - from) / 2);
      // in: 0 -> 1 over the first d seconds; out: 1 -> 0 over the last d (only when it leaves
      // before the end: at the end the whole video fades)
      const pin = d > 0 && from > 0 ? Math.min(1, (t - from) / d) : 1;
      const pout = d > 0 && to != null && to < all - 0.05 ? Math.min(1, (end - t) / d) : 1;
      const p = Math.max(0, Math.min(pin, pout));
      const e = easeOut(p);
      const r = { a: 1, k: 1, dy: 0 };
      switch (s.fx) {
        case 'fade': r.a = e; break;
        case 'pop': r.a = Math.min(1, p * 3); r.k = Math.max(0.01, easeBack(p)); break;
        case 'slide': r.a = e; r.dy = (1 - e) * 0.6; break;
        case 'zoom': r.a = e; r.k = 0.25 + 0.75 * e; break;
        case 'float': r.a = e; r.dy = (1 - e) * 0.15 + Math.sin((t - from) * 2.2) * 0.025; break;
        default: break;
      }
      return r.a > 0.003 ? r : null;
    }
    // editing: the preview standing still (the chosen sticker shows whatever its time)
    function draw(c, w, h, t, total, span, editing) {
      for (const s of list()) {
        if (!s.id) continue;               // a script's number with no picture chosen yet
        const im = image(s.id);
        if (!im.complete || !im.naturalWidth) continue;
        // the chosen one always shows while it is being edited (the preview stands still)
        const v = editing && list()[sel] === s ? { a: 1, k: 1, dy: 0 } : look(s, t == null ? null : t, total, span);
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
      if (!s || !s.id || api.playing() || stage.classList.contains('is-fs')) { frame.hidden = true; return; }
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
        b.onclick = () => (slotSel != null ? assign(slotSel, id) : add(id));
        grid.appendChild(b);
      });
      renderOwn();
      relabel();
    }

    // ---- the user's own stickers: «+ ملصقك» first, then theirs (each with ×), then the pack ----
    function ownDb() {
      return new Promise((resolve, reject) => {
        if (!window.indexedDB) { reject(new Error('no IndexedDB')); return; }
        const rq = indexedDB.open('vm-user-stickers', 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore('items', { keyPath: 'id' });
        rq.onsuccess = () => resolve(rq.result);
        rq.onerror = () => reject(rq.error);
      });
    }
    async function ownTx(mode, fn) {
      const db = await ownDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('items', mode), st = tx.objectStore('items');
        const out = fn(st);
        tx.oncomplete = () => { db.close(); resolve(out && out.result !== undefined ? out.result : undefined); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      });
    }
    async function loadOwn() {
      let rows = [];
      try { rows = (await ownTx('readonly', st => st.getAll())) || []; } catch (e) { rows = []; }
      rows.sort((a, b) => b.added - a.added).forEach(r => {
        if (!own.has(r.id)) own.set(r.id, { name: r.name, blob: r.blob, url: URL.createObjectURL(r.blob) });
      });
      renderOwn();
      relabel();
      renderControls();
      api.redraw();
    }
    function renderOwn() {
      const grid = $('vmStGrid');
      if (!grid) return;
      grid.querySelectorAll('.st-add, .st-own').forEach(el => el.remove());
      const first = grid.firstChild;
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'st-tile st-add';
      addBtn.id = 'vmStOwnAdd';
      addBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span></span>';
      addBtn.querySelector('span').textContent = tr('vm_st_own_add');
      addBtn.title = tr('vm_st_own_add_long');
      addBtn.setAttribute('aria-label', tr('vm_st_own_add_long'));
      addBtn.onclick = () => $('vmStOwnFile').click();
      grid.insertBefore(addBtn, first);
      for (const [id, o] of own) {
        const wrap = document.createElement('div');
        wrap.className = 'st-own';
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'st-tile';
        b.dataset.sticker = id;
        const im = document.createElement('img');
        im.src = o.url;
        im.alt = '';
        b.appendChild(im);
        b.onclick = () => (slotSel != null ? assign(slotSel, id) : add(id));
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'st-own-del';
        del.textContent = '×';
        del.setAttribute('aria-label', tr('vm_st_own_delete', { name: o.name }));
        del.title = del.getAttribute('aria-label');
        del.onclick = () => removeOwn(id);
        wrap.append(b, del);
        grid.insertBefore(wrap, first);
      }
    }
    // the pictures as they are (no re-encoding: no loss); each must open as a picture
    async function addOwn(files) {
      let added = null, bad = 0;
      for (const f of files) {
        if (own.size >= OWN_MAX) { api.say(tr('vm_st_own_max', { n: api.num(OWN_MAX) }), true); break; }
        if (!/^image\//.test(f.type) || f.size > OWN_BYTES || !(await opens(f))) { bad++; continue; }
        const id = 'u:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        const name = String(f.name || '').replace(/\.[^.]+$/, '').slice(0, 40) || tr('vm_st_own');
        try {
          await ownTx('readwrite', st => st.put({ id, name, blob: f, added: Date.now() }));
        } catch (e) { bad++; continue; }
        own.set(id, { name, blob: f, url: URL.createObjectURL(f) });
        // newest first: move it to the front
        const o = own.get(id); own.delete(id);
        const rest = [...own]; own.clear(); own.set(id, o); rest.forEach(([k, v]) => own.set(k, v));
        added = added || id;
      }
      renderOwn();
      relabel();
      // the first one goes into the video (or fills the script's number being chosen)
      if (added) {
        if (slotSel != null) assign(slotSel, added);
        else add(added);
      }
      if (bad) api.say(tr('vm_st_own_bad'), true);
      else if (added) api.say(tr('vm_st_own_added'), false);
    }
    function opens(f) {
      return new Promise(resolve => {
        const u = URL.createObjectURL(f), im = new Image();
        im.onload = () => { URL.revokeObjectURL(u); resolve(im.naturalWidth > 0); };
        im.onerror = () => { URL.revokeObjectURL(u); resolve(false); };
        im.src = u;
      });
    }
    async function removeOwn(id) {
      const used = list().filter(s => s.id === id).length;
      if (!confirm(used ? tr('vm_st_own_delete_used', { n: api.num(used) }) : tr('vm_st_own_delete_ask'))) return;
      try { await ownTx('readwrite', st => st.delete(id)); } catch (e) { /* gone from the list anyway */ }
      const o = own.get(id);
      if (o) URL.revokeObjectURL(o.url);
      own.delete(id);
      imgs.delete(id);
      if (used) { S.stickers = list().filter(s => s.id !== id); sel = -1; }
      renderOwn();
      relabel();
      changed();
    }
    function relabel() {
      document.querySelectorAll('#vmStGrid .st-tile[data-sticker]').forEach(b => {
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
        b.setAttribute('aria-label', label(s.id, s.slot));
        b.title = label(s.id, s.slot);
        if (s.id) {
          const im = document.createElement('img');
          im.src = srcOf(s.id);
          im.alt = '';
          b.appendChild(im);
        } else {
          b.classList.add('st-chip-empty');
          b.textContent = api.num(s.slot);
        }
        b.onclick = () => select(i === sel ? -1 : i);
        box.appendChild(b);
      });
      $('vmStEmpty').hidden = list().length > 0;
      renderSlots();
      $('vmStCount').textContent = list().length ? api.num(list().length) + ' / ' + api.num(MAX) : '';
    }
    function renderControls() {
      renderAdded();
      const s = list()[sel];
      $('vmStControls').hidden = !s;
      api.canvas.style.touchAction = s ? 'none' : '';
      if (!s) return;
      $('vmStAll').disabled = list().length < 2;
      $('vmStName').textContent = label(s.id, s.slot) + (s.id && s.slot ? ' · ' + slotName(s.slot) : '');
      // when it shows: with one of the texts (while that line is on screen), or from / to
      const texts = api.lines ? api.lines() : [];
      const pick = $('vmStWith');
      pick.innerHTML = '';
      const opt = (v, t) => { const o = document.createElement('option'); o.value = v; o.textContent = t; pick.appendChild(o); };
      opt('time', tr('vm_st_with_time'));
      texts.forEach(x => opt(String(x.i), tr('vm_st_with_line', { n: api.num(x.n) }) + ': ' + (x.text.length > 28 ? x.text.slice(0, 27) + '…' : x.text)));
      if (s.line != null && !texts.some(x => x.i === s.line)) opt(String(s.line), tr('vm_st_with_line', { n: api.num(s.line + 1) }));
      pick.value = s.line == null ? 'time' : String(s.line);
      $('vmStWithRow').hidden = !texts.length && s.line == null;
      $('vmStTimes').hidden = s.line != null;
      $('vmStUntilRow').hidden = s.line == null;
      const u = typeof s.until === 'number' ? 'time' : s.until;
      $('vmStUntil').value = u;
      $('vmStUntilAt').hidden = u !== 'time';
      if (u === 'time' && document.activeElement !== $('vmStUntilAt')) $('vmStUntilAt').value = +s.until.toFixed(1);
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
    // ---- the script's numbered stickers: a picture for each number ----
    function renderSlots() {
      const box = $('vmStSlots');
      if (!box) return;
      const ns = slots();
      box.hidden = !ns.length;
      const row = $('vmStSlotList');
      row.innerHTML = '';
      ns.forEach(n => {
        const id = slotId(n);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'st-slot' + (n === slotSel ? ' active' : '') + (id ? '' : ' empty');
        b.dataset.slot = n;
        b.setAttribute('aria-pressed', n === slotSel ? 'true' : 'false');
        const count = list().filter(s => s.slot === n).length;
        b.title = slotName(n) + (id ? ': ' + label(id) : '') + ' (×' + api.num(count) + ')';
        b.setAttribute('aria-label', b.title);
        if (id) { const im = document.createElement('img'); im.src = srcOf(id); im.alt = ''; b.appendChild(im); }
        const tag = document.createElement('span');
        tag.className = 'st-slot-n';
        tag.textContent = api.num(n);
        b.appendChild(tag);
        b.onclick = () => pickFor(n === slotSel ? null : n);
        row.appendChild(b);
      });
      const left = ns.filter(n => !slotId(n)).length;
      $('vmStSlotHint').textContent = slotSel != null ? tr('vm_st_slot_pick', { n: api.num(slotSel) }) : left ? tr('vm_st_slot_left', { n: api.num(left) }) : tr('vm_st_slot_done');
      $('vmStGrid').classList.toggle('picking', slotSel != null);
    }
    function pickFor(n) {
      slotSel = n;
      if (n != null) { sel = -1; placeBox(); setPicker(true); }
      renderControls();
      if (n != null) { const g = $('vmStGrid'); if (g.scrollIntoView) g.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    }
    // the picture for every sticker of number n; then on to the next number without one
    function assign(n, id) {
      list().forEach(s => { if (s.slot === n) s.id = id; });
      const next = slots().find(k => !slotId(k));
      slotSel = next == null ? null : next;
      api.save(); api.redraw(); renderControls();
    }
    // a script's stickers replace the ones the last script added (the user's own stay)
    function fromScript(items) {
      const own = list().filter(s => s.line == null && s.slot == null);
      const room = Math.max(0, MAX - own.length);
      S.stickers = own.concat(items.slice(0, room).map(s => ({
        id: s.id || null, slot: s.slot || null, line: s.line == null ? null : s.line,
        // no place given: one alone stands on the bottom edge, large, like a sticker added by hand
        ...(s.auto && s.x === 0.5 ? standing(s.id) : { x: s.x, y: s.y, s: s.s }), flip: !!s.flip, from: 0, to: null, fx: s.fx || 'pop', until: s.until || 'line',
      })));
      sanitize();
      sel = -1;
      const first = slots().find(k => !slotId(k));
      slotSel = first == null ? null : first;
      api.save(); api.redraw(); renderControls(); placeBox();
      return { added: Math.min(items.length, room), dropped: Math.max(0, items.length - room) };
    }
    const catalog = () => ids.map((id, i) => ({ id, ar: ALL[i][0], en: ALL[i][1], about: ABOUT[id] || '' }));

    // ---- the whole pack as one ZIP (with a list of what each picture is) ----
    async function downloadPack() {
      const btn = $('vmStPack');
      if (!window.ZipStore || btn.disabled) return;
      btn.disabled = true;
      try {
        const files = [];
        for (let i = 0; i < ids.length; i++) {
          api.say(tr('vm_st_pack_busy', { n: api.num(i + 1), of: api.num(ids.length) }), false);
          const r = await fetch(DIR + ids[i] + '.webp');
          if (!r.ok) throw new Error('HTTP ' + r.status);
          files.push({ name: 'zad-stickers/' + ids[i] + '.webp', data: new Uint8Array(await r.arrayBuffer()) });
        }
        const list = catalog().map(c => c.id + '\t' + c.ar + '\t' + c.en).join('\n');
        files.push({ name: 'zad-stickers/stickers.txt', data: new TextEncoder().encode('id\tالعربية\tEnglish\n' + list + '\n') });
        const blob = new Blob([ZipStore.make(files)], { type: 'application/zip' });
        api.download(blob, 'zad-stickers.zip');
        api.say(tr('vm_st_pack_done', { n: api.num(ids.length) }), false);
      } catch (e) {
        console.warn('[stickers] pack', e);
        api.say(tr('vm_st_pack_err'), true);
      } finally {
        btn.disabled = false;
      }
    }

    function setPicker(open) {
      $('vmStGrid').hidden = !open;
      $('vmStPickToggle').setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    function select(i) {
      sel = i;
      if (i >= 0) slotSel = null;
      placeBox();
      renderControls();
    }
    // centred, and as low as it goes with its whole picture in the frame
    function standing(id) {
      const cv = api.canvas, w = cv.width || 1080, h = cv.height || 1920, base = Math.min(w, h);
      const tile = document.querySelector('#vmStGrid [data-sticker="' + id + '"] img'), im = image(id);
      const src = im && im.naturalWidth ? im : tile && tile.naturalWidth ? tile : null;
      const ratio = src ? src.naturalHeight / src.naturalWidth : 1.3;
      const sz = w < h ? 0.62 : 0.5;                              // a portrait video: about two thirds of its width
      const bh = sz * base * ratio;
      return { x: 0.5, y: Math.round(Math.max(0.5, 1 - bh / 2 / h) * 1000) / 1000, s: sz };
    }
    function add(id) {
      if (list().length >= MAX) { api.say(tr('vm_st_max', { n: api.num(MAX) }), true); return; }
      // new ones start centred and large, standing on the bottom edge of the video (the text is above)
      const at = standing(id);
      const st = Object.assign({ id, flip: false, from: 0, to: null, fx: 'pop', line: null, slot: null, until: 'line' }, at);
      S.stickers.push(st);
      // its picture's shape not known yet (not loaded): place it again once it is, unless it was moved
      const im = image(id);
      if (!im.naturalWidth) {
        im.addEventListener('load', () => {
          if (st.x === at.x && st.y === at.y && st.s === at.s) { Object.assign(st, standing(id)); changed(); }
        }, { once: true });
      }
      api.say('', false);
      sel = S.stickers.length - 1;
      setPicker(false);                 // its controls come next; the picker opens again with a tap
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
      // only what the preview shows at its moment (the chosen one always)
      const f = api.frame ? api.frame() : null;
      for (let i = list().length - 1; i >= 0; i--) {
        if (!list()[i].id) continue;
        if (f && i !== sel && !look(list()[i], f.t, f.total, f.span)) continue;
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
      // either corner handle resizes: the sticker's width follows the finger's distance from its centre
      for (const handle of [$('vmStHandle'), $('vmStHandle2')]) {
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
      }
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && slotSel != null && !document.querySelector('.bottom-sheet.active')) { pickFor(null); return; }
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
      // the chosen one's place, size and effect for every sticker (each keeps its own timing and picture)
      $('vmStAll').onclick = () => {
        const s = list()[sel];
        if (!s || list().length < 2) return;
        list().forEach(o => { if (o !== s) { o.x = s.x; o.y = s.y; o.s = s.s; o.fx = s.fx; } });
        changed();
        api.say(tr('vm_st_all_done', { n: api.num(list().length - 1) }), false);
      };
      // when it shows: seconds from the start; an empty "to" = until the end
      const time = () => {
        const s = list()[sel];
        if (!s) return;
        const f = parseFloat($('vmStFrom').value), e = parseFloat($('vmStTo').value);
        s.from = isFinite(f) ? clamp(f, 0, MAX_T) : 0;
        s.to = isFinite(e) && e > s.from ? clamp(e, 0, MAX_T) : null;
        api.save(); api.redraw();
      };
      $('vmStWith').onchange = () => {
        const s = list()[sel];
        if (!s) return;
        const v = $('vmStWith').value;
        if (v === 'time') {
          // from a line to set times: where that line was, as a start
          if (s.line != null) {
            const sp = api.lineSpan ? api.lineSpan(s.line) : null;
            s.from = sp ? Math.round(sp[0] * 10) / 10 : 0;
            s.to = sp ? Math.round(sp[1] * 10) / 10 : null;
          }
          s.line = null;
        } else s.line = +v;
        changed();
      };
      $('vmStPack').onclick = downloadPack;
      const file = $('vmStOwnFile');
      file.onchange = () => { const fs = [...(file.files || [])]; file.value = ''; if (fs.length) addOwn(fs); };
      loadOwn();
      $('vmStUntil').onchange = () => {
        const s = list()[sel];
        if (!s) return;
        const v = $('vmStUntil').value;
        if (v === 'time') {
          const sp = api.lineSpan ? api.lineSpan(s.line) : null;
          s.until = Math.round((sp ? sp[1] : 5) * 10) / 10;
        } else s.until = v;
        changed();
      };
      $('vmStUntilAt').onchange = () => {
        const s = list()[sel];
        const n = parseFloat($('vmStUntilAt').value);
        if (!s || !isFinite(n)) return;
        s.until = clamp(n, 0, MAX_T);
        changed();
      };
      // the picker folds away once there are stickers (less to scroll past)
      $('vmStPickToggle').onclick = () => setPicker($('vmStGrid').hidden);
      setPicker(!list().length);
      const del = $('vmStBoxDel');
      del.addEventListener('pointerdown', e => e.stopPropagation());
      del.onclick = e => { e.stopPropagation(); remove(); };
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
      bindUi, render, draw, placeBox, clickAfterDrag, sanitize, look, hit: p => hit(p), fromScript, catalog, assign, pickFor, downloadPack,
      get slotSel() { return slotSel; },
      get max() { return MAX; },
      get selected() { return sel; },
      get ids() { return ids.concat([...own.keys()]); },
      get ownCount() { return own.size; },
    };
  };
})();
