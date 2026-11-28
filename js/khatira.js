// «خاطرة» (pages/video-maker.html): the recitation shown word by word.
//
// The reciters here are the ones quran.com publishes word timings for: per ayah, when each
// word starts and ends in a recording of the whole surah. The video needs only the chosen
// ayat, so only those seconds of the surah's MP3 are fetched (a byte range): in a
// constant-bitrate file a byte offset is a time, exact to one MP3 frame (~26 ms).
// Variable-bitrate files are fetched whole.
//
// Pure functions (no DOM, no audio objects) so they can be tested in Node:
// tests/node/khatira.test.cjs.
(function (root) {
  'use strict';

  const API = 'https://api.qurancdn.com/api/qdc/audio/reciters/';

  // quran.com recitations that come with word timings (id = its recitation id).
  const RECITERS = [
    { id: 7, name: 'مشاري راشد العفاسي', en: 'Mishari Rashid al-Afasy', style: 'murattal' },
    { id: 9, name: 'محمد صديق المنشاوي', en: 'Mohamed Siddiq al-Minshawi', style: 'murattal' },
    { id: 6, name: 'محمود خليل الحصري', en: 'Mahmoud Khalil al-Husary', style: 'murattal' },
    { id: 2, name: 'عبد الباسط عبد الصمد', en: 'AbdulBaset AbdulSamad', style: 'murattal' },
    { id: 1, name: 'عبد الباسط عبد الصمد', en: 'AbdulBaset AbdulSamad', style: 'mujawwad' },
    { id: 3, name: 'عبد الرحمن السديس', en: 'Abdur-Rahman as-Sudais', style: 'murattal' },
    { id: 10, name: 'سعود الشريم', en: 'Saud ash-Shuraim', style: 'murattal' },
    { id: 97, name: 'ياسر الدوسري', en: 'Yasser ad-Dussary', style: 'murattal' },
    { id: 4, name: 'أبو بكر الشاطري', en: 'Abu Bakr al-Shatri', style: 'murattal' },
    { id: 5, name: 'هاني الرفاعي', en: 'Hani ar-Rifai', style: 'murattal' },
    { id: 161, name: 'خليفة الطنيجي', en: 'Khalifah al-Tunaiji', style: 'murattal' },
    { id: 12, name: 'محمود خليل الحصري (المعلم)', en: 'Mahmoud Khalil al-Husary (teacher)', style: 'muallim' },
  ];

  const metaUrl = (id, surah) => API + id + '/audio_files?chapter=' + surah + '&segments=true';

  // { url, size, duration (ms), verses: { [ayah]: { from, to, segs: [[word, startMs, endMs]] } } }
  // from the API's answer for one surah. Entries that are not [word, start, end] are dropped.
  function parseMeta(json) {
    const f = json && json.audio_files && json.audio_files[0];
    if (!f || !f.audio_url || !Array.isArray(f.verse_timings)) throw new Error('no timings');
    const verses = {};
    for (const v of f.verse_timings) {
      const ayah = parseInt(String(v.verse_key).split(':')[1], 10);
      if (!(ayah >= 1)) continue;
      const segs = (v.segments || []).filter(s => Array.isArray(s) && s.length === 3 && s.every(n => typeof n === 'number' && isFinite(n)));
      verses[ayah] = { from: +v.timestamp_from, to: +v.timestamp_to, segs };
    }
    return { url: f.audio_url, size: +f.file_size || 0, duration: +f.duration || 0, verses };
  }

  // ---- words ----
  const LETTER = /[ء-غف-يٱ-ۓۺ-ۿ]/;
  // The words of an ayah (Uthmani text): tokens with letters. Marks that stand alone (۞ ۩)
  // are not words; quran.com doesn't count them.
  const wordsOf = text => String(text || '').split(/\s+/).filter(w => LETTER.test(w));
  const letters = w => (String(w).match(new RegExp(LETTER.source, 'g')) || []).length || 1;

  // [{ a, b }] (ms) for each word, from the ayah's timings.
  //   words: wordsOf(text)   v: { from, to, segs }
  // Words the timings skip are given a share of the gap between their neighbours (by
  // letters). When the timings count the words differently from the text (a word split in
  // two), the ayah's spoken time is shared by letters instead.
  function wordTimes(words, v) {
    const n = words.length;
    if (!n) return [];
    const byPos = new Map();
    for (const [p, a, b] of v.segs) if (p >= 1 && b > a && !byPos.has(p)) byPos.set(p, { a, b });
    const maxPos = byPos.size ? Math.max(...byPos.keys()) : 0;
    const span = byPos.size ? { a: Math.min(...[...byPos.values()].map(x => x.a)), b: Math.max(...[...byPos.values()].map(x => x.b)) } : { a: v.from, b: v.to };
    if (maxPos !== n) return share(words, span.a, span.b);
    const out = new Array(n);
    for (let i = 0; i < n; i++) if (byPos.has(i + 1)) out[i] = Object.assign({}, byPos.get(i + 1));
    // fill the words without a timing from their neighbours
    for (let i = 0; i < n;) {
      if (out[i]) { i++; continue; }
      let j = i;
      while (j < n && !out[j]) j++;
      const a = i > 0 ? out[i - 1].b : (j < n ? Math.max(v.from, out[j].a - 400 * (j - i)) : v.from);
      const b = j < n ? out[j].a : (i > 0 ? Math.min(v.to, out[i - 1].b + 400 * (j - i)) : v.to);
      share(words.slice(i, j), a, Math.max(a + 1, b)).forEach((x, k) => { out[i + k] = x; });
      i = j;
    }
    // monotonic, no overlaps
    for (let i = 1; i < n; i++) if (out[i].a < out[i - 1].a) out[i].a = out[i - 1].a;
    return out;
  }
  // The span a..b shared between the words by their letters.
  function share(words, a, b) {
    const w = words.map(letters), total = w.reduce((x, y) => x + y, 0) || 1;
    let t = a;
    return w.map(k => { const s = t; t += (b - a) * k / total; return { a: s, b: t }; });
  }

  // ---- MP3: which bytes hold which seconds ----
  const KBPS = [
    [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],   // MPEG-1 layer I
    [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],      // MPEG-1 layer II
    [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],       // MPEG-1 layer III
    [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],           // MPEG-2/2.5 layer II/III
  ];
  const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
  // The header at i, or null. Layer III only (what these files are).
  function frameAt(b, i) {
    if (i + 4 > b.length || b[i] !== 0xFF || (b[i + 1] & 0xE0) !== 0xE0) return null;
    const ver = (b[i + 1] >> 3) & 3, layer = (b[i + 1] >> 1) & 3;
    const bri = b[i + 2] >> 4, sri = (b[i + 2] >> 2) & 3, pad = (b[i + 2] >> 1) & 1;
    if (ver === 1 || layer !== 1 || bri === 0 || bri === 15 || sri === 3) return null;
    const kbps = (ver === 3 ? KBPS[2] : KBPS[3])[bri];
    const sr = RATES[ver][sri];
    const spf = ver === 3 ? 1152 : 576;
    const len = Math.floor(spf / 8 * kbps * 1000 / sr) + pad;
    return { kbps, sr, spf, len, ver, mono: (b[i + 3] >> 6) === 3 };
  }

  // How many bytes the ID3 tag at the start takes (0 if none): the header read must go past it.
  function id3Size(b) {
    if (!(b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33)) return 0;
    return 10 + ((b[6] & 127) << 21 | (b[7] & 127) << 14 | (b[8] & 127) << 7 | (b[9] & 127)) + ((b[5] & 0x10) ? 10 : 0);
  }
  // What the first bytes of a file say: where the audio starts, its format, and whether every
  // frame has the same bitrate (no Xing/VBRI header, and the frames read agree).
  //   b: Uint8Array of the first ~64 KB
  function mp3Info(b) {
    let i = id3Size(b);
    while (i < b.length - 4 && !(frameAt(b, i) && frameAt(b, i + frameAt(b, i).len))) i++;
    const t = frameAt(b, i);
    if (!t) return null;
    const side = t.ver === 3 ? (t.mono ? 17 : 32) : (t.mono ? 9 : 17);
    const tag = String.fromCharCode(...b.subarray(i + 4 + side, i + 8 + side));
    const vbr = tag === 'Xing' || String.fromCharCode(...b.subarray(i + 36, i + 40)) === 'VBRI';
    // an Info / Xing frame carries no audio (and may have its own bitrate): the audio, and the
    // format to go by, start after it
    const audio = tag === 'Xing' || tag === 'Info' ? i + t.len : i;
    const f = frameAt(b, audio);
    if (!f) return null;
    // the encoder's delay, from the LAME header of the Info / Xing frame (after its 120 bytes of
    // frame count, size, seek table and quality): a decoder trims it, plus its own 529 samples,
    // from the start of a whole file, but cannot from a range out of the middle
    let encDelay = 0;
    const x = i + 4 + side;
    if ((tag === 'Xing' || tag === 'Info') && (b[x + 7] & 0x0F) === 0x0F && x + 144 < b.length) {
      const enc = String.fromCharCode(...b.subarray(x + 120, x + 124));
      if (/^(LAME|Lavc|Lavf|GOGO|L3\.9)/.test(enc)) encDelay = (b[x + 141] << 4) | (b[x + 142] >> 4);
    }
    let cbr = !vbr, j = audio, seen = 0;
    while (cbr && j < b.length - 4) {
      const g = frameAt(b, j);
      if (!g) break;
      if (g.kbps !== f.kbps || g.sr !== f.sr) cbr = false;
      j += g.len; seen++;
    }
    if (seen < 8) cbr = false;            // too little read to be sure
    return { audio, kbps: f.kbps, sr: f.sr, spf: f.spf, frameLen: f.spf / 8 * f.kbps * 1000 / f.sr, cbr, tag: tag === 'Xing' || tag === 'Info' ? tag : '', encDelay };
  }
  // The byte where second `sec` of the audio starts (constant bitrate only).
  const byteAt = (info, sec) => info.audio + Math.max(0, Math.floor(sec * info.sr / info.spf)) * info.frameLen;
  // The first whole frame in a chunk that starts at byte `base` of the file: its position in
  // the chunk and the second it starts at. Two frames in a row must parse (a lone 0xFF is not one).
  // `sec` is the second, on the timeline of the whole file as a decoder plays it, at which the
  // chunk's decoded audio starts: the frame's own time, less the delays a decoder trims from a
  // whole file (the encoder's and its own 529 samples) but not from a chunk.
  function firstFrame(b, base, info) {
    for (let i = 0; i < b.length - 4; i++) {
      const f = frameAt(b, i);
      if (!f || f.sr !== info.sr || !frameAt(b, i + f.len)) continue;
      const index = Math.round((base + i - info.audio) / info.frameLen);
      return { pos: i, index, sec: (index * info.spf - 529 - (info.encDelay || 0)) / info.sr };
    }
    return null;
  }

  const api = { API, RECITERS, metaUrl, parseMeta, wordsOf, wordTimes, share, id3Size, mp3Info, byteAt, firstFrame, frameAt };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Khatira = api;
})(typeof window !== 'undefined' ? window : globalThis);
