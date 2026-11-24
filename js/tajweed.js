/* tajweed.js — «تعلم التجويد»: the mutun of tajweed with a simple sharh per bayt.
   Data: data/tajweed/<matn>.json (built and checked by scripts/build-tajweed.cjs).
   Audio: full recordings streamed from archive.org; for the Tuhfa each bayt has a
   published start/end, so a bayt can be played, repeated and followed on its own. */
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

  if (window.ThemeManager) ThemeManager.init();
  window.setTheme = t => window.ThemeManager && ThemeManager.set(t);
  window.addEventListener('themechange', e => {
    document.querySelectorAll('.theme-dock .dot').forEach(d => d.classList.toggle('active', d.dataset.set === e.detail.theme));
  });

  const cache = {};
  let M = null;                 // the matn on screen
  let matnId = null;
  const audio = new Audio();
  audio.preload = 'none';
  let reciterIdx = 0;
  let cur = -1;                 // bayt index playing (timed recordings)
  let plays = 0;                // times the current bayt has been played through
  let repeat = store.get('repeat', 1);   // 1, 3, 5, 0 = always
  let raf = 0;

  function load(id) {
    if (!cache[id]) {
      cache[id] = fetch('../data/tajweed/' + id + '.json').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
      cache[id].catch(() => { delete cache[id]; });
    }
    return cache[id];
  }

  function render() {
    $('tjTitle').textContent = M.title;
    $('tjAuthor').textContent = M.author;
    $('tjNote').textContent = M.sharhNote;
    document.querySelectorAll('.tab').forEach(b => { b.classList.toggle('on', b.dataset.matn === matnId); b.setAttribute('aria-selected', b.dataset.matn === matnId); });
    $('tjChaps').innerHTML = M.chapters.map((c, i) => `<button class="tj-chap" data-from="${c.from}">${esc(c.title)}</button>`).join('');
    let html = '', prev = null;
    M.abyat.forEach((b, i) => {
      if (b.sec !== prev) { html += `<h2 class="ch-title" id="ch-${b.n}" dir="rtl">${esc(b.sec)}</h2>`; prev = b.sec; }
      html += `<article class="bayt" id="b-${b.n}" data-i="${i}">
        <div class="b-head"><span class="b-num">${b.n}</span><span class="spacer"></span>
          ${M.audio.timed ? `<button class="b-play" data-i="${i}" aria-label="${esc(T('tj_play_bayt', 'استمع للبيت {n}', { n: b.n }))}"><svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg></button>` : ''}</div>
        <div class="b-text" lang="ar" dir="rtl"><span class="sh">${esc(b.a)}</span><span class="sh">${esc(b.b)}</span></div>
        <div class="b-sharh" lang="ar" dir="rtl"><b>${esc(T('tj_sharh', 'الشرح:'))}</b>${esc(b.sharh)}</div>
        ${b.dabba ? `<details class="b-dabba" lang="ar" dir="rtl"><summary>${esc(T('tj_dabba', 'شرح الشيخ الضبّاع'))}</summary>${b.dabba.map(t => `<p>${esc(t)}</p>`).join('')}</details>` : ''}
      </article>`;
    });
    $('tjList').innerHTML = html;
    const a = M.audio;
    $('tjSrc').innerHTML = `<h3>${esc(T('tj_sources', 'المصادر'))}</h3>
      <p>${esc(T('tj_src_matn', 'نص المتن:'))} ${esc(M.source)} — <a href="${esc(M.sourceUrl)}" target="_blank" rel="noopener">${esc(M.sourceUrl)}</a></p>
      <p>${esc(T('tj_src_sharh', 'الشرح:'))} ${esc(M.sharhNote)}</p>
      <p>${esc(T('tj_src_audio', 'التلاوة:'))} ${esc(a.source)}${a.timed ? ' ' + esc(T('tj_src_timed', 'وقد تتبع بعض التسجيلات نسخةً تختلف يسيرًا في ثلاثة أبيات (١٧، ٢٣، ٥٩) دون أثرٍ في الحكم.')) : ' ' + esc(T('tj_src_untimed', 'تُسمع الجزرية كاملةً؛ إذ لم تُنشر توقيتات أبياتها.'))}</p>`;
    // reciters
    reciterIdx = Math.min(store.get('reciter_' + matnId, 0), a.reciters.length - 1);
    // the picker is narrow: names without the honorific (the full name shows above it)
    $('tpReciter').innerHTML = a.reciters.map((r, i) => `<option value="${i}">${esc(r.name.replace(/^(الشيخ|القارئ)\s+/, ''))}</option>`).join('');
    $('tpReciter').value = String(reciterIdx);
    $('tpRepeat').hidden = !a.timed;
    $('tpPrev').hidden = $('tpNext').hidden = !a.timed;
    stop();
    const last = store.get('last_' + matnId, 0);
    if (last > 1) { const el = $('b-' + last); if (el) setTimeout(() => el.scrollIntoView({ block: 'center' }), 60); }
  }

  function show(id) {
    matnId = id;
    store.set('matn', id);
    $('tjList').innerHTML = `<div class="empty">${esc(T('tj_loading', 'جارٍ التحميل…'))}</div>`;
    load(id).then(m => { if (matnId !== id) return; M = m; render(); })
      .catch(() => { $('tjList').innerHTML = `<div class="empty">${esc(T('tj_load_error', 'تعذّر تحميل المتن. تحقق من الاتصال وحاول مرة أخرى.'))}</div>`; });
  }

  // ---------- audio ----------
  const rec = () => M.audio.reciters[reciterIdx];
  function setIcon(playing) { $('tpIcon').innerHTML = playing ? '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>' : '<path d="M7 4v16l13-8z"/>'; }
  function mark(i) {
    document.querySelectorAll('.bayt.playing').forEach(e => e.classList.remove('playing'));
    if (i < 0) return;
    const el = $('b-' + M.abyat[i].n);
    if (el) { el.classList.add('playing'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    store.set('last_' + matnId, M.abyat[i].n);
  }
  function info() {
    const r = rec();
    if (M.audio.timed && cur >= 0) {
      const rep = repeat === 1 ? '' : ' · ' + (repeat === 0 ? '∞' : T('tj_play_count', '{i} من {n}', { i: plays + 1, n: repeat }));
      $('tpInfo').innerHTML = esc(T('tj_bayt_n', 'البيت {n}', { n: M.abyat[cur].n })) + esc(rep) + `<small>${esc(r.name)}</small>`;
    } else $('tpInfo').innerHTML = esc(M.title) + `<small>${esc(r.name)}</small>`;
  }
  function ensureSrc() { if (audio.src !== rec().url) { audio.src = rec().url; } }
  // play bayt i of a timed recording
  function playBayt(i) {
    if (!M.audio.timed) return;
    if (i < 0 || i >= M.abyat.length) { stop(); return; }
    if (i !== cur) plays = 0;
    cur = i;
    ensureSrc();
    const [s] = rec().abyat[i];
    const go = () => { audio.currentTime = s; audio.play().catch(() => toast(T('tj_audio_error', 'تعذّر تشغيل التلاوة. تحقق من الاتصال.'))); };
    if (audio.readyState >= 1) go(); else audio.addEventListener('loadedmetadata', go, { once: true });
    if (audio.readyState < 1) audio.load();
    mark(i); info(); watch();
  }
  // follow the timed bayt: at its end repeat it, or go on to the next one
  function watch() {
    cancelAnimationFrame(raf);
    const step = () => {
      if (audio.paused) return;
      if (M.audio.timed && cur >= 0) {
        const [, e] = rec().abyat[cur];
        if (audio.currentTime >= e - 0.03) {
          if (repeat === 0 || plays + 1 < repeat) { plays++; audio.currentTime = rec().abyat[cur][0]; info(); }
          else if (cur + 1 < M.abyat.length) { plays = 0; cur++; audio.currentTime = Math.max(audio.currentTime, rec().abyat[cur][0]); mark(cur); info(); }
          else { stop(); return; }
        }
      }
      seekUi();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  function seekUi() {
    const d = audio.duration || rec().duration || 0;
    if (d) $('tpSeek').value = String(Math.round(audio.currentTime / d * 1000));
    $('tpTime').textContent = fmt(audio.currentTime) + ' / ' + fmt(d);
  }
  function stop() {
    audio.pause(); cancelAnimationFrame(raf);
    cur = -1; plays = 0; setIcon(false); mark(-1);
    if (M) info();
    $('tpSeek').value = '0'; $('tpTime').textContent = fmt(0) + ' / ' + fmt(M ? rec().duration : 0);
  }
  audio.addEventListener('play', () => { setIcon(true); watch(); });
  audio.addEventListener('pause', () => setIcon(false));
  audio.addEventListener('ended', () => stop());
  audio.addEventListener('error', () => { if (audio.src) toast(T('tj_audio_error', 'تعذّر تشغيل التلاوة. تحقق من الاتصال.')); setIcon(false); });

  $('tpPlay').onclick = () => {
    if (!M) return;
    if (!audio.paused) { audio.pause(); return; }
    if (M.audio.timed) { playBayt(cur >= 0 ? cur : Math.max(0, store.get('last_' + matnId, 1) - 1)); return; }
    ensureSrc(); audio.play().catch(() => toast(T('tj_audio_error', 'تعذّر تشغيل التلاوة. تحقق من الاتصال.'))); info();
  };
  $('tpPrev').onclick = () => { if (M && M.audio.timed) playBayt(Math.max(0, cur - 1)); };
  $('tpNext').onclick = () => { if (M && M.audio.timed) playBayt(cur + 1); };
  $('tpSeek').oninput = () => {
    const d = audio.duration || rec().duration; if (!d) return;
    ensureSrc();
    const t = Number($('tpSeek').value) / 1000 * d;
    const set = () => { audio.currentTime = t; };
    if (audio.readyState >= 1) set(); else { audio.addEventListener('loadedmetadata', set, { once: true }); audio.load(); }
    if (M.audio.timed) {             // the bayt under the new position
      const i = rec().abyat.findIndex(([s, e]) => t < e);
      if (i >= 0) { cur = i; plays = 0; mark(i); info(); }
    }
  };
  $('tpReciter').onchange = () => {
    const wasPlaying = !audio.paused, at = cur;
    reciterIdx = Number($('tpReciter').value); store.set('reciter_' + matnId, reciterIdx);
    audio.pause(); audio.removeAttribute('src'); audio.load();
    if (M.audio.timed && wasPlaying && at >= 0) playBayt(at); else { stop(); }
  };
  const REPEATS = [1, 3, 5, 0];
  function fillRepeat() {
    $('tpRepeat').innerHTML = REPEATS.map(n => `<option value="${n}">${esc(n === 1 ? T('tj_rep_off', 'بلا تكرار') : n === 0 ? T('tj_rep_always', 'تكرار دائم') : T('tj_rep_n', 'كرّر ×{n}', { n }))}</option>`).join('');
    $('tpRepeat').value = String(repeat);
  }
  $('tpRepeat').onchange = () => { repeat = Number($('tpRepeat').value); plays = 0; store.set('repeat', repeat); if (M) info(); };

  // ---------- page events ----------
  document.querySelectorAll('.tab').forEach(b => { b.onclick = () => { if (b.dataset.matn !== matnId) { stop(); show(b.dataset.matn); } }; });
  $('tjChaps').addEventListener('click', e => {
    const c = e.target.closest('.tj-chap'); if (!c) return;
    document.querySelectorAll('.tj-chap').forEach(x => x.classList.toggle('on', x === c));
    const el = $('b-' + c.dataset.from);
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

  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600); }

  // ?matn=jazariyya opens that matn; otherwise the last one read.
  const want = (() => { try { return new URLSearchParams(location.search).get('matn'); } catch { return null; } })();
  const start = ['tuhfa', 'jazariyya'].includes(want) ? want : store.get('matn', 'tuhfa');
  const go = () => { fillRepeat(); show(['tuhfa', 'jazariyya'].includes(start) ? start : 'tuhfa'); };
  if (window.I18n) I18n.init().then(go, go); else go();
  window.addEventListener('langchange', () => location.reload());
  window.TajweedPage = { playBayt, stop, get state() { return { matnId, cur, plays, repeat, reciterIdx }; }, audio };
})();
