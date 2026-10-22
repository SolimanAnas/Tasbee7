// Procedural light & atmosphere drawn on canvas: the dawn arch window and its
// volumetric beam, dust motes, the "distraction" storm, bokeh, studio light,
// the desk texture for the everyday-ritual scene, and film grain.
// All sprites are pre-rendered once; per-frame work is cheap compositing.
(function () {
  const { clamp, lerp, prog, ease, rng } = K;

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    return c;
  }

  // Pointed (two-centred) arch outline. (cx, top) apex; w width; h total height.
  function archPath(ctx, cx, top, w, h) {
    const ys = top + w * 0.62, x0 = cx - w / 2, x1 = cx + w / 2, base = top + h;
    ctx.beginPath();
    ctx.moveTo(x0, base);
    ctx.lineTo(x0, ys);
    ctx.bezierCurveTo(x0, ys - (ys - top) * 0.58, cx - w * 0.2, top + (ys - top) * 0.1, cx, top);
    ctx.bezierCurveTo(cx + w * 0.2, top + (ys - top) * 0.1, x1, ys - (ys - top) * 0.58, x1, ys);
    ctx.lineTo(x1, base);
    ctx.closePath();
  }

  // Eight-point-star lattice (two overlapping squares per cell): restrained, geometric.
  function lattice(ctx, x, y, w, h, cell, lw, color) {
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = lw;
    for (let gy = y - cell; gy < y + h + cell; gy += cell) {
      for (let gx = x - cell; gx < x + w + cell; gx += cell) {
        const cx = gx + cell / 2, cy = gy + cell / 2, r = cell * 0.36;
        ctx.strokeRect(cx - r, cy - r, r * 2, r * 2);
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
        ctx.strokeRect(-r, -r, r * 2, r * 2); ctx.restore();
      }
    }
    ctx.restore();
  }

  const FX = {};

  FX.init = function (L, images) {
    const { W, H, u } = L;
    FX.L = L;
    const A = L.arch; // {cx, top, w, h}

    // --- lit arch window sprite (glass + lattice + bloom)
    const pad = A.w * 0.9;
    const win = canvas(A.w + pad * 2, A.h + pad * 2);
    let c = win.getContext('2d');
    const ox = pad - (A.cx - A.w / 2), oy = pad - A.top;
    c.translate(ox, oy);
    c.filter = `blur(${A.w * 0.22}px)`;
    archPath(c, A.cx, A.top, A.w * 1.04, A.h * 1.02);
    c.fillStyle = 'rgba(255, 196, 120, 0.55)'; c.fill();
    c.filter = 'none';
    c.save();
    archPath(c, A.cx, A.top, A.w, A.h); c.clip();
    const g = c.createLinearGradient(A.cx, A.top, A.cx, A.top + A.h);
    g.addColorStop(0, '#fff6e3'); g.addColorStop(0.45, '#ffd99a'); g.addColorStop(1, '#d9924a');
    c.fillStyle = g; c.fillRect(A.cx - A.w, A.top, A.w * 2, A.h);
    lattice(c, A.cx - A.w / 2, A.top, A.w, A.h, A.w / 6, Math.max(1.6, A.w * 0.012), 'rgba(24, 14, 4, 0.9)');
    c.restore();
    // frame line
    archPath(c, A.cx, A.top, A.w, A.h);
    c.strokeStyle = 'rgba(30, 20, 8, 1)'; c.lineWidth = A.w * 0.04; c.stroke();
    FX.win = { img: win, x: -ox, y: -oy };

    // --- volumetric beam: from the window, falling diagonally to the floor
    const beam = canvas(W / 2, H / 2);
    c = beam.getContext('2d');
    c.scale(0.5, 0.5);
    c.filter = `blur(${28 * u}px)`;
    const fx0 = L.beamTo.x, fy0 = L.beamTo.y, spread = L.beamTo.spread;
    const bg = c.createLinearGradient(A.cx, A.top + A.h * 0.3, fx0, fy0);
    bg.addColorStop(0, 'rgba(255, 214, 150, 0.5)');
    bg.addColorStop(0.55, 'rgba(255, 196, 120, 0.2)');
    bg.addColorStop(1, 'rgba(255, 180, 100, 0.0)');
    c.fillStyle = bg;
    c.beginPath();
    c.moveTo(A.cx - A.w * 0.5, A.top + A.h * 0.25);
    c.lineTo(A.cx + A.w * 0.5, A.top + A.h * 0.55);
    c.lineTo(A.cx + A.w * 0.5, A.top + A.h);
    c.lineTo(fx0 + spread * 0.5, fy0 + spread * 0.18);
    c.lineTo(fx0 - spread * 0.5, fy0 - spread * 0.1);
    c.closePath(); c.fill();
    // light pool on the floor: the arch, foreshortened
    c.save();
    c.translate(fx0, fy0); c.scale(1, 0.28); c.translate(-fx0, -fy0);
    archPath(c, fx0, fy0 - spread * 0.9, spread * 0.55, spread * 1.6);
    c.fillStyle = 'rgba(255, 200, 130, 0.38)'; c.fill();
    c.restore();
    FX.beam = beam;

    // --- soft round sprite for bokeh / glows
    const dot = canvas(128, 128);
    c = dot.getContext('2d');
    const rg = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.55, 'rgba(255,255,255,0.35)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = rg; c.fillRect(0, 0, 128, 128);
    FX.dot = dot;
    // disc bokeh (hard-ish edge, like a lens)
    const disc = canvas(128, 128);
    c = disc.getContext('2d');
    const dg = c.createRadialGradient(64, 64, 40, 64, 64, 62);
    dg.addColorStop(0, 'rgba(255,255,255,0.55)'); dg.addColorStop(0.85, 'rgba(255,255,255,0.75)'); dg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = dg; c.beginPath(); c.arc(64, 64, 62, 0, Math.PI * 2); c.fill();
    FX.disc = disc;

    // --- seeded particle sets
    let r = rng(11);
    FX.dust = Array.from({ length: 240 }, () => ({ s: r(), a: r() * 2 - 1, d: r(), sp: 0.3 + r() * 0.7, ph: r() * 6.28, z: r() }));
    r = rng(23);
    FX.cards = Array.from({ length: 46 }, (_, i) => ({
      t0: 2.15 + Math.pow(r(), 0.8) * 1.85, ang: r() * Math.PI * 2, sp: 0.35 + r() * 0.65, z: r(),
      w: 0.6 + r() * 0.5, rot: (r() - 0.5) * 0.5, kind: Math.floor(r() * 3), hue: [350, 210, 140, 40][Math.floor(r() * 4)],
    }));
    r = rng(5);
    FX.bokeh = Array.from({ length: 34 }, () => ({ x: r(), y: r(), z: r(), sz: 0.3 + r(), gold: r() < 0.5, ph: r() * 6.28 }));
    r = rng(91);
    FX.motes = Array.from({ length: 90 }, () => ({ x: r(), y: r(), z: r(), ph: r() * 6.28, sp: 0.2 + r() * 0.8 }));

    // --- blurred mushaf backdrop (scene 3)
    const mp = images['quran-p2'];
    if (mp) {
      const bw = W * 0.6, bh = bw * (mp.height / mp.width);
      const mb = canvas(bw, bh);
      c = mb.getContext('2d');
      c.filter = `blur(${10 * u}px) saturate(0.85)`;
      c.drawImage(mp, 0, 0, bw, bh);
      FX.mushaf = mb;
    }

    // --- grain tiles
    FX.grain = [];
    r = rng(3);
    for (let k = 0; k < 6; k++) {
      const gc = canvas(256, 256);
      c = gc.getContext('2d');
      const id = c.createImageData(256, 256);
      for (let i = 0; i < id.data.length; i += 4) {
        const v = 128 + (r() + r() + r() - 1.5) * 70;
        id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255;
      }
      c.putImageData(id, 0, 0);
      FX.grain.push(gc);
    }
  };

  // Desk surface (warm stone with fine grain) + prayer beads, baked into a texture.
  FX.deskTexture = function (w, h, phoneRect) {
    const c0 = canvas(w, h), c = c0.getContext('2d');
    const r = rng(77);
    const g = c.createRadialGradient(w * 0.45, h * 0.4, 0, w * 0.5, h * 0.5, w * 0.75);
    g.addColorStop(0, '#5b4a37'); g.addColorStop(0.6, '#3a2f23'); g.addColorStop(1, '#1d1712');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    // stone veining / mottling
    for (let i = 0; i < 900; i++) {
      const x = r() * w, y = r() * h, rad = 20 + r() * 160;
      c.globalAlpha = 0.025 + r() * 0.03;
      c.fillStyle = r() < 0.5 ? '#c9b08a' : '#140f0b';
      c.beginPath(); c.ellipse(x, y, rad, rad * (0.3 + r() * 0.7), r() * 3, 0, Math.PI * 2); c.fill();
    }
    // fine speckle
    const id = c.getImageData(0, 0, w, h), d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (r() - 0.5) * 14;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    c.putImageData(id, 0, 0);
    c.globalAlpha = 1;

    // prayer beads (misbaha) resting beside the phone: 33 beads on a soft loop
    const { x: px, y: py, w: pw, h: ph } = phoneRect;
    const cx = px + pw + pw * 0.62, cy = py + ph * 0.58, R = pw * 0.42;
    const pts = [];
    for (let i = 0; i < 33; i++) {
      const a = (i / 33) * Math.PI * 2;
      const wob = 1 + 0.12 * Math.sin(a * 2 + 0.6);
      pts.push([cx + Math.cos(a) * R * wob * 0.82, cy + Math.sin(a) * R * wob * 1.15]);
    }
    const br = pw * 0.052;
    // tail to the imam bead and tassel
    const tail = [[cx - R * 0.15, cy + R * 1.18], [cx - R * 0.22, cy + R * 1.38], [cx - R * 0.3, cy + R * 1.58]];
    const all = pts.concat(tail);
    // thread
    c.strokeStyle = 'rgba(40, 20, 10, 0.6)'; c.lineWidth = br * 0.18;
    c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.stroke();
    // shadows
    all.forEach(([x, y]) => {
      c.save(); c.filter = `blur(${br * 0.5}px)`; c.fillStyle = 'rgba(0,0,0,0.55)';
      c.beginPath(); c.ellipse(x + br * 0.45, y + br * 0.55, br * 1.05, br * 0.9, 0, 0, Math.PI * 2); c.fill(); c.restore();
    });
    // beads: warm amber with specular highlight
    all.forEach(([x, y], i) => {
      const s = i === pts.length ? 1.25 : 1;
      const bg = c.createRadialGradient(x - br * 0.35 * s, y - br * 0.4 * s, br * 0.1, x, y, br * s);
      bg.addColorStop(0, '#ffe2a8'); bg.addColorStop(0.25, '#d9902f'); bg.addColorStop(0.75, '#8a4a12'); bg.addColorStop(1, '#3a1c06');
      c.fillStyle = bg; c.beginPath(); c.arc(x, y, br * s, 0, Math.PI * 2); c.fill();
    });
    // tassel
    const [tx, ty] = tail[2];
    c.strokeStyle = 'rgba(190, 150, 80, 0.8)'; c.lineWidth = br * 0.09;
    for (let k = 0; k < 18; k++) {
      c.beginPath(); c.moveTo(tx, ty + br);
      c.quadraticCurveTo(tx - br * 0.4 + k * br * 0.05, ty + br * 2.2, tx - br * 1.0 + k * br * 0.11, ty + br * 3.6);
      c.stroke();
    }
    return c0;
  };

  // ---------------------------------------------------------------- per frame
  FX.drawBg = function (ctx, t, L, S) {
    const { W, H, u } = L;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#010605';
    ctx.fillRect(0, 0, W, H);

    // ---- Scene 1: dawn architecture
    const dawn = S.dawn; // 0..1 intensity
    if (dawn > 0.001) {
      const A = L.arch;
      // wall spill
      const sp = ctx.createRadialGradient(A.cx, A.top + A.h * 0.5, 0, A.cx, A.top + A.h * 0.5, Math.max(W, H) * 0.75);
      sp.addColorStop(0, `rgba(120, 82, 40, ${0.42 * dawn})`);
      sp.addColorStop(0.35, `rgba(18, 52, 40, ${0.55 * dawn})`);
      sp.addColorStop(1, 'rgba(2, 10, 8, 0)');
      ctx.fillStyle = sp; ctx.fillRect(0, 0, W, H);
      // floor plane
      const fl = ctx.createLinearGradient(0, L.floorY, 0, H);
      fl.addColorStop(0, `rgba(30, 24, 16, ${0.0})`);
      fl.addColorStop(0.2, `rgba(40, 30, 18, ${0.35 * dawn})`);
      fl.addColorStop(1, `rgba(6, 8, 6, ${0.6 * dawn})`);
      ctx.fillStyle = fl; ctx.fillRect(0, L.floorY, W, H - L.floorY);
      // window
      ctx.globalAlpha = clamp(dawn * S.winFlicker);
      ctx.drawImage(FX.win.img, FX.win.x, FX.win.y);
      ctx.globalAlpha = 1;
    }

    // ---- Studio (scenes 2–5): emerald field + top light + drifting bokeh
    const st = S.studio;
    if (st > 0.001) {
      const cx = W * S.lightX, cy = H * S.lightY;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.8);
      g.addColorStop(0, `rgba(18, 78, 60, ${0.85 * st})`);
      g.addColorStop(0.35, `rgba(8, 44, 34, ${0.8 * st})`);
      g.addColorStop(1, `rgba(1, 8, 6, ${st})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // top spotlight cone
      const cone = ctx.createLinearGradient(0, 0, 0, H);
      cone.addColorStop(0, `rgba(255, 236, 200, ${0.10 * st * S.spot})`);
      cone.addColorStop(1, 'rgba(255, 236, 200, 0)');
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(cx - W * 0.06, 0); ctx.lineTo(cx + W * 0.06, 0);
      ctx.lineTo(cx + W * 0.32, H); ctx.lineTo(cx - W * 0.32, H); ctx.closePath(); ctx.fill();
      // architectural echo: a faint arch outline, very large, behind everything
      ctx.save();
      ctx.globalAlpha = 0.09 * st * S.archEcho;
      archPath(ctx, W * S.echoX, H * 0.06, Math.min(W, H) * 0.62, H * 1.2);
      ctx.strokeStyle = '#e6cf9c'; ctx.lineWidth = 1.5 * u; ctx.stroke();
      archPath(ctx, W * S.echoX, H * 0.06 + 22 * u, Math.min(W, H) * 0.62 - 44 * u, H * 1.2);
      ctx.globalAlpha = 0.05 * st * S.archEcho; ctx.stroke();
      ctx.restore();
    }

    // ---- blurred Mushaf macro (scene 3)
    if (S.mushaf > 0.001 && FX.mushaf) {
      const m = FX.mushaf, s = S.mushafScale;
      ctx.save();
      ctx.globalAlpha = S.mushaf * 0.2;
      ctx.translate(W * S.mushafX, H * 0.5);
      ctx.rotate(-0.06);
      ctx.drawImage(m, -m.width * s / 2, -m.height * s / 2 + S.mushafDrift * H, m.width * s, m.height * s);
      ctx.restore();
      // darken toward the text side for legibility
      const sh = L.v ? ctx.createLinearGradient(0, 0, 0, H) : ctx.createLinearGradient(0, 0, W, 0);
      sh.addColorStop(0, `rgba(1, 8, 6, ${0.75 * S.mushaf})`); sh.addColorStop(0.6, 'rgba(1,8,6,0)');
      ctx.fillStyle = sh; ctx.fillRect(0, 0, W, H);
    }

    // ---- bokeh
    if (S.bokeh > 0.001) {
      ctx.globalCompositeOperation = 'lighter';
      FX.bokeh.forEach(b => {
        const par = 0.3 + b.z;
        const x = ((b.x + t * 0.006 * par + S.camX * par) % 1.2 - 0.1) * W;
        const y = (b.y + Math.sin(t * 0.25 + b.ph) * 0.01) * H;
        const sz = (30 + b.sz * 90) * u * (0.6 + b.z);
        ctx.globalAlpha = S.bokeh * (0.03 + 0.05 * b.z) * (0.75 + 0.25 * Math.sin(t * 0.8 + b.ph));
        const img = b.gold ? FX.tint(FX.disc, 'gold') : FX.tint(FX.disc, 'emerald');
        ctx.drawImage(img, x - sz / 2, y - sz / 2, sz, sz);
      });
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    // ---- brand end card backdrop
    if (S.brand > 0.001) {
      const cx = W * S.brandLX, cy = H * S.brandLY;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7);
      g.addColorStop(0, `rgba(22, 84, 64, ${S.brand})`);
      g.addColorStop(0.45, `rgba(7, 38, 29, ${S.brand})`);
      g.addColorStop(1, `rgba(1, 8, 6, ${S.brand})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // slow light rays from behind the icon
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.02);
      for (let i = 0; i < 14; i++) {
        ctx.rotate(Math.PI * 2 / 14);
        const rg = ctx.createLinearGradient(0, 0, Math.max(W, H) * 0.6, 0);
        rg.addColorStop(0, `rgba(230, 207, 156, ${0.05 * S.brand * S.rays})`);
        rg.addColorStop(1, 'rgba(230, 207, 156, 0)');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.lineTo(Math.max(W, H) * 0.7, -60 * u); ctx.lineTo(Math.max(W, H) * 0.7, 60 * u); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  };

  // tinted copies of a sprite, cached
  const tintCache = {};
  FX.tint = function (img, name) {
    const key = name + img.width;
    if (tintCache[key]) return tintCache[key];
    const c = canvas(img.width, img.height), x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = { gold: '#e6c58c', emerald: '#37c995', warm: '#ffd59a', ivory: '#fff4e0' }[name];
    x.fillRect(0, 0, c.width, c.height);
    return (tintCache[key] = c);
  };

  // Additive light layer above the 3D world.
  FX.drawGlow = function (ctx, t, L, S) {
    const { W, H, u } = L;
    ctx.clearRect(0, 0, W, H);

    // dawn beam + dust
    if (S.dawn > 0.001) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(S.dawn * S.winFlicker * 0.9);
      ctx.drawImage(FX.beam, 0, 0, W, H);
      const A = L.arch, B = L.beamTo;
      FX.dust.forEach(d => {
        const s = (d.s + t * 0.015 * d.sp) % 1;
        const sx = lerp(A.cx, B.x, s), sy = lerp(A.top + A.h * 0.6, B.y, s);
        const nx = -(B.y - A.top), ny = (B.x - A.cx), nl = Math.hypot(nx, ny);
        const off = d.a * lerp(A.w * 0.4, B.spread * 0.45, s);
        const x = sx + nx / nl * off + Math.sin(t * 0.4 + d.ph) * 8 * u;
        const y = sy + ny / nl * off + Math.cos(t * 0.33 + d.ph) * 8 * u;
        const tw = 0.5 + 0.5 * Math.sin(t * (1 + d.sp) + d.ph * 3);
        const a = S.dawn * S.dustAmt * (0.25 + 0.75 * tw) * (1 - Math.abs(d.a) * 0.6) * Math.sin(Math.PI * s);
        const r = (1 + d.z * 2.4) * u;
        ctx.globalAlpha = clamp(a);
        ctx.drawImage(FX.tint(FX.dot, 'warm'), x - r * 2, y - r * 2, r * 4, r * 4);
      });
    }

    // the distraction storm
    if (S.storm > 0.001) {
      ctx.globalCompositeOperation = 'source-over';
      const cx = W / 2, cy = H / 2, R = Math.hypot(W, H) * 0.55;
      const imp = ease.in(prog(t, 4.0, 4.24)); // implosion
      FX.cards.forEach((c, i) => {
        const age = t - c.t0;
        if (age < 0) return;
        const dist = R * (1.05 - age * c.sp * (0.9 + age * 0.9));
        const ang = c.ang + age * 0.15 * (c.z - 0.5);
        let x = cx + Math.cos(ang) * dist * (W / Math.hypot(W, H)) * 1.6;
        let y = cy + Math.sin(ang) * dist * (H / Math.hypot(W, H)) * 1.6;
        let sc = (0.55 + c.z * 0.9) * u * (1 - imp);
        x = lerp(x, cx, imp); y = lerp(y, cy, imp);
        const a = clamp(age / 0.25) * S.storm * (0.35 + 0.65 * c.z) * (1 - imp);
        if (a < 0.003 || sc < 0.01) return;
        ctx.save();
        ctx.translate(x, y); ctx.rotate(c.rot * (1 - imp)); ctx.scale(sc, sc);
        ctx.globalAlpha = a;
        const w = 330 * c.w, h = 86;
        if (c.kind < 2) {
          // glassy notification card — abstract, no text, no brands
          ctx.fillStyle = 'rgba(210, 225, 220, 0.10)';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 22); ctx.fill(); ctx.stroke();
          ctx.fillStyle = `hsla(${c.hue}, 70%, 60%, 0.75)`;
          ctx.beginPath(); ctx.roundRect(-w / 2 + 16, -h / 2 + 18, 50, 50, 13); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          ctx.beginPath(); ctx.roundRect(-w / 2 + 82, -h / 2 + 24, w * 0.45, 11, 5); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.22)';
          ctx.beginPath(); ctx.roundRect(-w / 2 + 82, -h / 2 + 48, w * 0.62, 10, 5); ctx.fill();
        } else {
          // red badge dot
          ctx.fillStyle = 'rgba(240, 70, 70, 0.85)';
          ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      });
      // speed streaks
      ctx.globalCompositeOperation = 'lighter';
      const sk = rng(Math.floor(t * 30) + 1);
      const n = Math.floor(40 * S.storm * (1 - imp));
      for (let i = 0; i < n; i++) {
        const ang = sk() * Math.PI * 2, d0 = (0.2 + sk() * 0.8) * R, len = (40 + sk() * 160) * u;
        const x0 = cx + Math.cos(ang) * d0, y0 = cy + Math.sin(ang) * d0;
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.05 + sk() * 0.08})`;
        ctx.lineWidth = 1.2 * u;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 - Math.cos(ang) * len, y0 - Math.sin(ang) * len); ctx.stroke();
      }
    }

    // full-frame flash/fade to black (dips between beats)
    if (S.black > 0.001) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = clamp(S.black);
      ctx.fillStyle = '#010403'; ctx.fillRect(0, 0, W, H);
    }
    // the single point of light that becomes the phone's glow (scene 2 opening)
    if (S.point > 0.001) {
      ctx.globalCompositeOperation = 'lighter';
      const x = S.pointX, y = S.pointY;
      const r = (14 + 30 * S.pointGrow) * u;
      ctx.globalAlpha = S.point;
      ctx.drawImage(FX.tint(FX.dot, 'ivory'), x - r * 4, y - r * 4, r * 8, r * 8);
      // horizontal anamorphic line
      const lw = W * 0.9 * S.lineGrow;
      if (lw > 1) {
        const lg = ctx.createLinearGradient(x - lw / 2, 0, x + lw / 2, 0);
        lg.addColorStop(0, 'rgba(255,240,215,0)'); lg.addColorStop(0.5, `rgba(255,240,215,${0.8 * S.point})`); lg.addColorStop(1, 'rgba(255,240,215,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = lg;
        ctx.fillRect(x - lw / 2, y - 1.5 * u, lw, 3 * u);
        ctx.globalAlpha = 0.35 * S.point;
        ctx.fillRect(x - lw / 2, y - 10 * u, lw, 20 * u);
      }
    }

    // gentle recitation rings behind the audio phone (outside the screen)
    if (S.rings > 0.001) {
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 4; k++) {
        const p = ((t * 0.32 + k / 4) % 1);
        const r = (120 + p * 520) * u;
        ctx.globalAlpha = S.rings * 0.22 * Math.sin(Math.PI * p);
        ctx.strokeStyle = '#7fe0bd'; ctx.lineWidth = 1.5 * u;
        ctx.beginPath(); ctx.arc(S.ringsX, S.ringsY, r, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // floating gold motes (end card)
    if (S.motes > 0.001) {
      ctx.globalCompositeOperation = 'lighter';
      FX.motes.forEach(m => {
        const x = (m.x + Math.sin(t * 0.2 * m.sp + m.ph) * 0.02) * W;
        const y = ((m.y - t * 0.008 * m.sp) % 1 + 1) % 1 * H;
        const r = (1 + m.z * 2.5) * u;
        ctx.globalAlpha = S.motes * (0.2 + 0.5 * m.z) * (0.6 + 0.4 * Math.sin(t * 1.3 + m.ph));
        ctx.drawImage(FX.tint(FX.dot, 'gold'), x - r * 2, y - r * 2, r * 4, r * 4);
      });
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  FX.drawGrain = function (ctx, frame, L) {
    const tile = FX.grain[frame % FX.grain.length];
    const r = rng(frame * 7 + 1);
    ctx.save();
    ctx.translate(-r() * 256, -r() * 256);
    ctx.fillStyle = ctx.createPattern(tile, 'repeat');
    ctx.fillRect(0, 0, L.W + 256, L.H + 256);
    ctx.restore();
  };

  window.FX = FX;
  window.archPath = archPath;
})();
