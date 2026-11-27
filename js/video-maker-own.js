// «تسجيلي» — the user's own recording as the recitation (pages/video-maker.html).
//
// The user uploads one recording of the range they chose. It is kept on the device
// (IndexedDB), never uploaded. A recording has no ayah timestamps, so:
//   1. it is decoded once (48 kHz) and its loudness envelope is computed,
//   2. the pauses between ayat give a first split (js/own-recitation.js), or — when
//      they cannot be told apart — the time is shared by the length of each ayah's text,
//   3. the user checks the split by ear in the sync sheet and fixes the boundaries
//      (drag a marker, nudge it, or set it to the playhead).
// The boundaries are remembered per range (surah, from, to, basmala), so coming back
// to a range already synced needs no work. The video then plays / encodes slices of the
// one decoded buffer — nothing is copied or re-downloaded.
//
// Created by js/video-maker.js, which passes in what it shares (state, segments, text
// helpers, the sheet open / close, onChange).
(function () {
  'use strict';

  const DB = 'vm-own-recitation';
  const STORE = 'rec';
  const MAX_SECONDS = 30 * 60;           // longest recording accepted
  const MAX_BYTES = 250 * 1024 * 1024;   // largest file accepted
  const SR = 48000;                      // decoded at the rate the encoder uses
  const MAX_SYNCS = 40;                  // ranges remembered per recording
  const MIN_STEP = 0.2;                  // closest two boundaries may be (s)
  const R = window.OwnRecitation;

  window.VMOwn = function (api) {
    const S = api.state;
    const $ = api.$;
    const tr = api.tr;
    let rec = null;          // { id, name, size, type, duration, sync: { key: entry } }
    let pendingOwn = false;  // «تسجيلي» tapped with nothing uploaded yet: shows the upload panel
    let audio = null;        // decoded: { id, buffer, ch0, ch1, env }
    let decoding = null;

    // ---------- storage ----------
    function db() {
      return new Promise((resolve, reject) => {
        if (!window.indexedDB) { reject(new Error('no IndexedDB')); return; }
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    function tx(mode, fn) {
      return db().then(d => new Promise((resolve, reject) => {
        const t = d.transaction(STORE, mode);
        const out = fn(t.objectStore(STORE));
        t.oncomplete = () => { d.close(); resolve(out && 'result' in out ? out.result : undefined); };
        t.onerror = () => { d.close(); reject(t.error); };
        t.onabort = () => { d.close(); reject(t.error || new Error('aborted')); };
      }));
    }
    const saveMeta = () => tx('readwrite', s => s.put(rec, 'meta')).catch(() => {});
    // Each recording's audio sits under its own key, so a failed replacement leaves the
    // previous recording whole.
    const loadBlob = () => tx('readonly', s => s.get('blob-' + rec.id)).then(b => b || tx('readonly', s => s.get('blob')));
    async function load() {
      try { rec = (await tx('readonly', s => s.get('meta'))) || null; } catch (e) { rec = null; }
      if (rec && !rec.sync) rec.sync = {};
    }

    // ---------- small helpers ----------
    const num = n => (api.arabicNames() ? api.arDigits(n) : String(n));
    function fmt(t, tenths) {
      t = Math.max(0, t);
      const m = Math.floor(t / 60), s = t - m * 60;
      const txt = m + ':' + (tenths ? s.toFixed(1).padStart(4, '0') : String(Math.floor(s)).padStart(2, '0'));
      return api.arabicNames() ? api.arDigits(txt) : txt;
    }
    function size(bytes) {
      const mb = bytes / 1048576;
      const txt = mb >= 1 ? mb.toFixed(mb >= 10 ? 0 : 1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB';
      return api.arabicNames() ? api.arDigits(txt) : txt;
    }
    const letters = t => String(t || '').replace(/[^ء-ي]/g, '').length || 1;
    const has = () => !!rec;
    const active = () => S.recSource === 'own' && has();
    const keyOf = () => api.rangeKey();
    const entryNow = () => (rec && rec.sync[keyOf()]) || null;
    const sig = e => (e ? e.m.map(v => v.toFixed(2)).join(',') + '/' + e.end.toFixed(2) : '');

    // The shown name: what the user typed, else "My recitation" (own) / the reciter (list).
    function displayName() {
      const typed = String(S.sheikh || '').trim();
      if (typed) return typed;
      return active() ? tr('vm_my_recitation') : api.reciterName(api.reciterObj());
    }

    // ---------- decoding ----------
    function decodeBytes(bytes) {
      const ctx = new OfflineAudioContext(2, 1, SR);
      return new Promise((resolve, reject) => {
        const p = ctx.decodeAudioData(bytes, resolve, reject);
        if (p && p.catch) p.catch(reject);
      });
    }
    function decode() {
      if (!rec) return Promise.reject(new Error('no recording'));
      if (audio && audio.id === rec.id) return Promise.resolve(audio);
      if (decoding && decoding.id === rec.id) return decoding.p;
      const id = rec.id;
      const p = (async () => {
        const blob = await loadBlob();
        if (!blob) throw new Error('missing');
        const buffer = await decodeBytes(await blob.arrayBuffer());
        if (buffer.duration > MAX_SECONDS + 5) throw Object.assign(new Error('long'), { code: 'long' });
        const ch0 = buffer.getChannelData(0);
        const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : ch0;
        const env = R.envelopeDb(ch0, ch1, buffer.sampleRate);
        audio = { id, buffer, ch0, ch1, env, blob };
        return audio;
      })();
      decoding = { id, p };
      p.then(() => { decoding = null; }, () => { decoding = null; });
      return p;
    }

    // ---------- the split ----------
    function autoEntry(a, segs) {
      const n = segs.length;
      const r = R.autoSplit(a.env, R.HOP, n);
      let entry;
      if (r.markers) {
        entry = { m: r.markers, end: r.end, reviewed: false, confidence: r.confidence, method: 'silence' };
      } else {
        const one = R.autoSplit(a.env, R.HOP, 1);
        const start = one.markers ? one.markers[0] : 0;
        const end = one.markers ? one.end : a.buffer.duration;
        entry = { m: R.proportional(start, end, segs.map(s => letters(s.text))), end, reviewed: false, confidence: 'low', method: 'text' };
      }
      entry.m = R.normalizeMarkers(entry.m, entry.end, MIN_STEP);
      return entry;
    }
    function store(entry) {
      const key = keyOf();
      delete rec.sync[key];
      rec.sync[key] = entry;
      const keys = Object.keys(rec.sync);
      while (keys.length > MAX_SYNCS) delete rec.sync[keys.shift()];
      saveMeta();
    }
    // Decodes (once) and makes sure the current range has a split.
    async function prepare() {
      const a = await decode();
      const segs = api.segments();
      let e = entryNow();
      if (!e || e.m.length !== segs.length) { e = autoEntry(a, segs); store(e); }
      return { audio: a, entry: e, n: segs.length };
    }
    // [{ off, dur }] — where each ayah sits in the recording.
    function slices(entry) {
      return entry.m.map((o, i) => ({ off: o, dur: (i < entry.m.length - 1 ? entry.m[i + 1] : entry.end) - o }));
    }
    const span = entry => entry.end - entry.m[0];

    // ---------- the panel in step 2 ----------
    function renderBox() {
      const showOwn = (S.recSource === 'own' && has()) || pendingOwn;
      document.querySelectorAll('#vmSource button').forEach(b => b.classList.toggle('active', b.dataset.src === (showOwn ? 'own' : 'reciter')));
      $('vmReciterBox').hidden = showOwn;
      $('vmOwnBox').hidden = !showOwn;
      $('vmSheikh').placeholder = showOwn ? tr('vm_my_recitation') : api.reciterName(api.reciterObj());
      if ($('vmSheikh').value !== (S.sheikh || '')) $('vmSheikh').value = S.sheikh || '';
      const info = $('vmOwnInfo');
      info.hidden = !rec;
      $('vmOwnSync').hidden = !rec;
      $('vmOwnPick').querySelector('.own-pick-text').textContent = rec ? tr('vm_own_replace') : tr('vm_own_pick');
      if (rec) {
        $('vmOwnName').textContent = rec.name;
        // each part in its own left-to-right run, so the order reads right in Arabic too
        $('vmOwnMeta').innerHTML = '<span dir="ltr">' + fmt(rec.duration) + '</span> · <span dir="ltr">' + size(rec.size) + '</span>';
      }
      renderSyncStatus();
      if (api.renderFx) api.renderFx();
    }
    function renderSyncStatus() {
      const el = $('vmOwnStatus');
      el.className = 'own-status';
      if (!rec) { el.textContent = ''; return; }
      const e = entryNow();
      if (!e) { el.textContent = tr('vm_own_unsynced'); el.classList.add('warn'); }
      else if (!e.reviewed) { el.textContent = tr('vm_own_unreviewed'); el.classList.add('warn'); }
      else { el.textContent = tr('vm_own_synced'); el.classList.add('ok'); }
    }

    function probe(file) {
      return new Promise(resolve => {
        const a = new Audio();
        a.preload = 'metadata';
        const url = URL.createObjectURL(file);
        let done = false;
        const fin = v => { if (done) return; done = true; clearTimeout(timer); URL.revokeObjectURL(url); a.removeAttribute('src'); resolve(v); };
        const timer = setTimeout(() => fin(null), 8000);
        a.onloadedmetadata = () => fin(isFinite(a.duration) ? a.duration : null);
        a.onerror = () => fin(null);
        a.src = url;
      });
    }

    async function addFile(file) {
      if (!file) return;
      const okType = /^audio\//.test(file.type) || /^video\/(mp4|webm)$/.test(file.type) || /\.(mp3|m4a|aac|wav|ogg|opus|flac|weba|webm|mp4)$/i.test(file.name);
      if (!okType) { api.setStatus(tr('vm_own_bad'), true); return; }
      if (file.size > MAX_BYTES) { api.setStatus(tr('vm_own_big', { n: Math.round(MAX_BYTES / 1048576) }), true); return; }
      const secs = await probe(file);
      if (secs && secs > MAX_SECONDS) { api.setStatus(tr('vm_own_long', { n: MAX_SECONDS / 60 }), true); return; }
      await saveRecording(file, file.name, secs);
    }

    // Stores and decodes a recording, then makes it the recitation and opens the sync
    // sheet. `onDecoded(audio)` may set the current range's sync (the recorder does).
    async function saveRecording(blob, name, secs, onDecoded) {
      api.setStatus(tr('vm_own_decoding'));
      const previous = rec, previousAudio = audio;
      const id = Date.now().toString(36);
      rec = { id, name, size: blob.size, type: blob.type, duration: secs || 0, sync: {} };
      audio = null;
      try {
        await tx('readwrite', s => { s.put(blob, 'blob-' + id); s.put(rec, 'meta'); });
        const a = await decode();
        rec.duration = a.buffer.duration;
        if (onDecoded) onDecoded(a);
        await saveMeta();
        if (previous) tx('readwrite', s => { s.delete('blob-' + previous.id); s.delete('blob'); }).catch(() => {});
      } catch (e) {
        console.warn('[video-maker] own recording failed', e);
        rec = previous; audio = previousAudio;
        tx('readwrite', s => { s.delete('blob-' + id); if (previous) s.put(previous, 'meta'); else s.delete('meta'); }).catch(() => {});
        const quota = e && (e.name === 'QuotaExceededError' || /quota/i.test(String(e.message)));
        api.setStatus(quota ? tr('vm_bg_no_space') : e && e.code === 'long' ? tr('vm_own_long', { n: MAX_SECONDS / 60 }) : tr('vm_own_bad'), true);
        renderBox();
        return false;
      }
      S.recSource = 'own';
      pendingOwn = false;
      api.setStatus('');
      renderBox();
      api.onChange();
      api.openSync();                 // a new recording is checked right away
      return true;
    }

    // A take from the recorder: `taps` = seconds into it where the reader tapped «التالي».
    // The taps become the sync of the current range (snapped to the pauses); if the
    // reader stopped early, the ayat not reached share the rest by text length.
    function addRecorded(blob, taps) {
      const d = new Date();
      const two = n => String(n).padStart(2, '0');
      const ext = /mp4|aac|m4a/.test(blob.type) ? 'm4a' : /ogg/.test(blob.type) ? 'ogg' : 'webm';
      const name = 'recording-' + d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()) + '-' + two(d.getHours()) + two(d.getMinutes()) + '.' + ext;
      return saveRecording(blob, name, 0, a => {
        const segs = api.segments();
        const n = segs.length;
        const r = R.snapTaps(a.env, R.HOP, taps, n);
        let m = r.markers;
        const end = Math.max(r.end, m[m.length - 1] + MIN_STEP * 2);
        if (m.length < n) {
          const restFrom = m.length - 1;
          m = m.slice(0, restFrom).concat(R.proportional(m[restFrom], end, segs.slice(restFrom).map(sg => letters(sg.text))));
        }
        rec.sync[keyOf()] = {
          m: R.normalizeMarkers(m, end, MIN_STEP), end,
          reviewed: taps.length >= n - 1, confidence: 'high', method: 'live',
        };
      });
    }

    // The recording's levels, for the voice polish (noise floor, voice, peaks).
    let lvCache = null;
    function levels() {
      if (!audio || !window.AudioFx) return null;
      if (!lvCache || lvCache.id !== audio.id) lvCache = { id: audio.id, v: AudioFx.analyze(audio.env, R.percentile) };
      return lvCache.v;
    }

    async function remove() {
      if (!rec) return;
      const id = rec.id;
      rec = null; audio = null;
      try { await tx('readwrite', s => { s.delete('blob-' + id); s.delete('blob'); s.delete('meta'); }); } catch (e) { /* gone anyway */ }
      S.recSource = 'reciter';
      pendingOwn = false;
      renderBox();
      api.onChange();
    }

    // With nothing uploaded yet, «تسجيلي» only shows the upload panel; the recitation
    // stays the reciter's until a recording is in.
    function setSource(src) {
      if (src === 'own' && !has()) { pendingOwn = true; renderBox(); return; }
      pendingOwn = false;
      S.recSource = src;
      renderBox();
      api.onChange();
    }

    // ---------- the sync sheet ----------
    let work = null;     // { m, end, sel, dirty, win, follow, fixed }
    let el = null;       // <audio> element
    let url = '';
    let raf = 0;
    let outlineCache = null;
    const WINS = [10, 30, 120, 0];     // seconds shown; 0 = all

    const dur = () => (audio ? audio.buffer.duration : rec ? rec.duration : 0);

    // The markers the user placed by hand. The others are guesses: when the user fixes one, the
    // guesses after it (up to the next one placed by hand) are worked out again from it, so one
    // missed pause in the middle doesn't mean moving every ayah after it. Splits saved before
    // this was kept count as all placed by hand (the user's work is never moved).
    function fixedOf(e) {
      if (Array.isArray(e.fixed)) return new Set(e.fixed);
      if (e.method === 'manual' || e.method === 'live') return new Set(e.m.map((_, i) => i));
      return new Set();
    }
    // Splits the ayat after marker i again, up to the next fixed marker (or the end).
    // Returns how many moved.
    function followFrom(i) {
      const n = work.m.length;
      if (!audio || i >= n - 1) return 0;
      let j = i + 1;
      while (j < n && !work.fixed.has(j)) j++;
      if (j === i + 1) return 0;
      const b = j < n ? work.m[j] : work.end;
      const segs = api.segments();
      const weights = [];
      for (let q = i; q < j; q++) weights.push(letters(segs[q] && segs[q].text));
      const next = R.resplit(audio.env, R.HOP, work.m[i], b, weights);
      let moved = 0;
      for (let q = i + 1; q < j; q++) {
        if (Math.abs(next[q - i] - work.m[q]) > 0.05) moved++;
        work.m[q] = next[q - i];
      }
      if (moved) showFollowNote(i + 1, j);
      return moved;
    }
    let noteTimer = 0;
    function showFollowNote(from, to) {
      const box = $('vmSyncFollowNote');
      if (!box) return;
      box.textContent = to - from === 1 ? tr('vm_sync_followed_one', { a: num(from + 1) }) : tr('vm_sync_followed', { a: num(from + 1), b: num(to) });
      box.hidden = false;
      clearTimeout(noteTimer);
      noteTimer = setTimeout(() => { box.hidden = true; }, 4000);
    }

    async function openSync() {
      if (!rec) return;
      $('vmSyncStatus').textContent = tr('vm_own_decoding');
      $('vmSyncStatus').className = 'sync-status';
      $('vmSyncList').innerHTML = '';
      try {
        const p = await prepare();
        const e = p.entry;
        work = { m: e.m.slice(), end: e.end, sel: 0, playing: -1, dirty: false, win: 30, follow: true, info: e, fixed: fixedOf(e) };
        if (!outlineCache || outlineCache.id !== audio.id) outlineCache = { id: audio.id, bars: R.outline(audio.env, 1200) };
        const b = await audio.blob;
        url = URL.createObjectURL(b);
        el = new Audio(url);
        el.preload = 'auto';
        el.onended = () => { updateTransport(); };
        renderSync();
      } catch (err) {
        console.warn('[video-maker] sync open failed', err);
        $('vmSyncStatus').textContent = tr('vm_own_bad');
        $('vmSyncStatus').className = 'sync-status warn';
      }
    }
    function closeSync() {
      cancelAnimationFrame(raf);
      if (el) { el.pause(); el.removeAttribute('src'); el.load(); el = null; }
      if (url) { URL.revokeObjectURL(url); url = ''; }
      if (work && work.dirty && rec) {
        const e = { m: R.normalizeMarkers(work.m, work.end, MIN_STEP), end: work.end, reviewed: true, confidence: 'high', method: 'manual', fixed: [...work.fixed].sort((a, b) => a - b) };
        store(e);
        work = null;
        renderSyncStatus();
        api.onChange();
        return;
      }
      if (work && rec) {           // opened and looked through: counts as reviewed
        const e = entryNow();
        if (e && !e.reviewed) { e.reviewed = true; saveMeta(); renderSyncStatus(); }
      }
      work = null;
    }

    function syncStatusLine() {
      const e = work.info;
      const box = $('vmSyncStatus');
      let msg, cls = 'sync-status';
      if (work.dirty || e.method === 'manual') msg = tr('vm_sync_manual');
      else if (e.method === 'live') msg = tr('vm_sync_live');
      else if (e.method === 'text') { msg = tr('vm_sync_by_text'); cls += ' warn'; }
      else if (e.confidence === 'high') msg = tr('vm_sync_ok', { n: num(work.m.length) });
      else { msg = tr('vm_sync_unsure'); cls += ' warn'; }
      box.textContent = msg;
      box.className = cls;
    }

    function currentIndex(t) {
      let k = 0;
      for (let i = 0; i < work.m.length; i++) if (t >= work.m[i] - 0.001) k = i;
      return k;
    }

    function renderSync() {
      if (!work) return;
      syncStatusLine();
      const segs = api.segments();
      const list = $('vmSyncList');
      const row = (i, label, text, t, isEnd) =>
        '<div class="sync-row' + (i === work.sel ? ' sel' : '') + (isEnd ? ' end' : '') + '" data-i="' + i + '">' +
        '<span class="sr-num">' + label + '</span>' +
        '<span class="sr-text">' + text + '</span>' +
        '<span class="sr-ctl">' +
        '<button type="button" data-act="play" aria-label="' + api.esc(tr('vm_sync_play_here')) + '">▶</button>' +
        '<button type="button" data-act="minus" aria-label="−0.1">−</button>' +
        '<input type="number" step="0.1" min="0" inputmode="decimal" value="' + t.toFixed(1) + '" data-act="time" aria-label="' + api.esc(tr('vm_sync_time')) + '">' +
        '<button type="button" data-act="plus" aria-label="+0.1">+</button>' +
        '<button type="button" data-act="here" aria-label="' + api.esc(tr('vm_sync_set_here')) + '" title="' + api.esc(tr('vm_sync_set_here')) + '">⌖</button>' +
        '</span></div>';
      const words = s => api.ayahWords({ text: s.text, num: null }).slice(0, 5).join(' ') + (s.text.split(/\s+/).length > 5 ? ' …' : '');
      list.innerHTML = segs.map((s, i) => row(i, s.num == null ? '﷽' : num(s.num), api.esc(words(s)), work.m[i], false)).join('') +
        row(segs.length, '■', api.esc(tr('vm_sync_end')), work.end, true);
      document.querySelectorAll('#vmSyncZoom button').forEach(b => b.classList.toggle('active', +b.dataset.win === work.win));
      renderFocus();
      drawWave();
      updateTransport();
    }

    function markRows() {
      document.querySelectorAll('#vmSyncList .sync-row').forEach(r => r.classList.toggle('sel', +r.dataset.i === work.sel));
    }
    function markPlaying() {
      document.querySelectorAll('#vmSyncList .sync-row').forEach(r => r.classList.toggle('playing', +r.dataset.i === work.playing));
    }

    // The ayah being checked: its text, its start, and the buttons to go on to the next one.
    function renderFocus() {
      if (!work) return;
      const n = work.m.length, k = work.sel, segs = api.segments();
      const isEnd = k >= n;
      const seg = segs[Math.min(k, n - 1)];
      $('vmSyncFocusCount').textContent = isEnd ? tr('vm_sync_end') : (seg && seg.num == null ? '﷽ ' : '') + tr('vm_sync_ayah', { i: num(k + 1), n: num(n) });
      $('vmSyncFocusText').textContent = isEnd || !seg ? '' : api.ayahWords({ text: seg.text, num: null }).join(' ');
      $('vmSyncFocusLabel').textContent = isEnd ? tr('vm_sync_end') : tr('vm_sync_this_start');
      const f = $('vmSyncFTime');
      if (document.activeElement !== f) f.value = timeOf(k).toFixed(1);
      const mark = $('vmSyncMarkNext');
      mark.hidden = isEnd;
      $('vmSyncFollow').hidden = k >= n - 1;
      $('vmSyncMarkNextLabel').textContent = k < n - 1 ? tr('vm_sync_next_here') : tr('vm_sync_end_here');
      $('vmSyncPrev').disabled = k === 0;
      $('vmSyncNextLabel').textContent = isEnd ? tr('vm_sync_done') : tr('vm_sync_next');
    }
    // Moves the check to ayah k (0..n, n = the end of the recitation) and plays it from its start.
    function goTo(k, play) {
      if (!work) return;
      work.sel = Math.max(0, Math.min(work.m.length, k));
      markRows();
      renderFocus();
      if (play) playFrom(Math.max(0, work.sel >= work.m.length ? work.end - 1.5 : timeOf(work.sel) - 0.3));
      else drawWave();
    }
    // «The next ayah starts here»: the playhead is where the next ayah begins. The marker goes to
    // the pause just before it (a tap lands a little after the voice starts), the check moves on
    // to that ayah, and playback carries on, so a whole recording is one pass from start to end.
    function markNext() {
      if (!work || !el) return;
      const n = work.m.length, k = work.sel;
      if (k >= n) return;
      const i = k + 1;
      const t = el.currentTime;
      setMarker(i, i === n ? t : R.snapOne(audio.env, R.HOP, t, work.m[k]).m);
      work.sel = i;
      markRows();
      renderFocus();
      if (i === n) el.pause();
      updateTransport();
      drawWave();
    }

    // ---- waveform ----
    function view() {
      const d = dur();
      if (!work.win || work.win >= d) return { a: 0, b: d };
      const t = el ? el.currentTime : 0;
      const center = work.follow && el && !el.paused ? t : (work.sel < work.m.length ? work.m[work.sel] : work.end);
      const a = Math.min(Math.max(0, center - work.win / 2), d - work.win);
      return { a, b: a + work.win };
    }
    function drawWave() {
      const cv = $('vmSyncWave');
      if (!work || !cv || !outlineCache) return;
      const w = cv.clientWidth || 300, h = cv.clientHeight || 120, dpr = window.devicePixelRatio || 1;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const c = cv.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      const v = view(), d = dur(), bars = outlineCache.bars;
      const css = getComputedStyle(document.documentElement);
      const tok = (name, fallback) => (css.getPropertyValue(name) || '').trim() || fallback;
      const accent = tok('--accent-main', '#F2B33D'), text = tok('--text-secondary', '#A1A1AA');
      const endColor = tok('--danger', '#F87171'), headColor = tok('--text-primary', '#F4F4F5');
      const x = t => (t - v.a) / (v.b - v.a) * w;
      // bars
      c.fillStyle = text;            // neutral: the gold is kept for the selected marker
      c.globalAlpha = 0.55;
      const step = 3;
      for (let px = 0; px < w; px += step) {
        const t0 = v.a + px / w * (v.b - v.a), t1 = v.a + (px + step) / w * (v.b - v.a);
        const i0 = Math.floor(t0 / d * bars.length), i1 = Math.max(i0 + 1, Math.ceil(t1 / d * bars.length));
        let m = 0;
        for (let i = i0; i < i1 && i < bars.length; i++) if (bars[i] > m) m = bars[i];
        const bh = Math.max(1.5, m * (h - 26));
        c.fillRect(px, (h - bh) / 2 + 6, step - 1, bh);
      }
      c.globalAlpha = 1;
      // markers
      const all = work.m.concat([work.end]);
      all.forEach((t, i) => {
        if (t < v.a - 0.01 || t > v.b + 0.01) return;
        const px = x(t), sel = i === work.sel;
        c.strokeStyle = i === work.m.length ? endColor : (sel ? accent : text);
        c.lineWidth = sel ? 3 : 1.5;
        c.setLineDash(i < work.m.length && !work.fixed.has(i) ? [4, 3] : []);     // dashed = a guess
        c.beginPath(); c.moveTo(px, 14); c.lineTo(px, h); c.stroke();
        c.setLineDash([]);
        c.fillStyle = c.strokeStyle;
        c.font = '700 11px sans-serif';
        c.textAlign = 'center';
        c.fillText(i === work.m.length ? '■' : (i + 1), px, 11);
      });
      // playhead
      if (el) {
        const px = x(el.currentTime);
        if (px >= 0 && px <= w) { c.strokeStyle = headColor; c.lineWidth = 2; c.beginPath(); c.moveTo(px, 0); c.lineTo(px, h); c.stroke(); }
      }
    }

    function updateTransport() {
      if (!work || !el) return;
      const t = el.currentTime;
      $('vmSyncTime').textContent = fmt(t, true) + ' / ' + fmt(dur());
      $('vmSyncPlay').textContent = el.paused ? '▶' : '⏸';
      $('vmSyncPlay').setAttribute('aria-pressed', el.paused ? 'false' : 'true');
    }
    function tick() {
      if (!work || !el) return;
      if (!el.paused) {
        // the check stays on the chosen ayah (so «next starts here» always means the one after
        // it); the ayah the markers say is being heard gets its own mark in the list
        const k = Math.min(currentIndex(el.currentTime), work.m.length - 1);
        if (k !== work.playing) { work.playing = k; markPlaying(); }
        if (el.currentTime >= work.end) el.pause();
      }
      drawWave();
      updateTransport();
      raf = requestAnimationFrame(tick);
    }
    function playFrom(t) {
      if (!el) return;
      el.currentTime = Math.max(0, t);
      work.follow = true;
      el.play().catch(() => {});
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    }

    // ---- editing ----
    // Moves marker i (n = the end). It can't go before the one ahead of it; the ones after it
    // are pushed along if it passes them, so going through the ayat in order never gets stuck.
    function setMarker(i, t) {
      const n = work.m.length;
      if (i < n) work.fixed.add(i);
      const all = work.m.concat([work.end]);
      const lo = i === 0 ? 0 : all[i - 1] + MIN_STEP;
      const hi = dur() - MIN_STEP * (n - i);          // room left for the ones after it
      t = Math.min(Math.max(t, lo), Math.max(lo, hi));
      all[i] = t;
      for (let j = i + 1; j <= n; j++) if (all[j] < all[j - 1] + MIN_STEP) all[j] = all[j - 1] + MIN_STEP;
      work.m = all.slice(0, n);
      work.end = Math.min(all[n], dur());
      work.dirty = true;
      if (i < n) followFrom(i);
      refreshInputs();
      syncStatusLine();
      renderFocus();
      drawWave();
    }
    function refreshInputs() {
      const all = work.m.concat([work.end]);
      document.querySelectorAll('#vmSyncList .sync-row input').forEach(inp => {
        if (document.activeElement !== inp) inp.value = all[+inp.closest('.sync-row').dataset.i].toFixed(1);
      });
    }
    const timeOf = i => (i === work.m.length ? work.end : work.m[i]);

    function bindSheet() {
      $('vmSyncPlay').onclick = () => {
        if (!el) return;
        if (el.paused) playFrom(el.currentTime >= work.end ? work.m[0] : el.currentTime); else { el.pause(); updateTransport(); }
      };
      $('vmSyncList').addEventListener('click', e => {
        const rowEl = e.target.closest('.sync-row');
        if (!rowEl || !work) return;
        const i = +rowEl.dataset.i;
        const act = e.target.closest('[data-act]');
        if (e.target.tagName === 'INPUT') return;
        work.sel = i; markRows(); renderFocus();
        if (act) {
          const a = act.dataset.act;
          if (a === 'play') playFrom(Math.max(0, timeOf(i) - 0.3));
          else if (a === 'minus') setMarker(i, timeOf(i) - 0.1);
          else if (a === 'plus') setMarker(i, timeOf(i) + 0.1);
          else if (a === 'here' && el) setMarker(i, el.currentTime);
        } else if (el && el.paused) { work.follow = false; drawWave(); }
        drawWave();
      });
      $('vmSyncList').addEventListener('change', e => {
        if (e.target.dataset.act !== 'time' || !work) return;
        const i = +e.target.closest('.sync-row').dataset.i;
        const v = parseFloat(e.target.value);
        if (isFinite(v)) setMarker(i, v);
        e.target.value = timeOf(i).toFixed(1);
      });
      document.querySelectorAll('#vmSyncZoom button').forEach(b => {
        b.onclick = () => { if (!work) return; work.win = +b.dataset.win; document.querySelectorAll('#vmSyncZoom button').forEach(x => x.classList.toggle('active', x === b)); drawWave(); };
      });
      $('vmSyncAuto').onclick = () => {
        if (!work || !audio) return;
        const e = autoEntry(audio, api.segments());
        work.m = e.m; work.end = e.end; work.info = e; work.dirty = e.method !== 'silence' ? true : false; work.sel = 0; work.fixed = new Set();
        renderSync();
      };
      $('vmSyncText').onclick = () => {
        if (!work || !audio) return;
        const segs = api.segments();
        const one = R.autoSplit(audio.env, R.HOP, 1);
        const start = one.markers ? one.markers[0] : 0, end = one.markers ? one.end : audio.buffer.duration;
        work.m = R.normalizeMarkers(R.proportional(start, end, segs.map(s => letters(s.text))), end, MIN_STEP);
        work.end = end; work.dirty = true; work.info = { method: 'text', confidence: 'low' }; work.sel = 0; work.fixed = new Set();
        renderSync();
      };
      $('vmSyncDone').onclick = () => api.closeSync();
      // the guided pass
      $('vmSyncMarkNext').onclick = markNext;
      $('vmSyncPrev').onclick = () => { if (work) goTo(work.sel - 1, true); };
      $('vmSyncFromStart').onclick = () => { if (work) goTo(work.sel, true); };
      $('vmSyncNext').onclick = () => {
        if (!work) return;
        if (work.sel >= work.m.length) api.closeSync();     // past the end of the recitation: done
        else goTo(work.sel + 1, true);
      };
      // «sync the ayat after this one»: they are all worked out again from this ayah's start,
      // also the ones placed by hand before
      $('vmSyncFollow').onclick = () => {
        if (!work || work.sel >= work.m.length - 1) return;
        for (let q = work.sel + 1; q < work.m.length; q++) work.fixed.delete(q);
        work.fixed.add(work.sel);
        followFrom(work.sel);
        work.dirty = true;
        refreshInputs(); syncStatusLine(); renderFocus(); drawWave();
      };
      $('vmSyncFMinus').onclick = () => { if (work) setMarker(work.sel, timeOf(work.sel) - 0.1); };
      $('vmSyncFPlus').onclick = () => { if (work) setMarker(work.sel, timeOf(work.sel) + 0.1); };
      $('vmSyncFHere').onclick = () => { if (work && el) setMarker(work.sel, el.currentTime); };
      $('vmSyncFTime').onchange = e => {
        if (!work) return;
        const v = parseFloat(e.target.value);
        if (isFinite(v)) setMarker(work.sel, v);
        e.target.value = timeOf(work.sel).toFixed(1);
      };
      // keyboard: Enter / Space = the next ayah starts here, arrows = previous / next ayah
      document.addEventListener('keydown', e => {
        if (!work || !$('vmSyncSheet').classList.contains('active')) return;
        const tag = e.target && e.target.tagName;
        if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'SUMMARY') return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); markNext(); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          const forward = (e.key === 'ArrowLeft') === (document.documentElement.dir === 'rtl');
          if (forward && work.sel < work.m.length) goTo(work.sel + 1, true);
          else if (!forward) goTo(work.sel - 1, true);
        }
      });
      // waveform: tap = move the playhead (or select a marker), drag a marker = move it
      const cv = $('vmSyncWave');
      let drag = -1;
      const timeAt = ev => { const r = cv.getBoundingClientRect(); const v = view(); return v.a + (ev.clientX - r.left) / r.width * (v.b - v.a); };
      const nearest = ev => {
        const r = cv.getBoundingClientRect(), v = view();
        let best = -1, bd = 18;
        work.m.concat([work.end]).forEach((t, i) => { const d = Math.abs((t - v.a) / (v.b - v.a) * r.width - (ev.clientX - r.left)); if (d < bd) { bd = d; best = i; } });
        return best;
      };
      cv.addEventListener('pointerdown', ev => {
        if (!work) return;
        drag = nearest(ev);
        if (drag >= 0) { work.sel = drag; markRows(); renderFocus(); cv.setPointerCapture(ev.pointerId); work.follow = false; }
        else if (el) { el.currentTime = Math.min(dur(), Math.max(0, timeAt(ev))); work.follow = false; updateTransport(); }
        drawWave();
      });
      cv.addEventListener('pointermove', ev => { if (drag >= 0 && work) setMarker(drag, timeAt(ev)); });
      const end = () => { if (drag >= 0 && work) { const r = document.querySelector('#vmSyncList .sync-row.sel'); if (r) r.scrollIntoView({ block: 'nearest' }); } drag = -1; };
      cv.addEventListener('pointerup', end);
      cv.addEventListener('pointercancel', end);
      window.addEventListener('resize', () => { if (work) drawWave(); });
    }

    // ---------- the controls ----------
    function bindUi() {
      document.querySelectorAll('#vmSource button').forEach(b => { b.onclick = () => setSource(b.dataset.src); });
      $('vmOwnPick').onclick = () => $('vmOwnFile').click();
      $('vmOwnFile').onchange = e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; addFile(f); };
      $('vmOwnDel').onclick = remove;
      $('vmOwnSync').onclick = () => api.openSync();
      $('vmSheikh').oninput = () => { S.sheikh = $('vmSheikh').value.slice(0, 60); api.onChange(); };
      bindSheet();
    }

    async function init() {
      await load();
      if (S.recSource === 'own' && !has()) S.recSource = 'reciter';
      renderBox();
    }

    return {
      init, bindUi, renderBox, has, active, displayName, prepare, slices, span, sig, entryNow, addRecorded, levels,
      openSync, closeSync, renderSync, decode,
      get rec() { return rec; },
      get buffer() { return audio ? audio.buffer : null; },
    };
  };
})();
