// Helpers for the user's own recording (pages/video-maker.html, «تسجيلي»):
// the loudness envelope of a decoded recording and where each ayah starts in it.
// Pure functions (no DOM, no audio objects) so they can be tested in Node:
// tests/node/own-recitation.test.cjs.
//
// A recording has no ayah timestamps, so the split is a proposal the user checks by ear in
// the sync sheet. The boundaries are chosen among the pauses (longer pauses first), helped by
// where the length of each ayah's text says it should end, so a long breath inside an ayah
// doesn't win over a shorter pause between two. Where no pause fits, a boundary is placed by
// text length. Each boundary says whether it is sure, so the sheet can point the user at the
// ones worth a listen.
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
  //   weights: (optional) the length of each ayah's text, to judge where boundaries belong
  // Returns { markers, end, confidence, method, unsure } — markers has n entries (the start of
  // each ayah, ascending), end is where the last one stops, unsure lists the markers (1..n-1)
  // worth checking. With no voice to find, { markers: null, confidence: 'none' } and the caller
  // falls back to splitting by text length.
  function autoSplit(env, hop, n, weights) {
    const h = hop || HOP;
    if (!(n >= 1) || !env.length) return { markers: null, end: 0, confidence: 'none', method: 'none', unsure: [] };
    const duration = env.length * h;
    const { active, contrast } = activity(env);
    if (contrast < 6) return { markers: null, end: duration, confidence: 'none', method: 'none', unsure: [] };
    let first = -1, last = -1;
    for (let i = 0; i < active.length; i++) if (active[i]) { if (first < 0) first = i; last = i; }
    if (first < 0) return { markers: null, end: duration, confidence: 'none', method: 'none', unsure: [] };

    const start = Math.max(0, first * h - LEAD_IN);
    const end = Math.min(duration, (last + 1) * h + TAIL_OUT);
    if (n === 1) return { markers: [start], end, confidence: 'high', method: 'silence', unsure: [] };

    const w = weights && weights.length === n ? weights : new Array(n).fill(1);
    const cands = candidates(active, h, first, last + 1, start, end);
    const r = choose(cands, start, end, w, !!(weights && weights.length === n));
    const real = r.picks.filter(p => !p.virtual).length;
    const share = r.unsure.length / (n - 1);
    const confidence = r.unsure.length === 0 ? 'high' : share <= 1 / 3 && real === n - 1 ? 'medium' : 'low';
    return { markers: r.markers, end, confidence, method: 'silence', unsure: r.unsure, found: real };
  }

  // The pauses that could separate two ayat, between frames i0 and i1 of the activity, each
  // with where its marker would go (just before the next voice) and how long it is.
  // Only pauses whose marker falls inside (a, b) count.
  function candidates(active, h, i0, i1, a, b) {
    const minLen = Math.ceil(0.12 / h);
    const out = [];
    for (let i = Math.max(0, i0); i < i1 && i < active.length;) {
      if (active[i]) { i++; continue; }
      let j = i;
      while (j < active.length && !active[j]) j++;
      if (j - i >= minLen && j <= i1) {
        const ga = i * h, gb = j * h;
        const m = Math.max(ga + (gb - ga) * 0.5, gb - LEAD_IN);
        if (m > a + MIN_GAP && m < b - MIN_GAP) out.push({ m, len: gb - ga });
      }
      i = j;
    }
    return out;
  }

  // Chooses the count-1 boundaries between a and b (count = weights.length) among the
  // candidate pauses: a dynamic programme over them, in order, that prefers long pauses near
  // where the text lengths say each ayah should change. Where no pause fits, a «virtual» one at
  // that expected place is used instead (placed by text length, and marked unsure).
  // Returns { markers (count entries, the first = a), picks, unsure (marker indices 1..) }.
  const VIRTUAL = -0.6;        // a pause, however short, is preferred to no pause
  function choose(cands, a, b, weights, pace) {
    const count = weights.length, k = count - 1;
    if (k <= 0) return { markers: [a], picks: [], unsure: [] };
    const total = weights.reduce((x, y) => x + y, 0) || 1;
    const expect = [];
    let acc = 0;
    for (let q = 0; q < k; q++) { acc += weights[q]; expect.push(a + (b - a) * acc / total); }
    const all = cands.concat(expect.map(m => ({ m, len: 0, virtual: true }))).sort((x, y) => x.m - y.m || (x.virtual ? 1 : -1));
    const avg = (b - a) / count;
    const score = (q, g) => (all[g].virtual ? VIRTUAL : Math.min(all[g].len, 1.2) / 1.2) - 0.15 * Math.abs(all[g].m - expect[q]) / avg;
    const G = all.length;
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
    const pickIdx = [g];
    for (let q = k - 1; q >= 1; q--) { g = from[q - 1][g]; pickIdx.unshift(g); }
    const picks = pickIdx.map(x => all[x]);
    const markers = normalizeMarkers([a].concat(picks.map(p => p.m)), b, MIN_GAP);
    // A boundary is unsure when it is placed by text length, sits in a very short pause, or
    // another pause between its neighbours is nearly as long (it could be either).
    const chosen = new Set(pickIdx);
    const unsure = [];
    picks.forEach((p, q) => {
      let rival = 0;
      const lo = q === 0 ? a : picks[q - 1].m, hi = q === k - 1 ? b : picks[q + 1].m;
      all.forEach((c, x) => { if (!c.virtual && !chosen.has(x) && c.m > lo + MIN_GAP && c.m < hi - MIN_GAP && c.len > rival) rival = c.len; });
      if (p.virtual || p.len < 0.25 || rival >= p.len * 0.75) unsure.push(q + 1);
    });
    if (pace) paceCheck(markers, b, weights).forEach(i => { if (!unsure.includes(i)) unsure.push(i); });
    unsure.sort((x, y) => x - y);
    return { markers, picks, unsure };
  }

  // The pace check: an ayah that takes far longer (or shorter) than its text would at the
  // reciter's own pace is two ayat run together (a pause too short to hear) or half of one.
  // Its boundaries are marked unsure. Loose limits, so a slow, melodic recitation passes.
  //   markers: ayah starts   end: where the last ends   weights: text lengths
  // Returns marker indices (1..n-1).
  function paceCheck(markers, end, weights) {
    const n = markers.length;
    if (n < 3 || !weights || weights.length !== n) return [];
    const rate = markers.map((m, q) => ((q < n - 1 ? markers[q + 1] : end) - m) / (weights[q] || 1));
    const med = rate.slice().sort((x, y) => x - y)[Math.floor(n / 2)];
    const out = new Set();
    rate.forEach((r, q) => {
      if (r > med * 2.5 || r < med * 0.4) { if (q >= 1) out.add(q); if (q + 1 <= n - 1) out.add(q + 1); }
    });
    return [...out];
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
    if (contrast >= 6) {
      for (let i = 0; i < env.length; i++) active[i] = env[i] > thr ? 1 : 0;
      // Clicks: a burst shorter than 50 ms with silence on both sides is not speech.
      const blip = Math.max(1, Math.round(0.05 / HOP));
      for (let i = 0; i < active.length;) {
        if (!active[i]) { i++; continue; }
        let j = i;
        while (j < active.length && active[j]) j++;
        if (j - i < blip) for (let k = i; k < j; k++) active[k] = 0;
        i = j;
      }
    }
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
  // Returns { markers (count entries, the first = a), unsure (indices into markers) }, chosen
  // the same way as autoSplit.
  function resplitInfo(env, hop, a, b, weights) {
    const h = hop || HOP;
    if (weights.length <= 1) return { markers: [a], unsure: [] };
    const { active } = activity(env);
    // the voice of the fixed ayah starts after a: a pause before it belongs to the fixed marker
    let onset = Math.ceil(a / h);
    while (onset < active.length && onset * h < b && !active[onset]) onset++;
    const r = choose(candidates(active, h, onset, Math.floor(b / h), a, b), a, b, weights, true);
    return { markers: r.markers, unsure: r.unsure.filter(i => i >= 1) };
  }
  const resplit = (env, hop, a, b, weights) => resplitInfo(env, hop, a, b, weights).markers;

  // Where markers can snap to while one is dragged: the marker position of every pause.
  function snapPoints(env, hop) {
    const { gaps } = pauses(env, hop || HOP);
    return gaps.map(g => ({ a: g.a, b: g.b, m: Math.max(g.a + (g.b - g.a) * 0.5, g.b - LEAD_IN) }));
  }

  const api = { HOP, MIN_GAP, LEAD_IN, resplit, resplitInfo, snapPoints, paceCheck, envelopeDb, autoSplit, proportional, normalizeMarkers, outline, percentile, snapTaps, snapOne };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OwnRecitation = api;
})(typeof window !== 'undefined' ? window : globalThis);
