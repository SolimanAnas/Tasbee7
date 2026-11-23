// "Your whole day, in one app" — 43 s YouTube Shorts reel, 1080×1920, English.
// A day from dawn to night, one genuine feature per moment; the sky behind the
// phone follows the time of day (sun arc, then moon). Pure function of time.
//   0.0–2.6   hook: rapid montage of real screens
//   2.6–32.8  dawn → morning → on the go → midday → afternoon → evening → night → share
//   32.8–35.2 the three home themes side by side
//   35.2–43.0 end card (QR + "search on Google Play": Shorts links aren't tappable)
(function () {
  const { clamp, lerp, prog, ease, set, el, makeText, playText } = K;
  const win = K.window;
  const FPS = 30, DURATION = 43;
  const W = 1080, H = 1920, u = 1;
  const L = { W, H, u, v: true, sq: false, lang: 'en', rtl: false,
    arch: { cx: W / 2, top: 0, w: 200, h: 400 }, beamTo: { x: 0, y: H, spread: 300 }, floorY: H };

  const frame = document.getElementById('frame');
  frame.style.width = W + 'px'; frame.style.height = H + 'px';
  const cv = {};
  ['bg', 'glow', 'grain'].forEach(id => { const c = document.getElementById(id); c.width = W; c.height = H; cv[id] = c.getContext('2d'); });
  Object.assign(document.getElementById('grain').style, { mixBlendMode: 'overlay', opacity: 0.32 });
  const type = document.getElementById('type');
  const anchor = document.getElementById('anchor');
  const scrim = document.getElementById('topscrim');

  const at = (e, cx, cy, o, extra = {}) => {
    const r = e._wh || (e._wh = [e.offsetWidth, e.offsetHeight]);
    set(e, Object.assign({ x: cx - r[0] / 2, y: cy - r[1] / 2, o }, extra));
  };
  const headline = (html, y, size) => {
    const b = makeText(type, html);
    Object.assign(b.style, { left: 0, width: W + 'px', textAlign: 'center', top: y * H + 'px', fontSize: size + 'px' });
    return b;
  };
  const line = (cls, html, size) => { const d = el('div', cls, type, html); d.style.fontSize = size + 'px'; return d; };

  const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="#e6cf9c" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>';
  const RISE = '<svg viewBox="0 0 24 24" fill="none" stroke="#e6cf9c" stroke-width="1.8" stroke-linecap="round"><path d="M4 18h16M7.5 18a4.5 4.5 0 0 1 9 0M12 6v3.5M5.6 11.2l1.5 1.2M18.4 11.2l-1.5 1.2"/></svg>';
  const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="#e6cf9c" stroke-width="1.8" stroke-linejoin="round"><path d="M19.5 14.6A8 8 0 1 1 9.4 4.5a6.4 6.4 0 0 0 10.1 10.1z"/></svg>';
  const GO = '<svg viewBox="0 0 24 24" fill="none" stroke="#e6cf9c" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/></svg>';
  const SHARE = '<svg viewBox="0 0 24 24" fill="none" stroke="#e6cf9c" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.6-4M8.2 13.2l7.6 4"/></svg>';

  // ---- the day: time window, chip, headline, subline, screens [name, from]
  const BEATS = [
    { a: 2.6, b: 5.6, icon: RISE, chip: 'Dawn', h: 'Prayer times,<br><em>wherever you are.</em>', s: '', scr: [['r-home-light', 2.6]] },
    { a: 5.6, b: 8.6, icon: SUN, chip: 'Morning', h: 'Morning <em>adhkar.</em>', s: 'Read, listen and count', scr: [['r-azkar', 5.6]] },
    { a: 8.6, b: 12.8, icon: GO, chip: 'On the go', h: 'Recitation &<br><em>live Quran radio.</em>', s: '', scr: [['r-audio', 8.6], ['r-radio', 10.7]] },
    { a: 12.8, b: 17.0, icon: SUN, chip: 'Midday', h: 'Open <em>the Mushaf.</em>', s: '5 Mushaf styles · tafsir · bookmarks', scr: [['r-quran', 12.8]] },
    { a: 17.0, b: 21.4, icon: SUN, chip: 'Afternoon', h: 'Keep your <em>dhikr.</em>', s: 'Smart tasbeeh · daily targets', scr: [['r-masbaha-30', 17.0], ['r-masbaha-31', 18.7], ['r-masbaha-32', 19.0], ['r-masbaha-33', 19.3]] },
    { a: 21.4, b: 25.6, icon: RISE, chip: 'Evening', h: 'Hadith &<br><em>the Qibla, anywhere.</em>', s: '', scr: [['r-hadith', 21.4], ['r-qibla-compass', 23.5]] },
    { a: 25.6, b: 29.4, icon: MOON, chip: 'Night', h: 'Adhkar <em>before sleep.</em>', s: '', scr: [['r-sleeping', 25.6]] },
    { a: 29.4, b: 32.8, icon: SHARE, chip: 'Anytime', h: 'Share an ayah<br><em>to your status.</em>', s: 'Ayah Video Maker', scr: [['r-video-maker', 29.4]] },
  ];
  const MONTAGE = ['r-home-light', 'r-quran', 'r-azkar', 'r-audio', 'r-masbaha-33', 'r-qibla-compass', 'r-sleeping', 'r-video-maker'];

  // sky colours through the day: [time, top, bottom]
  const SKY = [
    [0.0, '#06251c', '#0b3d2e'], [2.4, '#06251c', '#0b3d2e'],
    [3.0, '#1c2b52', '#c9876a'],            // dawn
    [6.0, '#2f6a9e', '#e6b98c'],            // morning
    [9.0, '#26708f', '#7fc0b4'],            // on the go
    [13.2, '#2b78a8', '#9cc9cf'],           // midday
    [17.4, '#8a5a2b', '#d9a865'],           // afternoon (warm, like the sepia theme)
    [21.8, '#4a2c5e', '#c8673f'],           // sunset
    [26.0, '#081430', '#1a2a57'],           // night
    [29.8, '#071a22', '#0b3d2e'],           // back to the brand emerald
  ];
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (c1, c2, p) => { const a = hex(c1), b = hex(c2); return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], p))).join(',')})`; };
  const hexOrRgb = c => (c[0] === '#' ? hex(c) : c.slice(4, -1).split(',').map(Number));
  function skyAt(t) {
    for (let i = 1; i < SKY.length; i++) {
      if (t <= SKY[i][0]) {
        const p = ease.inOutSine(prog(t, SKY[i - 1][0], SKY[i][0]));
        return [mix(SKY[i - 1][1], SKY[i][1], p), mix(SKY[i - 1][2], SKY[i][2], p)];
      }
    }
    return [SKY[SKY.length - 1][1], SKY[SKY.length - 1][2]];
  }

  let render;
  window.ready = (async () => {
    await document.fonts.load('500 40px Cormorant');
    await document.fonts.load('italic 400 40px Cormorant');
    await document.fonts.load('600 40px Manrope');
    await document.fonts.load('700 40px Manrope');
    FX.init(L, {});

    const SCR = [...new Set([...MONTAGE, ...BEATS.flatMap(b => b.scr.map(s => s[0])), 'r-home-sepia', 'r-home-dark'])];
    const hPh = 0.52 * H, phY = 0.06 * H;
    const phone = makePhone(anchor, hPh, SCR);
    const themes = ['r-home-light', 'r-home-sepia', 'r-home-dark'].map(n => makePhone(anchor, 0.42 * H, [n]));

    // type
    const hook1 = headline('Your whole day,', 0.105, 112);
    const hook2 = headline('<em>in one app.</em>', 0.165, 112);
    const beatsUI = BEATS.map(bt => {
      const chip = line('chip-time', bt.icon + bt.chip, 26);
      const h = headline(bt.h, 0.115, 96);
      const s = bt.s ? line('sub', bt.s, 40) : null;
      return { bt, chip, h, s };
    });
    const themeH = headline('Light, sepia <em>or dark.</em>', 0.115, 100);
    const themeS = line('sub', 'Three themes, one beautiful app', 40);

    // end card
    const icon = el('div', 'icon', type, '<img src="../assets/brand/app-icon-1024.png"><div class="sweep"></div>');
    Object.assign(icon.style, { width: '230px', height: '230px' });
    const sweep = icon.querySelector('.sweep');
    const endName = headline('Zad Al-Muslim', 0.235, 124);
    const endTag = line('caps-line', 'Your all-in-one Islamic companion', 24);
    endTag.style.color = 'var(--ivory)';
    const endBen = line('caps-line', 'Free  •  Ad-free  •  Works offline', 26);
    const qr = el('div', 'qr-card', type, '<img src="../assets/brand/qr-google-play.png">');
    Object.assign(qr.style, { width: '330px', height: '330px' });
    const search = headline('Search <em>“Zad Al-Muslim”</em>', 0.625, 66);
    const searchSub = line('sub', 'on Google Play', 40);
    const badge = el('div', 'badge', type, '<img src="../assets/brand/google-play-badge-cropped.png">');
    badge.style.width = '360px';

    await Promise.all([...document.images].map(im => im.decode().catch(() => {})));
    const resettable = [...type.children].filter(e => !e.classList.contains('txt'));

    render = t => {
      resettable.forEach(e => { e.style.visibility = 'hidden'; e.style.opacity = 0; });
      const brandO = ease.inOut(prog(t, 35.0, 35.9));
      const S = {
        dawn: 0, storm: 0, black: 0, point: 0, studio: 0, spot: 0, archEcho: 0, bokeh: 0.5, camX: t * 0.004,
        mushaf: 0, rings: 0, motes: ease.inOut(prog(t, 35.2, 36.4)), brand: brandO, brandLX: 0.5, brandLY: 0.13,
        rays: 0.6 + 0.4 * Math.sin(t * 0.5),
      };
      S.sky = skyAt(t);
      S.skyO = 1 - brandO;
      S.sun = t > 2.4 && t < 26.4 ? prog(t, 2.6, 25.8) : -1;
      S.moon = ease.inOut(prog(t, 25.4, 26.6)) * (1 - ease.inOut(prog(t, 29.4, 30.4)));
      scrim.style.opacity = (1 - brandO).toFixed(3);

      // hook
      playText(hook1, t, 0.15, 2.35, { stagger: 0.08, dur: 0.6, outDur: 0.3 });
      playText(hook2, t, 0.75, 2.35, { stagger: 0.08, dur: 0.6, outDur: 0.3 });

      // beats
      beatsUI.forEach(({ bt, chip, h, s }) => {
        const o = win(t, bt.a + 0.05, bt.b, 0.4, 0.35);
        chip._wh = chip._wh || [chip.offsetWidth, chip.offsetHeight];
        set(chip, { x: W / 2 - chip._wh[0] / 2, y: 0.075 * H - chip._wh[1] / 2 + (1 - ease.out(prog(t, bt.a, bt.a + 0.5))) * 14, o });
        playText(h, t, bt.a + 0.12, bt.b - 0.3, { stagger: 0.07, dur: 0.6, outDur: 0.3 });
        if (s) at(s, W / 2, (bt.h.includes('<br>') ? 0.268 : 0.205) * H, win(t, bt.a + 0.45, bt.b, 0.4, 0.3));
      });

      // main phone: montage, then the day
      const pin = ease.outQuint(prog(t, 0.05, 0.7));
      const pout = ease.in(prog(t, 32.5, 33.1));
      const showMain = t < 33.2;
      phone.pose(!showMain ? { o: 0 } : {
        x: 0, y: phY + (1 - pin) * 0.25 * H + Math.sin(t * 0.8) * 5, z: lerp(-150, 0, pin) - pout * 400,
        ry: Math.sin(t * 0.45) * 4, rx: 2, o: ease.inOut(prog(t, 0.05, 0.4)) * (1 - pout), blur: pout * 8,
      });
      const st = {};
      if (t < 2.6) {
        const k = clamp(Math.floor((t - 0.2) / 0.3), 0, MONTAGE.length - 1);
        st[MONTAGE[k]] = { o: 1 };
      } else {
        // the screen at time t, sliding in from the right when it changes
        const seq = BEATS.flatMap(b => b.scr);
        let cur = 0;
        seq.forEach((s, i) => { if (t >= s[1]) cur = i; });
        const [name, t0] = seq[cur];
        const tapLike = name.startsWith('r-masbaha') && t0 > 17.0;   // counter steps: no slide
        const p = tapLike ? 1 : ease.inOut(prog(t, t0, t0 + 0.45));
        st[name] = { o: 1, x: (1 - p) * 100 };
        if (p < 1 && cur > 0) st[seq[cur - 1][0]] = { o: 1, x: -p * 30 };
        if (tapLike) Object.assign(st, { [seq[cur - 1][0]]: undefined });
      }
      phone.show(st);
      // real taps on the counter (31, 32, 33)
      const tapT = [18.7, 19.0, 19.3].find(x => t >= x && t < x + 0.3);
      phone.tap(0.5, 0.42, tapT !== undefined ? (t - tapT) / 0.3 : 0);

      // the three themes
      const tIn = ease.outQuint(prog(t, 32.8, 33.8)), tOut = ease.in(prog(t, 34.8, 35.4));
      themes.forEach((ph, i) => {
        const d = i - 1;
        if (t < 32.8 || t > 35.4) { ph.pose({ o: 0 }); return; }
        ph.pose({ x: d * 0.25 * W * lerp(0.4, 1, tIn), y: phY + Math.abs(d) * 30 + (1 - tIn) * 0.1 * H, z: -Math.abs(d) * 120 + tOut * 200,
          rz: d * 5 * tIn, ry: -d * 8, rx: 2, o: ease.inOut(prog(t, 32.8 + Math.abs(d) * 0.12, 33.3 + Math.abs(d) * 0.12)) * (1 - tOut), blur: tOut * 6 });
        ph.show({ [Object.keys(ph.layers)[0]]: { o: 1 } });
      });
      playText(themeH, t, 32.95, 35.0, { stagger: 0.07, dur: 0.6, outDur: 0.3 });
      at(themeS, W / 2, 0.205 * H, win(t, 33.3, 35.1, 0.4, 0.3));

      // end card
      const ip = ease.outQuint(prog(t, 35.4, 36.4));
      at(icon, W / 2, 0.135 * H, ease.inOut(prog(t, 35.4, 35.9)), { s: lerp(0.86, 1, ip), blur: lerp(12, 0, ip) });
      set(sweep, { x: lerp(-1.4, 1.4, ease.inOut(prog(t, 36.0, 37.0))) * 230 });
      playText(endName, t, 35.7, undefined, { stagger: 0.1 });
      at(endTag, W / 2, 0.325 * H, ease.inOut(prog(t, 36.4, 37.1)));
      at(endBen, W / 2, 0.365 * H, ease.inOut(prog(t, 37.0, 37.7)));
      const qp = ease.outQuint(prog(t, 37.6, 38.6));
      at(qr, W / 2, 0.5 * H, ease.inOut(prog(t, 37.6, 38.1)), { s: lerp(0.9, 1, qp) });
      playText(search, t, 38.6, undefined, { stagger: 0.08 });
      at(searchSub, W / 2, 0.69 * H, ease.inOut(prog(t, 39.0, 39.6)));
      const bp = ease.outQuint(prog(t, 39.3, 40.2));
      at(badge, W / 2, 0.74 * H, ease.inOut(prog(t, 39.3, 39.8)), { s: lerp(0.92, 1, bp) });
      return S;
    };

    window.renderFrame(0);
    return { W, H, FPS, DURATION };
  })();

  // sky + sun/moon under FX's layers (FX draws the end card's brand light)
  function drawSky(c, t, S) {
    if (S.skyO <= 0.001) return;
    c.save();
    c.globalAlpha = S.skyO;
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, S.sky[0]); g.addColorStop(1, S.sky[1]);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (S.sun >= 0) {   // sun arc: rises left, peaks at midday, sets right
      const a = Math.PI * (1 - S.sun);
      const x = W / 2 + Math.cos(a) * W * 0.46, y = H * 0.72 - Math.sin(a) * H * 0.5;
      const r = 300;
      const sg = c.createRadialGradient(x, y, 0, x, y, r);
      sg.addColorStop(0, 'rgba(255,244,214,0.95)'); sg.addColorStop(0.12, 'rgba(255,226,170,0.8)');
      sg.addColorStop(0.35, 'rgba(255,200,130,0.22)'); sg.addColorStop(1, 'rgba(255,190,120,0)');
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = sg; c.fillRect(x - r, y - r, 2 * r, 2 * r);
      c.globalCompositeOperation = 'source-over';
    }
    if (S.moon > 0.001) {
      const x = W * 0.14, y = H * 0.36, r = 46;   // beside the phone, clear of the headline
      c.globalAlpha = S.skyO * S.moon;
      const mg = c.createRadialGradient(x, y, 0, x, y, r * 4);
      mg.addColorStop(0, 'rgba(230,235,255,0.35)'); mg.addColorStop(1, 'rgba(230,235,255,0)');
      c.fillStyle = mg; c.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
      c.fillStyle = '#f4efe0';
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      // crescent: shade with the sky's own colour at that height
      const sk = S.sky.map(hexOrRgb);
      c.fillStyle = `rgb(${sk[0].map((v, i) => Math.round(lerp(v, sk[1][i], y / H))).join(',')})`;
      c.beginPath(); c.arc(x + r * 0.42, y - r * 0.18, r * 0.9, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  window.renderFrame = function (t) {
    const S = render(t);
    FX.drawBg(cv.bg, t, L, S);
    drawSky(cv.bg, t, S);
    FX.drawGlow(cv.glow, t, L, S);
    FX.drawGrain(cv.grain, Math.round(t * FPS), L);
  };
  const qs = new URLSearchParams(location.search);
  if (qs.has('t')) window.ready.then(() => window.renderFrame(parseFloat(qs.get('t'))));
})();
