// Entry point: sets the format, preloads every asset, then exposes
// window.renderFrame(t) for the renderer (and ?t= for quick previews).
(function () {
  const FPS = 30, DURATION = 45;
  const qs = new URLSearchParams(location.search);
  const fmt = qs.get('fmt') || 'landscape';
  const lang = qs.get('lang') === 'ar' ? 'ar' : 'en';
  const SIZES = { landscape: [1920, 1080], vertical: [1080, 1920], square: [1080, 1080] };
  const [W, H] = SIZES[fmt];
  const v = fmt === 'vertical', sq = fmt === 'square';
  const u = Math.min(W, H) / 1080;

  const L = {
    fmt, W, H, u, v, sq, lang, rtl: lang === 'ar',
    arch: v ? { cx: 0.5 * W, top: 0.11 * H, w: 0.36 * W, h: 0.37 * H }
      : sq ? { cx: 0.7 * W, top: 0.12 * H, w: 0.25 * W, h: 0.55 * H }
        : { cx: 0.7 * W, top: 0.15 * H, w: 0.17 * W, h: 0.6 * H },
    beamTo: v ? { x: 0.4 * W, y: 0.8 * H, spread: 0.75 * W }
      : sq ? { x: 0.36 * W, y: 0.9 * H, spread: 0.5 * W }
        : { x: 0.38 * W, y: 0.9 * H, spread: 0.42 * W },
    floorY: v ? 0.5 * H : sq ? 0.69 * H : 0.75 * H,
  };

  // RTL: mirror the dawn window and its beam
  if (L.rtl) { L.arch.cx = W - L.arch.cx; L.beamTo.x = W - L.beamTo.x; }

  const frame = document.getElementById('frame');
  if (L.rtl) { frame.classList.add('ar'); document.documentElement.lang = 'ar'; }
  frame.style.width = W + 'px'; frame.style.height = H + 'px';
  const cv = {};
  ['bg', 'glow', 'grain'].forEach(id => {
    const c = document.getElementById(id);
    c.width = W; c.height = H;
    cv[id] = c.getContext('2d');
  });
  const grainEl = document.getElementById('grain');
  Object.assign(grainEl.style, { mixBlendMode: 'overlay', opacity: 0.42 });

  function loadImage(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  }

  let render = null;
  window.ready = (async () => {
    await document.fonts.load('500 40px Cormorant');
    await document.fonts.load('italic 400 40px Cormorant');
    await document.fonts.load('600 40px Manrope');
    await document.fonts.load('400 40px Amiri', 'زاد المسلم');
    await document.fonts.load('700 40px Tajawal', 'زاد المسلم');
    await document.fonts.load('500 40px Tajawal', 'زاد المسلم');
    const images = { 'quran-p2': await loadImage('../assets/screens/quran-p2.png') };
    FX.init(L, images);
    render = buildScenes(L);
    // wait for every <img> the scenes created
    await Promise.all([...document.images].map(img => (img.complete ? img.decode().catch(() => {}) : new Promise(r => { img.onload = img.onerror = r; }))));
    await document.fonts.ready;
    window.renderFrame(0);
    return { W, H, FPS, DURATION };
  })();

  window.renderFrame = function (t) {
    const S = render(t);
    FX.drawBg(cv.bg, t, L, S);
    FX.drawGlow(cv.glow, t, L, S);
    const cam = `translate(${S.cam.x.toFixed(2)}px, ${S.cam.y.toFixed(2)}px) scale(${S.cam.s.toFixed(4)})`;
    cv.bg.canvas.style.transform = cam;
    cv.glow.canvas.style.transform = cam;
    FX.drawGrain(cv.grain, Math.round(t * FPS), L);
  };

  if (qs.has('t')) window.ready.then(() => window.renderFrame(parseFloat(qs.get('t'))));
})();
