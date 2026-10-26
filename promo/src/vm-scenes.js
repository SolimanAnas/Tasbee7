// Ayah Video Maker promo — 30 s, 1080×1920, Arabic (default) or English
// (?lang=en: English UI captures and an English-UI export). Pure function of time.
//   0.0–3.2   hook: "make your status an ayah", the editor rises into view
//   3.2–13.0  three steps in the real UI: ayat → reciter & background → format → create
//   13.4–23.5 the exported clip, full screen, with its own recitation (nothing over it)
//   23.5–30   end card
(function () {
  const { clamp, lerp, prog, ease, tween, set, el, makeText, playText } = K;
  const win = K.window;
  const qs = new URLSearchParams(location.search);
  const EN = qs.get('lang') === 'en';
  const tx = (en, ar) => (EN ? en : ar);
  const SUF = EN ? '-en' : '';
  const FPS = 30, DURATION = 30;
  const CLIP_T0 = 13.4, CLIP_FRAMES = EN ? 303 : 302;   // frames extracted from each export
  const CLIP_END = CLIP_T0 + CLIP_FRAMES / FPS;
  const W = 1080, H = 1920, u = 1;
  const L = { W, H, u, v: true, sq: false, lang: EN ? 'en' : 'ar', rtl: !EN,
    arch: { cx: W / 2, top: 0, w: 200, h: 400 }, beamTo: { x: 0, y: H, spread: 300 }, floorY: H };

  const frame = document.getElementById('frame');
  if (EN) { frame.classList.remove('ar'); frame.classList.add('en'); document.documentElement.lang = 'en'; document.documentElement.dir = 'ltr'; }
  frame.style.width = W + 'px'; frame.style.height = H + 'px';
  const cv = {};
  ['bg', 'glow', 'grain'].forEach(id => { const c = document.getElementById(id); c.width = W; c.height = H; cv[id] = c.getContext('2d'); });
  Object.assign(document.getElementById('grain').style, { mixBlendMode: 'overlay', opacity: 0.38 });
  const type = document.getElementById('type');
  const anchor = document.getElementById('anchor');
  const clipImg = document.getElementById('clip');

  const at = (e, cx, cy, o, extra = {}) => {
    const r = e._wh || (e._wh = [e.offsetWidth, e.offsetHeight]);
    set(e, Object.assign({ x: cx - r[0] / 2, y: cy - r[1] / 2, o }, extra));
  };
  function headline(html, y, size) {
    const b = makeText(type, html);
    Object.assign(b.style, { left: 0, width: W + 'px', textAlign: 'center', top: y * H + 'px', fontSize: size + 'px', direction: EN ? 'ltr' : 'rtl' });
    return b;
  }
  function kicker(text, y, size) {
    const d = el('div', 'kicker', type, text);  // placed by at() each frame
    d.style.fontSize = size + 'px';
    return d;
  }

  let render;
  window.ready = (async () => {
    await document.fonts.load('500 40px Cormorant');
    await document.fonts.load('italic 400 40px Cormorant');
    await document.fonts.load('600 40px Manrope');
    await document.fonts.load('400 40px Amiri', 'زاد');
    await document.fonts.load('700 40px Tajawal', 'زاد');
    await document.fonts.load('500 40px Tajawal', 'زاد');
    FX.init(L, {});

    // ---- phone with the genuine editor screens
    const hPh = 0.6 * H, phY = 0.085 * H;
    const SCR = ['vm-editor', 'vm-popular', 'vm-step2', 'vm-step3', 'vm-step4', 'vm-recording', 'vm-result'];
    const phone = makePhone(anchor, hPh, SCR.map(n => n + SUF));
    const show = st => phone.show(Object.fromEntries(Object.entries(st).map(([k, v]) => [k + SUF, v])));

    // ---- type
    const K0 = kicker(tx('Ayah Video Maker · Zad Al-Muslim', 'صانعُ فيديو الآيات · زاد المسلم'), 0.06, EN ? 30 : 40);
    if (EN) K0.classList.add('caps-en');
    const T0 = headline(tx('Make your status<br><em>an ayah.</em>', 'اجعلْ حالتَكَ<br><em>آيةً تُذكِّر</em>'), 0.1, EN ? 128 : 118);
    const steps = [
      [tx('Pick the <em>ayat</em>', 'اختَرِ <em>الآيات</em>'), tx('Any surah, or a popular selection', 'من أيِّ سورة، أو من الآيات المختارة'), 3.2, 5.55],
      [tx('Reciter & <em>background</em>', 'القارئُ <em>والخلفيّة</em>'), tx('Multiple reciters · picture & video backgrounds', 'قرّاء متعدّدون · خلفيات صور وفيديو'), 5.6, 8.25],
      [tx('Sized for <em>every platform</em>', 'مقاسٌ <em>لكلِّ منصّة</em>'), tx('Status / Story · Square · Wide', 'حالة / ستوري · مربع · عريض'), 8.3, 10.85],
      [tx('Create the <em>video</em>', 'أنشئِ <em>الفيديو</em>'), tx('Recitation and ayah text, ready to share', 'بالتلاوة ونصِّ الآيات، جاهزًا للمشاركة'), 10.9, 13.05],
    ].map(([h1, sub, a, b]) => ({ h: headline(h1, 0.06, EN ? 112 : 104), s: kicker(sub, 0.15, EN ? 38 : 42), a, b }));
    steps.forEach(s => { s.s.style.color = 'rgba(244,237,223,0.8)'; s.s.style.fontWeight = 500; });
    const dots = el('div', 'stepdots', type, '<span></span><span></span><span></span><span></span>');
    if (EN) dots.style.direction = 'ltr';
    const dotEls = [...dots.children];
    const bar = el('div', 'storybar', type, '<i></i>');

    // ---- end card
    const icon = el('div', 'icon', type, '<img src="../assets/brand/app-icon-1024.png"><div class="sweep"></div>');
    Object.assign(icon.style, { width: '250px', height: '250px' });
    const sweep = icon.querySelector('.sweep');
    const endT = headline(tx('Ayah Video <em>Maker</em>', 'صانعُ فيديو <em>الآيات</em>'), 0.27, EN ? 120 : 112);
    const endSub = kicker(tx('in the Zad Al-Muslim app', 'في تطبيق زادِ المسلم'), 0.365, EN ? 44 : 48);
    endSub.style.color = 'var(--ivory)';
    const endBen = kicker(tx('Free  •  Ad-Free  •  Works Offline', 'مَجّاني  •  بلا إعلانات  •  يعمل دون إنترنت'), 0.425, EN ? 26 : 36);
    if (EN) endBen.classList.add('caps-en');
    const cta = headline(tx('Download on <em>Google Play</em>', 'حمِّله الآن من <em>Google Play</em>'), 0.5, EN ? 72 : 66);
    const qr = el('div', 'qr-card', type, '<img src="../assets/brand/qr-google-play.png">');
    Object.assign(qr.style, { width: '400px', height: '400px' });
    const scan = kicker(tx('Scan to install', 'امسح الرمز للتثبيت'), 0.785, EN ? 22 : 32);
    if (EN) scan.classList.add('caps-en');
    const badge = el('div', 'badge', type, `<img src="../assets/brand/google-play-badge${EN ? '' : '-ar'}-cropped.png">`);
    badge.style.width = '420px';
    const url = el('div', 'url', type, 'play.google.com/store/apps/details?id=io.github.solimananas.twa');
    Object.assign(url.style, { fontSize: '24px', direction: 'ltr' });

    // preload clip frames
    const frames = Array.from({ length: CLIP_FRAMES }, (_, i) => `../build/vm-frames${SUF}/f${String(i + 1).padStart(4, '0')}.jpg`);
    await Promise.all(frames.map(src => new Promise(r => { const im = new Image(); im.onload = im.onerror = r; im.src = src; })));
    await Promise.all([...document.images].map(im => im.decode().catch(() => {})));

    const resettable = [...type.children].filter(e => !e.classList.contains('txt'));

    render = t => {
      resettable.forEach(e => { e.style.visibility = 'hidden'; e.style.opacity = 0; });
      const clipOn = win(t, CLIP_T0 - 0.2, CLIP_END + 0.35, 0.55, 0.6);
      const S = {
        dawn: 0, storm: 0, black: 0, point: 0, studio: 1, lightX: 0.5, lightY: 0.04, spot: 1.1,
        archEcho: 0.9 * (1 - clipOn), echoX: 0.5, camX: t * 0.004, bokeh: 0.9, mushaf: 0, rings: 0,
        motes: ease.inOut(prog(t, 23.8, 25)), brand: ease.inOut(prog(t, 23.6, 24.6)), brandLX: 0.5, brandLY: 0.13, rays: 0.6 + 0.4 * Math.sin(t * 0.5),
      };

      // hook
      at(K0, W / 2, 0.06 * H, win(t, 0.2, 3.1, 0.6, 0.4));
      playText(T0, t, 0.35, 2.95, { stagger: 0.12 });

      // steps: headline + subline + dots
      steps.forEach((s, i) => {
        playText(s.h, t, s.a, s.b - 0.35, { stagger: 0.1, dur: 0.8, outDur: 0.35 });
        at(s.s, W / 2, 0.15 * H + 26, win(t, s.a + 0.25, s.b, 0.5, 0.35));
      });
      const dotO = win(t, 3.1, 13.0, 0.5, 0.4);
      at(dots, W / 2, 0.915 * H, dotO);
      const si = steps.findIndex(s => t >= s.a && t < s.b);
      dotEls.forEach((d, i) => d.classList.toggle('on', i === si));

      // phone pose
      if (t < 13.9) {
        const pin = ease.outQuint(prog(t, 0.3, 1.8));
        const pout = ease.in(prog(t, 12.95, 13.75));
        phone.pose({
          x: 0, y: phY + (1 - pin) * 0.35 * H + Math.sin(t * 0.7) * 5,
          z: lerp(-200, 0, pin) + pout * 900, ry: lerp(-16, 0, pin) + Math.sin(t * 0.35) * 3, rx: lerp(10, 2, pin),
          o: ease.inOut(prog(t, 0.3, 1.0)) * (1 - pout), blur: (1 - pin) * 8,
        });
      } else phone.pose({ o: 0 });
      // phone screens — genuine captures in the order a user meets them
      const push = (a, b, t0, d = 0.5) => { const p = ease.inOut(prog(t, t0, t0 + d)); return { [a]: { o: p < 1 ? 1 : 0, y: -p * 100 }, [b]: { o: p > 0 ? 1 : 0, y: (1 - p) * 100 } }; };
      let st;
      if (t < 5.6) {
        const p = ease.inOut(prog(t, 4.0, 4.5));
        st = { 'vm-editor': { o: 1, s: 1 - p * 0.03 }, 'vm-popular': { o: p > 0 ? 1 : 0, y: (1 - p) * 100 } };
      } else if (t < 6.9) st = push('vm-popular', 'vm-step2', 5.6);
      else if (t < 8.3) st = push('vm-step2', 'vm-step3', 6.9);
      else if (t < 11.4) st = push('vm-step3', 'vm-step4', 8.3);
      else if (t < 12.3) { const p = ease.inOut(prog(t, 11.4, 11.65)); st = { 'vm-step4': { o: 1 - p }, 'vm-recording': { o: p } }; }
      else { const p = ease.inOut(prog(t, 12.3, 12.75)); st = { 'vm-recording': { o: 1 }, 'vm-result': { o: p > 0 ? 1 : 0, y: (1 - p) * 100 } }; }
      show(st);
      // taps on the real buttons (mirrored between the RTL and LTR layouts)
      phone.tap(EN ? 0.81 : 0.2, 0.875, prog(t, 3.65, 4.15));   // Popular → popular-ayat sheet
      phone.tap(EN ? 0.7 : 0.25, 0.955, prog(t, 11.0, 11.5));   // Create video
      phone.dim(0);

      // the exported clip, full screen
      if (clipOn > 0.001) {
        const f = clamp(Math.floor((t - CLIP_T0) * FPS), 0, CLIP_FRAMES - 1);
        const src = frames[f];
        if (clipImg.getAttribute('src') !== src) clipImg.setAttribute('src', src);
        set(clipImg, { o: clipOn, s: lerp(1.06, 1, ease.out(prog(t, CLIP_T0 - 0.2, CLIP_T0 + 0.6))) });
        at(bar, W / 2, 33, clipOn * 0.9);
        bar.firstChild.style.width = (clamp((t - CLIP_T0) / (CLIP_END - CLIP_T0)) * 100).toFixed(2) + '%';
        S.black = 0;
      } else set(clipImg, { o: 0 });

      // end card
      const ip = ease.outQuint(prog(t, 23.9, 25.0));
      at(icon, W / 2, 0.15 * H, ease.inOut(prog(t, 23.9, 24.4)), { s: lerp(0.86, 1, ip), blur: lerp(12, 0, ip) });
      set(sweep, { x: lerp(-1.4, 1.4, ease.inOut(prog(t, 24.5, 25.5))) * 250 });
      playText(endT, t, 24.2, undefined, { stagger: 0.12 });
      at(endSub, W / 2, 0.365 * H + 30, ease.inOut(prog(t, 24.9, 25.6)));
      at(endBen, W / 2, 0.425 * H + 22, ease.inOut(prog(t, 25.3, 26.0)));
      playText(cta, t, 26.9, undefined, { stagger: 0.1 });
      const qp = ease.outQuint(prog(t, 25.9, 27.0));
      at(qr, W / 2, 0.665 * H, ease.inOut(prog(t, 25.9, 26.4)), { s: lerp(0.9, 1, qp) });
      at(scan, W / 2, 0.785 * H + 20, ease.inOut(prog(t, 26.3, 26.9)));
      const bp = ease.outQuint(prog(t, 27.1, 28.0));
      at(badge, W / 2, 0.855 * H, ease.inOut(prog(t, 27.1, 27.6)), { s: lerp(0.92, 1, bp) });
      at(url, W / 2, 0.925 * H, ease.inOut(prog(t, 27.5, 28.2)));
      return S;
    };

    window.renderFrame(0);
    return { W, H, FPS, DURATION };
  })();

  window.renderFrame = function (t) {
    const S = render(t);
    FX.drawBg(cv.bg, t, L, S);
    FX.drawGlow(cv.glow, t, L, S);
    FX.drawGrain(cv.grain, Math.round(t * FPS), L);
  };
  if (qs.has('t')) window.ready.then(() => window.renderFrame(parseFloat(qs.get('t'))));
})();
