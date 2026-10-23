// Deterministic animation helpers. Every visual is a pure function of time t
// (seconds), so any frame can be rendered in any order, in any worker.
(function () {
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  // progress of t through [t0, t1], 0..1
  const prog = (t, t0, t1) => clamp((t - t0) / (t1 - t0));

  const ease = {
    linear: p => p,
    inOut: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    out: p => 1 - Math.pow(1 - p, 3),
    outQuint: p => 1 - Math.pow(1 - p, 5),
    in: p => p * p * p,
    outExpo: p => (p === 1 ? 1 : 1 - Math.pow(2, -10 * p)),
    inOutSine: p => -(Math.cos(Math.PI * p) - 1) / 2,
    // gentle overshoot used sparingly for UI "settle"
    outBack: p => { const c1 = 1.2, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
  };

  // eased value from a -> b over [t0, t1]
  const tween = (t, t0, t1, a, b, fn = ease.inOut) => lerp(a, b, fn(prog(t, t0, t1)));

  // Keyframe track: [[time, value], ...] with per-segment easing.
  function track(t, keys, fn = ease.inOut) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const [t0, a] = keys[i - 1], [t1, b, f] = keys[i];
        return lerp(a, b, (f || fn)(prog(t, t0, t1)));
      }
    }
    return keys[keys.length - 1][1];
  }

  // fade in over [a, a+fi], hold, fade out over [b-fo, b]
  const window_ = (t, a, b, fi = 0.5, fo = 0.5) =>
    Math.min(ease.inOut(prog(t, a, a + fi)), 1 - ease.inOut(prog(t, b - fo, b)));

  // Seeded PRNG (mulberry32)
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let r = Math.imul(s ^ (s >>> 15), 1 | s);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Apply a transform/opacity/filter description to an element.
  function set(el, o) {
    const tr = [];
    if (o.x !== undefined || o.y !== undefined || o.z !== undefined)
      tr.push(`translate3d(${(o.x || 0).toFixed(2)}px, ${(o.y || 0).toFixed(2)}px, ${(o.z || 0).toFixed(2)}px)`);
    if (o.rx) tr.push(`rotateX(${o.rx.toFixed(3)}deg)`);
    if (o.ry) tr.push(`rotateY(${o.ry.toFixed(3)}deg)`);
    if (o.rz) tr.push(`rotateZ(${o.rz.toFixed(3)}deg)`);
    if (o.s !== undefined) tr.push(`scale(${o.s.toFixed(4)})`);
    el.style.transform = tr.join(' ');
    if (o.o !== undefined) {
      el.style.opacity = o.o.toFixed(4);
      el.style.visibility = o.o <= 0.001 ? 'hidden' : 'visible';
    }
    if (o.blur !== undefined || o.bright !== undefined) {
      const f = [];
      if (o.blur > 0.05) f.push(`blur(${o.blur.toFixed(2)}px)`);
      if (o.bright !== undefined && Math.abs(o.bright - 1) > 0.002) f.push(`brightness(${o.bright.toFixed(3)})`);
      el.style.filter = f.join(' ') || 'none';
    }
  }

  function el(tag, cls, parent, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }

  // ---- Kinetic type: words rise out of a soft blur, one after another.
  function makeText(parent, html, cls) {
    const box = el('div', 'txt ' + (cls || ''), parent);
    // Keep explicit <br> line breaks; split each line into word spans.
    html.split('<br>').forEach((line, li) => {
      if (li) box.appendChild(document.createElement('br'));
      // allow <em>..</em> around words
      const tokens = line.match(/<em>.*?<\/em>|\S+/g) || [];
      tokens.forEach((tok, i) => {
        const em = tok.startsWith('<em>');
        const words = em ? tok.slice(4, -5).split(' ') : [tok];
        words.forEach(w => {
          const wrap = el('span', 'w' + (em ? ' em' : ''), box);
          el('span', 'wi', wrap, w);
          box.appendChild(document.createTextNode(' '));
        });
      });
    });
    box._words = [...box.querySelectorAll('.wi')];
    return box;
  }

  // in: [t0, t0+dur] staggered; out: fade/rise all words over [t1, t1+0.6]
  function playText(box, t, t0, t1, opts = {}) {
    const st = opts.stagger ?? 0.09, dur = opts.dur ?? 0.9, rise = opts.rise ?? 0.42;
    let any = false;
    box._words.forEach((w, i) => {
      const p = ease.outQuint(prog(t, t0 + i * st, t0 + i * st + dur));
      const q = t1 === undefined ? 0 : ease.inOut(prog(t, t1 + i * 0.03, t1 + i * 0.03 + (opts.outDur ?? 0.6)));
      const o = p * (1 - q);
      if (o > 0.001) any = true;
      w.style.opacity = o.toFixed(3);
      w.style.transform = `translateY(${((1 - p) * rise - q * 0.25).toFixed(3)}em)`;
      const b = (1 - p) * 10 + q * 8;
      w.style.filter = b > 0.1 ? `blur(${b.toFixed(2)}px)` : 'none';
    });
    box.style.visibility = any ? 'visible' : 'hidden';
  }

  window.K = { clamp, lerp, prog, ease, tween, track, window: window_, rng, set, el, makeText, playText };
})();
