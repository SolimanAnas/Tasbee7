// The commercial's choreography. buildScenes(L) creates the DOM once and
// returns render(t), a pure function of time. Scene timings (seconds):
//   S1 0.0–4.3  Hook: dawn light, then the storm of distractions, then a hush
//   S2 4.3–8.0  The shift: a point of light becomes the phone
//   S3 8.0–15   The Quran: genuine Mushaf pages, recitation
//   S4 15–22    Remember. Reflect. Grow. (adhkar, Hisn, tasbeeh, memorisation)
//   S5 22–29    More ways to stay connected (hadith, qibla, radio, languages, offline)
//   S6 29–35    A daily ritual: the phone on a desk from dawn to night
//   S7 35–45    Brand reveal, benefits, Google Play badge + QR
(function () {
  const { clamp, lerp, prog, ease, tween, track, set, el, makeText, playText } = K;
  const win = K.window;

  function buildScenes(L) {
    const { W, H, u } = L;
    const V = L.v, SQ = L.sq;
    const pick = o => (V ? o.v : SQ ? (o.s ?? o.v) : o.l);
    // Arabic cut (?lang=ar): Arabic copy and app UI, composition mirrored for RTL.
    const AR = L.lang === 'ar', M = AR ? -1 : 1;
    const tx = (en, ar) => (AR ? ar : en);
    const AR_SCREENS = ['audio', 'azkar', 'hisn', 'masbaha-30', 'masbaha-31', 'masbaha-32', 'masbaha-33', 'hadith', 'radio', 'takrar', 'sleeping'];
    const sn = n => (!AR ? n : n === 'home-en' ? 'home-ar' : n === 'qibla-compass' ? 'qibla-ar' : AR_SCREENS.includes(n) ? n + '-ar' : n);
    // x for a box of width w placed at left x in LTR → mirrored for RTL
    const mx = (x, w) => (AR ? W - x - w : x);
    const anchor = document.getElementById('anchor');
    const type = document.getElementById('type');

    // ---- text helpers ------------------------------------------------------
    function headline(html, pos, cls) {
      const b = makeText(type, html, cls || '');
      b.style.fontSize = pos.size * u + 'px';
      if (pos.align === 'center') {
        Object.assign(b.style, { left: 0, width: W + 'px', textAlign: 'center', top: pos.y * H + 'px' });
      } else if (AR) {
        Object.assign(b.style, { right: pos.x * W + 'px', top: pos.y * H + 'px', textAlign: 'right' });
      } else {
        Object.assign(b.style, { left: pos.x * W + 'px', top: pos.y * H + 'px' });
      }
      if (AR) b.style.direction = 'rtl';
      return b;
    }
    function label(html, size) {
      const d = el('div', 'label', type, html);
      d.style.fontSize = size * u * (AR ? 1.3 : 1) + 'px';
      return d;
    }
    // place a centred element at frame coords (cx, cy)
    function at(e, cx, cy, o, extra = {}) {
      const r = e._wh || (e._wh = [e.offsetWidth, e.offsetHeight]);
      set(e, Object.assign({ x: cx - r[0] / 2, y: cy - r[1] / 2, o }, extra));
    }
    function chip(html, size) {
      const d = el('div', 'chip', type, html);
      d.style.fontSize = size * u * (AR ? 1.15 : 1) + 'px';
      d.style.left = '0'; d.style.top = '0';
      return d;
    }

    // ---- phones ------------------------------------------------------------
    const hHero = pick({ l: 0.8 * H, v: 0.5 * H, s: 0.64 * H });
    const hero = makePhone(anchor, hHero, [sn('home-en'), 'quran-p1', 'quran-p2']);
    const audio = makePhone(anchor, hHero, [sn('audio')]);
    const hCar = pick({ l: 0.64 * H, v: 0.45 * H, s: 0.56 * H });
    const car = [
      makePhone(anchor, hCar, [sn('azkar')]),
      makePhone(anchor, hCar, [sn('hisn')]),
      makePhone(anchor, hCar, ['masbaha-30', 'masbaha-31', 'masbaha-32', 'masbaha-33'].map(sn)),
      makePhone(anchor, hCar, [sn('takrar')]),
    ];
    const hMore = pick({ l: 0.62 * H, v: 0.43 * H, s: 0.5 * H });
    const more = ['hadith', 'qibla-compass', 'radio'].map(s => makePhone(anchor, hMore, [sn(s)]));
    const hLang = pick({ l: 0.56 * H, v: 0.33 * H, s: 0.46 * H });
    const langs = ['home-en', 'home-ckb', 'home-ar', 'home-ur', 'home-tr'].map(s => makePhone(anchor, hLang, [s]));

    // ---- desk scene (S6): a tilted plane carrying texture, light and phone
    const plane = el('div', 'plane', anchor);
    const PW = pick({ l: W * 1.5, v: W * 2.2, s: W * 1.8 }), PH = pick({ l: H * 2.0, v: H * 1.5, s: H * 2.0 });
    Object.assign(plane.style, { position: 'absolute', left: -PW / 2 + 'px', top: -PH / 2 + 'px', width: PW + 'px', height: PH + 'px', transformStyle: 'preserve-3d' });
    const hDesk = pick({ l: 0.62 * H, v: 0.36 * H, s: 0.5 * H });
    const deskPhoneW = hDesk * 0.458;
    const dpX = pick({ l: 0.1 * PW, v: -0.04 * PW, s: 0.06 * PW }) * M; // phone offset from plane centre
    const tex = FX.deskTexture(Math.round(PW / 1.5), Math.round(PH / 1.5), {
      x: (PW / 2 + dpX - deskPhoneW / 2) / 1.5, y: (PH / 2 - hDesk / 2) / 1.5, w: deskPhoneW / 1.5, h: hDesk / 1.5,
    }, M);
    Object.assign(tex.style, { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' });
    plane.appendChild(tex);
    // window light falling across the desk (three arches)
    const gobo = document.createElement('canvas');
    gobo.width = 900; gobo.height = 700;
    {
      const c = gobo.getContext('2d');
      c.filter = 'blur(14px)';
      c.fillStyle = 'rgba(255, 214, 150, 1)';
      for (let i = 0; i < 3; i++) { archPath(c, 170 + i * 280, 60, 200, 560); c.fill(); }
      c.filter = 'none';
      c.globalCompositeOperation = 'destination-out';
      c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 10;
      for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(170 + i * 280, 60); c.lineTo(170 + i * 280, 620); c.stroke(); }
    }
    Object.assign(gobo.style, { position: 'absolute', width: PW * 0.75 + 'px', height: PW * 0.75 * 700 / 900 + 'px', mixBlendMode: 'soft-light', transform: 'translateZ(1px)' });
    plane.appendChild(gobo);
    const warm = el('div', '', plane);
    Object.assign(warm.style, { position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 30% 30%, rgba(255,190,110,0.35), rgba(255,170,90,0) 60%)', mixBlendMode: 'screen', transform: 'translateZ(1px)' });
    const night = el('div', '', plane);
    Object.assign(night.style, { position: 'absolute', inset: 0, background: 'rgba(8, 20, 48, 0.78)', mixBlendMode: 'multiply', transform: 'translateZ(1.5px)' });
    const screenGlow = el('div', '', plane);
    Object.assign(screenGlow.style, {
      position: 'absolute', left: PW / 2 + dpX - hDesk * 0.6 + 'px', top: PH / 2 - hDesk * 0.75 + 'px', width: hDesk * 1.2 + 'px', height: hDesk * 1.5 + 'px',
      background: 'radial-gradient(ellipse, rgba(90, 160, 255, 0.35), rgba(60, 120, 220, 0) 65%)', mixBlendMode: 'screen', transform: 'translateZ(2px)',
    });
    const pAnchor = el('div', 'anchor', plane);
    pAnchor.style.left = PW / 2 + dpX + 'px'; pAnchor.style.top = PH / 2 + 'px';
    const desk = makePhone(pAnchor, hDesk, [sn('home-en'), sn('sleeping')]);
    // mirror every phone's placement and yaw for RTL
    if (AR) [hero, audio, ...car, ...more, ...langs, desk].forEach(ph => {
      const pose = ph.pose.bind(ph);
      ph.pose = p => pose(Object.assign({}, p, { x: -(p.x || 0), ry: -(p.ry || 0), rz: -(p.rz || 0) }));
    });

    // legibility scrim behind type over the bright desk (S6)
    const scrim = el('div', 'scrim', type);
    Object.assign(scrim.style, {
      position: 'absolute', width: W + 'px', height: H + 'px',
      background: V || SQ
        ? 'linear-gradient(180deg, rgba(2,8,6,0.8) 0%, rgba(2,8,6,0.45) 22%, rgba(2,8,6,0) 40%, rgba(2,8,6,0) 80%, rgba(2,8,6,0.6) 100%)'
        : `linear-gradient(${AR ? 270 : 90}deg, rgba(2,8,6,0.82) 0%, rgba(2,8,6,0.55) 30%, rgba(2,8,6,0) 58%)`,
    });

    // ---- headlines ----------------------------------------------------------
    const T1 = headline(tx("Among life's<br><em>endless distractions…</em>", 'وسطَ مشاغلِ الحياةِ<br><em>التي لا تنتهي…</em>'),
      pick({ l: { x: 0.07, y: 0.38, size: 92 }, v: { align: 'center', y: 0.575, size: 92 }, s: { x: 0.07, y: 0.73, size: 70 } }));
    const T2 = headline(tx('Make space<br>for <em>what matters.</em>', 'اِمنحْ قَلْبَكَ مساحةً<br><em>لما يهمُّ حقًّا.</em>'),
      pick({ l: { x: 0.08, y: 0.37, size: 110 }, v: { align: 'center', y: 0.075, size: 104 }, s: { align: 'center', y: 0.05, size: 76 } }));
    const T3 = headline(tx('Your connection<br>with <em>the Quran.</em>', 'صِلَتُكَ<br><em>بالقرآنِ الكريم.</em>'),
      pick({ l: { x: 0.07, y: 0.3, size: 104 }, v: { align: 'center', y: 0.075, size: 100 }, s: { align: 'center', y: 0.05, size: 74 } }));
    const T4 = headline(tx('Remember. Reflect. <em>Grow.</em>', 'تذكَّرْ. تأمَّلْ. <em>اِرتقِ.</em>'),
      pick({ l: { align: 'center', y: 0.075, size: 92 }, v: { align: 'center', y: 0.085, size: 86 }, s: { align: 'center', y: 0.06, size: 74 } }));
    const T5 = headline(tx('More ways to<br><em>stay connected.</em>', 'طرقٌ أكثرُ<br><em>لتبقى قريبًا.</em>'),
      pick({ l: { x: 0.07, y: 0.36, size: 100 }, v: { align: 'center', y: 0.075, size: 96 }, s: { align: 'center', y: 0.05, size: 72 } }));
    const T5b = headline(tx('In your <em>own language.</em>', 'بِلُغَتِكَ <em>المفضّلة.</em>'),
      pick({ l: { align: 'center', y: 0.07, size: 84 }, v: { align: 'center', y: 0.14, size: 88 }, s: { align: 'center', y: 0.07, size: 70 } }));
    const T6 = headline(tx('Made for your<br><em>everyday journey.</em>', 'رَفِيقُكَ<br><em>في كلِّ يوم.</em>'),
      pick({ l: { x: 0.07, y: 0.34, size: 100 }, v: { align: 'center', y: 0.075, size: 96 }, s: { align: 'center', y: 0.05, size: 72 } }));

    // ---- labels / chips -----------------------------------------------------
    const capsSize = pick({ l: 21, v: 24, s: 18 }), subSize = pick({ l: 19, v: 22, s: 16 });
    const lab = (title, sub) => label(`${title}<span class="sub" style="font-size:${subSize / capsSize}em">${sub}</span>`, capsSize);
    const carLabels = [
      lab(tx('Daily Adhkar', 'أذكار اليوم'), tx('Morning, evening &amp; after-prayer remembrance', 'أذكار الصباح والمساء وبعد الصلاة')),
      lab(tx('Hisn Al-Muslim', 'حصن المسلم'), tx('The complete book of supplications', 'الكتاب الكامل للأدعية')),
      lab(tx('Smart Tasbeeh', 'المسبحة الذكية'), tx('Daily targets and lifetime statistics', 'أهداف يومية وإحصاءات دائمة')),
      lab(tx('Memorization', 'الحفظ'), tx('Verse repetition by surah, juz or page', 'تكرار الآيات بالسورة أو الجزء أو الصفحة')),
    ];
    const moreLabels = [
      lab(tx('Hadith', 'الحديث'), tx('Search the major collections', 'ابحث في كتب السنّة')),
      lab(tx('Qibla', 'القبلة'), tx('Live compass direction', 'بوصلة وواقع معزّز')),
      lab(tx('Quran Radio', 'إذاعة القرآن'), tx('Live stations, 24/7', 'بثّ مباشر على مدار الساعة')),
    ];
    const chipSize = pick({ l: 22, v: 26, s: 18 });
    const dot = '<i></i>';
    const chips3 = [chip(dot + tx('5 Mushaf styles', '٥ أنماط للمصحف'), chipSize), chip(dot + tx('Tafsir &amp; bookmarks', 'التفاسير والعلامات'), chipSize)];
    const chips3b = [chip(dot + tx('Multiple reciters', 'قرّاء متعدّدون'), chipSize), chip(dot + tx('Background playback', 'تشغيل في الخلفية'), chipSize)];
    const offIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="#e6cf9c" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 2l20 20"/><path d="M17.5 17.5H7a5 5 0 0 1-1.6-9.74"/><path d="M9.2 5.3A7 7 0 0 1 21 11.3a4 4 0 0 1-1.2 5.3"/></svg>';
    const globe = '<svg viewBox="0 0 24 24" fill="none" stroke="#e6cf9c" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>';
    const chipsLang = [chip(globe + tx('Arabic · English · Turkish · Kurdish · Urdu', 'العربية · الإنجليزية · التركية · الكردية · الأردية'), chipSize), chip(offIcon + tx('Works offline', 'يعمل دون إنترنت'), chipSize)];
    const deskCaps = [
      label(tx('Dawn', 'الفجر') + '<span class="sub" style="font-size:' + subSize / capsSize + 'em">' + tx('Prayer times &amp; morning remembrance', 'مواقيت الصلاة وأذكار الصباح') + '</span>', capsSize * 1.2),
      label(tx('Night', 'الليل') + '<span class="sub" style="font-size:' + subSize / capsSize + 'em">' + tx('Adhkar before sleep', 'أذكار النوم') + '</span>', capsSize * 1.2),
    ];
    if (!V && !SQ) deskCaps.forEach(d => (d.style.textAlign = AR ? 'right' : 'left'));

    // ---- brand end card -------------------------------------------------------
    const B = pick({
      l: { lx: 0.31, ly: 0, rx: 0.745, icon: 250, iconY: 0.25, nameY: 0.5, nameS: 116, arY: 0.615, arS: 66, ruleY: 0.695, tagY: 0.745, tagS: 22, benY: 0.82, benS: 25,
        ctaY: 0.165, ctaS: 54, qr: 330, qrY: 0.47, scanY: 0.655, badge: 330, badgeY: 0.765, urlY: 0.875, urlS: 20, shift: { x: 0.19, y: 0 } },
      v: { lx: 0.5, ly: 0, rx: 0.5, icon: 270, iconY: 0.155, nameY: 0.29, nameS: 122, arY: 0.35, arS: 74, ruleY: 0.393, tagY: 0.418, tagS: 26, benY: 0.46, benS: 29,
        ctaY: 0.545, ctaS: 62, qr: 420, qrY: 0.675, scanY: 0.79, badge: 430, badgeY: 0.855, urlY: 0.928, urlS: 25, shift: { x: 0, y: 0.13 } },
      s: { lx: 0.3, ly: 0, rx: 0.755, icon: 190, iconY: 0.22, nameY: 0.45, nameS: 84, arY: 0.555, arS: 52, ruleY: 0.625, tagY: 0.675, tagS: 16, benY: 0.75, benS: 18,
        ctaY: 0.15, ctaS: 40, qr: 300, qrY: 0.44, scanY: 0.61, badge: 300, badgeY: 0.715, urlY: 0.82, urlS: 13.5, shift: { x: 0.2, y: 0 } },
    });
    if (AR) { B.lx = 1 - B.lx; B.rx = 1 - B.rx; B.shift = { x: -B.shift.x, y: B.shift.y }; }
    const icon = el('div', 'icon', type, '<img src="../assets/brand/app-icon-1024.png"><div class="sweep"></div>');
    Object.assign(icon.style, { width: B.icon * u + 'px', height: B.icon * u + 'px' });
    const sweep = icon.querySelector('.sweep');
    const nameEn = el('div', 'brand-name', type);
    // Arabic cut leads with the Arabic name; the Latin name becomes the subtitle.
    if (AR) { nameEn.classList.add('ar-display'); }
    const nameEnT = makeText(nameEn, tx('Zad Al-Muslim', 'زادُ المسلم'));
    nameEnT.style.position = 'relative';
    if (AR) nameEnT.style.direction = 'rtl';
    nameEn.style.fontSize = B.nameS * u + 'px';
    const nameAr = el('div', AR ? 'brand-name' : 'brand-ar', type, tx('زاد المسلم', 'Zad Al-Muslim'));
    if (AR) nameAr.style.color = 'var(--gold-soft)';
    nameAr.style.fontSize = B.arS * u + 'px';
    const rule = el('div', 'rule', type);
    rule.style.width = 380 * u * (SQ ? 0.75 : 1) + 'px';
    const tag = el('div', 'label', type, tx('Your All-in-One Islamic Companion', 'رَفِيقُكَ الإسلاميّ المتكامل'));
    tag.style.fontSize = B.tagS * u * (AR ? 1.45 : 1) + 'px';
    tag.style.color = 'var(--ivory)';
    const ben = el('div', 'label', type);
    ben.style.fontSize = B.benS * u * (AR ? 1.3 : 1) + 'px';
    ben.style.color = 'var(--gold-soft)';
    if (AR) ben.style.direction = 'rtl';
    const benItems = (AR ? ['مَجّاني', 'بلا إعلانات', 'يعمل دون إنترنت'] : ['Free', 'Ad-Free', 'Works Offline']).map((s, i) => {
      if (i) el('span', 'sep', ben, '&nbsp;&nbsp;•&nbsp;&nbsp;');
      return el('span', '', ben, s);
    });
    const benSeps = [...ben.querySelectorAll('.sep')];
    const cta = el('div', 'brand-name', type);
    if (AR) cta.classList.add('ar-display');
    // U+00A0 keeps "Google Play" one token, so RTL word order can't flip it
    const ctaT = makeText(cta, tx('Download on <em>Google Play</em>', 'حمِّله الآن من <em>Google\u00a0Play</em>'));
    if (AR) ctaT.style.direction = 'rtl';
    ctaT.style.position = 'relative';
    cta.style.fontSize = B.ctaS * u + 'px';
    cta.style.fontWeight = 500;
    const qr = el('div', 'qr-card', type, '<img src="../assets/brand/qr-google-play.png">');
    Object.assign(qr.style, { width: B.qr * u + 'px', height: B.qr * u + 'px' });
    const scan = el('div', 'label', type, tx('Scan to install', 'امسح الرمز للتثبيت'));
    scan.style.fontSize = (SQ ? 14 : 18) * u * (AR ? 1.3 : 1) + 'px';
    const badge = el('div', 'badge', type, `<img src="../assets/brand/google-play-badge${AR ? '-ar' : ''}-cropped.png">`);
    badge.style.width = B.badge * u + 'px';
    const URL_TXT = 'play.google.com/store/apps/details?id=io.github.solimananas.twa';
    const url = el('div', 'url', type, SQ ? 'play.google.com/store/apps/details<br>?id=io.github.solimananas.twa' : URL_TXT);
    Object.assign(url.style, { fontSize: B.urlS * u + 'px', textAlign: 'center', lineHeight: 1.5, direction: 'ltr' });

    // ======================================================================
    const resettable = [...type.children].filter(e => !e.classList.contains('txt'));
    function render(t) {
      resettable.forEach(e => { e.style.visibility = 'hidden'; e.style.opacity = 0; });
      const S = {
        dawn: 0, winFlicker: 1, dustAmt: 1, storm: 0, black: 0, point: 0, pointGrow: 0, lineGrow: 0,
        studio: 0, lightX: 0.5, lightY: 0.05, spot: 1, archEcho: 0, echoX: 0.5, camX: 0, bokeh: 0,
        mushaf: 0, mushafX: 0.3, mushafScale: 1.2, mushafDrift: 0, rings: 0, motes: 0,
        brand: 0, brandLX: 0.5, brandLY: 0.42, rays: 1, cam: { s: 1, x: 0, y: 0 },
      };

      // ---------------- S1: hook -------------------------------------------
      const stormOn = prog(t, 2.25, 3.2);
      S.dawn = ease.out(prog(t, 0.15, 2.4)) * (1 - 0.5 * stormOn) * (t < 4.24 ? 1 : 0);
      S.winFlicker = 1 - stormOn * 0.25 * (0.5 + 0.5 * Math.sin(t * 41));
      S.storm = t < 4.25 ? prog(t, 2.15, 2.5) : 0;
      S.cam.s = t < 4.25 ? lerp(1, 1.07, ease.inOut(prog(t, 0, 4.25))) : 1;
      if (t > 2.4 && t < 4.24) {
        const k = stormOn * 3 * u;
        S.cam.x = Math.sin(t * 23) * k; S.cam.y = Math.cos(t * 19) * k;
      }
      playText(T1, t, 0.5, 3.7, { stagger: 0.16, dur: 1.2, outDur: 0.45 });
      // the hush: black, then a single point of light
      if (t >= 4.24 && t < 5.9) S.black = 1 - ease.inOut(prog(t, 4.6, 5.9));

      // ---------------- S2: the shift --------------------------------------
      const heroX = pick({ l: 0.2 * W, v: 0, s: 0 }) * M, heroY = pick({ l: 0.02 * H, v: 0.13 * H, s: 0.15 * H });
      S.point = tween(t, 4.38, 4.5, 0, 1) * (1 - ease.inOut(prog(t, 5.0, 5.9)));
      S.pointGrow = ease.outExpo(prog(t, 4.4, 5.2));
      S.lineGrow = ease.outExpo(prog(t, 4.45, 5.4)) * (1 - prog(t, 5.4, 5.9) * 0.5);
      S.pointX = W / 2 + heroX; S.pointY = H / 2 + heroY;
      const studioIn = ease.inOut(prog(t, 4.7, 6.2));
      const studioOut = 1 - ease.inOut(prog(t, 28.8, 29.6));
      S.studio = studioIn * studioOut;
      S.lightX = 0.5 + heroX / W;
      S.archEcho = studioIn * (1 - prog(t, 14.6, 15.4)) + prog(t, 21.8, 22.6) * (1 - prog(t, 25.8, 26.4));
      S.echoX = pick({ l: 0.7, v: 0.5, s: 0.5 });
      if (AR) S.echoX = 1 - S.echoX;
      S.bokeh = studioIn * studioOut;
      playText(T2, t, 5.35, 7.45, { stagger: 0.1 });

      // hero phone pose through S2 → S3
      let hp = { o: 0 };
      if (t > 4.6 && t < 15.6) {
        const p2 = ease.outQuint(prog(t, 4.7, 8.2));
        hp = {
          x: heroX * M, y: heroY + Math.sin(t * 0.7) * 5 * u,
          z: lerp(-700, 0, p2), ry: lerp(-30, -8, p2), rx: lerp(12, 3, p2), rz: lerp(-3, 0, p2),
          o: ease.inOut(prog(t, 4.75, 5.7)), blur: lerp(16, 0, ease.out(prog(t, 4.7, 6.0))), bright: lerp(0.4, 1, ease.out(prog(t, 4.7, 6.4))),
        };
        // S3 settle + making room for the audio phone
        const p3 = ease.inOut(prog(t, 8.0, 9.4));
        hp.ry = lerp(hp.ry, -3, p3);
        hp.x = lerp(hp.x, pick({ l: 0.16 * W, v: 0, s: 0 }), p3);
        const pa = ease.inOut(prog(t, 11.0, 12.1));
        hp.x = lerp(hp.x, pick({ l: 0.05 * W, v: -0.19 * W, s: -0.17 * W }), pa);
        hp.z = lerp(hp.z, -260, pa); hp.ry = lerp(hp.ry, 14, pa);
        hp.bright = lerp(hp.bright, 0.62, pa);
        // exit
        const pe = ease.in(prog(t, 14.55, 15.3));
        hp.y -= pe * 0.12 * H; hp.o *= 1 - pe; hp.blur += pe * 10;
      }
      hero.pose(hp);
      // hero screen: home → tap "The Noble Quran" → Mushaf page 1 → page 2
      hero.tap(AR ? 0.6 : 0.4, 0.265, prog(t, 7.3, 7.85));
      const nav = ease.inOut(prog(t, 7.75, 8.35));
      const turn = ease.inOut(prog(t, 10.0, 10.65));
      hero.show({
        [sn('home-en')]: { o: nav < 1 ? 1 : 0, s: 1 - nav * 0.06 },
        'quran-p1': { o: nav > 0 ? 1 : 0, y: (1 - nav) * 100, x: turn * 100 },
        'quran-p2': { o: turn > 0 ? 1 : 0, x: -100 + turn * 100 },
      });
      hero.dim(nav * (1 - nav) * 0.8);

      // ---------------- S3: the Quran --------------------------------------
      S.mushaf = win(t, 7.9, 15.2, 1.0, 0.8);
      S.mushafX = pick({ l: 0.28, v: 0.5, s: 0.5 });
      if (AR) S.mushafX = 1 - S.mushafX;
      S.mushafScale = lerp(1.25, 1.4, prog(t, 7.9, 15.2)) * (V ? 1.6 : 1);
      S.mushafDrift = lerp(0.03, -0.03, prog(t, 7.9, 15.2));
      playText(T3, t, 8.5, 14.45, { stagger: 0.1 });
      // audio phone
      let ap = { o: 0 };
      if (t > 10.9 && t < 15.6) {
        const pa = ease.outQuint(prog(t, 11.0, 12.4));
        const pe = ease.in(prog(t, 14.45, 15.2));
        ap = {
          x: lerp(pick({ l: 0.52 * W, v: 0.6 * W, s: 0.6 * W }), pick({ l: 0.29 * W, v: 0.19 * W, s: 0.19 * W }), pa),
          y: heroY + pick({ l: 0.01 * H, v: 0.03 * H, s: 0.03 * H }) - pe * 0.12 * H + Math.sin(t * 0.8 + 1) * 5 * u,
          z: lerp(-200, 40, pa), ry: lerp(-30, -10, pa), rx: 2,
          o: ease.inOut(prog(t, 11.0, 11.6)) * (1 - pe), blur: pe * 10,
        };
      }
      audio.pose(ap);
      audio.show({ [sn('audio')]: { o: 1 } });
      S.rings = win(t, 11.8, 15.0, 0.8, 0.6);
      S.ringsX = W / 2 + (ap.x || 0) * M; S.ringsY = H / 2 + (ap.y || 0) - hHero * 0.27;
      // chips
      const chipPos = (list, t0, t1) => list.forEach((c, i) => {
        const o = win(t, t0 + i * 0.15, t1, 0.6, 0.5);
        const r = c._wh || (c._wh = [c.offsetWidth, c.offsetHeight]);
        let x, y;
        if (V || SQ) {
          const gap = 18 * u, total = list.reduce((a, cc) => a + (cc._wh ? cc._wh[0] : cc.offsetWidth), 0) + gap;
          x = W / 2 - total / 2 + (i ? list[0]._wh[0] + gap : 0);
          y = pick({ v: 0.205, s: 0.235 }) * H;
        } else {
          x = 0.07 * W; y = (AR ? 0.63 : 0.58) * H + i * (r[1] + 16 * u);
        }
        set(c, { x: mx(x, r[0]), y: y + (1 - ease.out(prog(t, t0 + i * 0.15, t0 + i * 0.15 + 0.6))) * 14 * u, o });
      });
      chipPos(chips3, 9.4, 11.0);
      chipPos(chips3b, 11.9, 14.45);

      // ---------------- S4: Remember. Reflect. Grow. ------------------------
      playText(T4, t, 15.25, 21.55, { stagger: 2.2, dur: 1.0 });
      const c = track(t, [[14.9, -1.2], [15.9, 0, ease.outQuint], [16.7, 0], [17.35, 1], [18.25, 1], [18.9, 2], [20.15, 2], [20.8, 3], [21.6, 3], [22.4, 4.2, ease.in]]);
      const carOn = ease.inOut(prog(t, 14.9, 15.6)) * (1 - ease.inOut(prog(t, 21.65, 22.35)));
      const sp = pick({ l: 0.2 * W, v: 0.56 * W, s: 0.36 * W });
      const carY = pick({ l: 0.065 * H, v: 0.025 * H, s: 0.05 * H });
      car.forEach((ph, i) => {
        const d = i - c, ad = Math.abs(d);
        if (carOn <= 0.001 || ad > 2.6) { ph.pose({ o: 0 }); return; }
        ph.pose({
          x: d * sp, y: carY + Math.sin(t * 0.7 + i) * 4 * u, z: -ad * 420, ry: -d * 24, rx: 2,
          o: carOn * clamp(1.4 - ad * 0.55), blur: Math.min(ad, 2) * 2.2, bright: 1 - Math.min(ad, 1.5) * 0.35,
        });
        const lo = carOn * clamp(1 - ad * 2.6);
        at(carLabels[i], W / 2, H / 2 + carY + hCar / 2 + pick({ l: 48, v: 70, s: 44 }) * u, lo);
      });
      car[0].show({ [sn('azkar')]: { o: 1 } });
      car[1].show({ [sn('hisn')]: { o: 1 } });
      const mStep = Math.floor(clamp((t - 19.0) / 0.26, 0, 3));
      car[2].show({ [sn(`masbaha-${30 + mStep}`)]: { o: 1 } });
      car[2].tap(0.5, 0.42, t > 19.0 && t < 19.8 ? ((t - 19.0) % 0.26) / 0.26 : 0);
      car[3].show({ [sn('takrar')]: { o: 1 } });

      // ---------------- S5: more ways to stay connected --------------------
      playText(T5, t, 22.3, 25.75, { stagger: 0.1 });
      const mxs = pick({ l: [0.03, 0.19, 0.35], v: [-0.3, 0, 0.3], s: [-0.28, 0, 0.28] });
      const mBaseY = pick({ l: 0.03 * H, v: 0.05 * H, s: 0.1 * H });
      more.forEach((ph, i) => {
        const t0 = 22.3 + i * 0.7;
        const pin = ease.outQuint(prog(t, t0, t0 + 1.1));
        const pout = ease.in(prog(t, 25.85, 26.5));
        if (t < t0 || pout >= 1) { ph.pose({ o: 0 }); moreLabels[i].style.visibility = 'hidden'; return; }
        const mid = i === 1;
        const y = mBaseY + (mid ? -0.02 * H : 0) + (1 - pin) * 0.14 * H + pout * 0.08 * H + Math.sin(t * 0.7 + i * 2) * 4 * u;
        ph.pose({
          x: mxs[i] * W + (V || SQ ? 0 : -(t - 22) * 6 * u), y, z: (mid ? 60 : -30) - (1 - pin) * 200, ry: V || SQ ? (i - 1) * -14 : -12, rx: 2,
          o: ease.inOut(prog(t, t0, t0 + 0.6)) * (1 - pout), blur: (1 - pin) * 12 + pout * 8,
        });
        const lo = ease.inOut(prog(t, t0 + 0.45, t0 + 1.0)) * (1 - pout);
        at(moreLabels[i], W / 2 + mxs[i] * W * M, H / 2 + mBaseY + hMore / 2 + pick({ l: 46, v: 56, s: 40 }) * u + (1 - pin) * 20, lo);
      });
      // languages fan
      playText(T5b, t, 26.3, 28.75, { stagger: 0.1 });
      const fanSp = pick({ l: 0.145 * W, v: 0.17 * W, s: 0.16 * W });
      const fanY = pick({ l: 0.07 * H, v: 0.07 * H, s: 0.08 * H });
      langs.forEach((ph, i) => {
        const d = i - 2, ad = Math.abs(d);
        const t0 = 26.25 + ad * 0.14;
        const pin = ease.outQuint(prog(t, t0, t0 + 1.0));
        const pout = ease.in(prog(t, 28.7, 29.3));
        if (t < t0 || pout >= 1) { ph.pose({ o: 0 }); return; }
        ph.pose({
          x: d * fanSp * lerp(0.6, 1, pin), y: fanY + ad * ad * 16 * u + (1 - pin) * 0.1 * H - pout * 0.05 * H,
          z: -ad * 150 + pout * 120, rz: d * 5 * pin, ry: -d * 6, rx: 2,
          o: ease.inOut(prog(t, t0, t0 + 0.5)) * (1 - pout), blur: (1 - pin) * 10 + pout * 6, bright: 1 - ad * 0.1,
        });
        ph.show({ [ph.layers['home-en'] ? 'home-en' : Object.keys(ph.layers)[0]]: { o: 1 } });
      });
      more.forEach((ph, i) => ph.show({ [Object.keys(ph.layers)[0]]: { o: 1 } }));
      chipsLang.forEach((cp, i) => {
        const r = cp._wh || (cp._wh = [cp.offsetWidth, cp.offsetHeight]);
        const o = win(t, 26.9 + i * 0.25, 29.0, 0.6, 0.45);
        let x, y;
        const gap = 18 * u;
        if (V) { x = W / 2 - r[0] / 2; y = 0.835 * H + i * (r[1] + gap); }
        else {
          const total = chipsLang[0]._wh[0] + (chipsLang[1]._wh || [chipsLang[1].offsetWidth])[0] + gap;
          x = W / 2 - total / 2 + (i ? chipsLang[0]._wh[0] + gap : 0); y = pick({ l: 0.885, s: 0.885 }) * H;
        }
        set(cp, { x: mx(x, r[0]), y: y + (1 - ease.out(prog(t, 26.9 + i * 0.25, 27.6 + i * 0.25))) * 12 * u, o });
      });

      // ---------------- S6: the daily ritual --------------------------------
      const dIn = ease.inOut(prog(t, 28.9, 29.8)), dOut = 1 - ease.inOut(prog(t, 34.6, 35.4));
      const dO = dIn * dOut;
      if (dO > 0.001) {
        const pd = prog(t, 29, 35.4);
        set(plane, {
          x: pick({ l: 0.13 * W, v: 0, s: 0.05 * W }) * M, y: pick({ l: 0.06 * H, v: 0.1 * H, s: 0.12 * H }), z: lerp(-80, 60, ease.inOutSine(pd)),
          rx: lerp(52, 44, ease.inOutSine(pd)), rz: lerp(-16, -7, ease.inOutSine(pd)) * M, o: dO,
        });
        desk.pose({ z: hDesk * 0.02, rz: -6 });
        const toNight = ease.inOut(prog(t, 31.6, 33.0));
        desk.show({ [sn('home-en')]: { o: 1 }, [sn('sleeping')]: { o: toNight } });
        set(gobo, { x: lerp(-0.05, 0.25, pd) * PW, y: lerp(0.05, 0.25, pd) * PH, z: 1, o: 0.95 * (1 - toNight) });
        warm.style.opacity = (1 - toNight).toFixed(3);
        night.style.opacity = (toNight * 0.92).toFixed(3);
        screenGlow.style.opacity = (0.25 + toNight * 0.75).toFixed(3);
      } else {
        set(plane, { o: 0 });
      }
      set(scrim, { o: dO });
      playText(T6, t, 29.45, 34.45, { stagger: 0.1 });
      deskCaps.forEach((d, i) => {
        const o = i === 0 ? win(t, 30.0, 32.0, 0.6, 0.5) : win(t, 32.6, 34.6, 0.6, 0.5);
        if (V || SQ) at(d, W / 2, pick({ v: 0.92, s: 0.93 }) * H, o);
        else { const r = d._wh || (d._wh = [d.offsetWidth, d.offsetHeight]); set(d, { x: mx(0.07 * W, r[0]), y: 0.64 * H, o }); }
      });
      // a soft dip between ritual and brand
      if (t > 34.5 && t < 35.8) S.black = Math.max(S.black, 0.6 * Math.sin(Math.PI * prog(t, 34.5, 35.8)));

      // ---------------- S7: brand reveal & call to action ------------------
      S.brand = ease.inOut(prog(t, 34.9, 35.8));
      S.motes = ease.inOut(prog(t, 35.2, 36.5));
      S.rays = 0.6 + 0.4 * Math.sin(t * 0.5);
      const slide = ease.inOut(prog(t, 39.4, 40.5));
      const offX = (1 - slide) * B.shift.x * W, offY = (1 - slide) * B.shift.y * H;
      S.brandLX = B.lx + offX / W; S.brandLY = B.iconY + offY / H;
      const breathe = 1 + 0.012 * ease.inOutSine(prog(t, 40.5, 45));
      const lx = B.lx * W + offX;
      const ip = ease.outQuint(prog(t, 35.25, 36.6));
      at(icon, lx, B.iconY * H + offY, ease.inOut(prog(t, 35.25, 35.9)), { s: lerp(0.84, 1, ip) * breathe, blur: lerp(14, 0, ip) });
      set(sweep, { x: lerp(-1.4, 1.4, ease.inOut(prog(t, 36.0, 37.1))) * B.icon * u });
      at(nameEn, lx, B.nameY * H + offY, t > 35.9 ? 1 : 0);
      playText(nameEnT, t, 36.0, undefined, { stagger: 0.14, dur: 1.0 });
      at(nameAr, lx, B.arY * H + offY, ease.inOut(prog(t, 36.6, 37.4)), { s: 1 });
      nameAr.style.transform += ` translateY(${((1 - ease.out(prog(t, 36.6, 37.4))) * 16 * u).toFixed(2)}px)`;
      at(rule, lx, B.ruleY * H + offY, ease.inOut(prog(t, 37.1, 37.8)));
      rule.style.transform += ` scaleX(${ease.inOut(prog(t, 37.1, 38.0)).toFixed(3)})`;
      at(tag, lx, B.tagY * H + offY, ease.inOut(prog(t, 37.35, 38.2)));
      // (Arabic must never be letter-spaced: it breaks the joining)
      if (!AR) tag.style.letterSpacing = lerp(0.5, 0.3, ease.out(prog(t, 37.35, 38.6))).toFixed(3) + 'em';
      at(ben, lx, B.benY * H + offY, t > 39.6 ? 1 : 0);
      [39.7, 40.4, 41.25].forEach((t0, i) => {
        const p = ease.out(prog(t, t0, t0 + 0.7));
        benItems[i].style.opacity = p.toFixed(3);
        benItems[i].style.filter = p < 1 ? `blur(${((1 - p) * 6).toFixed(2)}px)` : 'none';
        if (i) benSeps[i - 1].style.opacity = p.toFixed(3);
      });
      ben.style.visibility = t > 39.6 ? 'visible' : 'hidden';
      // right column (or lower block in vertical)
      const rx = B.rx * W;
      at(cta, rx, B.ctaY * H, t > 40.35 ? 1 : 0);
      playText(ctaT, t, 40.4, undefined, { stagger: 0.12, dur: 1.0 });
      const qp = ease.outQuint(prog(t, 40.6, 41.8));
      at(qr, rx, B.qrY * H, ease.inOut(prog(t, 40.6, 41.2)), { s: lerp(0.9, 1, qp) });
      at(scan, rx, B.scanY * H, ease.inOut(prog(t, 41.1, 41.8)));
      const bp = ease.outQuint(prog(t, 42.4, 43.4));
      at(badge, rx, B.badgeY * H, ease.inOut(prog(t, 42.4, 42.9)), { s: lerp(0.92, 1, bp) });
      at(url, rx, B.urlY * H, ease.inOut(prog(t, 42.8, 43.5)));

      return S;
    }
    return render;
  }

  window.buildScenes = buildScenes;
})();
