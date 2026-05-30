// tarteel-worker.js - ES module Web Worker
// Pipeline: 16kHz audio -> mel spectrogram -> ONNX CTC -> Levenshtein -> surah:ayah
//
// Model: NVIDIA FastConformer Arabic CTC (CC-BY-4.0)
// Original: https://github.com/yazinsai/offline-tarteel (by Yazin Insai)
// See ATTRIBUTION.md for license compliance.

import * as ort from 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.2/dist/ort.wasm.bundle.min.mjs';

ort.env.wasm.numThreads = 1;
ort.env.wasm.numThreads = 1; // single-thread avoids SharedArrayBuffer / CORP headers

const MODEL_URL = new URL('../models/fastconformer_ar_ctc_q8.onnx', self.location.href).href;
const MODEL_FALLBACKS = [
  'https://pub-cc0cb21aa3184d36978638448759d480.r2.dev/fastconformer_ar_ctc_q8.onnx',
];
const CACHE_NAME = 'tarteel-model-v1';

// Mel spectrogram constants (NeMo-compatible)
const SR = 16000, N_FFT = 512, HOP = 160, WIN = 400, N_MELS = 80;
const PREEMPH = 0.97, DITHER = 1e-5, LOG_GUARD = 1e-5;

let session = null;
let vocab = null;
let quranVerses = null;
let blankId = 1024;

// ── FFT (Cooley-Tukey radix-2, iterative) ────────────────────────────────────
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wRe = Math.cos(ang), wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let uRe = 1, uIm = 0;
      for (let j = 0; j < (len >> 1); j++) {
        const idx = i + j + (len >> 1);
        const vRe = re[idx] * uRe - im[idx] * uIm;
        const vIm = re[idx] * uIm + im[idx] * uRe;
        re[idx] = re[i + j] - vRe; im[idx] = im[i + j] - vIm;
        re[i + j] += vRe; im[i + j] += vIm;
        const tmp = uRe * wRe - uIm * wIm; uIm = uRe * wIm + uIm * wRe; uRe = tmp;
      }
    }
  }
}

// ── Hann window (periodic, matches NeMo) ─────────────────────────────────────
function makeHannWindow(n) {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / n));
  return w;
}

// ── Mel filter bank (HTK mel scale, Slaney normalization) ────────────────────
function makeMelFilters() {
  const hzToMel = f => 2595 * Math.log10(1 + f / 700);
  const melToHz = m => 700 * (Math.pow(10, m / 2595) - 1);
  const nBins = N_FFT / 2 + 1;
  const melMin = hzToMel(0), melMax = hzToMel(8000);

  const hzPts = new Array(N_MELS + 2);
  for (let i = 0; i <= N_MELS + 1; i++) {
    hzPts[i] = melToHz(melMin + (melMax - melMin) * i / (N_MELS + 1));
  }
  const bins = hzPts.map(f => Math.floor((N_FFT + 1) * f / SR));

  const filters = new Float32Array(N_MELS * nBins);
  for (let m = 0; m < N_MELS; m++) {
    const norm = 2.0 / (hzPts[m + 2] - hzPts[m]);
    const lo = bins[m], mid = bins[m + 1], hi = bins[m + 2];
    for (let k = lo; k < mid; k++) filters[m * nBins + k] = norm * (k - lo) / (mid - lo);
    for (let k = mid; k < hi; k++) filters[m * nBins + k] = norm * (hi - k) / (hi - mid);
  }
  return filters;
}

const hannWin = makeHannWindow(WIN);
const melFilters = makeMelFilters();

// ── Compute mel spectrogram ───────────────────────────────────────────────────
function computeMelSpec(audio) {
  const a = new Float32Array(audio.length);
  for (let i = 0; i < audio.length; i++) a[i] = audio[i] + DITHER * (Math.random() * 2 - 1);
  for (let i = a.length - 1; i > 0; i--) a[i] -= PREEMPH * a[i - 1];

  const nFrames = Math.max(1, Math.floor((a.length - WIN) / HOP) + 1);
  const nBins = N_FFT / 2 + 1;
  const re = new Float32Array(N_FFT);
  const im = new Float32Array(N_FFT);
  const power = new Float32Array(nFrames * nBins);

  for (let f = 0; f < nFrames; f++) {
    re.fill(0); im.fill(0);
    const start = f * HOP;
    for (let j = 0; j < WIN && start + j < a.length; j++) re[j] = a[start + j] * hannWin[j];
    fft(re, im);
    for (let k = 0; k < nBins; k++) power[f * nBins + k] = re[k] * re[k] + im[k] * im[k];
  }

  const mel = new Float32Array(N_MELS * nFrames);
  for (let m = 0; m < N_MELS; m++) {
    let sum = 0;
    for (let t = 0; t < nFrames; t++) {
      let v = 0;
      for (let k = 0; k < nBins; k++) v += melFilters[m * nBins + k] * power[t * nBins + k];
      v = Math.log(v + LOG_GUARD);
      mel[m * nFrames + t] = v;
      sum += v;
    }
    const mean = sum / nFrames;
    let sumSq = 0;
    for (let t = 0; t < nFrames; t++) sumSq += (mel[m * nFrames + t] - mean) * (mel[m * nFrames + t] - mean);
    const std = Math.sqrt(sumSq / nFrames) || 1e-10;
    for (let t = 0; t < nFrames; t++) mel[m * nFrames + t] = (mel[m * nFrames + t] - mean) / std;
  }

  return { features: mel, timeFrames: nFrames };
}

// ── CTC greedy decoder ────────────────────────────────────────────────────────
function ctcDecode(logprobs, T) {
  const vocabSize = logprobs.length / T;
  const tokens = [];
  let prev = -1;
  for (let t = 0; t < T; t++) {
    let maxVal = -Infinity, maxIdx = 0;
    const offset = t * vocabSize;
    for (let v = 0; v < vocabSize; v++) {
      if (logprobs[offset + v] > maxVal) { maxVal = logprobs[offset + v]; maxIdx = v; }
    }
    if (maxIdx !== prev && maxIdx !== blankId) tokens.push(maxIdx);
    prev = maxIdx;
  }
  // U+2581 is the word-boundary token used in BPE
  return tokens.map(id => vocab[String(id)] || '').join('').replace(/▁/g, ' ').trim();
}

// ── Arabic normalizer ─────────────────────────────────────────────────────────
const DIACS_RE = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۤۧۨ-ۭـ]/g;
const NORM_MAP = {
  'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا',
  'ة': 'ه', 'ى': 'ي'
};
function normalizeArabic(text) {
  text = text.replace(DIACS_RE, '');
  text = text.replace(/./g, ch => NORM_MAP[ch] !== undefined ? NORM_MAP[ch] : ch);
  return text.split(/\s+/).filter(Boolean).join(' ');
}

// ── Levenshtein distance ──────────────────────────────────────────────────────
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const row = new Uint32Array(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = i;
    for (let j = 1; j <= n; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1] : 1 + Math.min(row[j], prev, row[j - 1]);
      row[j - 1] = prev;
      prev = val;
    }
    row[n] = prev;
  }
  return row[n];
}

// ── Verse matching ────────────────────────────────────────────────────────────
function matchVerse(transcript) {
  const normT = normalizeArabic(transcript);
  let bestScore = -1, bestVerse = null;
  for (const v of quranVerses) {
    const normV = normalizeArabic(v.text_clean || '');
    const maxLen = Math.max(normT.length, normV.length);
    if (maxLen === 0) continue;
    const score = 1 - levenshtein(normT, normV) / maxLen;
    if (score > bestScore) { bestScore = score; bestVerse = v; }
  }
  return bestVerse
    ? { surah: bestVerse.surah, ayah: bestVerse.ayah, text: bestVerse.text_uthmani, surahName: bestVerse.surah_name, score: bestScore }
    : null;
}

// ── Model download with progress ──────────────────────────────────────────────
async function fetchWithProgress(url, onProgress) {
  const resp = await fetch(url, { redirect: 'follow' });
  if (!resp.ok) throw new Error('HTTP ' + resp.status + ' when fetching model');
  const total = parseInt(resp.headers.get('content-length') || '0');
  const reader = resp.body.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total > 0) onProgress(Math.round(received / total * 100));
  }
  const buf = new Uint8Array(received);
  let pos = 0;
  for (const c of chunks) { buf.set(c, pos); pos += c.length; }
  return buf.buffer;
}

async function loadModel() {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(MODEL_URL);
  if (cached) {
    self.postMessage({ type: 'loading', progress: 95, status: 'جاري التهيئة من الكاش...' });
    return await cached.arrayBuffer();
  }
  // Try local model first, then fallback URLs
  const urls = [MODEL_URL, ...MODEL_FALLBACKS];
  let lastError = null;
  for (const url of urls) {
    try {
      self.postMessage({ type: 'loading', progress: 0, status: 'جاري تحميل النموذج...' });
      const buf = await fetchWithProgress(url, pct =>
        self.postMessage({ type: 'loading', progress: Math.round(pct * 0.92), status: pct + '%' })
      );
      await cache.put(MODEL_URL, new Response(new Uint8Array(buf), {
        headers: { 'Content-Type': 'application/octet-stream' }
      }));
      return buf;
    } catch (e) {
      lastError = e;
      continue;
    }
  }
  throw lastError || new Error('Failed to fetch model from all sources');
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function initModel() {
  try {
    self.postMessage({ type: 'loading', progress: 0, status: 'جاري تحميل البيانات...' });
    const base = self.location.href.replace(/\/js\/[^/]+$/, '/');
    const [vRes, qRes] = await Promise.all([
      fetch(base + 'data/vocab.json'),
      fetch(base + 'data/quran.json'),
    ]);
    if (!vRes.ok) throw new Error('vocab.json not found (' + vRes.status + ')');
    if (!qRes.ok) throw new Error('quran.json not found (' + qRes.status + ')');
    vocab = await vRes.json();
    quranVerses = await qRes.json();
    blankId = Math.max.apply(null, Object.keys(vocab).map(Number));

    const modelBuf = await loadModel();
    self.postMessage({ type: 'loading', progress: 98, status: 'جاري إعداد النموذج...' });

    session = await ort.InferenceSession.create(modelBuf, { executionProviders: ['wasm'] });
    self.postMessage({ type: 'ready' });
  } catch (e) {
    self.postMessage({ type: 'error', message: e.message || String(e) });
  }
}

// ── Recognize ─────────────────────────────────────────────────────────────────
async function recognize(audio) {
  try {
    self.postMessage({ type: 'processing' });
    const { features, timeFrames } = computeMelSpec(audio);

    const inputTensor = new ort.Tensor('float32', features, [1, N_MELS, timeFrames]);
    const lenTensor = new ort.Tensor('int64', BigInt64Array.from([BigInt(timeFrames)]), [1]);

    const out = await session.run({
      [session.inputNames[0]]: inputTensor,
      [session.inputNames[1]]: lenTensor,
    });

    const logprobs = out[session.outputNames[0]];
    const T = logprobs.dims[1];
    const vocabSize = logprobs.dims[2];
    const data = logprobs.data.subarray(0, T * vocabSize);

    const transcript = ctcDecode(data, T);
    const match = matchVerse(transcript);
    self.postMessage({ type: 'result', result: Object.assign({}, match, { transcript: transcript }) });
  } catch (e) {
    self.postMessage({ type: 'error', message: e.message || String(e) });
  }
}

// ── Message handler ───────────────────────────────────────────────────────────
self.onmessage = function(e) {
  if (e.data.type === 'init') initModel();
  if (e.data.type === 'recognize') recognize(e.data.audio);
};

self.addEventListener('unhandledrejection', e => {
  self.postMessage({ type: 'error', message: (e.reason && e.reason.message) || String(e.reason) });
});
