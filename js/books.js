/* books.js — «تحميل كتب PDF» (pages/books.html): a library of PDF books to read or keep.
   Data: data/books/<library>.json (now: «رسالة الحرمين», risala.prh.gov.sa — titles,
   authors and descriptions as published there; each PDF checked: a valid PDF whose
   cover shows that title and author; pages and size measured).

   «تحميل» downloads the PDF (CORS; the site allows it) with progress, keeps it in
   Cache Storage "quran-offline-books-v1" (kept across app updates, listed in the
   download center) and hands the file to the device's downloads. A saved book
   opens from the device, with or without a connection; one not saved opens from
   the publisher. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const T = (k, f, p) => {
    let s = f;
    if (window.I18n) { const v = I18n.t(k, p || {}); if (v && v !== k) return v; }
    if (p) Object.keys(p).forEach(x => { s = String(s).split('{' + x + '}').join(p[x]); });
    return s;
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => Math.round(n).toLocaleString('en-US');
  const mb = n => (n / 1048576).toFixed(1);
  const size = n => '\u2066' + mb(n) + ' MB\u2069';   // kept left-to-right inside Arabic text (else «MB 1.7»)
  const norm = s => String(s || '').replace(/[ً-ْٰـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase();

  if (window.ThemeManager) ThemeManager.init();
  window.setTheme = t => window.ThemeManager && ThemeManager.set(t);
  window.addEventListener('themechange', e => {
    document.querySelectorAll('.theme-dock .dot').forEach(d => d.classList.toggle('active', d.dataset.set === e.detail.theme));
  });

  const CACHE = 'quran-offline-books-v1';
  const hasCaches = typeof caches !== 'undefined';
  let L = null;                 // the library
  let cat = 'all', query = '';
  const saved = new Set();      // PDF URLs kept on the device
  const saving = {};            // url → { pct, ctrl }
  const openDesc = new Set();
  let allRunning = false;

  async function loadSaved() {
    if (!hasCaches) return;
    try { (await (await caches.open(CACHE)).keys()).forEach(r => saved.add(r.url)); } catch { /* no Cache Storage */ }
  }
  async function savedBlob(url) {
    try { const r = await (await caches.open(CACHE)).match(url); return r ? await r.blob() : null; } catch { return null; }
  }
  // the PDF as a file in the device's downloads, under the publisher's own file name
  // (the name risala.prh.gov.sa gives it; browsers may refuse an Arabic download name)
  function giveFile(blob, b) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = decodeURIComponent(b.pdf.split('/').pop()).replace(/\.pdf$/i, '') + '.pdf';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  }
  async function save(b, { file = true, quiet = false } = {}) {
    if (saving[b.pdf] || !hasCaches) return false;
    if (saved.has(b.pdf)) { if (file) { const bl = await savedBlob(b.pdf); if (bl) giveFile(bl, b); } return true; }
    const ctrl = new AbortController();
    saving[b.pdf] = { pct: 0, ctrl };
    paintBook(b);
    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      const res = await fetch(b.pdf, { mode: 'cors', signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const total = Number(res.headers.get('content-length')) || b.size;
      const chunks = []; let got = 0;
      if (res.body && res.body.getReader) {
        const rd = res.body.getReader();
        for (;;) {
          const { done, value } = await rd.read();
          if (done) break;
          chunks.push(value); got += value.length;
          saving[b.pdf].pct = Math.min(99, Math.floor(got / total * 100)); paintProgress(b);
        }
      } else chunks.push(new Uint8Array(await res.arrayBuffer()));
      const blob = new Blob(chunks, { type: 'application/pdf' });
      const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
      if (String.fromCharCode(...head) !== '%PDF-') throw new Error('not a PDF');
      await (await caches.open(CACHE)).put(b.pdf, new Response(blob, { headers: { 'Content-Type': 'application/pdf', 'Content-Length': String(blob.size) } }));
      saved.add(b.pdf);
      delete saving[b.pdf];
      paintBook(b); paintStats();
      if (file) giveFile(blob, b);
      if (!quiet) toast(T('bk_saved', 'حُفظ الكتاب على الجهاز، ويُقرأ الآن دون اتصال.'));
      return true;
    } catch (e) {
      delete saving[b.pdf];
      paintBook(b);
      if (!(e && e.name === 'AbortError') && !quiet) toast(navigator.onLine === false ? T('bk_offline', 'لا يوجد اتصال بالإنترنت.') : T('bk_save_error', 'تعذّر تحميل الكتاب. تحقق من الاتصال والمساحة المتاحة.'));
      return false;
    }
  }
  async function remove(b) {
    try { await (await caches.open(CACHE)).delete(b.pdf); } catch { /* nothing to delete */ }
    saved.delete(b.pdf);
    paintBook(b); paintStats();
  }
  async function read(b) {
    if (saved.has(b.pdf)) {
      const bl = await savedBlob(b.pdf);
      if (bl) {
        const url = URL.createObjectURL(bl);
        const w = window.open(url, '_blank');
        if (!w) giveFile(bl, b);          // pop-ups blocked: hand over the file instead
        setTimeout(() => URL.revokeObjectURL(url), 120000);
        return;
      }
      saved.delete(b.pdf);
    }
    if (navigator.onLine === false) { toast(T('bk_need_save', 'هذا الكتاب غير محفوظ على الجهاز؛ حمّله عند الاتصال لتقرأه دون اتصال.')); return; }
    window.open(b.pdf, '_blank', 'noopener');
  }

  // ---------- render ----------
  const ICON = {
    read: '<svg viewBox="0 0 24 24"><path d="M3 5.5C5.5 4.5 8.5 4.6 11 6.4V20c-2.5-1.6-5.5-1.8-8-.6zM21 5.5c-2.5-1-5.5-.9-8 .9V20c2.5-1.6 5.5-1.8 8-.6z"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/></svg>',
    ok: '<svg viewBox="0 0 24 24"><path d="M5 12.5 10 17 19 7"/></svg>',
    del: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    pages: '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/></svg>',
    size: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/></svg>',
    lang: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z"/></svg>',
  };
  function actsHtml(b) {
    const s = saving[b.pdf];
    const readBtn = `<button class="bk-btn" data-act="read">${ICON.read}<span>${esc(T('bk_read', 'قراءة'))}</span></button>`;
    if (s) return readBtn + `<button class="bk-btn busy" data-act="cancel" style="--pct:${s.pct}%" aria-label="${esc(T('bk_cancel', 'إيقاف التحميل'))}"><span>${num(s.pct)}%</span><span>${esc(T('bk_cancel', 'إيقاف التحميل'))}</span></button>`;
    if (saved.has(b.pdf)) return `<button class="bk-btn primary" data-act="read">${ICON.read}<span>${esc(T('bk_read', 'قراءة'))}</span></button>
      <button class="bk-btn done" data-act="file" title="${esc(T('bk_to_device', 'حفظ الملف في تنزيلات الجهاز'))}">${ICON.ok}<span>${esc(T('bk_on_device', 'محفوظ'))}</span></button>
      <button class="bk-del" data-act="del" aria-label="${esc(T('bk_delete', 'حذف من الجهاز'))}" title="${esc(T('bk_delete', 'حذف من الجهاز'))}">${ICON.del}</button>`;
    return readBtn + `<button class="bk-btn primary" data-act="save">${ICON.down}<span>${esc(T('bk_download', 'تحميل'))} · ${size(b.size)}</span></button>`;
  }
  function bookHtml(b) {
    const isSaved = saved.has(b.pdf);
    return `<article class="bk${isSaved ? ' is-saved' : ''}" id="${esc(b.id)}">
      <div class="bk-cover"><img src="../${esc(b.cover)}" alt="" loading="lazy" decoding="async" width="240" height="340">${isSaved ? `<span class="ok" title="${esc(T('bk_on_device', 'محفوظ'))}">${ICON.ok}</span>` : ''}</div>
      <div class="bk-body">
        <h3 lang="ar" dir="rtl">${esc(b.title)}</h3>
        <div class="bk-author" lang="ar" dir="rtl">${esc(b.author)}</div>
        <div class="bk-meta">
          <span>${ICON.pages}${esc(T('bk_pages', '{n} صفحة', { n: num(b.pages) }))}</span>
          <span>${ICON.size}${size(b.size)}</span>
          ${b.translations ? `<span>${ICON.lang}${esc(T('bk_translations', 'مترجم إلى {n} لغة', { n: num(b.translations) }))}</span>` : ''}
        </div>
        <p class="bk-desc${openDesc.has(b.id) ? ' open' : ''}" lang="ar" dir="rtl">${esc(b.desc)}</p>
        ${b.desc.length > 150 ? `<button class="bk-more" data-act="more">${esc(openDesc.has(b.id) ? T('bk_less', 'أقل') : T('bk_more', 'المزيد'))}</button>` : ''}
      </div>
      <div class="bk-acts">${actsHtml(b)}</div>
    </article>`;
  }
  const visible = () => {
    const q = norm(query.trim());
    return L.books.filter(b => (cat === 'all' || (cat === 'saved' ? saved.has(b.pdf) : b.cat === cat)) &&
      (!q || norm(b.title + ' ' + b.author + ' ' + b.desc).includes(q)));
  };
  function render() {
    const list = visible();
    if (!list.length) { $('bkBody').innerHTML = `<div class="bk-empty">${esc(T('bk_none', 'لا توجد كتب مطابقة.'))}</div>`; return; }
    let html = '';
    if (cat === 'all' && !query.trim()) {
      L.cats.forEach(c => {
        const bs = list.filter(b => b.cat === c.id); if (!bs.length) return;
        html += `<h2 class="bk-cat">${esc(c.name)}<small class="n">${num(bs.length)}</small></h2><div class="bk-list">${bs.map(bookHtml).join('')}</div>`;
      });
    } else html = `<div class="bk-list">${list.map(bookHtml).join('')}</div>`;
    $('bkBody').innerHTML = html;
  }
  function paintChips() {
    const n = id => (id === 'all' ? L.books.length : id === 'saved' ? saved.size : L.books.filter(b => b.cat === id).length);
    const cs = [{ id: 'all', name: T('bk_all', 'الكل') }, ...L.cats, { id: 'saved', name: T('bk_saved_chip', 'المحفوظة') }];
    $('bkChips').innerHTML = cs.map(c => `<button class="chip${c.id === cat ? ' active' : ''}" role="tab" aria-selected="${c.id === cat}" data-cat="${esc(c.id)}">${esc(c.name)}<span class="n">${num(n(c.id))}</span></button>`).join('');
  }
  function paintStats() {
    const bs = L.books.filter(b => saved.has(b.pdf));
    $('stBooks').textContent = num(L.books.length);
    $('stSaved').textContent = num(bs.length);
    $('stSize').textContent = mb(bs.reduce((a, b) => a + b.size, 0));
    const left = L.books.filter(b => !saved.has(b.pdf));
    $('bkAll').hidden = !left.length && !allRunning;
    $('bkAllLabel').textContent = allRunning ? T('bk_all_stop', 'إيقاف حفظ الكل')
      : T('bk_all_save', 'حفظ الكل للقراءة دون اتصال ({mb} MB)', { mb: '\u2066' + mb(left.reduce((a, b) => a + b.size, 0)) }).replace(' MB)', ' MB\u2069)');
    paintChips();
  }
  function paintBook(b) {
    const el = $(b.id);
    if (!el) return;
    if (cat === 'saved' && !saved.has(b.pdf) && !saving[b.pdf]) { render(); return; }
    el.outerHTML = bookHtml(b);
  }
  function paintProgress(b) {
    const card = $(b.id), btn = card && card.querySelector('.bk-btn.busy');
    if (!btn) { paintBook(b); return; }
    btn.style.setProperty('--pct', saving[b.pdf].pct + '%');
    btn.firstElementChild.textContent = num(saving[b.pdf].pct) + '%';
  }
  async function saveAll() {
    if (allRunning) { allRunning = false; Object.values(saving).forEach(s => s.ctrl.abort()); paintStats(); return; }
    allRunning = true; paintStats();
    let ok = 0, failed = 0;
    for (const b of L.books) {
      if (!allRunning) break;
      if (saved.has(b.pdf)) continue;
      if (await save(b, { file: false, quiet: true })) ok++; else if (allRunning) failed++;
    }
    const stopped = !allRunning;
    allRunning = false; paintStats();
    if (!stopped) toast(failed ? T('bk_all_partial', 'حُفظ {n}، وتعذّر {f}. أعد المحاولة لاحقًا.', { n: num(ok), f: num(failed) }) : T('bk_all_done', 'حُفظت الكتب كلها على الجهاز.'));
  }

  // ---------- events ----------
  $('bkBody').addEventListener('click', e => {
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const card = btn.closest('.bk'); const b = card && L.books.find(x => x.id === card.id); if (!b) return;
    switch (btn.dataset.act) {
      case 'read': read(b); break;
      case 'save': save(b); break;
      case 'file': save(b); break;          // already saved: hand the file to the device again
      case 'cancel': if (saving[b.pdf]) saving[b.pdf].ctrl.abort(); break;
      case 'del': if (window.confirm(T('bk_delete_confirm', 'حذف «{t}» من الجهاز؟', { t: b.title }))) remove(b); break;
      case 'more': if (openDesc.has(b.id)) openDesc.delete(b.id); else openDesc.add(b.id); paintBook(b); break;
    }
  });
  $('bkChips').addEventListener('click', e => {
    const c = e.target.closest('[data-cat]'); if (!c) return;
    cat = c.dataset.cat; paintChips(); render();
  });
  $('bkSearch').addEventListener('input', () => { query = $('bkSearch').value; render(); });
  $('bkAll').onclick = saveAll;

  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 3000); }

  async function start() {
    try {
      const [lib] = await Promise.all([fetch('../data/books/risala.json').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }), loadSaved()]);
      L = lib;
    } catch {
      $('bkBody').innerHTML = `<div class="bk-empty">${esc(T('bk_load_error', 'تعذّر تحميل قائمة الكتب. تحقق من الاتصال وحاول مرة أخرى.'))}</div>`;
      return;
    }
    $('bkTitle').textContent = L.title;
    $('bkPublisher').textContent = L.publisher;
    $('bkIntro').textContent = T('bk_intro', 'كتب مختارة من إصدارات «رسالة الحرمين»، لكل كتاب مؤلفه ونبذة عنه. اقرأه، أو حمّله واحفظه على جهازك ليُقرأ دون اتصال.');
    $('bkSrc').innerHTML = `${esc(T('bk_source', 'المصدر: «رسالة الحرمين» — رئاسة الشؤون الدينية بالمسجد الحرام والمسجد النبوي. العناوين والمؤلفون والنبذ كما نُشرت هناك، والكتب تُحمَّل من موقعها:'))}
      <a href="${esc(L.source)}" target="_blank" rel="noopener">${esc(L.source)}</a>`;
    paintStats(); render();
  }
  const go = () => start();
  if (window.I18n) I18n.init().then(go, go); else go();
  window.addEventListener('langchange', () => location.reload());
  window.BooksPage = { get state() { return { cat, saved: [...saved], books: L ? L.books.length : 0 }; }, save: i => save(L.books[i], { file: false }), remove: i => remove(L.books[i]) };
})();
