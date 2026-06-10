// ════════════════════════════════════════════════════════════════════
//  Tasmee' Pro v2 — text-rendered mushaf page (quran-t.html)
//
//  Loaded AFTER ui-extras.js: redefines the rendering layer of the
//  Tasmee' Pro panel while reusing its audio capture + worker pipeline
//  (tpToggleRecord, _tarteelOnMsg, _tpShowError stay as-is).
//
//  Why no image masking: overlaying patches on the page raster needs
//  per-variant pixel calibration and breaks whenever it drifts. Here the
//  page is rebuilt as real text — 15 flex lines from ayarects(line, word)
//  — and hidden words are simply `color: transparent`, so the layout can
//  never collapse and ayah medallions stay in place.
// ════════════════════════════════════════════════════════════════════

const _v2 = {
  page: 0,
  words: [],        // recitation order: {span, surah, ayah, word, norm, line}
  markers: {},      // "s_a" -> marker span
  ayahRanges: {},   // "s_a" -> {start, end} indices into words[]
  ptr: 0,           // next expected word index
  streamBase: 0,    // ptr value when current recording started
  errors: 0,
  peek: false,
  quranIndex: null, // "s_a" -> {words:[], surahName}
  fitRaf: null,
};

const _V2_BASMALA_WORDS = 4;
const _V2_DIACS = /[ً-ٰٟـۖ-ۜ۟-۪ۨ-ࣰۭ-ࣿ﻿]/g;

function _v2Norm(w) {
  return (w || '')
    .replace(_V2_DIACS, '')
    .replace(/[أإآٱا]/g, 'ا').replace(/ى/g, 'ي').replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي').replace(/ء/g, '').replace(/ة/g, 'ه')
    .trim();
}

function _v2Digits(n) {
  return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
}

// ── Quran text (local, offline) ───────────────────────────────────────
async function _v2LoadQuranText() {
  if (_v2.quranIndex) return _v2.quranIndex;
  const res = await fetch('../data/quran.json');
  if (!res.ok) throw new Error('quran.json: ' + res.status);
  const verses = await res.json();
  const idx = {};
  verses.forEach(v => {
    let words = v.text_uthmani.replace(/﻿/g, '').trim().split(/\s+/);
    // mushaf rects exclude the basmala header on ayah 1 (except 1:1, 9:1)
    if (v.ayah === 1 && v.surah !== 1 && v.surah !== 9 && words.length > _V2_BASMALA_WORDS) {
      words = words.slice(_V2_BASMALA_WORDS);
    }
    idx[v.surah + '_' + v.ayah] = { words, surahName: v.surah_name };
  });
  _v2.quranIndex = idx;
  return idx;
}

// ── Page model from ayarects (page, line, word) ───────────────────────
function _v2QueryPage(pageNumber) {
  const rects = [];
  const stmt = db.prepare(
    'SELECT soraid, ayaid, line, word, minx, maxx FROM ayarects WHERE page = ? ORDER BY line, minx DESC');
  stmt.bind([pageNumber]);
  while (stmt.step()) {
    const r = stmt.getAsObject();
    rects.push({ surah: r.soraid, ayah: r.ayaid, line: r.line, word: r.word });
  }
  stmt.free();

  // total rect count per ayah (across pages) — highest index is the medallion
  const maxWord = {};
  const stmt2 = db.prepare(
    'SELECT a.soraid s, a.ayaid y, MAX(a.word) m FROM ayarects a ' +
    'JOIN (SELECT DISTINCT soraid, ayaid FROM ayarects WHERE page = ?) b ' +
    'ON a.soraid = b.soraid AND a.ayaid = b.ayaid GROUP BY a.soraid, a.ayaid');
  stmt2.bind([pageNumber]);
  while (stmt2.step()) {
    const r = stmt2.getAsObject();
    maxWord[r.s + '_' + r.y] = r.m;
  }
  stmt2.free();
  return { rects, maxWord };
}

// Map a rect (1-based word index) to its slice of the ayah's text words.
// Counts almost always line up (rects = words + medallion); when they
// don't, partition words proportionally so order is kept and nothing dups.
function _v2RectText(rect, maxW, ayahWords) {
  const slots = maxW - 1;                  // rects that carry text
  const M = ayahWords.length;
  if (slots <= 0) return '';
  const i = rect.word - 1;                 // 0-based slot
  if (slots === M) return ayahWords[i] || '';
  const from = Math.floor(i * M / slots);
  const to = Math.floor((i + 1) * M / slots);
  return ayahWords.slice(from, to).join(' ');
}

// ── Render ────────────────────────────────────────────────────────────
function _v2RenderPage(pageNumber) {
  const host = document.getElementById('tpv2PageHost');
  host.innerHTML = '';
  host.classList.remove('peek');
  _v2.words = []; _v2.markers = {}; _v2.ayahRanges = {};
  _v2.ptr = 0; _v2.streamBase = 0;

  const { rects, maxWord } = _v2QueryPage(pageNumber);
  if (!rects.length) {
    host.innerHTML = '<div style="margin:auto;font-family:Tajawal,sans-serif;color:var(--text-hint)">تعذر تحميل بيانات الصفحة</div>';
    return;
  }

  const totalLines = pageNumber <= 2 ? 8 : 15;
  const byLine = {};
  rects.forEach(r => { (byLine[r.line] = byLine[r.line] || []).push(r); });

  // collect word elements per line first (recitation order needs ayah order)
  const flat = [];
  for (let L = 1; L <= totalLines; L++) {
    if (byLine[L]) continue;
    // gap line → surah header or basmala. Decide by the surah starting below.
    let next = null;
    for (let k = L + 1; k <= totalLines && !next; k++) {
      if (byLine[k]) next = byLine[k][0];
    }
    byLine[L] = next ? [] : null; // placeholder, classified during render
  }

  for (let L = 1; L <= totalLines; L++) {
    const items = byLine[L];
    const row = document.createElement('div');

    if (!items || !items.length) {
      // header/basmala row: header on the first gap line of a run, basmala after
      let next = null;
      for (let k = L + 1; k <= totalLines && !next; k++) {
        if (byLine[k] && byLine[k].length) next = byLine[k][0];
      }
      const prevIsGap = L > 1 && (!byLine[L - 1] || !byLine[L - 1].length);
      if (next && !prevIsGap) {
        const s = (typeof SURAH_MAP !== 'undefined' && SURAH_MAP.find(x => x.number === next.surah));
        row.className = 'tpv2-surah-header';
        row.innerHTML = '<img src="../img/Sura_border.svg" alt="">' +
                        '<span>سُورَةُ ' + (s ? s.name : next.surah) + '</span>';
      } else if (next) {
        row.className = 'tpv2-basmala';
        row.innerHTML = '<img src="../img/Basmala.svg" alt="بسم الله الرحمن الرحيم">';
      } else {
        row.className = 'tpv2-line centered';
      }
      host.appendChild(row);
      continue;
    }

    row.className = 'tpv2-line' + (pageNumber <= 2 || items.length < 4 ? ' centered' : '');
    items.forEach(rect => {
      const key = rect.surah + '_' + rect.ayah;
      const maxW = maxWord[key] || rect.word;
      if (rect.word === maxW) {
        const m = document.createElement('span');
        m.className = 'tpv2-marker';
        m.innerHTML = '<span class="tpv2-marker-glyph">۝</span>' +
                      '<span class="tpv2-marker-num">' + _v2Digits(rect.ayah) + '</span>';
        row.appendChild(m);
        _v2.markers[key] = m;
        return;
      }
      const entry = _v2.quranIndex[key];
      const text = entry ? _v2RectText(rect, maxW, entry.words) : '';
      const norm = _v2Norm(text);
      const sp = document.createElement('span');
      sp.textContent = text;
      // pure ornaments (۞ rub-el-hizb, sajdah sign…) are never recited:
      // keep them visible and out of the matching sequence
      if (!/[ء-ي]/.test(norm)) {
        sp.className = 'tpv2-ornament';
        row.appendChild(sp);
        return;
      }
      sp.className = 'tpv2-word masked';
      row.appendChild(sp);
      flat.push({ span: sp, surah: rect.surah, ayah: rect.ayah, word: rect.word,
                  norm, row });
    });
    row.classList.toggle('has-hidden', row.querySelector('.tpv2-word.masked') !== null);
    host.appendChild(row);
  }

  // recitation order = surah, ayah, word-index
  flat.sort((a, b) => a.surah - b.surah || a.ayah - b.ayah || a.word - b.word);
  _v2.words = flat;
  flat.forEach((w, i) => {
    const key = w.surah + '_' + w.ayah;
    if (!_v2.ayahRanges[key]) _v2.ayahRanges[key] = { start: i, end: i };
    _v2.ayahRanges[key].end = i;
  });
  _v2MarkExpected();
  _v2FitFont();
}

// scale text so every line fits: height-driven, then shrink for overflow.
// Content width is summed from children (scrollWidth misses the half that
// centered/justified RTL lines spill on the inline-start side).
function _v2LineRatio(host) {
  let worst = 1;
  host.querySelectorAll('.tpv2-line').forEach(l => {
    if (!l.clientWidth || !l.children.length) return;
    const gap = parseFloat(getComputedStyle(l).columnGap) || 0;
    let w = gap * (l.children.length - 1);
    for (const c of l.children) w += c.offsetWidth;
    worst = Math.max(worst, w / l.clientWidth);
  });
  return worst;
}

function _v2FitFont() {
  const host = document.getElementById('tpv2PageHost');
  if (!host) return;
  const rows = host.children.length || 15;
  let fs = Math.max(13, Math.min(
    (host.clientHeight / rows) * 0.52,
    host.clientWidth / 14
  ));
  host.style.fontSize = fs + 'px';
  for (let pass = 0; pass < 3; pass++) {
    const worst = _v2LineRatio(host);
    if (worst <= 1.01) break;
    fs = Math.max(10, fs / (worst * 1.02));
    host.style.fontSize = fs + 'px';
  }
}

// ── Reveal / mask primitives ──────────────────────────────────────────
function _v2UpdateRules() {
  document.querySelectorAll('#tpv2PageHost .tpv2-line').forEach(l =>
    l.classList.toggle('has-hidden', l.querySelector('.tpv2-word.masked') !== null));
}

function _v2RevealWord(i, missed) {
  const w = _v2.words[i];
  if (!w || !w.span.classList.contains('masked')) return;
  w.span.classList.remove('masked', 'expected');
  w.span.classList.add('just-revealed');
  if (missed) w.span.classList.add('missed');
  setTimeout(() => w.span.classList.remove('just-revealed'), 650);
  const key = w.surah + '_' + w.ayah;
  const range = _v2.ayahRanges[key];
  if (range && i === range.end && _v2.markers[key]) _v2.markers[key].classList.add('lit');
}

function _v2MaskWord(i) {
  const w = _v2.words[i];
  if (!w) return;
  w.span.classList.add('masked');
  w.span.classList.remove('missed', 'just-revealed', 'expected');
  const key = w.surah + '_' + w.ayah;
  if (_v2.markers[key]) _v2.markers[key].classList.remove('lit');
}

function _v2MarkExpected() {
  document.querySelectorAll('#tpv2PageHost .tpv2-word.expected')
    .forEach(el => el.classList.remove('expected'));
  const w = _v2.words[_v2.ptr];
  if (w) w.span.classList.add('expected');
  _v2UpdateRules();
  const done = _v2.ptr >= _v2.words.length && _v2.words.length > 0;
  document.getElementById('tasmeeProPanel').classList.toggle('complete', done);
  if (done) showCustomToast('🎉 أتممت تسميع الصفحة كاملة — أحسنت!');
}

function _v2SetPtr(p) {
  const target = Math.max(0, Math.min(p, _v2.words.length));
  while (_v2.ptr < target) { _v2RevealWord(_v2.ptr); _v2.ptr++; }
  while (_v2.ptr > target) { _v2.ptr--; _v2MaskWord(_v2.ptr); }
  _v2MarkExpected();
}

function _v2CountError() {
  _v2.errors++;
  const badge = document.getElementById('tpErrorBadge');
  badge.textContent = _v2Digits(_v2.errors) + ' أخطاء';
  badge.classList.remove('bump'); void badge.offsetWidth; badge.classList.add('bump');
  document.getElementById('tpErrorPill').textContent = 'أخطاء ' + _v2Digits(_v2.errors);
  const w = _v2.words[_v2.ptr];
  if (w) {
    w.span.classList.add('flash-err');
    setTimeout(() => w.span.classList.remove('flash-err'), 650);
  }
}

// ── Live stream matching: reveal words as they are recited ───────────
function _v2FuzzyEq(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length > 3 && (a.startsWith(b) || b.startsWith(a))) return true;
  if (Math.abs(a.length - b.length) > 2) return false;
  // single edit tolerance for words longer than 3 chars
  if (Math.min(a.length, b.length) <= 3) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function _tpHandleStreamResult(data) {
  if (!data.transcript) return;
  const strip = document.getElementById('tpLiveStrip');
  strip.innerHTML = '';
  const spoken = data.transcript.split(/\s+/).filter(Boolean);
  spoken.slice(-8).forEach((w, i) => {
    const sp = document.createElement('span');
    sp.className = 'tp-live-word';
    sp.textContent = w;
    sp.style.animationDelay = (i * 0.04) + 's';
    strip.appendChild(sp);
  });

  // transcript is cumulative for this recording → re-match from streamBase
  let p = _v2.streamBase;
  const missed = [];
  for (const raw of spoken) {
    if (p >= _v2.words.length) break;
    const tw = _v2Norm(raw);
    if (!tw) continue;
    if (_v2FuzzyEq(tw, _v2.words[p].norm)) { p++; continue; }
    // lookahead: reciter skipped up to 2 words → flag them as missed
    for (let ahead = 1; ahead <= 2 && p + ahead < _v2.words.length; ahead++) {
      if (_v2FuzzyEq(tw, _v2.words[p + ahead].norm)) {
        for (let m = 0; m < ahead; m++) missed.push(p + m);
        p += ahead + 1;
        break;
      }
    }
  }
  if (p > _v2.ptr) {
    for (let i = _v2.ptr; i < p; i++) _v2RevealWord(i, missed.includes(i));
    _v2.ptr = p;
    _v2MarkExpected();
  }
}

// ── Final chunk result (worker 'result' → _tarteelOnMsg) ─────────────
function _aiHandleResult(result) {
  _tarteelProcessing = false;
  document.getElementById('tpMicBtn').className = 'tp-mic-btn';
  document.getElementById('tpRecTimer').textContent = '00:00';
  document.getElementById('tpLiveStrip').classList.remove('active');
  if (!result || !result.surah) {
    showCustomToast('لم يُتعرَّف على التلاوة — حاول مجدداً');
    _v2CountError();
    return;
  }
  const key = result.surah + '_' + result.ayah;
  const range = _v2.ayahRanges[key];
  if (!range) {
    showCustomToast((result.surahName || 'سورة') + ' — الآية ' + _v2Digits(result.ayah) + ' ليست في هذه الصفحة');
    _v2CountError();
    return;
  }
  // wrong place? expected pointer should sit inside/before this ayah
  if (_v2.ptr < range.start) {
    // reciter jumped ahead: words in between were skipped
    showCustomToast('انتقلت إلى آية متقدمة — راجع ما قبلها');
    _v2CountError();
  }
  _v2SetPtr(Math.max(_v2.ptr, range.end + 1));
  showCustomToast('✓ ' + (result.surahName || '') + ' — الآية ' + _v2Digits(result.ayah));
}

// ── Panel lifecycle ───────────────────────────────────────────────────
async function _v2Open(pageNumber) {
  try {
    await _v2LoadQuranText();
  } catch (e) {
    showCustomToast('تعذر تحميل نص المصحف');
    return;
  }
  if (!db || !dbReady) {
    showCustomToast('قاعدة البيانات غير جاهزة بعد — أعد المحاولة');
    return;
  }
  _v2.page = pageNumber;
  _v2.errors = 0;
  _v2.peek = false;

  document.getElementById('tpPageLabel').textContent = 'صفحة ' + _v2Digits(pageNumber);
  document.getElementById('tpErrorBadge').textContent = '٠ أخطاء';
  document.getElementById('tpErrorPill').textContent = 'أخطاء ٠';
  const surah = (typeof SURAH_MAP !== 'undefined') &&
    [...SURAH_MAP].reverse().find(s => pageNumber >= s.page);
  document.getElementById('tpv2Surah').textContent = surah ? 'سورة ' + surah.name : '';

  const mb = document.getElementById('tpMicBtn');
  mb.className = 'tp-mic-btn';
  document.getElementById('tpMicIcon').style.display = '';
  document.getElementById('tpStopIcon').style.display = 'none';
  document.getElementById('tpEyeBtn').classList.remove('active');
  document.getElementById('tasmeeProPanel').classList.remove('complete');

  document.getElementById('tasmeeProPanel').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => _v2RenderPage(pageNumber));
}

async function startAITasmee() {
  if (!_tarteelReady) return;
  closeTarteelSheet();
  _v2Open(currentPage);
}

function closeTasmeePro() {
  _tarteelTasmeeMode = false; _tp.recording = false;
  clearInterval(_tp.timerInterval); clearInterval(_tpStreamTimer);
  if (_tp.stream) { _tp.stream.getTracks().forEach(t => t.stop()); _tp.stream = null; }
  if (_tpScriptProc) { _tpScriptProc.disconnect(); _tpScriptProc = null; }
  if (_tpAudioCtx) { _tpAudioCtx.close().catch(() => {}); _tpAudioCtx = null; }
  _tpAllSamples = [];
  _v2.words = []; _v2.markers = {}; _v2.ayahRanges = {}; _v2.ptr = 0;
  const host = document.getElementById('tpv2PageHost');
  if (host) host.innerHTML = '';
  document.getElementById('tpLiveStrip').classList.remove('active');
  document.getElementById('tpRecDot').className = 'tp-rec-dot';
  document.getElementById('tasmeeProPanel').style.display = 'none';
  document.body.style.overflow = '';
}

// ── Dock actions ──────────────────────────────────────────────────────
function tpToggleText() {
  _v2.peek = !_v2.peek;
  document.getElementById('tpEyeBtn').classList.toggle('active', _v2.peek);
  document.getElementById('tpv2PageHost').classList.toggle('peek', _v2.peek);
}

function tpPrev() {           // step one word back
  _v2SetPtr(_v2.ptr - 1);
  _v2.streamBase = Math.min(_v2.streamBase, _v2.ptr);
}

function tpSkipBack() {       // re-mask the previous ayah and retry it
  const prev = _v2.words[_v2.ptr - 1];
  if (!prev) return;
  const range = _v2.ayahRanges[prev.surah + '_' + prev.ayah];
  _v2SetPtr(range ? range.start : 0);
  _v2.streamBase = Math.min(_v2.streamBase, _v2.ptr);
  showCustomToast('أُعيد إخفاء الآية — أعد تلاوتها');
}

// keep streamBase in sync: every new recording starts matching from ptr
(function () {
  const orig = window.tpToggleRecord;
  window.tpToggleRecord = async function () {
    if (!_tp.recording) _v2.streamBase = _v2.ptr;
    return orig.apply(this, arguments);
  };
})();

window.addEventListener('resize', () => {
  if (document.getElementById('tasmeeProPanel').style.display === 'none') return;
  cancelAnimationFrame(_v2.fitRaf);
  _v2.fitRaf = requestAnimationFrame(_v2FitFont);
});

// glyph widths change once Scheherazade/marker fonts arrive → refit
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    if (document.getElementById('tasmeeProPanel').style.display !== 'none') _v2FitFont();
  });
}

// Test/demo hook: open the panel without the speech model (mic disabled
// until the model is downloaded, but rendering is fully inspectable).
window.tpv2OpenDemo = function (page) { _v2Open(page || currentPage); };
window._tpv2 = _v2;
