// Helpers for the user's own recording (pages/video-maker.html, «تسجيلي»):
// the loudness envelope of a decoded recording and a first guess at where each
// ayah starts, from the pauses between them. Pure functions (no DOM, no audio
// objects) so they can be tested in Node: tests/node/own-recitation.test.cjs.
//
// A recording has no ayah timestamps, so the split is a proposal the user checks
// and fixes by ear in the sync sheet. The pauses between ayat are usually longer
// than the breaths inside an ayah, so the N-1 longest pauses are taken as the
// boundaries between N ayat; how clearly they stand out sets the confidence.
(function (root) {
  'use strict';

  const HOP = 0.02;          // envelope resolution (s)
  const MIN_GAP = 0.18;      // shortest pause that can separate two ayat (s)
  const LEAD_IN = 0.15;      // a marker sits this long before the voice starts (s)
  const TAIL_OUT = 0.2;      // the last ayah keeps this long after the voice ends (s)

  // Loudness (dB) per HOP seconds of the mono mix of the channels.
  function envelopeDb(ch0, ch1, sampleRate, hop) {
    const h = hop || HOP;
    const frame = Math.max(1, Math.round(sampleRate * h));
    const n = Math.ceil(ch0.length / frame);
    const out = new Float32Array(n);
    const two = ch1 && ch1 !== ch0;
    for (let f = 0; f < n; f++) {
      const a = f * frame, b = Math.min(ch0.length, a + frame);
      let sum = 0;
      for (let i = a; i < b; i++) {
        const v = two ? (ch0[i] + ch1[i]) * 0.5 : ch0[i];
        sum += v * v;
      }
      out[f] = 20 * Math.log10(Math.sqrt(sum / Math.max(1, b - a)) + 1e-9);
    }
    return out;
  }

  function percentile(arr, p) {
    if (!arr.length) return 0;
    const s = Float32Array.from(arr).sort();
    return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))];
  }

  // Where the ayat start, as seconds into the recording.
  //   env: envelopeDb(...)   hop: its resolution   n: number of ayat expected
  // Returns { markers, end, confidence, method } — markers has n entries (the start of
  // each ayah, ascending), end is where the last one stops. When the pauses cannot
  // be told apart, { markers: null, confidence: 'none' } and the caller falls back to
  // splitting by text length.
  function autoSplit(env, hop, n) {
    const h = hop || HOP;
    if (!(n >= 1) || !env.length) return { markers: null, end: 0, confidence: 'none', method: 'none' };
    const duration = env.length * h;
    const floor = percentile(env, 0.1), speech = percentile(env, 0.9);
    const contrast = speech - floor;
    if (contrast < 6) return { markers: null, end: duration, confidence: 'none', method: 'none' };
    const thr = floor + contrast * 0.3;

    const active = new Uint8Array(env.length);
    for (let i = 0; i < env.length; i++) active[i] = env[i] > thr ? 1 : 0;
    // Clicks: a burst shorter than 50 ms with silence on both sides is not speech.
    const blip = Math.max(1, Math.round(0.05 / h));
    for (let i = 0; i < active.length;) {
      if (!active[i]) { i++; continue; }
      let j = i;
      while (j < active.length && active[j]) j++;
      if (j - i < blip) for (let k = i; k < j; k++) active[k] = 0;
      i = j;
    }
    let first = -1, last = -1;
    for (let i = 0; i < active.length; i++) if (active[i]) { if (first < 0) first = i; last = i; }
    if (first < 0) return { markers: null, end: duration, confidence: 'none', method: 'none' };

    const start = Math.max(0, first * h - LEAD_IN);
    const end = Math.min(duration, (last + 1) * h + TAIL_OUT);
    if (n === 1) return { markers: [start], end, confidence: 'high', method: 'silence' };

    // Silent stretches between the first and the last sound.
    const minLen = Math.ceil(MIN_GAP / h);
    const gaps = [];
    for (let i = first; i <= last;) {
      if (active[i]) { i++; continue; }
      let j = i;
      while (j <= last && !active[j]) j++;
      if (j - i >= minLen) gaps.push({ s: i, e: j - 1, len: j - i });
      i = j;
    }
    if (gaps.length < n - 1) return { markers: null, end, confidence: 'none', method: 'silence', found: gaps.length };

    const byLen = gaps.slice().sort((a, b) => b.len - a.len || a.s - b.s);
    const chosen = byLen.slice(0, n - 1).sort((a, b) => a.s - b.s);
    const rejected = byLen[n - 1];
    const shortest = byLen[n - 2].len;
    let confidence;
    if (!rejected) confidence = shortest * h >= 0.3 ? 'high' : 'medium';
    else {
      const ratio = shortest / rejected.len;
      confidence = ratio >= 1.5 ? 'high' : ratio >= 1.15 ? 'medium' : 'low';
    }
    const markers = [start];
    for (const g of chosen) {
      const a = g.s * h, b = (g.e + 1) * h;
      markers.push(Math.max(a + (b - a) * 0.5, b - LEAD_IN));   // just before the next voice starts
    }
    return { markers, end, confidence, method: 'silence' };
  }

  // The fallback: the time shared between the ayat by the length of their text.
  function proportional(start, end, weights) {
    const sum = weights.reduce((a, b) => a + b, 0) || 1;
    const markers = [];
    let t = start;
    for (const w of weights) { markers.push(t); t += (end - start) * w / sum; }
    return markers;
  }

  // Markers ascending, each at least `minGap` after the one before, inside [0, end).
  function normalizeMarkers(markers, end, minGap) {
    const gap = minGap == null ? 0.2 : minGap;
    const out = [];
    for (let i = 0; i < markers.length; i++) {
      const lo = i ? out[i - 1] + gap : 0;
      const hi = end - gap * (markers.length - i);
      out.push(Math.min(Math.max(+markers[i] || 0, lo), Math.max(lo, hi)));
    }
    return out;
  }

  // Min / max-style outline of the envelope for the waveform picture:
  // `bars` values in 0..1 (loudness scaled between the quiet and the loud parts).
  function outline(env, bars) {
    const floor = percentile(env, 0.05), top = Math.max(percentile(env, 0.98), floor + 1);
    const out = new Float32Array(bars);
    for (let b = 0; b < bars; b++) {
      const a = Math.floor(b * env.length / bars), z = Math.max(a + 1, Math.floor((b + 1) * env.length / bars));
      let m = -Infinity;
      for (let i = a; i < z && i < env.length; i++) if (env[i] > m) m = env[i];
      out[b] = Math.min(1, Math.max(0, (m - floor) / (top - floor)));
    }
    return out;
  }

  // Voice activity of an envelope: the same threshold autoSplit uses.
  const activityCache = new WeakMap();      // env -> activity (the sheet asks again on every edit)
  function activity(env) {
    if (typeof env === 'object' && activityCache.has(env)) return activityCache.get(env);
    const r = activityOf(env);
    if (typeof env === 'object') activityCache.set(env, r);
    return r;
  }
  function activityOf(env) {
    const floor = percentile(env, 0.1), speech = percentile(env, 0.9);
    const contrast = speech - floor;
    const thr = floor + contrast * 0.3;
    const active = new Uint8Array(env.length);
    if (contrast >= 6) for (let i = 0; i < env.length; i++) active[i] = env[i] > thr ? 1 : 0;
    return { active, contrast };
  }

  // The pauses of a recording (>= 0.12 s, between the first and the last sound), with where
  // the voice starts and stops: shared by the recorder's taps and the sheet's «next ayah
  // starts here».
  function pauses(env, h) {
    const duration = env.length * h;
    const { active } = activity(env);
    let first = -1, last = -1;
    for (let i = 0; i < active.length; i++) if (active[i]) { if (first < 0) first = i; last = i; }
    const start = first >= 0 ? Math.max(0, first * h - LEAD_IN) : 0;
    const end = last >= 0 ? Math.min(duration, (last + 1) * h + TAIL_OUT) : duration;
    const minLen = Math.ceil(0.12 / h);
    const gaps = [];
    for (let i = Math.max(first, 0); i <= last && first >= 0;) {
      if (active[i]) { i++; continue; }
      let j = i;
      while (j <= last && !active[j]) j++;
      if (j - i >= minLen) gaps.push({ a: i * h, b: j * h });
      i = j;
    }
    return { gaps, start, end };
  }
  // Where an ayah that was heard starting around `t` really starts: the pause nearest before
  // it. People tap up to ~1.5 s after the voice starts, or a little before it.
  function snapTo(gaps, t, after) {
    let best = null, bestScore = -Infinity;
    for (const g of gaps) {
      if (g.b < t - 1.5 || g.b > t + 0.8) continue;
      if (g.b <= after + MIN_GAP) continue;
      const score = Math.min(g.b - g.a, 1.2) - Math.abs(g.b - t) * 0.6;
      if (score > bestScore) { bestScore = score; best = g; }
    }
    if (best) return { m: Math.max(best.a + (best.b - best.a) * 0.5, best.b - LEAD_IN), snapped: true };
    return { m: Math.max(0, t - 0.3), snapped: false };      // no pause near: taps come a little late
  }
  // One tap, for the sync sheet. `after` = the marker before it (the new one must follow it).
  function snapOne(env, hop, t, after) {
    const { gaps } = pauses(env, hop || HOP);
    const r = snapTo(gaps, t, after == null ? -Infinity : after);
    if (after != null && r.m < after + MIN_GAP) r.m = after + MIN_GAP;
    return r;
  }

  // The recorder's live sync: the reader taps «التالي» as they start each next ayah.
  // A tap is a little early or late, so each one is moved to the voice onset after the
  // pause nearest to it (within a window), the same place autoSplit would put a marker.
  //   taps: seconds into the recording of each tap (taps[k] starts ayah k + 1)
  //   n:    ayat expected. Fewer taps than n - 1 leave the rest to the caller.
  // Returns { markers, end, snapped } — markers has taps.length + 1 entries.
  function snapTaps(env, hop, taps, n) {
    const h = hop || HOP;
    const { gaps, start, end } = pauses(env, h);
    const markers = [start];
    let snapped = 0;
    const use = Math.min(taps.length, Math.max(0, n - 1));
    for (let k = 0; k < use; k++) {
      const r = snapTo(gaps, taps[k], markers[markers.length - 1]);
      if (r.snapped) snapped++;
      markers.push(r.m);
    }
    return { markers: normalizeMarkers(markers, Math.max(end, markers[markers.length - 1] + MIN_GAP * 2), MIN_GAP), end, snapped };
  }

  // The ayat after one the user has fixed by hand, split again from it.
  //   a: where the fixed ayah starts   b: where the next fixed marker (or the end) is
  //   weights: the length of the text of each ayah from the fixed one up to b (count = weights.length)
  // Returns count markers, the first one = a. The pauses between a and b are the candidates;
  // the ones chosen are the longest that also fall near where the text lengths say the ayat
  // should change (a dynamic programme over the pauses, in order). Too few pauses: the time
  // is shared by text length.
  function resplit(env, hop, a, b, weights) {
    const h = hop || HOP;
    const count = weights.length;
    if (count <= 1) return [a];
    const { active } = activity(env);
    // the voice of the fixed ayah starts after a: a pause before it belongs to the fixed marker
    let onset = Math.ceil(a / h);
    while (onset < active.length && onset * h < b && !active[onset]) onset++;
    const minLen = Math.ceil(0.12 / h);
    const cands = [];
    for (let i = onset; i * h < b && i < active.length;) {
      if (active[i]) { i++; continue; }
      let j = i;
      while (j < active.length && !active[j]) j++;
      if (j - i >= minLen) {
        const ga = i * h, gb = j * h;
        const m = Math.max(ga + (gb - ga) * 0.5, gb - LEAD_IN);
        if (m > a + MIN_GAP && m < b - MIN_GAP && gb < b) cands.push({ m, len: gb - ga });
      }
      i = j;
    }
    const k = count - 1;                                   // boundaries to place
    const total = weights.reduce((x, y) => x + y, 0) || 1;
    const expect = [];
    let acc = 0;
    for (let q = 0; q < k; q++) { acc += weights[q]; expect.push(a + (b - a) * acc / total); }
    if (cands.length < k) return normalizeMarkers(proportional(a, b, weights), b, MIN_GAP);
    // dp[q][g]: best score with boundary q at candidate g
    const avg = (b - a) / count;
    const score = (q, g) => Math.min(cands[g].len, 1.2) / 1.2 - 0.15 * Math.abs(cands[g].m - expect[q]) / avg;
    const G = cands.length;
    let prev = new Float64Array(G), from = [];
    for (let g = 0; g < G; g++) prev[g] = score(0, g);
    for (let q = 1; q < k; q++) {
      const cur = new Float64Array(G).fill(-Infinity), back = new Int32Array(G).fill(-1);
      let best = -Infinity, bestAt = -1;
      for (let g = q; g < G; g++) {
        if (prev[g - 1] > best) { best = prev[g - 1]; bestAt = g - 1; }
        if (bestAt >= 0) { cur[g] = best + score(q, g); back[g] = bestAt; }
      }
      from.push(back);
      prev = cur;
    }
    let g = -1, best = -Infinity;
    for (let x = 0; x < G; x++) if (prev[x] > best) { best = prev[x]; g = x; }
    const picks = [g];
    for (let q = k - 1; q >= 1; q--) { g = from[q - 1][g]; picks.unshift(g); }
    return normalizeMarkers([a].concat(picks.map(x => cands[x].m)), b, MIN_GAP);
  }

  const api = { HOP, MIN_GAP, resplit, envelopeDb, autoSplit, proportional, normalizeMarkers, outline, percentile, snapTaps, snapOne };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OwnRecitation = api;
})(typeof window !== 'undefined' ? window : globalThis);
