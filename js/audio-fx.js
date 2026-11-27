// Audio effects for the user's own recording (pages/video-maker.html, «مؤثرات صوتية»):
// voice polish (rumble filter, noise gate, warmth, clarity, compressor, loudness), echo
// and reverb presets. Nothing is applied to the stored recording: the same Web Audio
// chain is built live for the preview / real-time recording and inside an
// OfflineAudioContext, slice by slice, for the fast export — so what you hear is what
// is exported.
(function () {
  'use strict';

  const WORKLET = '../js/fx-gate-worklet.js';

  // Reverb rooms: decay = seconds to fall 60 dB, pre = pre-delay, damp = how fast the
  // highs die out, mix = how much of the room is heard by default.
  const ROOMS = {
    none:   null,
    room:   { decay: 0.7, pre: 0.008, damp: 0.6, mix: 0.18 },
    mosque: { decay: 2.6, pre: 0.025, damp: 0.45, mix: 0.26 },
    hall:   { decay: 3.4, pre: 0.03, damp: 0.5, mix: 0.28 },
    haram:  { decay: 5.5, pre: 0.045, damp: 0.35, mix: 0.3 },
  };

  const DEFAULTS = {
    on: true,                                        // master switch (A/B)
    reverb: { preset: 'none', mix: 0.26, decay: 2.6 },
    echo: { mix: 0, delay: 0.32, feedback: 0.3 },
    polish: { on: false, gate: 35, warmth: 2, clarity: 3, comp: 45, normalize: true },
  };

  const clamp = (v, a, b, d) => (typeof v === 'number' && isFinite(v) ? Math.min(b, Math.max(a, v)) : d);
  function sanitize(fx) {
    const f = fx && typeof fx === 'object' ? fx : {};
    const r = f.reverb || {}, e = f.echo || {}, p = f.polish || {};
    return {
      on: f.on !== false,
      reverb: {
        preset: Object.prototype.hasOwnProperty.call(ROOMS, r.preset) ? r.preset : 'none',
        mix: clamp(r.mix, 0, 0.6, DEFAULTS.reverb.mix),
        decay: clamp(r.decay, 0.3, 8, DEFAULTS.reverb.decay),
      },
      echo: {
        mix: clamp(e.mix, 0, 0.6, 0),
        delay: clamp(e.delay, 0.06, 0.8, DEFAULTS.echo.delay),
        feedback: clamp(e.feedback, 0, 0.75, DEFAULTS.echo.feedback),
      },
      polish: {
        on: !!p.on,
        gate: clamp(p.gate, 0, 100, DEFAULTS.polish.gate),
        warmth: clamp(p.warmth, 0, 8, DEFAULTS.polish.warmth),
        clarity: clamp(p.clarity, 0, 8, DEFAULTS.polish.clarity),
        comp: clamp(p.comp, 0, 100, DEFAULTS.polish.comp),
        normalize: p.normalize !== false,
      },
    };
  }
  const reverbOn = f => f.on && f.reverb.preset !== 'none' && f.reverb.mix > 0.001;
  const echoOn = f => f.on && f.echo.mix > 0.001;
  const polishOn = f => f.on && f.polish.on;
  const active = f => reverbOn(f) || echoOn(f) || polishOn(f);

  // Levels of the recording (dB per 20 ms, from js/own-recitation.js) the polish needs:
  // the room noise and the voice, so the gate and the loudness work on any recording.
  function analyze(env, percentile) {
    return { floor: percentile(env, 0.1), voice: percentile(env, 0.8), peak: percentile(env, 0.995) };
  }

  // ---- reverb impulse: decaying noise, darker as it fades, a few early reflections ----
  const irCache = new Map();
  function irData(sr, room) {
    const key = [sr, room.decay.toFixed(2), room.pre, room.damp].join('|');
    if (irCache.has(key)) return irCache.get(key);
    const pre = Math.round(room.pre * sr);
    const len = pre + Math.ceil(room.decay * sr);
    const out = [new Float32Array(len), new Float32Array(len)];
    let seed = 0x9e3779b9;
    const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) / 4294967296) * 2 - 1; };
    for (let c = 0; c < 2; c++) {
      const d = out[c];
      let y = 0;
      for (let i = pre; i < len; i++) {
        const t = (i - pre) / sr;
        const amp = Math.pow(10, -3 * t / room.decay);         // -60 dB at `decay`
        const a = 1 - room.damp * Math.min(1, t / room.decay) * 0.92;   // one-pole low-pass closing over time
        y += a * (rnd() - y);
        d[i] = y * amp;
      }
      // early reflections (a little different per side for width)
      [0.007, 0.013, 0.021, 0.029, 0.037].forEach((tt, k) => {
        const i = pre + Math.round((tt + c * 0.0017 * (k + 1)) * sr);
        if (i < len) d[i] += (k % 2 ? -1 : 1) * 0.5 * Math.pow(0.75, k);
      });
    }
    // same loudness whatever the room, so the mix slider means the same everywhere
    let e = 0;
    for (const d of out) for (let i = 0; i < d.length; i++) e += d[i] * d[i];
    const k = 1 / Math.sqrt(e / 2 + 1e-9) * 0.5;
    for (const d of out) for (let i = 0; i < d.length; i++) d[i] *= k;
    irCache.set(key, out);
    if (irCache.size > 6) irCache.delete(irCache.keys().next().value);
    return out;
  }
  function roomOf(f) {
    const base = ROOMS[f.reverb.preset];
    return base ? { decay: f.reverb.decay, pre: base.pre, damp: base.damp } : null;
  }

  const workletReady = new WeakMap();
  function ensureWorklet(ctx) {
    if (!ctx.audioWorklet) return Promise.resolve(false);
    if (!workletReady.has(ctx)) workletReady.set(ctx, ctx.audioWorklet.addModule(WORKLET).then(() => true, () => false));
    return workletReady.get(ctx);
  }
  const db = v => Math.pow(10, v / 20);

  // Builds the chain on `ctx`: returns { input, output, dispose }. Sources connect to
  // input; output goes to the speakers / recorder. `lv` = analyze(...) of the recording.
  async function build(ctx, fxIn, lv) {
    const f = sanitize(fxIn);
    const input = ctx.createGain();
    const output = ctx.createGain();
    const nodes = [input, output];
    const mk = n => { nodes.push(n); return n; };
    if (!active(f)) {
      input.connect(output);
      return { input, output, dispose: () => nodes.forEach(n => { try { n.disconnect(); } catch (e) { /* gone */ } }) };
    }
    let head = input;
    const chain = n => { head.connect(n); head = n; return n; };

    if (polishOn(f)) {
      const p = f.polish;
      if (p.normalize && lv) {
        // bring the voice to about -20 dBFS (RMS per 20 ms), the limiter catches peaks
        const g = mk(ctx.createGain());
        g.gain.value = Math.min(8, Math.max(0.25, db(-20 - lv.voice)));
        chain(g);
      }
      const hp = mk(ctx.createBiquadFilter());
      hp.type = 'highpass'; hp.frequency.value = 80; hp.Q.value = 0.7;
      chain(hp);
      if (p.gate > 0 && lv && (await ensureWorklet(ctx))) {
        const gate = mk(new AudioWorkletNode(ctx, 'zad-gate', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] }));
        // threshold between the room noise and the voice; depth grows with the slider
        const span = Math.max(6, lv.voice - lv.floor);
        const normGain = p.normalize ? Math.min(8, Math.max(0.25, db(-20 - lv.voice))) : 1;
        const thrDb = lv.floor + span * (0.15 + 0.3 * p.gate / 100);
        gate.parameters.get('threshold').value = Math.min(1, db(thrDb + 3) * normGain);   // peak ≈ RMS + 3 dB
        gate.parameters.get('floor').value = db(-(6 + 24 * p.gate / 100));
        chain(gate);
      }
      if (p.warmth > 0) {
        const w = mk(ctx.createBiquadFilter());
        w.type = 'lowshelf'; w.frequency.value = 220; w.gain.value = p.warmth;
        chain(w);
      }
      if (p.clarity > 0) {
        const c = mk(ctx.createBiquadFilter());
        c.type = 'peaking'; c.frequency.value = 3800; c.Q.value = 0.9; c.gain.value = p.clarity;
        chain(c);
      }
      if (p.comp > 0) {
        const k = p.comp / 100;
        const comp = mk(ctx.createDynamicsCompressor());
        comp.threshold.value = -12 - 22 * k; comp.ratio.value = 1.5 + 6.5 * k;
        comp.knee.value = 10; comp.attack.value = 0.006; comp.release.value = 0.18;
        chain(comp);
        const makeup = mk(ctx.createGain());
        makeup.gain.value = db(6 * k);
        chain(makeup);
      }
    }

    // dry + echo + reverb, summed, then a limiter so nothing clips
    const sum = mk(ctx.createGain());
    const dry = mk(ctx.createGain());
    dry.gain.value = reverbOn(f) ? 1 - f.reverb.mix * 0.35 : 1;
    head.connect(dry); dry.connect(sum);

    if (echoOn(f)) {
      const e = f.echo;
      const delay = mk(ctx.createDelay(1.0));
      delay.delayTime.value = e.delay;
      const fb = mk(ctx.createGain());
      fb.gain.value = e.feedback;
      const tone = mk(ctx.createBiquadFilter());
      tone.type = 'lowpass'; tone.frequency.value = 4500;
      const wet = mk(ctx.createGain());
      wet.gain.value = e.mix;
      head.connect(delay); delay.connect(tone); tone.connect(fb); fb.connect(delay);
      tone.connect(wet); wet.connect(sum);
    }
    if (reverbOn(f)) {
      const room = roomOf(f);
      const data = irData(ctx.sampleRate, room);
      const ir = ctx.createBuffer(2, data[0].length, ctx.sampleRate);
      ir.copyToChannel(data[0], 0); ir.copyToChannel(data[1], 1);
      const conv = mk(ctx.createConvolver());
      conv.normalize = false;
      conv.buffer = ir;
      const wet = mk(ctx.createGain());
      wet.gain.value = f.reverb.mix * 1.6;
      head.connect(conv); conv.connect(wet); wet.connect(sum);
    }
    const lim = mk(ctx.createDynamicsCompressor());
    lim.threshold.value = -1.5; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12;
    sum.connect(lim); lim.connect(output);
    return { input, output, dispose: () => nodes.forEach(n => { try { n.disconnect(); } catch (e) { /* gone */ } }) };
  }

  // How much audio before a slice must run through the chain so it starts in the
  // same state as in a continuous playback (reverb / echo tails, compressor, gate).
  function preroll(fxIn) {
    const f = sanitize(fxIn);
    let p = polishOn(f) ? 0.4 : 0;
    if (echoOn(f)) p = Math.max(p, Math.min(3, f.echo.delay * (1 + 1 / Math.max(0.05, 1 - f.echo.feedback))));
    if (reverbOn(f)) p = Math.max(p, Math.min(8, f.reverb.decay + 0.3));
    return p;
  }
  // Ring-out kept after the last ayah (fades with the video's tail).
  function tailOf(fxIn) {
    const f = sanitize(fxIn);
    return Math.max(echoOn(f) ? Math.min(1.2, f.echo.delay * 3) : 0, reverbOn(f) ? Math.min(1.2, f.reverb.decay * 0.4) : 0);
  }

  // Renders [off, off + dur + extra) of `buffer` through the chain, at `sr`.
  // Returns { ch0, ch1 } (Float32Array each).
  async function renderRange(buffer, off, dur, fxIn, lv, sr, extra) {
    const pre = Math.min(off, preroll(fxIn));
    const from = off - pre;
    const total = pre + dur + (extra || 0);
    const frames = Math.max(1, Math.round(total * sr));
    const ctx = new OfflineAudioContext(2, frames, sr);
    const chainNodes = await build(ctx, fxIn, lv);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(chainNodes.input);
    chainNodes.output.connect(ctx.destination);
    src.start(0, from, Math.min(total, buffer.duration - from));
    const out = await ctx.startRendering();
    const skip = Math.round(pre * sr);
    if (extra) {
      // fade the ring-out so the audio track ends smoothly
      const fadeFrom = Math.round((pre + dur) * sr);
      for (let c = 0; c < 2; c++) {
        const d = out.getChannelData(c);
        for (let i = fadeFrom; i < d.length; i++) d[i] *= 1 - (i - fadeFrom) / Math.max(1, d.length - fadeFrom);
      }
    }
    return { ch0: out.getChannelData(0).subarray(skip), ch1: out.getChannelData(1).subarray(skip) };
  }

  window.AudioFx = { ROOMS, DEFAULTS, sanitize, active, analyze, build, renderRange, preroll, tailOf, reverbOn, echoOn, polishOn };
})();
