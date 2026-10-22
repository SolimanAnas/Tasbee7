// A premium phone mockup built from DOM layers: stacked edge layers give real
// thickness under CSS 3D rotation, a brushed-metal frame, a glass glare that
// tracks the rotation, and a stack of genuine app screenshots as screen layers.
(function () {
  const { el, set } = K;
  const CAP_RATIO = 412 / 892;     // genuine capture viewport
  const BAND = 0.05;               // status-bar band above the web capture
  const SCREEN_RATIO = 412 / (892 * (1 + BAND));
  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  // colour of the capture's top-left pixel, used to fill the status-bar band
  function topColor(img) {
    probe.clearRect(0, 0, 1, 1);
    probe.drawImage(img, 0, 0, 4, 4, 0, 0, 1, 1);
    const d = probe.getImageData(0, 0, 1, 1).data;
    return `rgb(${d[0]},${d[1]},${d[2]})`;
  }

  function makePhone(parent, height, screens, opts = {}) {
    const pad = height * 0.016;
    const sh = height - pad * 2, sw = sh * SCREEN_RATIO;
    const w = sw + pad * 2;
    const r = height * 0.072, rs = r - pad * 0.9;
    const depth = height * 0.018;

    const root = el('div', 'phone', parent);
    Object.assign(root.style, { width: w + 'px', height: height + 'px', marginLeft: -w / 2 + 'px', marginTop: -height / 2 + 'px' });

    // contact shadow (rendered in phone space, far behind)
    const shadow = el('div', 'ph-shadow', root);
    Object.assign(shadow.style, { borderRadius: r + 'px', transform: `translateZ(${-depth * 1.2}px)` });

    // edge layers → thickness
    const N = 7;
    for (let i = N; i >= 1; i--) {
      const L = el('div', 'ph-edge', root);
      const k = i / N;
      L.style.borderRadius = r + 'px';
      L.style.transform = `translateZ(${(-depth * k).toFixed(2)}px)`;
      L.style.background = `linear-gradient(135deg, hsl(160 8% ${14 + 10 * (1 - k)}%), hsl(160 10% ${6 + 5 * (1 - k)}%) 45%, hsl(160 8% ${12 + 8 * (1 - k)}%) 80%)`;
    }
    const body = el('div', 'ph-body', root);
    body.style.borderRadius = r + 'px';

    // side buttons
    const btn = (side, top, len) => {
      const b = el('div', 'ph-btn', root);
      Object.assign(b.style, {
        [side]: -height * 0.004 + 'px', top: top * height + 'px', height: len * height + 'px',
        width: height * 0.006 + 'px', transform: `translateZ(${-depth * 0.5}px)`,
      });
    };
    btn('left', 0.2, 0.05); btn('left', 0.28, 0.08); btn('right', 0.24, 0.11);

    const screen = el('div', 'ph-screen', root);
    Object.assign(screen.style, { left: pad + 'px', top: pad + 'px', width: sw + 'px', height: sh + 'px', borderRadius: rs + 'px' });

    const layers = {};
    const imgH = sw / CAP_RATIO;
    screens.forEach(name => {
      const wrap = el('div', 'ph-layer', screen);
      const img = el('img', 'ph-img', wrap);
      img.src = `../assets/screens/${name}.png`;
      Object.assign(img.style, { top: sh - imgH + 'px', height: imgH + 'px' });
      wrap.style.visibility = 'hidden';
      wrap._img = img;
      layers[name] = wrap;
    });

    const ripple = el('div', 'ph-ripple', screen);
    const dim = el('div', 'ph-dim', screen);
    const glare = el('div', 'ph-glare', screen);
    const island = el('div', 'ph-island', root);
    Object.assign(island.style, {
      width: sw * 0.27 + 'px', height: sw * 0.075 + 'px', top: pad + sh * 0.012 + 'px',
      marginLeft: -sw * 0.135 + 'px', borderRadius: sw + 'px',
    });

    return {
      root, screen, layers, w, h: height, sw, sh,
      // pose: {x, y, z, rx, ry, rz, s, o}
      pose(p) {
        // brightness goes through the screen-dim overlay (a CSS filter here
        // would flatten the 3D edge layers)
        this._dimPose = p.bright !== undefined ? 1 - p.bright : 0;
        dim.style.opacity = this._dimPose.toFixed(3);
        set(root, Object.assign({}, p, { bright: undefined, blur: p.blur || 0 }));
        // glare drifts with yaw, giving a sense of glass under light
        const g = (p.ry || 0) * 1.6 + (p.glare || 0);
        glare.style.transform = `translateX(${g.toFixed(2)}%)`;
        glare.style.opacity = (0.55 + Math.abs(p.ry || 0) * 0.02).toFixed(3);
      },
      // screens: {name: {o, x, y, s}}  (x, y in % of the screen)
      show(state) {
        for (const name in layers) {
          const s = state[name];
          if (!s || s.o <= 0.001) { layers[name].style.visibility = 'hidden'; continue; }
          if (!layers[name]._bg) layers[name].style.background = layers[name]._bg = topColor(layers[name]._img);
          set(layers[name], { x: (s.x || 0) * sw / 100, y: (s.y || 0) * sh / 100, s: s.s ?? 1, o: s.o ?? 1 });
        }
      },
      // tap feedback at screen fraction (fx, fy), p in 0..1
      tap(fx, fy, p) {
        if (p <= 0 || p >= 1) { ripple.style.opacity = 0; return; }
        const d = sw * 0.32;
        Object.assign(ripple.style, {
          left: fx * sw - d / 2 + 'px', top: fy * sh - d / 2 + 'px', width: d + 'px', height: d + 'px',
          opacity: (Math.sin(p * Math.PI) * 0.55).toFixed(3), transform: `scale(${(0.25 + p * 0.9).toFixed(3)})`,
        });
      },
      dim(v) { dim.style.opacity = Math.max(v, this._dimPose || 0).toFixed(3); },
    };
  }

  window.makePhone = makePhone;
})();
