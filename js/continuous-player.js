/**
 * ZadShell — continuous audio while browsing other pages.
 *
 * The app is multi-page: opening another page unloads audio.html and its
 * <audio>. When continuous playback is on (setting "continuousAudio", default
 * on) and something has been played, audio.html stays loaded as a *host* and
 * other pages open inside a full-screen same-origin <iframe> on top of it,
 * with a floating "island" mini player above them.
 *
 * History: navigations inside the frame are intercepted with the Navigation
 * API and turned into location.replace(), while the host records each page
 * as its own history entry ({zad: depth}). So the system back button walks
 * back through the visited pages and finally reveals the player, and closing
 * the frame from the island unwinds exactly our entries. Browsers without the
 * Navigation API just navigate normally (feature off).
 *
 * Pages need no changes: on each frame load the host
 *  - patches HTMLMediaElement.play so a page playing its own audio pauses
 *    the host (no overlapping recitations),
 *  - turns a navigation back to the host page into "close the frame",
 *  - opens external links in a new tab instead of inside the frame.
 */
(function () {
  'use strict';
  const KEY = 'continuousAudio';
  // A page shown inside another host's frame (e.g. audio.html while the radio
  // is the host) must not become a nested host: its links simply navigate the
  // frame, which the outer host intercepts.
  const framedByShell = (() => { try { return window.top !== window && !!window.top.ZadShell; } catch { return false; } })();
  const supported = typeof window.navigation !== 'undefined' && !framedByShell;

  function enabled() {
    try { return localStorage.getItem(KEY) !== 'false'; } catch { return true; }
  }

  let opts = null;          // host callbacks, set by init()
  let frame = null;         // <iframe>
  let island = null;        // floating player
  let depth = 0;            // our history entries currently on the stack
  const meta = {};          // depth -> {kind:'page'|'leave', url}
  let closing = false;      // unwinding our entries after a UI close
  let internalNav = false;  // the next frame navigation is our own replace()
  const frameMedia = new Set();
  let leaveArmed = false;

  // ---------------------------------------------------------------- history
  function push(kind, url) {
    depth++;
    meta[depth] = { kind, url };
    history.pushState({ zad: depth }, '');
  }
  function pageEntries() {
    let n = 0;
    for (let d = depth; d > 0 && meta[d] && meta[d].kind === 'page'; d--) n++;
    return n;
  }
  // Every history entry the host creates carries our depth at that moment
  // (stamped below), so a popstate always says where in our stack we landed —
  // also for entries pushed by BackClose for the host's own sheets.
  function stampHistory() {
    if (history.__zadStamped) return;
    history.__zadStamped = true;
    const wrap = (fn) => function (st, ...rest) {
      if (st == null || typeof st !== 'object') st = {};
      if (typeof st.zad !== 'number') st = Object.assign({}, st, { zad: depth });
      return fn.call(history, st, ...rest);
    };
    history.pushState = wrap(history.pushState);
    history.replaceState = wrap(history.replaceState);
  }
  window.addEventListener('popstate', (e) => {
    if (!opts) return;
    const target = (e.state && typeof e.state.zad === 'number') ? e.state.zad : 0;
    if (target >= depth) return;            // not one of ours (e.g. a sheet)
    let popped = null;
    while (depth > target) { popped = meta[depth]; delete meta[depth]; depth--; }
    const top = meta[depth];
    if (closing) {
      if (top && top.kind === 'page') { history.go(-pageEntries()); return; }
      closing = false; removeFrame(); return;
    }
    if (top && top.kind === 'page') { showInFrame(top.url); return; }
    if (frame) { removeFrame(); return; }
    // Back pressed on the host itself while playing: show the page the user
    // came from (normally home) instead of leaving and stopping the audio.
    if (popped && popped.kind === 'leave') {
      if (enabled() && opts && opts.isActive()) openFrame(popped.url);
      else history.back();
    }
  });

  // ------------------------------------------------------------------ frame
  function ensureFrame() {
    if (frame) return frame;
    frame = document.createElement('iframe');
    frame.id = 'zadFrame';
    frame.title = '';
    frame.setAttribute('allow', 'autoplay; clipboard-write; geolocation; microphone; camera; fullscreen');
    frame.addEventListener('load', wireFrame);
    document.body.appendChild(frame);
    document.documentElement.classList.add('zad-frame-open');
    renderIsland();
    return frame;
  }
  function showInFrame(url) {
    const f = ensureFrame();
    frameMedia.clear();
    try {
      if (f.contentWindow && f.contentWindow.location.href !== 'about:blank') {
        internalNav = true;
        f.contentWindow.location.replace(url);
        return;
      }
    } catch { /* not loaded yet */ }
    f.src = url;
  }
  function removeFrame() {
    if (frame) { frame.remove(); frame = null; }
    frameMedia.clear();
    document.documentElement.classList.remove('zad-frame-open');
    if (opts && opts.title) document.title = opts.title;
    renderIsland();
  }

  function isHostUrl(u) {
    try { return new URL(u, location.href).pathname === location.pathname; } catch { return false; }
  }

  function wireFrame() {
    let w;
    try { w = frame.contentWindow; void w.document.title; } catch { return; }
    if (!w || w.__zadWired) return;
    w.__zadWired = true;
    if (w.document.title) document.title = w.document.title;

    // A page playing its own audio pauses the host.
    const P = w.HTMLMediaElement && w.HTMLMediaElement.prototype;
    if (P && !P.__zadPatched) {
      const orig = P.play;
      P.play = function () {
        frameMedia.add(this);
        if (opts && opts.isPlaying()) opts.pause();
        return orig.apply(this, arguments);
      };
      P.__zadPatched = true;
    }

    if (!w.navigation) return;
    w.navigation.addEventListener('navigate', (e) => {
      if (internalNav && e.navigationType === 'replace') { internalNav = false; return; }
      if (!e.cancelable || e.downloadRequest !== null || e.formData || e.hashChange) return;
      if (e.navigationType === 'reload' || e.navigationType === 'traverse') return;
      if (e.destination.sameDocument) return;
      const url = e.destination.url;
      let dest;
      try { dest = new URL(url); } catch { return; }
      e.preventDefault();
      if (dest.origin !== location.origin) { window.open(url, '_blank', 'noopener'); return; }
      if (isHostUrl(url)) { closeFrame(); return; }   // back to the player
      push('page', url);
      showInFrame(url);
    });
  }

  // ------------------------------------------------------------- public API
  function shouldFrame() {
    return supported && enabled() && !!opts && opts.isActive();
  }
  function openFrame(url) {
    // beforeOpen may close host sheets (an async history.back()); pushing our
    // entry in the same tick would race it, so wait the delay it returns.
    const wait = (opts && opts.beforeOpen && opts.beforeOpen()) || 0;
    const abs = new URL(url, location.href).href;
    const go = () => { push('page', abs); showInFrame(abs); };
    if (wait) setTimeout(go, wait); else go();
  }
  function closeFrame() {
    const n = pageEntries();
    if (!frame) return;
    frame.style.visibility = 'hidden';
    if (n > 0) { closing = true; history.go(-n); } else removeFrame();
  }
  function navigate(url) {
    if (shouldFrame()) openFrame(url); else location.href = url;
  }
  // One extra back press is answered by showing the previous page in the
  // frame instead of leaving (armed once per page load, after playback starts).
  function armLeave(url) {
    if (leaveArmed || !supported || frame) return;
    leaveArmed = true;
    push('leave', new URL(url, location.href).href);
  }
  function pauseFrameMedia() {
    frameMedia.forEach(m => { try { m.pause(); } catch {} });
  }

  // ----------------------------------------------------------------- island
  const ICONS = {
    play: '<svg viewBox="0 0 24 24"><polygon points="6 4 20 12 6 20 6 4"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>',
    collapse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>'
  };
  let state = { title: '', subtitle: '', playing: false, progress: 0, art: '' };
  let collapsed = false, pos = null;
  try { collapsed = localStorage.getItem('zadIslandCollapsed') === '1'; pos = JSON.parse(localStorage.getItem('zadIslandPos') || 'null'); } catch {}

  function buildIsland() {
    island = document.createElement('div');
    island.id = 'zadIsland';
    island.setAttribute('role', 'region');
    island.innerHTML =
      '<div class="zi-bubble" role="button" tabindex="0"><img class="zi-art" alt="" draggable="false"><span class="zi-ring"></span></div>' +
      '<div class="zi-pill">' +
        '<button type="button" class="zi-open" aria-label=""><img class="zi-art" alt="" draggable="false"></button>' +
        '<div class="zi-text"><div class="zi-title"></div><div class="zi-sub"></div></div>' +
        '<button type="button" class="zi-btn zi-play" aria-label=""></button>' +
        '<button type="button" class="zi-btn zi-next" aria-label="">' + ICONS.next + '</button>' +
        '<button type="button" class="zi-btn zi-min" aria-label="">' + ICONS.collapse + '</button>' +
        '<span class="zi-bar"></span>' +
      '</div>';
    document.body.appendChild(island);
    const tr = (k, f) => (window.t ? window.t(k) : f);
    island.setAttribute('aria-label', tr('audio_island_label', 'المشغّل'));
    island.querySelector('.zi-open').setAttribute('aria-label', tr('audio_open_player', 'فتح المشغّل'));
    island.querySelector('.zi-next').setAttribute('aria-label', tr('audio_next', 'التالي'));
    island.querySelector('.zi-min').setAttribute('aria-label', tr('audio_island_collapse', 'تصغير'));
    island.querySelector('.zi-bubble').setAttribute('aria-label', tr('audio_open_player', 'فتح المشغّل'));

    island.querySelector('.zi-play').onclick = () => opts && opts.toggle();
    island.querySelector('.zi-next').onclick = () => opts && opts.next();
    island.querySelector('.zi-open').onclick = closeFrame;
    island.querySelector('.zi-min').onclick = () => setCollapsed(true);
    const bubble = island.querySelector('.zi-bubble');
    bubble.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCollapsed(false); } };
    enableDrag(island);
  }
  function setCollapsed(v) {
    collapsed = v;
    try { localStorage.setItem('zadIslandCollapsed', v ? '1' : '0'); } catch {}
    renderIsland();
  }
  function renderIsland() {
    const show = !!frame && !!opts && opts.isActive();
    if (!show) { if (island) island.hidden = true; return; }
    if (!island) buildIsland();
    island.hidden = false;
    island.classList.toggle('collapsed', collapsed);
    island.classList.toggle('playing', !!state.playing);
    island.querySelectorAll('.zi-art').forEach(i => { if (state.art && i.getAttribute('src') !== state.art) i.src = state.art; });
    island.querySelector('.zi-title').textContent = state.title || '';
    island.querySelector('.zi-sub').textContent = state.subtitle || '';
    const play = island.querySelector('.zi-play');
    play.innerHTML = state.playing ? ICONS.pause : ICONS.play;
    const tr = (k, f) => (window.t ? window.t(k) : f);
    play.setAttribute('aria-label', state.playing ? tr('audio_pause', 'إيقاف مؤقت') : tr('audio_play', 'تشغيل'));
    island.style.setProperty('--zi-p', Math.max(0, Math.min(100, state.progress || 0)) + '%');
    applyPos();
  }
  function update(s) { state = Object.assign(state, s); if (island || frame) renderIsland(); }

  function applyPos() {
    if (!island) return;
    const h = window.innerHeight;
    const y = pos && typeof pos.y === 'number' ? pos.y : h - 150;
    island.style.top = Math.max(8, Math.min(h - 72, y)) + 'px';
    if (collapsed) {
      const side = pos && pos.side === 'left' ? 'left' : 'right';
      island.style.left = side === 'left' ? '10px' : 'auto';
      island.style.right = side === 'right' ? '10px' : 'auto';
    } else { island.style.left = ''; island.style.right = ''; }
  }
  function enableDrag(el) {
    let sx = 0, sy = 0, oy = 0, moved = false, id = null;
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button') && !collapsed) return;
      id = e.pointerId; sx = e.clientX; sy = e.clientY; oy = el.getBoundingClientRect().top; moved = false;
      // capture right away: a mouse moving off the small island would
      // otherwise send its moves to the page frame underneath
      try { el.setPointerCapture(id); } catch {}
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && Math.hypot(dx, dy) < 8) return;
      moved = true;
      el.classList.add('dragging');
      el.style.top = Math.max(8, Math.min(window.innerHeight - 72, oy + dy)) + 'px';
      if (collapsed) { el.style.left = (e.clientX - 28) + 'px'; el.style.right = 'auto'; }
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null; el.classList.remove('dragging');
      if (!moved) {
        // A tap. With pointer capture the click lands on the island itself,
        // so act on what was under the finger here (buttons never get here).
        if (e.type !== 'pointerup') return;
        if (collapsed) { setCollapsed(false); return; }
        const hit = document.elementFromPoint(e.clientX, e.clientY);
        if (hit && hit.closest && hit.closest('.zi-text')) closeFrame();
        return;
      }
      pos = { y: el.getBoundingClientRect().top, side: e.clientX < window.innerWidth / 2 ? 'left' : 'right' };
      try { localStorage.setItem('zadIslandPos', JSON.stringify(pos)); } catch {}
      applyPos();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
  window.addEventListener('resize', applyPos);

  const css = `
html.zad-frame-open, html.zad-frame-open body { overflow: hidden !important; }
#zadFrame { position: fixed; inset: 0; width: 100%; height: 100%; border: 0; z-index: 2147482000; background: var(--bg-surface, #fff); }
#zadIsland { position: fixed; z-index: 2147482001; left: 50%; transform: translateX(-50%); touch-action: none; user-select: none; -webkit-user-select: none;
  font-family: inherit; direction: rtl; transition: transform .25s, opacity .25s; }
#zadIsland[hidden] { display: none; }
#zadIsland img { -webkit-user-drag: none; user-drag: none; pointer-events: none; }
#zadIsland.dragging { transition: none; }
#zadIsland .zi-pill { position: relative; display: flex; align-items: center; gap: 8px; width: min(92vw, 400px); padding: 7px 8px; border-radius: 999px; overflow: hidden;
  background: var(--glass, rgba(255,255,255,.85)); backdrop-filter: blur(24px) saturate(1.4); -webkit-backdrop-filter: blur(24px) saturate(1.4);
  border: 1px solid var(--glass-border, rgba(0,0,0,.08)); box-shadow: 0 10px 30px rgba(0,0,0,.25); color: var(--text-primary, #0f172a); }
#zadIsland .zi-open { flex: none; padding: 0; border: 0; background: none; cursor: pointer; border-radius: 50%; }
#zadIsland .zi-art { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; display: block; box-shadow: 0 0 0 2px var(--accent-main, #10b981); }
#zadIsland.playing .zi-art { animation: ziSpin 12s linear infinite; }
#zadIsland .zi-text { flex: 1; min-width: 0; cursor: pointer; }
#zadIsland .zi-title { font-weight: 800; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#zadIsland .zi-sub { font-weight: 600; font-size: 11.5px; color: var(--accent-main, #10b981); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#zadIsland .zi-btn { flex: none; width: 38px; height: 38px; border-radius: 50%; border: 0; display: grid; place-items: center; cursor: pointer;
  background: transparent; color: var(--text-primary, #0f172a); }
#zadIsland .zi-btn svg { width: 18px; height: 18px; fill: currentColor; }
#zadIsland .zi-min svg { fill: none; }
#zadIsland .zi-play { background: var(--accent-main, #10b981); color: #fff; box-shadow: 0 3px 12px var(--accent-glow, rgba(16,185,129,.4)); }
#zadIsland .zi-btn:active { transform: scale(.9); }
#zadIsland .zi-bar { position: absolute; left: 0; bottom: 0; height: 2.5px; width: var(--zi-p, 0%); background: var(--accent-main, #10b981); }
#zadIsland .zi-bubble { display: none; position: relative; width: 58px; height: 58px; border-radius: 50%; cursor: pointer;
  background: var(--glass, rgba(255,255,255,.85)); box-shadow: 0 8px 24px rgba(0,0,0,.3); }
#zadIsland .zi-bubble .zi-art { position: absolute; top: 5px; left: 5px; width: 48px; height: 48px; box-shadow: none; }
#zadIsland .zi-ring { position: absolute; inset: 0; border-radius: 50%;
  background: conic-gradient(var(--accent-main, #10b981) var(--zi-p, 0%), rgba(127,127,127,.25) 0);
  -webkit-mask: radial-gradient(circle, transparent 25px, #000 26px); mask: radial-gradient(circle, transparent 25px, #000 26px); }
#zadIsland.collapsed { transform: none; }
#zadIsland.collapsed .zi-pill { display: none; }
#zadIsland.collapsed .zi-bubble { display: block; }
@keyframes ziSpin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { #zadIsland.playing .zi-art { animation: none; } }`;
  function injectCss() {
    if (document.getElementById('zadShellCss')) return;
    const s = document.createElement('style'); s.id = 'zadShellCss'; s.textContent = css;
    document.head.appendChild(s);
  }

  /**
   * opts: { isActive():bool  — a track has been started on this page
   *         isPlaying():bool, pause(), toggle(), next(),
   *         beforeOpen()     — close host sheets etc. before showing a page,
   *         title            — host document title to restore }
   */
  function init(o) {
    opts = Object.assign({ title: document.title }, o);
    injectCss();
    if (supported) stampHistory();
  }

  window.ZadShell = { init, navigate, openFrame, closeFrame, shouldFrame, armLeave, update, pauseFrameMedia,
    isOpen: () => !!frame, supported, enabled, KEY,
    available: typeof window.navigation !== 'undefined' };   // for showing the setting
})();
