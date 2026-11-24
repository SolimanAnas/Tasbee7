/* tajweed.js — «تعلم التجويد»: the mutun of tajweed with a simple sharh per bayt.
   Data: data/tajweed/<matn>.json (built and checked by scripts/build-tajweed.cjs).
   Audio: full recordings of the matn on archive.org; for the Tuhfa each bayt has a
   published start/end, so a bayt can be played, repeated and followed on its own.

   Playback, and why it is done this way:
   • archive.org answers every request with a redirect to one of several data
     nodes. Passed through the service worker each range request came back
     opaque, from a node that could change between seeks — slow, never cached,
     and refused by some browsers. sw.js now leaves these two items to the
     browser, which streams them directly.
   • A recording can be saved on the device (CORS download, Cache Storage
     "quran-offline-tajweed-v1", kept across app updates). It then plays from a
     local blob: URL — jumping from bayt to bayt is instant and works offline.
   • play() is called inside the tap (iOS refuses a play() that waits for the
     metadata first); the start of the bayt is applied when the metadata
     arrives. An interrupted play() (AbortError) is not an error; a failed load
     is retried twice before the listener is told. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const T = (k, f, p) => {
    let s = f;
    if (window.I18n) { const v = I18n.t(k, p || {}); if (v && v !== k) return v; }
    if (p) Object.keys(p).forEach(x => { s = String(s).split('{' + x + '}').join(p[x]); });
    return s;
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem('tajweed_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('tajweed_' + k, JSON.stringify(v)); } catch { /* storage blocked */ } },
  };
  const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const mb = n => (n / 1048576).toFixed(n < 10485760 ? 1 : 0);
  const shortName = n => n.replace(/^(الشيخ|القارئ)\s+/, '');
  const shortTitle = t => t.replace(/\s*\(.*\)$/, '').replace(/^المقدمة فيما يجب.*/, 'المقدمة الجزرية');

  if (window.ThemeManager) ThemeManager.init();
  window.setTheme = t => window.ThemeManager && ThemeManager.set(t);
  window.addEventListener('themechange', e => {
    document.querySelectorAll('.theme-dock .dot').forEach(d => d.classList.toggle('active', d.dataset.set === e.detail.theme));
  });

  const cache = {};
  let M = null;                 // the matn on screen
  let matnId = null;
  const audio = new Audio();
  audio.preload = 'metadata';
  let reciterIdx = 0;
  let cur = -1;                 // bayt index playing (timed recordings)
  let plays = 0;                // times the current bayt has been played through
  let repeat = store.get('repeat', 1);   // 1, 3, 5, 0 = always
  const SPEEDS = [1, 0.75, 1.25];
  let speed = SPEEDS.includes(store.get('speed', 1)) ? store.get('speed', 1) : 1;
  let raf = 0;
  let pendingSeek = null;       // where to start once the metadata is in
  let retries = 0;
  let slowTimer = 0;

  function load(id) {
    if (!cache[id]) {
      cache[id] = fetch('../data/tajweed/' + id + '.json').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
      cache[id].catch(() => { delete cache[id]; });
    }
    return cache[id];
  }

  // ---------- saved recordings ----------
  const AUDIO_CACHE = 'quran-offline-tajweed-v1';
  const saved = new Set();      // recording URLs kept on the device
  const saving = {};            // url → { pct, ctrl }
  const blobs = {};             // url → blob: URL of the saved copy
  const hasCaches = typeof caches !== 'undefined';
  const savedReady = (async () => {
    if (!hasCaches) return;
    try { (await (await caches.open(AUDIO_CACHE)).keys()).forEach(r => saved.add(r.url)); } catch { /* no Cache Storage */ }
  })();
  async function blobFor(url) {
    if (blobs[url]) return blobs[url];
    if (!saved.has(url)) return null;
    try {
      const res = await (await caches.open(AUDIO_CACHE)).match(url);
      if (!res) { saved.delete(url); return null; }
      blobs[url] = URL.createObjectURL(await res.blob());
      return blobs[url];
    } catch { return null; }
  }
  async function saveRecording(r) {
    if (saving[r.url] || saved.has(r.url) || !hasCaches) return;
    const ctrl = new AbortController();
    saving[r.url] = { pct: 0, ctrl };
    paintSaving(r);
    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      const res = await fetch(r.url, { mode: 'cors', signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const total = Number(res.headers.get('content-length')) || r.size || 0;
      const chunks = []; let got = 0;
      if (res.body && res.body.getReader) {
        const rd = res.body.getReader();
        for (;;) {
          const { done, value } = await rd.read();
          if (done) break;
          chunks.push(value); got += value.length;
          if (total) { saving[r.url].pct = Math.min(99, Math.floor(got / total * 100)); paintSaving(r); }
        }
      } else chunks.push(new Uint8Array(await res.arrayBuffer()));
      const blob = new Blob(chunks, { type: 'audio/mpeg' });
      if (r.size && Math.abs(blob.size - r.size) > 1024) throw new Error('incomplete');
      await (await caches.open(AUDIO_CACHE)).put(r.url, new Response(blob, { headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(blob.size) } }));
      saved.add(r.url);
      blobs[r.url] = URL.createObjectURL(blob);
      delete saving[r.url];
      toast(T('tj_saved', 'حُفظ التسجيل على الجهاز، ويعمل الآن دون اتصال.'));
      if (M && rec().url === r.url) switchToLocal();
    } catch (e) {
      delete saving[r.url];
      if (!(e && e.name === 'AbortError')) toast(T('tj_save_error', 'تعذّر حفظ التسجيل. تحقق من الاتصال والمساحة المتاحة.'), 4200);
    }
    paintSaving(r);
  }
  async function deleteRecording(r) {
    try { await (await caches.open(AUDIO_CACHE)).delete(r.url); } catch { /* nothing to delete */ }
    saved.delete(r.url);
    if (blobs[r.url]) {
      if (M && rec().url === r.url && audio.src === blobs[r.url]) {
        const t = audio.currentTime, was = !audio.paused;
        audio.src = r.url; pendingSeek = t; retries = 0;
        if (was) safePlay();
      }
      URL.revokeObjectURL(blobs[r.url]); delete blobs[r.url];
    }
    paintSaving(r);
  }
  // the selected recording was just saved: carry on from the local copy
  function switchToLocal() {
    const url = blobs[rec().url]; if (!url || audio.src === url) return;
    const t = pendingSeek != null ? pendingSeek : audio.currentTime, was = !audio.paused;
    audio.src = url; pendingSeek = t; retries = 0;
    if (was) safePlay();
  }

  // ---------- page ----------
  function render() {
    $('tjTitle').textContent = M.title;
    $('tjAuthor').textContent = M.author;
    $('tjNote').textContent = M.sharhNote;
    document.querySelectorAll('.tab').forEach(b => { b.classList.toggle('on', b.dataset.matn === matnId); b.setAttribute('aria-selected', b.dataset.matn === matnId); });
    $('tjChaps').innerHTML = M.chapters.map(c => `<button class="tj-chap" data-from="${c.from}">${esc(c.title)}</button>`).join('');
    let html = '', prev = null;
    M.abyat.forEach((b, i) => {
      if (b.sec !== prev) { html += `<h2 class="ch-title" id="ch-${b.n}" dir="rtl">${esc(b.sec)}</h2>`; prev = b.sec; }
      html += `<article class="bayt" id="b-${b.n}" data-i="${i}">
        <div class="b-head"><span class="b-num">${b.n}</span><span class="spacer"></span>
          ${M.audio.timed ? `<button class="b-play" data-i="${i}" aria-label="${esc(T('tj_play_bayt', 'استمع للبيت {n}', { n: b.n }))}"><svg viewBox="0 0 24 24"><path class="i-play" d="M7 4v16l13-8z"/><path class="i-pause" d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg></button>` : ''}</div>
        <div class="b-text" lang="ar" dir="rtl"><span class="sh">${esc(b.a)}</span><span class="sh">${esc(b.b)}</span></div>
        <div class="b-sharh" lang="ar" dir="rtl"><b>${esc(T('tj_sharh', 'الشرح:'))}</b>${esc(b.sharh)}</div>
        ${b.dabba ? `<details class="b-dabba" lang="ar" dir="rtl"><summary>${esc(T('tj_dabba', 'شرح الشيخ الضبّاع'))}</summary>${b.dabba.map(t => `<p>${esc(t)}</p>`).join('')}</details>` : ''}
        ${M.audio.timed ? '<div class="b-prog"></div>' : ''}
      </article>`;
    });
    $('tjList').innerHTML = html;
    const a = M.audio;
    $('tjSrc').innerHTML = `<h3>${esc(T('tj_sources', 'المصادر'))}</h3>
      <p>${esc(T('tj_src_matn', 'نص المتن:'))} ${esc(M.source)} — <a href="${esc(M.sourceUrl)}" target="_blank" rel="noopener">${esc(M.sourceUrl)}</a></p>
      <p>${esc(T('tj_src_sharh', 'الشرح:'))} ${esc(M.sharhNote)}</p>
      <p>${esc(T('tj_src_audio', 'التسجيلات الصوتية:'))} ${esc(a.source)}${a.timed ? ' ' + esc(T('tj_src_timed', 'وقد تتبع بعض التسجيلات نسخةً تختلف يسيرًا في ثلاثة أبيات (١٧، ٢٣، ٥٩) دون أثرٍ في الحكم.')) : ' ' + esc(T('tj_src_untimed', 'تُسمع الجزرية كاملةً؛ إذ لم تُنشر توقيتات أبياتها.'))}</p>`;
    // the Jazariyya has no per-bayt timings: no repeat, and the side buttons skip 10 s
    $('tpRepeat').hidden = !a.timed;
    $('tpPrev').innerHTML = a.timed ? ICON.prev : ICON.back10;
    $('tpNext').innerHTML = a.timed ? ICON.next : ICON.fwd10;
    $('tpPrev').setAttribute('aria-label', a.timed ? T('tj_prev', 'البيت السابق') : T('tj_back10', 'رجوع ١٠ ثوانٍ'));
    $('tpNext').setAttribute('aria-label', a.timed ? T('tj_next', 'البيت التالي') : T('tj_fwd10', 'تقديم ١٠ ثوانٍ'));
    reciterIdx = Math.max(0, Math.min(store.get('reciter_' + matnId, 0), a.reciters.length - 1));
    stop();
    selectReciter(reciterIdx, false);
    const last = store.get('last_' + matnId, 0);
    const cont = $('tjContinue');
    if (last > 1 && last <= M.abyat.length) {
      cont.hidden = false;
      cont.textContent = T('tj_continue', 'تابع من البيت {n}', { n: last });
      cont.onclick = () => {
        const el = $('b-' + last); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (a.timed) playBayt(last - 1);
      };
    } else cont.hidden = true;
    observeChapters();
  }

  function show(id) {
    matnId = id;
    store.set('matn', id);
    $('tjList').innerHTML = `<div class="empty">${esc(T('tj_loading', 'جارٍ التحميل…'))}</div>`;
    load(id).then(m => { if (matnId !== id) return; M = m; render(); })
      .catch(() => { $('tjList').innerHTML = `<div class="empty">${esc(T('tj_load_error', 'تعذّر تحميل المتن. تحقق من الاتصال وحاول مرة أخرى.'))}</div>`; });
  }

  // the chapter chip follows the reading
  let chapObs = null;
  function observeChapters() {
    if (chapObs) chapObs.disconnect();
    if (!('IntersectionObserver' in window)) return;
    chapObs = new IntersectionObserver(es => {
      es.forEach(e => {
        if (!e.isIntersecting) return;
        const n = Number(e.target.id.slice(2));
        let from = M.chapters[0].from;
        M.chapters.forEach(c => { if (c.from <= n) from = c.from; });
        document.querySelectorAll('.tj-chap').forEach(x => {
          const on = Number(x.dataset.from) === from;
          if (on && !x.classList.contains('on')) x.parentNode.scrollTo({ left: x.offsetLeft - x.parentNode.clientWidth / 2 + x.offsetWidth / 2, behavior: 'smooth' });
          x.classList.toggle('on', on);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('.bayt').forEach(b => chapObs.observe(b));
  }

  // ---------- audio ----------
  const ICON = {
    play: '<path d="M7 4v16l13-8z"/>',
    pause: '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>',
    prev: '<svg viewBox="0 0 24 24"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M16 5h2v14h-2zM4 5v14l11-7z"/></svg>',
    back10: '<svg viewBox="0 0 24 24" class="stroke"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 3.8v3.6h3.6"/><text x="12.6" y="15.6" text-anchor="middle">10</text></svg>',
    fwd10: '<svg viewBox="0 0 24 24" class="stroke"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 3.8v3.6h-3.6"/><text x="11.4" y="15.6" text-anchor="middle">10</text></svg>',
  };
  const rec = () => M.audio.reciters[reciterIdx];
  const timed = () => !!(M && M.audio.timed);
  const baseSrc = () => audio.src.replace(/\?_r=\d+$/, '');
  function setIcon(playing) {
    $('tpIcon').innerHTML = playing ? ICON.pause : ICON.play;
    document.body.classList.toggle('tj-on', playing);   // the playing bayt's own button shows pause
  }
  function setLoading(on) {
    $('tjPlayer').classList.toggle('loading', on);
    document.querySelectorAll('.bayt.loading').forEach(e => e.classList.remove('loading'));
    if (on && cur >= 0) { const el = $('b-' + M.abyat[cur].n); if (el) el.classList.add('loading'); }
    clearTimeout(slowTimer);
    $('tpSlow').hidden = true;
    // a long wait on a recording that isn't on the device: say so, and offer to save it
    if (on && M && !blobs[rec().url]) slowTimer = setTimeout(() => { $('tpSlow').hidden = false; }, 7000);
  }
  function mark(i, scroll = true) {
    document.querySelectorAll('.bayt.playing').forEach(e => { e.classList.remove('playing'); e.style.removeProperty('--p'); });
    if (i < 0) return;
    const el = $('b-' + M.abyat[i].n);
    if (el) { el.classList.add('playing'); if (scroll) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    store.set('last_' + matnId, M.abyat[i].n);
  }
  function info() {
    const r = rec();
    let line;
    if (timed() && cur >= 0) {
      const rep = repeat === 1 ? '' : ' · ' + (repeat === 0 ? '∞' : T('tj_play_count', '{i} من {n}', { i: plays + 1, n: repeat }));
      line = T('tj_bayt_n', 'البيت {n}', { n: M.abyat[cur].n }) + rep;
    } else line = shortTitle(M.title);
    $('tpInfo').textContent = line;
    $('tpReciterName').textContent = shortName(r.name);
    $('tpSaved').toggleAttribute('hidden', !saved.has(r.url));
    if ('mediaSession' in navigator && window.MediaMetadata) {
      try { navigator.mediaSession.metadata = new MediaMetadata({ title: line, artist: r.name, album: shortTitle(M.title) }); } catch { /* unsupported */ }
    }
  }
  function ensureSrc() {
    const want = blobs[rec().url] || rec().url;
    if (baseSrc() !== want) { audio.src = want; retries = 0; }
  }
  function startAt(t) {
    ensureSrc();
    if (audio.readyState >= 1) { audio.currentTime = t; pendingSeek = null; } else pendingSeek = t;
    safePlay();
  }
  // play() right away (inside the tap), and tell real failures from interruptions
  function safePlay() {
    audio.playbackRate = speed;
    if (audio.paused || audio.readyState < 3) setLoading(true);
    const p = audio.play();
    if (p && p.catch) p.catch(e => {
      if (e && e.name === 'AbortError') return;          // a newer load or a pause took over
      if (audio.error) return;                           // the error handler retries
      setLoading(false); setIcon(false);
      if (e && e.name === 'NotAllowedError') toast(T('tj_tap_play', 'اضغط زر التشغيل لبدء الاستماع.'));
      else failed();
    });
  }
  function failed() {
    setLoading(false); setIcon(false);
    toast(navigator.onLine === false
      ? T('tj_offline', 'لا يوجد اتصال بالإنترنت. احفظ التسجيل على الجهاز ليعمل دون اتصال.')
      : T('tj_audio_error', 'تعذّر تشغيل التسجيل الصوتي. حاول مرة أخرى أو اختر قارئًا آخر.'), 4200);
  }
  // play bayt i of a timed recording
  function playBayt(i) {
    if (!timed()) return;
    if (i < 0 || i >= M.abyat.length) { stop(); return; }
    if (i !== cur) plays = 0;
    cur = i;
    mark(i); info();
    startAt(rec().abyat[i][0]);
    watch();
  }
  // follow the timed bayt: at its end repeat it, or go on to the next one
  function watch() {
    cancelAnimationFrame(raf);
    const step = () => {
      if (audio.paused) return;
      if (timed() && cur >= 0 && pendingSeek == null) {
        const [s, e] = rec().abyat[cur];
        const t = audio.currentTime;
        if (t >= e - 0.03) {
          if (repeat === 0 || plays + 1 < repeat) { plays++; audio.currentTime = s; info(); }
          else if (cur + 1 < M.abyat.length) { plays = 0; cur++; audio.currentTime = Math.max(t, rec().abyat[cur][0]); mark(cur); info(); }
          else { stop(); return; }
        } else {
          const el = $('b-' + M.abyat[cur].n);
          if (el) el.style.setProperty('--p', Math.max(0, Math.min(1, (t - s) / (e - s))).toFixed(3));
        }
      }
      seekUi();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  function seekUi() {
    const d = audio.duration || rec().duration || 0;
    const t = pendingSeek != null ? pendingSeek : audio.currentTime;
    if (d) $('tpSeek').value = String(Math.round(t / d * 1000));
    $('tpSeek').style.setProperty('--v', d ? (t / d * 100).toFixed(2) + '%' : '0%');
    $('tpTime').textContent = fmt(t) + ' / ' + fmt(d);
  }
  function stop() {
    audio.pause(); cancelAnimationFrame(raf);
    cur = -1; plays = 0; pendingSeek = null; setIcon(false); setLoading(false); mark(-1);
    if (M) { info(); $('tpTime').textContent = fmt(0) + ' / ' + fmt(rec().duration); }
    $('tpSeek').value = '0'; $('tpSeek').style.setProperty('--v', '0%');
  }
  audio.addEventListener('loadedmetadata', () => {
    if (pendingSeek != null) { try { audio.currentTime = pendingSeek; } catch { /* not seekable yet */ } pendingSeek = null; }
  });
  audio.addEventListener('play', () => { setIcon(true); watch(); });
  audio.addEventListener('playing', () => { setLoading(false); retries = 0; });
  audio.addEventListener('waiting', () => { if (!audio.paused) setLoading(true); });
  audio.addEventListener('pause', () => { setIcon(false); setLoading(false); });
  audio.addEventListener('ended', () => stop());
  audio.addEventListener('error', () => {
    if (!M || !audio.getAttribute('src')) return;
    const r = rec();
    const local = audio.src.startsWith('blob:');
    const was = !audio.paused || $('tjPlayer').classList.contains('loading');
    const at = pendingSeek != null ? pendingSeek : timed() && cur >= 0 ? rec().abyat[cur][0] : (audio.currentTime || 0);
    if (local) {                     // the saved copy didn't play: stream for now, keep the download
      URL.revokeObjectURL(blobs[r.url]); delete blobs[r.url];
    } else if (retries >= 2 || navigator.onLine === false) { if (was) failed(); return; }
    retries++;
    setTimeout(() => {
      if (!M || rec() !== r) return;
      audio.src = r.url + (local ? '' : '?_r=' + Date.now());   // a fresh redirect, maybe to another node
      pendingSeek = at;
      if (was) safePlay();
    }, local ? 0 : 800 * retries);
  });

  $('tpPlay').onclick = () => {
    if (!M) return;
    if (!audio.paused) { audio.pause(); return; }
    if (timed()) { playBayt(cur >= 0 ? cur : Math.max(0, store.get('last_' + matnId, 1) - 1)); return; }
    ensureSrc(); safePlay(); info();
  };
  $('tpPrev').onclick = () => {
    if (!M) return;
    if (timed()) { playBayt(Math.max(0, cur - 1)); return; }
    ensureSrc(); audio.currentTime = Math.max(0, audio.currentTime - 10); seekUi();
  };
  $('tpNext').onclick = () => {
    if (!M) return;
    if (timed()) { playBayt(cur + 1); return; }
    ensureSrc(); audio.currentTime = Math.min((audio.duration || rec().duration) - 0.5, audio.currentTime + 10); seekUi();
  };
  $('tpSeek').oninput = () => {
    const d = audio.duration || rec().duration; if (!d) return;
    ensureSrc();
    const t = Number($('tpSeek').value) / 1000 * d;
    if (audio.readyState >= 1) audio.currentTime = t; else pendingSeek = t;
    if (timed()) {             // the bayt under the new position
      const i = rec().abyat.findIndex(([, e]) => t < e);
      if (i >= 0 && i !== cur) { cur = i; plays = 0; mark(i, false); info(); }
    }
    seekUi();
  };
  const REPEATS = [1, 3, 5, 0];
  const repeatName = () => repeat === 1 ? T('tj_rep_off', 'بلا تكرار') : repeat === 0 ? T('tj_rep_always', 'تكرار دائم') : T('tj_rep_n', 'كرّر ×{n}', { n: repeat });
  function paintRepeat() {
    $('tpRepeat').textContent = repeat === 1 ? '×1' : repeat === 0 ? '∞' : '×' + repeat;
    $('tpRepeat').classList.toggle('on', repeat !== 1);
    $('tpRepeat').setAttribute('aria-label', T('tj_repeat', 'تكرار') + ': ' + repeatName());
  }
  $('tpRepeat').onclick = () => {
    repeat = REPEATS[(REPEATS.indexOf(repeat) + 1) % REPEATS.length];
    plays = 0; store.set('repeat', repeat); paintRepeat(); if (M) info();
    toast(repeatName(), 1200);
  };
  function paintSpeed() {
    $('tpSpeed').textContent = speed + '×';
    $('tpSpeed').classList.toggle('on', speed !== 1);
    $('tpSpeed').setAttribute('aria-label', T('tj_speed', 'السرعة') + ' ' + speed + '×');
  }
  $('tpSpeed').onclick = () => {
    speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    audio.playbackRate = speed; store.set('speed', speed); paintSpeed();
  };

  // ---------- reciter sheet ----------
  async function selectReciter(i, keepPlaying) {
    const wasPlaying = keepPlaying && !audio.paused, at = cur;
    reciterIdx = i; store.set('reciter_' + matnId, i);
    const r = rec();
    audio.pause(); pendingSeek = null; retries = 0;
    info();
    const local = await blobFor(r.url);
    if (rec() !== r) return;
    audio.src = local || r.url;      // starts fetching the metadata (preload="metadata")
    if (timed() && wasPlaying && at >= 0) playBayt(at);
    else if (wasPlaying) safePlay();
    else stop();
  }
  function openSheet() {
    if (!M) return;
    paintSheet();
    $('tjSheet').hidden = false;
    requestAnimationFrame(() => $('tjSheet').classList.add('open'));
    const on = $('tjRcList').querySelector('.rc.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  }
  function closeSheet() { $('tjSheet').classList.remove('open'); setTimeout(() => { $('tjSheet').hidden = true; }, 220); }
  function rowState(r) {
    if (saving[r.url]) return `<span class="rc-pct">${saving[r.url].pct}%</span>`;
    if (saved.has(r.url)) return '<svg viewBox="0 0 24 24" class="stroke"><path d="M5 12.5 10 17 19 7"/></svg>';
    return '<svg viewBox="0 0 24 24" class="stroke"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/></svg>';
  }
  function rowLabel(r) {
    if (saving[r.url]) return T('tj_cancel_save', 'إيقاف الحفظ');
    if (saved.has(r.url)) return T('tj_delete_saved', 'حذف التسجيل من الجهاز');
    return T('tj_save', 'حفظ على الجهاز') + ' (' + mb(r.size) + ' MB)';
  }
  function paintSheet() {
    $('tjSheetTitle').textContent = T('tj_reciters_of', 'قرّاء {m}', { m: shortTitle(M.title) });
    $('tjRcList').innerHTML = M.audio.reciters.map((r, i) => `
      <div class="rc${i === reciterIdx ? ' on' : ''}" data-i="${i}">
        <button class="rc-pick" data-i="${i}" aria-pressed="${i === reciterIdx}"><span class="rc-av">${esc(shortName(r.name).charAt(0))}</span>
          <span class="rc-name">${esc(shortName(r.name))}<small><bdi dir="ltr">${fmt(r.duration)}</bdi> · <bdi dir="ltr">${mb(r.size)} MB</bdi>${saved.has(r.url) ? ' · <b>' + esc(T('tj_on_device', 'على الجهاز')) + '</b>' : ''}</small></span></button>
        <button class="rc-save${saving[r.url] ? ' busy' : ''}${saved.has(r.url) ? ' done' : ''}" data-i="${i}" aria-label="${esc(rowLabel(r))}" title="${esc(rowLabel(r))}" style="--pct:${saving[r.url] ? saving[r.url].pct : 0}">${rowState(r)}</button>
      </div>`).join('');
  }
  function paintSaving(r) {
    if (M && !$('tjSheet').hidden) {
      const row = $('tjRcList').querySelector(`.rc[data-i="${M.audio.reciters.indexOf(r)}"]`);
      if (row && saving[r.url]) { const b = row.querySelector('.rc-save'); b.classList.add('busy'); b.style.setProperty('--pct', saving[r.url].pct); b.innerHTML = rowState(r); }
      else paintSheet();
    }
    if (M) info();
  }
  $('tpReciter').onclick = openSheet;
  $('tpSlow').onclick = () => { $('tpSlow').hidden = true; openSheet(); };
  $('tjSheet').addEventListener('click', e => {
    if (e.target === $('tjSheet') || e.target.closest('.sheet-x')) { closeSheet(); return; }
    const pick = e.target.closest('.rc-pick');
    if (pick) { selectReciter(Number(pick.dataset.i), true); closeSheet(); return; }
    const sv = e.target.closest('.rc-save');
    if (sv) {
      const r = M.audio.reciters[Number(sv.dataset.i)];
      if (saving[r.url]) saving[r.url].ctrl.abort();
      else if (saved.has(r.url)) { if (window.confirm(T('tj_delete_confirm', 'حذف تسجيل {r} من الجهاز؟', { r: shortName(r.name) }))) deleteRecording(r); }
      else saveRecording(r);
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('tjSheet').hidden) closeSheet(); });

  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession;
    try {
      ms.setActionHandler('play', () => $('tpPlay').click());
      ms.setActionHandler('pause', () => audio.pause());
      ms.setActionHandler('previoustrack', () => $('tpPrev').click());
      ms.setActionHandler('nexttrack', () => $('tpNext').click());
    } catch { /* unsupported action */ }
  }

  // ---------- page events ----------
  document.querySelectorAll('.tab').forEach(b => { b.onclick = () => { if (b.dataset.matn !== matnId) { stop(); show(b.dataset.matn); } }; });
  $('tjChaps').addEventListener('click', e => {
    const c = e.target.closest('.tj-chap'); if (!c) return;
    document.querySelectorAll('.tj-chap').forEach(x => x.classList.toggle('on', x === c));
    const el = $('ch-' + c.dataset.from) || $('b-' + c.dataset.from);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('tjList').addEventListener('click', e => {
    const p = e.target.closest('.b-play'); if (!p) return;
    const i = Number(p.dataset.i);
    if (i === cur && !audio.paused) audio.pause(); else playBayt(i);
  });
  $('tjHideSharh').checked = store.get('hideSharh', false);
  document.body.classList.toggle('no-sharh', $('tjHideSharh').checked);
  $('tjHideSharh').onchange = () => { const on = $('tjHideSharh').checked; document.body.classList.toggle('no-sharh', on); store.set('hideSharh', on); };

  function toast(msg, ms) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms || 2600); }

  // ?matn=jazariyya opens that matn; otherwise the last one read.
  const want = (() => { try { return new URLSearchParams(location.search).get('matn'); } catch { return null; } })();
  const start = ['tuhfa', 'jazariyya'].includes(want) ? want : store.get('matn', 'tuhfa');
  const go = () => { paintRepeat(); paintSpeed(); savedReady.then(() => show(['tuhfa', 'jazariyya'].includes(start) ? start : 'tuhfa')); };
  if (window.I18n) I18n.init().then(go, go); else go();
  window.addEventListener('langchange', () => location.reload());
  window.TajweedPage = {
    playBayt, stop, saveRecording: i => saveRecording(M.audio.reciters[i]), selectReciter: i => selectReciter(i, true),
    get state() { return { matnId, cur, plays, repeat, speed, reciterIdx, saved: [...saved], src: audio.src }; }, audio,
  };
})();
