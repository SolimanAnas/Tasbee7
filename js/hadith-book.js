/* hadith-book.js — the single-book hadith reader (list, reader, memorization
   mode, sharing, per-hadith recitation). Each page sets window.HADITH_BOOK:
     { title, pageUrl, storageKey, data, cats: {key: label}, meta: [[title, narrator, source, cat], …] }
   and provides the markup (see pages/nawawi.html). Data file format:
     { audio?: {base, reader, source}, hadiths: [{ n, blocks, en?, audio?, grade?, title?, narrator?, source?, cat? }] }
   blocks: {p: [[text, isMatn], …]} paragraphs, {src: '…'} takhreej lines,
           {head: {n, repeat, audio, short}} starts one supplication in a chapter-style
           book (حصن المسلم): number, repeat counter and its own share button,
           {tr: 'translation', tl: 'transliteration'} that supplication's translation.
   Optional labels (CFG.labels) rename «الحديث» etc. for books that are not hadith lists. */
(function () {
  'use strict';

  // Per-book settings come from the page (window.HADITH_BOOK).
  const CFG = window.HADITH_BOOK || {};
  const BOOK = CFG.title;
  const PAGE_URL = CFG.pageUrl;
  const KEY = CFG.storageKey;
  const CATS = CFG.cats || {};
  const META = CFG.meta || [];
  const L = Object.assign({
    unit: 'الحديث',            // «الحديث ٥ من ٤٢»
    units: 'الأحاديث',
    daily: 'حديث اليوم',
    legend: 'كلام النبي ﷺ مميَّز بـ',
    empty: 'لا توجد أحاديث مطابقة.',
    loadErr: 'تعذّر تحميل الأحاديث. تحقق من الاتصال ثم أعد المحاولة.'
  }, CFG.labels || {});
  const $ = id => document.getElementById(id);
  const ar = n => Number(n).toLocaleString('ar-EG');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

  let H = [];                 // hadiths
  let cur = -1;               // open index
  let filter = 'all';
  let memo = false;
  const S = { read: [], mem: [], fav: [], last: 0, fs: 1, trans: false, rep: 0, auto: true, speed: 1, pmin: false };
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* private mode */ }
  ['read','mem','fav'].forEach(k => { if (!Array.isArray(S[k])) S[k] = []; });
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
  const has = (k, n) => S[k].includes(n);

  // ---- theme ----
  window.addEventListener('themechange', e => {
    const t = e.detail.theme;
    document.querySelectorAll('.theme-dock .dot').forEach(d => d.classList.toggle('active', d.dataset.set === t));
  });
  ThemeManager.init();
  window.setTheme = t => ThemeManager.set(t);

  const plain = s => s.replace(/[ً-ْٰـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

  // Data (assets/hadith/nawawi40-matn.json): each hadith is a list of blocks —
  //   {p: [[text, isMatn], …]}  a paragraph; isMatn marks the Prophet's ﷺ words
  //   {src: '…'}                 the takhreej (who narrated it), after the hadith
  function decorate(w) { return esc(w).replace(/ﷺ/g, '<span class="saw">ﷺ</span>'); }
  const ICON_IMG = '<svg class="i" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>';
  function headHtml(b, k) {
    const h = b.head, r = +h.repeat || 1;
    return `<div class="dua-head" data-k="${k}">
        <span class="dua-n">${ar(h.n)}</span>
        ${h.tag ? `<span class="dua-tag">${esc(h.tag)}</span>` : ''}
        ${r > 1 ? `<button class="dua-count" data-left="${r}" data-total="${r}" aria-label="عدّاد التكرار">${ar(r)} مرات</button>` : ''}
        <span class="spacer"></span>
        <button class="dua-share" data-k="${k}" aria-label="مشاركة هذا الذكر كصورة أو فيديو" title="مشاركة كصورة أو فيديو">${ICON_IMG}</button>
      </div>`;
  }
  function blocksHtml(blocks) {
    let i = 0;
    const words = t => t.split(/(\s+)/).map(w => /^\s+$/.test(w) || !w ? w : `<span class="mw" data-w="${i++}">${decorate(w)}</span>`).join('');
    return blocks.map((b, k) => b.head ? headHtml(b, k)
      : b.tr != null ? `<div class="trans dtr"${S.trans ? '' : ' hidden'}>${b.tl ? `<span class="nar">${esc(b.tl)}</span>` : ''}${esc(b.tr)}</div>`
      : b.src != null
      ? `<div class="src"><b>التخريج</b>${esc(b.src).replace(/\n/g, '<br>')}</div>`
      : '<p>' + b.p.map(([t, m]) => {
          if (!m) return words(t);
          const lead = t.match(/^\s*/)[0], tail = t.match(/\s*$/)[0];
          return lead + `<span class="matn">${words(t.trim())}</span>` + tail;
        }).join('') + '</p>'
    ).join('');
  }
  // Plain text for copying / sharing / the image card: matn inside « ».
  function plainOf(blocks, withSrc) {
    return blocks.filter(b => b.p || (b.src != null && (withSrc || b !== blocks[blocks.length - 1])))
      .map(b => b.src != null ? b.src : b.p.map(([t, m]) => m ? t.replace(/^(\s*)(.*?)(\s*)$/, '$1«$2»$3') : t).join('')).join('\n');
  }

  // Optional grading: {label: 'صحيح', by: 'الألباني', weak: false, note: '…'}
  function gradeTag(h) {
    const g = h.grade; if (!g) return '';
    return `<span class="tag grade${g.weak ? ' weak' : ''}">الحكم: ${esc(g.label)}${g.by ? ' — ' + esc(g.by) : ''}</span>`;
  }
  function gradeNote(h) {
    const g = h.grade; return g && g.note ? `<div class="grade-note${g.weak ? ' weak' : ''}"><b>درجة الحديث</b>${esc(g.note)}</div>` : '';
  }
  const srcLabel = h => /^كتاب/.test(h.source) ? 'رويناه في ' + h.source : 'رواه ' + h.source;

  // ---- load ----
  let AUDIO = null;
  fetch(CFG.data).then(r => r.json()).then(d => {
    AUDIO = d.audio || null;
    if (!AUDIO) document.body.classList.add('no-audio');
    H = d.hadiths.map((h, i) => {
      // titles etc. live in the data file (h.title …) or in the page config (META)
      const m = h.title ? [h.title, h.narrator || '', h.source || '', h.cat || ''] : (META[i] || ['الحديث ' + ar(i + 1), '', '', '']);
      const text = plainOf(h.blocks, false);
      const takhreej = h.blocks[h.blocks.length - 1].src || '';
      const count = h.blocks.filter(b => b.head).length;
      return {
        n: h.n, title: m[0], narrator: m[1], source: m[2], cat: m[3], blocks: h.blocks, text, takhreej,
        grade: h.grade || null, count,
        audio: h.audio && AUDIO ? AUDIO.base + encodeURIComponent(h.audio) : '',
        en: h.en && (h.en.text || h.en.nar) ? h.en : null,
        norm: plain(text + ' ' + m[0] + ' ' + m[1] + ' ' + takhreej)
      };
    });
    renderChips(); renderList(); renderStats(); renderDaily(); syncPlayer();
    const m = location.hash.match(/^#(\d{1,3})$/);
    if (m && +m[1] >= 1 && +m[1] <= H.length) {
      try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) { /* ignore */ }
      openReader(+m[1] - 1);
    }
  }).catch(() => {
    $('list').innerHTML = `<div class="empty">${esc(L.loadErr)}</div>`;
  });

  // ---- list view ----
  // inline icons (the page avoids emoji-range characters such as ★ ✓)
  const CHIP_STAR = '<svg class="i ci" viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/></svg>';
  const CHIP_CHECK = '<svg class="i ci" viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>';
  const FILTERS = () => [
    ['all', 'الكل', H.length], ['fav', CHIP_STAR + 'المفضلة', S.fav.length], ['mem', CHIP_CHECK + 'المحفوظة', S.mem.length], ['todo', 'لم أحفظها', H.length - S.mem.length],
    ...Object.keys(CATS).map(k => [k, CATS[k], H.filter(h => h.cat === k).length])
  ];
  function renderChips() {
    $('chips').innerHTML = FILTERS().map(([k, l, n]) =>
      `<button class="chip${filter === k ? ' active' : ''}" role="tab" aria-selected="${filter === k}" data-f="${k}">${l}<span class="n">${ar(n)}</span></button>`).join('');
  }
  $('chips').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    filter = b.dataset.f; renderChips(); renderList();
  });
  let qT; $('q').addEventListener('input', () => { clearTimeout(qT); qT = setTimeout(renderList, 180); });

  const ICON_USER = '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
  const ICON_BOOK = '<svg class="i" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/></svg>';
  const STAR = '<svg class="i" viewBox="0 0 24 24" style="fill:currentColor"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/></svg>';
  const EYE = '<svg class="i" viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const MEDAL = '<svg viewBox="0 0 48 48"><use href="#star8"/></svg>';

  function visible() {
    const raw = $('q').value.trim();
    const q = plain(raw.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    return H.filter(h => {
      if (filter === 'fav' && !has('fav', h.n)) return false;
      if (filter === 'mem' && !has('mem', h.n)) return false;
      if (filter === 'todo' && has('mem', h.n)) return false;
      if (CATS[filter] && h.cat !== filter) return false;
      if (!q) return true;
      if (/^\d+$/.test(q)) return h.n === +q;
      return h.norm.includes(q);
    });
  }
  function renderList() {
    const items = visible();
    if (!items.length) { $('list').innerHTML = `<div class="empty">${esc(L.empty)}</div>`; return; }
    $('list').innerHTML = items.map((h, k) => `
      <button class="h-card${has('mem', h.n) ? ' mem' : ''}" role="listitem" data-i="${h.n - 1}" style="animation-delay:${Math.min(k, 12) * 25}ms">
        <span class="num">${MEDAL}<span>${ar(h.n)}</span></span>
        <span class="h-body">
          <span class="h-title">${esc(h.title)}</span>
          <span class="h-meta">${h.narrator ? `<span>${ICON_USER}${esc(h.narrator)}</span>` : ''}${h.source ? `<span>${ICON_BOOK}${esc(h.source)}</span>` : ''}${h.count ? `<span>${ICON_BOOK}${ar(h.count)} ${h.count === 1 ? 'ذكر' : h.count === 2 ? 'ذكران' : h.count <= 10 ? 'أذكار' : 'ذكرًا'}</span>` : ''}${h.grade && h.grade.weak ? `<span class="g-weak">${esc(h.grade.label)}</span>` : ''}</span>
        </span>
        <span class="h-flags">${has('fav', h.n) ? STAR : ''}${has('read', h.n) && !has('mem', h.n) ? '<span class="read">' + EYE + '</span>' : ''}</span>
      </button>`).join('');
  }
  $('list').addEventListener('click', e => { const c = e.target.closest('.h-card'); if (c) openReader(+c.dataset.i); });

  function renderStats() {
    $('stRead').textContent = ar(S.read.length);
    $('stMem').textContent = ar(S.mem.length);
    $('stFav').textContent = ar(S.fav.length);
    const total = H.length || 42;
    const pct = Math.round(S.mem.length / total * 100);
    $('memBar').style.width = pct + '%';
    $('memLabel').textContent = `تقدّم الحفظ: ${ar(S.mem.length)} من ${ar(total)} (${ar(pct)}٪)`;
    $('continueLabel').textContent = S.last ? `تابع من ${L.unit} ${ar(S.last)}` : 'ابدأ القراءة';
  }

  function dayIndex() {
    const d = new Date(), start = new Date(d.getFullYear(), 0, 0);
    return Math.floor((d - start) / 864e5) % H.length;
  }
  function renderDaily() {
    const h = H[dayIndex()];
    $('daily').innerHTML = `
      <div class="daily-head">
        <svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
        ${esc(L.daily)}<span class="spacer"></span><span style="color:var(--text-muted);font-weight:700">رقم ${ar(h.n)}</span>
      </div>
      <div class="daily-title">${esc(h.title)}</div>
      <div class="daily-text">${blocksHtml([h.blocks.find(b => b.p)])}</div>
      <div class="daily-actions">
        <button class="chip-btn" onclick="openReader(${h.n - 1})">
          <svg class="i" viewBox="0 0 24 24"><path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2z"/><path d="M22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z"/></svg>اقرأ كاملاً</button>
        <button class="chip-btn" onclick="shareImageOf(${h.n - 1})">
          <svg class="i" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>شاركه كصورة</button>
      </div>`;
  }

  // ---- reader ----
  window.openReader = function (i) {
    if (!H[i]) return;
    const wasOpen = cur >= 0;
    // Push the back-button sentinel first so the #n hash lands on it, not on the list entry.
    if (!wasOpen && window.BackClose) BackClose.opened(closeReaderUi);
    cur = i; memo = false;
    renderReader();
    if (!wasOpen) {
      $('mini').hidden = true;
      $('reader').classList.add('open'); $('reader').setAttribute('aria-hidden', 'false');
      document.body.classList.add('reader-open');
    }
  };
  function closeReaderUi() {
    cur = -1;
    $('reader').classList.remove('open'); $('reader').setAttribute('aria-hidden', 'true');
    document.body.classList.remove('reader-open');
    try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) { /* ignore */ }
    renderList(); renderStats(); renderChips();
    syncPlayer();
  }
  window.closeReader = function () {
    if (cur < 0) return;
    if (window.BackClose) BackClose.closed();
    closeReaderUi();
  };

  function renderReader() {
    const h = H[cur];
    if (!has('read', h.n)) { S.read.push(h.n); }
    S.last = h.n; save();
    try { history.replaceState(history.state, '', '#' + h.n); } catch (e) { /* ignore */ }
    document.documentElement.style.setProperty('--fs', S.fs);
    $('rPos').innerHTML = `${L.unit} ${ar(h.n)} من ${ar(H.length)}<small>${esc(CATS[h.cat] || '')}</small>`;
    $('rBar').style.width = (h.n / H.length * 100) + '%';
    const trans = h.en && (h.en.text || h.en.nar);
    const hasTr = trans || h.blocks.some(b => b.tr);
    $('rInner').innerHTML = `
      <div class="r-head">
        <div class="medal">${MEDAL}<span>${ar(h.n)}</span></div>
        <h2 class="r-title">${esc(h.title)}</h2>
        <div class="r-tags">
          ${h.narrator ? `<span class="tag">${ICON_USER}الراوي: ${esc(h.narrator)}</span>` : ''}
          ${h.source ? `<span class="tag">${ICON_BOOK}${esc(srcLabel(h))}</span>` : ''}
          ${h.count ? `<span class="tag">${ICON_BOOK}${ar(h.count)} ${h.count === 1 ? 'ذكر' : h.count === 2 ? 'ذكران' : h.count <= 10 ? 'أذكار' : 'ذكرًا'}</span>` : ''}
          ${CATS[h.cat] ? `<span class="tag cat">${esc(CATS[h.cat])}</span>` : ''}
          ${gradeTag(h)}
        </div>
        <div class="ornament"><svg viewBox="0 0 48 48"><use href="#star8"/></svg></div>
      </div>
      <article class="text-card${memo ? ' memo' : ''}" id="tCard">
        <div class="memo-hint">وضع الحفظ: اضغط على أي كلمة لإظهارها، أو استخدم الأزرار بالأسفل</div>
        <div class="legend">${esc(L.legend)} <i>«اللون والخط العريض»</i></div>
        <div class="ar" id="arText">${blocksHtml(h.blocks)}</div>
        <div class="memo-bar">
          <button class="tool" onclick="revealNext()">إظهار الكلمة التالية</button>
          <button class="tool" onclick="revealAll(true)">إظهار الكل</button>
          <button class="tool" onclick="revealAll(false)">إخفاء الكل</button>
        </div>
        ${trans ? `<div class="trans" id="trans"${S.trans ? '' : ' hidden'}>${h.en.nar ? `<span class="nar">${esc(h.en.nar)}</span>` : ''}${esc(h.en.text).replace(/\n+/g, '<br>')}</div>` : ''}
      </article>
      ${gradeNote(h)}
      <div class="tools">
        ${hasTr ? `<button class="tool${S.trans ? ' on' : ''}" id="tTrans" onclick="toggleTrans()">
          <svg class="i" viewBox="0 0 24 24"><path d="m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6"/></svg>الترجمة</button>` : ''}
        <button class="tool${memo ? ' on' : ''}" id="tMemo" onclick="toggleMemo()">
          <svg class="i" viewBox="0 0 24 24"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24A2.5 2.5 0 0 1 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24A2.5 2.5 0 0 0 14.5 2z"/></svg>وضع الحفظ</button>
        <button class="tool" onclick="copyHadith()">
          <svg class="i" viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>نسخ</button>
        <button class="tool" onclick="shareImageOf(${cur})">
          <svg class="i" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>صورة</button>
      </div>
      <div class="swipe-hint">اسحب يميناً أو يساراً للتنقل بين ${esc(L.units)}</div>`;
    $('dPrev').disabled = cur <= 0;
    $('dNext').disabled = cur >= H.length - 1;
    syncDock();
    $('rScroll').scrollTop = 0;
    // Keep the audio on the hadith being read: switching hadith while playing switches the track.
    if (audioIdx !== cur && !audio.paused) loadTrack(cur, true); else syncPlayer();
  }
  function syncDock() {
    const n = H[cur].n;
    $('dFav').classList.toggle('on', has('fav', n));
    $('dMem').classList.toggle('on', has('mem', n));
    $('dFav').setAttribute('aria-pressed', has('fav', n));
    $('dMem').setAttribute('aria-pressed', has('mem', n));
  }
  window.step = function (d) {
    const i = cur + d;
    if (i < 0 || i >= H.length) return;
    cur = i; memo = false; renderReader();
  };
  window.toggleFlag = function (k) {
    const n = H[cur].n, a = S[k], at = a.indexOf(n);
    if (at >= 0) a.splice(at, 1); else a.push(n);
    save(); syncDock(); renderStats();
    toast(k === 'fav' ? (at >= 0 ? 'أُزيل من المفضلة' : 'أُضيف إلى المفضلة')
                      : (at >= 0 ? 'أُزيلت علامة الحفظ' : `ما شاء الله! حفظت ${ar(S.mem.length)} من ${ar(H.length)}`));
  };
  window.toggleTrans = function () {
    S.trans = !S.trans; save();
    document.querySelectorAll('#rInner .trans').forEach(t => { t.hidden = !S.trans; });
    $('tTrans').classList.toggle('on', S.trans);
  };
  window.fontStep = function (d) {
    S.fs = Math.min(1.8, Math.max(0.8, Math.round((S.fs + d * 0.1) * 10) / 10)); save();
    document.documentElement.style.setProperty('--fs', S.fs);
  };

  // memorization mode
  window.toggleMemo = function () {
    memo = !memo;
    $('tCard').classList.toggle('memo', memo);
    $('tMemo').classList.toggle('on', memo);
    revealAll(!memo);
  };
  window.revealAll = function (show) {
    document.querySelectorAll('#arText .mw').forEach(w => w.classList.toggle('h', !show));
  };
  window.revealNext = function () {
    const w = document.querySelector('#arText .mw.h');
    if (w) { w.classList.remove('h'); w.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    else toast('أحسنت! ظهرت كل الكلمات');
  };
  $('rInner').addEventListener('click', e => {
    const cnt = e.target.closest('.dua-count');
    if (cnt) {                                  // tap counter: counts the repetitions down
      let left = +cnt.dataset.left;
      left = left > 0 ? left - 1 : +cnt.dataset.total;
      cnt.dataset.left = left;
      cnt.classList.toggle('done', left === 0);
      cnt.textContent = left === 0 ? 'تمّ' : `${ar(left)} مرات`;
      if (left === 0 && navigator.vibrate) navigator.vibrate(30);
      return;
    }
    const sh = e.target.closest('.dua-share');
    if (sh) { shareDua(cur, +sh.dataset.k); return; }
    if (!memo) return;
    const w = e.target.closest('.mw'); if (w) w.classList.toggle('h');
  });

  // swipe (RTL: finger → right = next, like the other readers)
  let sx = 0, sy = 0, st = 0;
  $('rScroll').addEventListener('touchstart', e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); }, { passive: true });
  $('rScroll').addEventListener('touchend', e => {
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (Date.now() - st > 600 || Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
    if (window.getSelection && String(window.getSelection())) return;
    step(dx > 0 ? 1 : -1);
  }, { passive: true });
  document.addEventListener('keydown', e => {
    if (cur < 0 || e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowLeft') step(1);
    else if (e.key === 'ArrowRight') step(-1);
    else if (e.key === 'Escape' && !$('shareSheet').classList.contains('open')) closeReader();
    else if (e.key === ' ' && e.target.tagName !== 'BUTTON') { e.preventDefault(); togglePlay(); }
  });

  // ---- audio: one recitation track per hadith ----
  const audio = $('audio');
  const REPS = [0, 3, 5, 10, Infinity];          // plays per hadith (0 = no repeat)
  const SPEEDS = [0.75, 1, 1.25, 1.5];
  const ICON_PLAY = '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>';
  const ICON_PAUSE = '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
  const ICON_LOAD = '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
  let audioIdx = -1, playsLeft = 0, loading = false;
  if (!REPS[S.rep]) S.rep = 0;
  if (!SPEEDS.includes(S.speed)) S.speed = 1;
  const fmt = t => !isFinite(t) || t < 0 ? '0:00' : Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');

  function loadTrack(i, play) {
    if (!H[i] || !H[i].audio) return;
    audioIdx = i; playsLeft = REPS[S.rep] || 1;
    audio.src = H[i].audio; audio.playbackRate = S.speed;
    if (play) start();
    setMediaSession();
    syncPlayer();
  }
  function start() {
    loading = true; syncPlayer();
    const p = audio.play();
    if (p && p.catch) p.catch(e => { loading = false; syncPlayer(); if (e && e.name !== 'AbortError') toast('تعذّر تشغيل الصوت — تحقق من الاتصال'); });
  }
  window.togglePlay = function () {
    const want = cur >= 0 ? cur : (audioIdx >= 0 ? audioIdx : 0);
    if (audioIdx !== want && cur >= 0) return loadTrack(want, true);
    if (audioIdx < 0) return loadTrack(want, true);
    if (audio.paused) start(); else audio.pause();
  };
  window.playStep = function (d) {
    const i = (audioIdx >= 0 ? audioIdx : Math.max(cur, 0)) + d;
    if (i < 0 || i >= H.length) return;
    loadTrack(i, true);
    if (cur >= 0) { cur = i; memo = false; renderReader(); }
  };
  window.seekBy = d => { if (audioIdx >= 0 && isFinite(audio.duration)) audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + d)); };
  window.cycleRepeat = function () {
    S.rep = (S.rep + 1) % REPS.length; save();
    playsLeft = REPS[S.rep] || 1;
    syncPlayer();
    toast(S.rep ? `تكرار ${L.unit} ${REPS[S.rep] === Infinity ? 'بلا توقف' : ar(REPS[S.rep]) + ' مرات'}` : 'التكرار متوقف');
  };
  window.toggleAuto = function () {
    S.auto = !S.auto; save(); syncPlayer();
    toast(S.auto ? `الانتقال التلقائي إلى ${L.unit} التالي: مفعّل` : 'الانتقال التلقائي: متوقف');
  };
  window.cycleSpeed = function () {
    S.speed = SPEEDS[(SPEEDS.indexOf(S.speed) + 1) % SPEEDS.length]; save();
    audio.playbackRate = S.speed; syncPlayer();
  };
  window.stopAudio = function () {
    audio.pause(); audio.removeAttribute('src'); audio.load();
    audioIdx = -1; $('mini').hidden = true; syncPlayer();
  };
  window.listenAll = function () {
    if (!S.auto) { S.auto = true; save(); }
    openReader(0); loadTrack(0, true);
  };

  audio.addEventListener('playing', () => { loading = false; syncPlayer(); });
  audio.addEventListener('waiting', () => { loading = true; syncPlayer(); });
  audio.addEventListener('pause', syncPlayer);
  audio.addEventListener('loadedmetadata', syncPlayer);
  audio.addEventListener('error', () => { if (!audio.getAttribute('src')) return; loading = false; syncPlayer(); toast('تعذّر تحميل التلاوة — تحقق من الاتصال'); });
  audio.addEventListener('timeupdate', () => {
    if (seeking || !isFinite(audio.duration)) return;
    $('pSeek').value = Math.round(audio.currentTime / audio.duration * 1000);
    $('pCur').textContent = fmt(audio.currentTime);
    syncMini();
  });
  audio.addEventListener('ended', () => {
    if (playsLeft === Infinity || playsLeft > 1) {
      if (playsLeft !== Infinity) playsLeft--;
      audio.currentTime = 0; start(); syncPlayer(); return;
    }
    if (S.auto && audioIdx < H.length - 1) { playStep(1); return; }
    syncPlayer();
  });
  let seeking = false;
  $('pSeek').addEventListener('input', () => {
    seeking = true;
    if (isFinite(audio.duration)) $('pCur').textContent = fmt($('pSeek').value / 1000 * audio.duration);
  });
  $('pSeek').addEventListener('change', () => {
    if (audioIdx < 0 && cur >= 0) loadTrack(cur, false);
    if (isFinite(audio.duration)) audio.currentTime = $('pSeek').value / 1000 * audio.duration;
    seeking = false;
  });

  function syncPlayer() {
    const playing = audioIdx >= 0 && !audio.paused;
    const icon = loading && playing ? ICON_LOAD : playing ? ICON_PAUSE : ICON_PLAY;
    ['pPlay', 'pPlayMini', 'miniPlay'].forEach(id => {
      const b = $(id); b.innerHTML = icon; b.classList.toggle('loading', loading && playing);
      b.setAttribute('aria-label', playing ? 'إيقاف مؤقت' : 'تشغيل');
    });
    const here = audioIdx >= 0 && audioIdx === cur;
    if (!here && !seeking) { $('pSeek').value = 0; $('pCur').textContent = '0:00'; }
    $('pDur').textContent = here ? fmt(audio.duration) : '0:00';
    const n = REPS[S.rep];
    $('pRepeat').classList.toggle('on', !!n);
    $('pRepeatN').hidden = !n;
    // badge: repeat count, or "this play / total" while repeating this hadith
    $('pRepeatN').textContent = n === Infinity ? '∞' : !n ? '' : here && playing ? `${ar(n - playsLeft + 1)}/${ar(n)}` : ar(n);
    $('pAuto').classList.toggle('on', S.auto);
    $('pSpeed').textContent = S.speed + '×';
    $('player').title = `تلاوة: ${AUDIO ? AUDIO.reader : ''}`;
    $('player').classList.toggle('min', !!S.pmin);
    syncMini();
    const showMini = cur < 0 && audioIdx >= 0;
    $('mini').hidden = !showMini;
    if (showMini) $('miniT').innerHTML = `${L.unit} ${ar(H[audioIdx].n)}: ${esc(H[audioIdx].title)}<small>${playing ? 'يُتلى الآن' : 'متوقف مؤقتاً'} — اضغط للفتح</small>`;
  }
  Object.defineProperty(window, 'audioIdx', { get: () => audioIdx });   // for the mini player's onclick

  // collapsed pill: hadith number, elapsed / total, progress fill
  function syncMini() {
    const here = audioIdx >= 0 && audioIdx === cur, i = cur >= 0 ? cur : Math.max(audioIdx, 0);
    const d = here && isFinite(audio.duration) ? audio.duration : 0;
    const tm = here ? `${fmt(audio.currentTime)} / ${fmt(d)}` : '';
    $('pMiniT').innerHTML = H[i] ? `${L.unit} ${ar(H[i].n)}<small>${tm}</small>` : '';
    $('player').style.setProperty('--pp', d ? (audio.currentTime / d * 100).toFixed(1) + '%' : '0%');
  }
  window.setPlayerMin = function (v) { S.pmin = !!v; save(); syncPlayer(); };

  function setMediaSession() {
    if (!('mediaSession' in navigator) || audioIdx < 0) return;
    const h = H[audioIdx];
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `${L.unit} ${ar(h.n)}: ${h.title}`, artist: AUDIO.reader, album: BOOK,
        artwork: [{ src: new URL('../icons/icon_512.png', location.href).href, sizes: '512x512', type: 'image/png' }]
      });
      const ms = navigator.mediaSession;
      ms.setActionHandler('play', () => start());
      ms.setActionHandler('pause', () => audio.pause());
      ms.setActionHandler('previoustrack', () => playStep(-1));
      ms.setActionHandler('nexttrack', () => playStep(1));
      ms.setActionHandler('seekbackward', () => seekBy(-5));
      ms.setActionHandler('seekforward', () => seekBy(5));
    } catch (e) { /* older browsers */ }
  }

  window.continueReading = () => openReader(Math.max(0, (S.last || 1) - 1));
  window.openRandom = () => openReader(Math.floor(Math.random() * H.length));

  // ---- sharing ----
  let shareIdx = -1;
  function shareTextOf(h) {
    return `📖 ${BOOK} — ${L.unit} ${ar(h.n)}: ${h.title}\n\n${h.text}\n\n${h.takhreej}\n\n${PAGE_URL}#${h.n}`;
  }
  window.openShare = function () {
    shareIdx = cur;
    const h = H[cur];
    $('shareSub').textContent = `${L.unit} ${ar(h.n)}: ${h.title}`;
    $('shareOverlay').classList.add('open'); $('shareSheet').classList.add('open');
    if (window.BackClose) BackClose.opened(closeShareUi);
  };
  function closeShareUi() { $('shareOverlay').classList.remove('open'); $('shareSheet').classList.remove('open'); }
  window.closeShare = function () {
    if (!$('shareSheet').classList.contains('open')) return;
    if (window.BackClose) BackClose.closed();
    closeShareUi();
  };
  window.shareImageOf = function (i) {
    const h = H[i]; if (!h || !window.ShareCard) return;
    ShareCard.open({
      text: h.text,
      translation: h.en ? [h.en.nar, h.en.text].filter(Boolean).join(' ') : '',
      title: `${BOOK} • ${L.unit} ${ar(h.n)}`,
      source: h.source ? `${h.title} — ${srcLabel(h)}` : h.title,
      audio: h.audio
    });
  };
  // One supplication of a chapter (from its head block to the next head).
  function shareDua(i, k) {
    const h = H[i]; if (!h || !window.ShareCard) return;
    const head = h.blocks[k].head;
    let end = h.blocks.findIndex((b, j) => j > k && b.head); if (end < 0) end = h.blocks.length;
    const part = h.blocks.slice(k + 1, end);
    const tr = part.find(b => b.tr != null);
    ShareCard.open({
      text: plainOf(part.filter(b => b.p), false),
      translation: tr ? tr.tr : '',
      title: `${BOOK} • ${h.title}`,
      source: head.short || '',
      repeat: +head.repeat || 1,
      audio: head.audio && AUDIO ? AUDIO.base + encodeURIComponent(head.audio) : ''
    });
  }
  window.shareAsImage = function () {
    const i = shareIdx >= 0 ? shareIdx : cur;
    // Let the sheet's history.back() land before ShareCard pushes its own
    // back-button entry, or the async back would pop the new one instead.
    let done = false;
    const go = () => { if (done) return; done = true; window.removeEventListener('popstate', go); shareImageOf(i); };
    window.addEventListener('popstate', go);
    setTimeout(go, 400);
    closeShare();
  };
  window.shareText = function () {
    const h = H[shareIdx], text = shareTextOf(h);
    if (navigator.share) navigator.share({ title: `${BOOK} — ${h.title}`, text }).catch(() => {});
    else copy(text, 'تم النسخ — الصقه حيث تريد');
  };
  window.shareTo = function (where) {
    const h = H[shareIdx], text = shareTextOf(h), url = `${PAGE_URL}#${h.n}`;
    const short = `${BOOK} — ${L.unit} ${ar(h.n)}: ${h.title}`;
    const links = {
      wa: 'https://wa.me/?text=' + encodeURIComponent(text),
      tg: 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(short + '\n\n' + h.text),
      x:  'https://twitter.com/intent/tweet?text=' + encodeURIComponent(short) + '&url=' + encodeURIComponent(url),
      fb: 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url)
    };
    window.open(links[where], '_blank', 'noopener');
  };
  window.copyHadith = function () {
    const h = H[shareIdx >= 0 && $('shareSheet').classList.contains('open') ? shareIdx : cur];
    copy(shareTextOf(h), 'تم النسخ');
  };
  window.copyLink = function () { copy(`${PAGE_URL}#${H[shareIdx].n}`, 'تم نسخ الرابط'); };

  function copy(text, msg) {
    const done = () => toast(msg);
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => fallback(text, done));
    else fallback(text, done);
  }
  function fallback(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;top:0'; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('تعذّر النسخ'); }
    ta.remove();
  }
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
  }
})();
