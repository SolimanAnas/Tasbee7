/* thabat.js — «ثبات»: private journeys of repentance and steadfastness.
   Everything lives in localStorage on this device (key thabat_v1); nothing is sent anywhere.
   A journey keeps every stretch it has had: renewing one's resolve after a slip closes the
   current stretch and opens a new one, so past days of steadfastness are never wiped. */
(function () {
  'use strict';
  const KEY = 'thabat_v1';
  const MILES = [1, 3, 7, 14, 30, 60, 90, 180, 365];
  const COVERS = [1, 2, 3, 4, 5, 6, 7, 8].map(n => `../images/thabat/c${n}.webp`);
  const DAY = 864e5;
  const C = window.THABAT_CONTENT || { ayat: [], hadith: [], dua: [] };
  const $ = id => document.getElementById(id);

  // ---- language helpers (UI follows the app language; the texts stay Arabic) ----
  const lang = () => (window.I18n ? I18n.getLang() : 'ar');
  function T(k, f, p) {
    let s = f;
    if (window.I18n) { const v = I18n.t(k); if (v && v !== k) s = v; }
    if (p) Object.keys(p).forEach(x => { s = String(s).split('{' + x + '}').join(p[x]); });
    return s;
  }
  // Counters use Western digits, like the app's other counters (the Arabic zero «٠»
  // renders as a small diamond in Tajawal and read as a broken character).
  const num = n => Number(n).toLocaleString('en-US');
  const two = n => String(n).padStart(2, '0');
  // Arabic counted nouns: 1 / 2 / 3–10 / 11+
  function counted(n, ar, key1, keyN) {
    if (lang() === 'ar') return n === 1 ? ar[0] : n === 2 ? ar[1] : n <= 10 ? `${num(n)} ${ar[2]}` : `${num(n)} ${ar[3]}`;
    return T(n === 1 ? key1 : keyN, n === 1 ? ar[0] : `{n} ${ar[3]}`, { n: num(n) });
  }
  const daysLabel = n => counted(n, ['يوم واحد', 'يومان', 'أيام', 'يومًا'], 'th_day_one', 'th_day_many');
  const hoursLabel = n => counted(n, ['ساعة واحدة', 'ساعتان', 'ساعات', 'ساعة'], 'th_hour_one', 'th_hour_many');
  const minutesLabel = n => counted(n, ['دقيقة واحدة', 'دقيقتان', 'دقائق', 'دقيقة'], 'th_min_one', 'th_min_many');
  // a remaining time: whole days from two days on, otherwise hours, then minutes
  function leftLabel(ms) {
    if (ms >= 2 * DAY) return daysLabel(Math.floor(ms / DAY));
    if (ms >= 36e5) return hoursLabel(Math.ceil(ms / 36e5));
    return minutesLabel(Math.max(1, Math.ceil(ms / 6e4)));
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const loc = () => (lang() === 'ar' ? 'ar-EG-u-nu-latn' : lang());
  const fmtDate = ms => new Date(ms).toLocaleDateString(loc(), { year: 'numeric', month: 'long', day: 'numeric' });
  const fmtDT = ms => new Date(ms).toLocaleString(loc(), { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const toLocalInput = ms => { const d = new Date(ms - new Date(ms).getTimezoneOffset() * 6e4); return d.toISOString().slice(0, 16); };
  const showEn = () => ['en', 'tr'].includes(lang());

  // ---- state ----
  let S = { journeys: [], settings: { seconds: false, hideNumbers: false, pin: null } };
  try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d && Array.isArray(d.journeys)) S = Object.assign(S, d, { settings: Object.assign(S.settings, d.settings || {}) }); } catch (e) { /* private mode */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast(T('th_save_err', 'تعذّر الحفظ على هذا الجهاز')); } }
  const byId = id => S.journeys.find(j => j.id === id);
  const cur = j => j.streaks[j.streaks.length - 1];
  const now = () => Date.now();
  const elapsed = j => Math.max(0, now() - cur(j).start);
  const streakDays = s => Math.floor(Math.max(0, (s.end || now()) - s.start) / DAY);
  const totalDays = j => j.streaks.reduce((a, s) => a + streakDays(s), 0);
  const longest = j => Math.max(0, ...j.streaks.map(streakDays));
  const nextMile = d => MILES.find(m => m > d);
  const prevMile = d => [0, ...MILES].filter(m => m <= d).pop();

  // ---- theme ----
  window.addEventListener('themechange', e => {
    document.querySelectorAll('.theme-dock .dot').forEach(d => d.classList.toggle('active', d.dataset.set === e.detail.theme));
  });
  ThemeManager.init();
  window.setTheme = t => ThemeManager.set(t);

  // ---- home ----
  function renderHome() {
    const days = S.journeys.reduce((a, j) => a + totalDays(j), 0);
    const miles = S.journeys.reduce((a, j) => a + MILES.filter(m => longest(j) >= m).length, 0);
    $('stJ').textContent = num(S.journeys.length);
    $('stD').textContent = num(days);
    $('stM').textContent = num(miles);
    const box = $('journeys');
    if (!S.journeys.length) {
      box.innerHTML = `<div class="card empty"><svg class="sprout"><use href="#sprout"/></svg>
        <b>${esc(T('th_empty', 'ابدأ رحلتك الأولى'))}</b>
        <p>${esc(T('th_empty_sub', 'كل رحلة تبدأ بخطوة ونيّة صادقة. اختر ما تريد تركه لله، أو طاعة تريد المداومة عليها.'))}</p>
        <button class="btn primary" onclick="openForm()">${esc(T('th_new', 'رحلة جديدة'))}</button></div>`;
      return;
    }
    box.innerHTML = S.journeys.map(j => {
      const ms = elapsed(j), d = Math.floor(ms / DAY), nx = nextMile(d), pv = prevMile(d);
      const pct = nx ? Math.min(100, Math.round((ms / DAY - pv) / (nx - pv) * 100)) : 100;
      // a new journey counts its first hours and minutes instead of showing 0 days
      const badge = d >= 1 ? [num(d), T('th_u_days', 'يوم')]
        : ms >= 36e5 ? [num(Math.floor(ms / 36e5)), T('th_u_hours', 'ساعة')] : [num(Math.floor(ms / 6e4)), T('th_u_minutes', 'دقيقة')];
      return `<button class="card j-card" data-id="${j.id}">
        <img class="j-cover" src="${COVERS[(j.cover || 1) - 1]}" alt="">
        <span class="j-body">
          <span class="j-name">${esc(j.name)}</span>
          <span class="j-kind">${esc(kindLabel(j))}</span>
          <span class="j-next"><span class="j-bar"><i style="width:${pct}%"></i></span>
            <small>${nx ? esc(T('th_to_next', 'المحطة القادمة: {m}', { m: daysLabel(nx) })) : esc(T('th_all_miles', 'بلغت كل المحطات، الحمد لله'))}</small></span>
        </span>
        <span class="j-days">${S.settings.hideNumbers ? `<svg class="i" viewBox="0 0 24 24" style="color:var(--accent)"><path d="m5 12 5 5 9-10"/></svg>` : `<b>${badge[0]}</b><span>${esc(badge[1])}</span>`}</span>
      </button>`;
    }).join('');
  }
  const kindLabel = j => j.kind === 'keep' ? T('th_kind_keep', 'مداومة على طاعة') : T('th_kind_quit', 'ترك ما لا يرضي الله');
  $('journeys').addEventListener('click', e => { const c = e.target.closest('.j-card'); if (c) openView(c.dataset.id); });

  // ---- daily provision (same item for everyone on a given day) ----
  const ALL = [...C.ayat.map(x => ['ayat', x]), ...C.hadith.map(x => ['hadith', x]), ...C.dua.map(x => ['dua', x])];
  let dailyIdx = Math.floor((now() - new Date(new Date().getFullYear(), 0, 0)) / DAY) % ALL.length;
  const KIND = { ayat: ['th_k_ayah', 'آية'], hadith: ['th_k_hadith', 'حديث'], dua: ['th_k_dua', 'دعاء'] };
  function quoteHtml(x) {
    return `<div class="quote">${esc(x.ar)}</div><div class="quote-src">${esc(x.src)}</div>${showEn() && x.en ? `<div class="quote-en">${esc(x.en)}</div>` : ''}`;
  }
  function renderDaily() {
    const [k, x] = ALL[dailyIdx];
    $('daily').innerHTML = `<span class="kind"><svg style="width:12px;height:12px"><use href="#star8"/></svg>${esc(T(...KIND[k]))}</span>
      ${quoteHtml(x)}
      <div class="row">
        <button class="chip-btn" onclick="nextDaily()"><svg class="i" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>${esc(T('th_another', 'غيرها'))}</button>
        <button class="chip-btn" onclick="copyQuote('${k}', ${C[k].indexOf(x)})"><svg class="i" viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>${esc(T('hb_copy', 'نسخ'))}</button>
      </div>`;
  }
  window.nextDaily = () => { dailyIdx = (dailyIdx + 1) % ALL.length; renderDaily(); };
  window.copyQuote = (k, i) => {
    const x = C[k][i]; if (!x) return;
    const text = `${x.ar}\n${x.src}`;
    const done = () => toast(T('hb_copied', 'تم النسخ'));
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => {});
  };

  // ---- library ----
  let libKind = 'ayat', libAll = false;
  const LIB_FIRST = 4;
  function renderLib() {
    document.querySelectorAll('#libTabs button').forEach(b => b.classList.toggle('on', b.dataset.k === libKind));
    const list = C[libKind], shown = libAll ? list : list.slice(0, LIB_FIRST);
    const more = list.length > LIB_FIRST ? `<div class="more"><button class="chip-btn" onclick="toggleLib()">${esc(libAll ? T('th_show_less', 'عرض أقل') : T('th_show_all', 'عرض الكل ({n})', { n: num(list.length) }))}</button></div>` : '';
    $('lib').innerHTML = shown.map((x, i) => `<article class="card item">${quoteHtml(x)}
      <div class="acts"><button class="icon-btn" onclick="copyQuote('${libKind}', ${i})" aria-label="${esc(T('hb_copy', 'نسخ'))}"><svg class="i" viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg></button></div></article>`).join('') + more;
  }
  window.toggleLib = () => {
    libAll = !libAll; renderLib();
    if (!libAll) $('libTabs').scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  $('libTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { libKind = b.dataset.k; libAll = false; renderLib(); } });

  // ---- journey view ----
  window.curId = null;
  function openView(id) {
    const j = byId(id); if (!j) return;
    window.curId = id;
    renderView();
    $('view').classList.add('open'); $('view').setAttribute('aria-hidden', 'false');
    $('view').scrollTop = 0;
    if (window.BackClose) BackClose.opened(closeViewUi);
    checkMilestones();
  }
  function closeViewUi() { window.curId = null; $('view').classList.remove('open'); $('view').setAttribute('aria-hidden', 'true'); renderHome(); }
  window.closeView = () => { if (window.BackClose) BackClose.closed(); closeViewUi(); };
  const CHECK = '<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>';
  function renderView() {
    const j = byId(window.curId); if (!j) return;
    const d = streakDays(cur(j)), nx = nextMile(d);
    const anchor = C.ayat[(j.id.charCodeAt(0) + j.streaks.length) % C.ayat.length];
    const past = j.streaks.slice(0, -1).reverse();
    $('vContent').innerHTML = `
      <div class="v-banner" style="background-image:url('${COVERS[(j.cover || 1) - 1]}')">
        <h2>${esc(j.name)}</h2><span class="pill">${esc(kindLabel(j))}</span>
      </div>
      <div class="v-body">
        <div class="card"><div id="timer"></div></div>
        <div class="since">${esc(T('th_since', 'منذ {d}', { d: fmtDT(cur(j).start) }))}</div>
        <div class="card miles">
          <h3><svg class="i" viewBox="0 0 24 24" style="color:var(--gold)"><use href="#star8"/></svg>${esc(T('th_miles', 'محطات الشكر'))}</h3>
          <div class="track" id="track">${MILES.map(m => `<div class="ms${d >= m ? ' done' : ''}${m === nx ? ' cur' : ''}"><i>${d >= m ? CHECK : ''}</i><b>${num(m)}</b><span>${esc(T('th_u_days', 'يوم'))}</span></div>`).join('')}</div>
          <div class="next-msg">${nextText(j)}</div>
        </div>
        <div class="card box"><h3>${esc(T('th_f_why', 'نيّتي وسببي'))}</h3>
          ${j.why ? `<div class="why">${esc(j.why)}</div>` : `<div class="why empty-why">${esc(T('th_why_empty', 'لم تكتب سببًا بعد؛ اكتبه من زر التعديل ليذكّرك حين تضعف.'))}</div>`}</div>
        <div class="grid3">
          <div class="card mini"><b>${num(totalDays(j))}</b><span>${esc(T('th_total', 'مجموع أيام الثبات'))}</span></div>
          <div class="card mini"><b>${num(longest(j))}</b><span>${esc(T('th_longest', 'أطول ثبات (يوم)'))}</span></div>
          <div class="card mini"><b>${num(j.streaks.length - 1)}</b><span>${esc(T('th_renewals', 'مرات تجديد العزم'))}</span></div>
        </div>
        <div class="card qcard">${quoteHtml(anchor)}</div>
        <div class="v-actions">
          <button class="btn weak" style="color:var(--warm)" onclick="openWeak()">${esc(T('th_weak', 'أشعر بضعف'))}</button>
          <button class="btn ghost" onclick="openRenew()">${esc(T('th_renew', 'جدّد العزم'))}</button>
        </div>
        ${past.length ? `<div class="card box"><h3>${esc(T('th_history', 'سجلّ الرحلة'))}</h3><div class="hist">${past.map(s => `<div class="h"><b>${esc(daysLabel(streakDays(s)))}</b><div>${esc(fmtDate(s.start))} — ${esc(fmtDate(s.end))}${s.note ? `<small>${esc(s.note)}</small>` : ''}</div></div>`).join('')}</div></div>` : ''}
      </div>`;
    tick();
    const doneEls = $('track').querySelectorAll('.ms.done');
    if (doneEls.length) doneEls[doneEls.length - 1].scrollIntoView({ inline: 'center', block: 'nearest' });
  }
  function nextText(j) {
    const nx = nextMile(streakDays(cur(j)));
    return nx ? esc(T('th_next_in', 'بقي {n} على محطة «{m}»', { n: leftLabel(nx * DAY - elapsed(j)), m: daysLabel(nx) })) : esc(T('th_all_miles', 'بلغت كل المحطات، الحمد لله'));
  }
  function tick() {
    const el = $('timer'); if (!el || !window.curId) return;
    const j = byId(window.curId); if (!j) return;
    if (S.settings.hideNumbers) {
      el.className = 'timer hidden-num';
      el.textContent = T('th_hidden_msg', 'ماضٍ في رحلتك بتوفيق الله — اسأله الثبات');
      return;
    }
    const ms = elapsed(j);
    const d = Math.floor(ms / DAY), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
    el.className = 'timer';
    const u = (v, k, f, cls) => `<div class="u${cls ? ' ' + cls : ''}"><b>${v}</b><span>${esc(T(k, f))}</span></div>`;
    el.innerHTML = u(num(d), 'th_u_days', 'يوم', 'days') + u(two(h), 'th_u_hours', 'ساعة') + u(two(m), 'th_u_minutes', 'دقيقة') +
      (S.settings.seconds ? u(two(s), 'th_u_seconds', 'ثانية') : '');
  }
  setInterval(() => { if (document.hidden) return; tick(); }, 1000);
  let lastDay = -1;
  setInterval(() => {   // each minute: refresh the cards / next-milestone text and check milestones
    const d = Math.floor(now() / 6e4);
    if (d !== lastDay) {
      lastDay = d;
      if (!window.curId) renderHome();
      else { const n = document.querySelector('#vContent .next-msg'), j = byId(window.curId); if (n && j) n.innerHTML = nextText(j); }
      checkMilestones();
    }
  }, 30000);

  // ---- milestones: thank Allah once per milestone per stretch ----
  let mileQueue = [];
  function checkMilestones() {
    if (document.body.classList.contains('locked') || $('mileModal').classList.contains('open')) return;
    S.journeys.forEach(j => {
      const s = cur(j), d = streakDays(s);
      s.seen = s.seen || [];
      MILES.filter(m => d >= m && !s.seen.includes(m)).forEach(m => { s.seen.push(m); mileQueue.push([j, m]); });
    });
    // only the highest new milestone of each journey is shown
    const best = {};
    mileQueue.forEach(([j, m]) => { if (!best[j.id] || best[j.id][1] < m) best[j.id] = [j, m]; });
    mileQueue = Object.values(best);
    save();
    showNextMile();
  }
  function showNextMile() {
    const it = mileQueue.shift(); if (!it) return;
    const [j, m] = it;
    $('mileText').textContent = T('th_mile_text', 'بلغت {d} في «{n}»', { d: daysLabel(m), n: j.name });
    const q = C.dua[(m + j.name.length) % C.dua.length];
    $('mileQuote').textContent = q.ar; $('mileSrc').textContent = q.src;
    $('mileModal').classList.add('open');
    if (navigator.vibrate) navigator.vibrate([20, 60, 20]);
  }
  window.closeMile = () => { $('mileModal').classList.remove('open'); setTimeout(showNextMile, 350); };

  // ---- sheets ----
  let openSheetId = null;
  function openSheet(id) {
    if (openSheetId) closeSheetUi();
    openSheetId = id;
    $('overlay').classList.add('open'); $(id).classList.add('open'); $(id).scrollTop = 0;
    if (window.BackClose) BackClose.opened(closeSheetUi);
  }
  function closeSheetUi() {
    if (!openSheetId) return;
    $(openSheetId).classList.remove('open'); $('overlay').classList.remove('open');
    if (openSheetId === 'weakSheet') stopPatience();
    openSheetId = null;
  }
  window.closeSheet = () => { if (!openSheetId) return; if (window.BackClose) BackClose.closed(); closeSheetUi(); };

  // new / edit
  let editId = null, fKind = 'quit', fCover = 1;
  $('fCovers').innerHTML = COVERS.map((c, i) => `<button type="button" data-c="${i + 1}"><img src="${c}" alt="" loading="lazy"></button>`).join('');
  $('fCovers').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { fCover = +b.dataset.c; syncForm(); } });
  $('fKind').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { fKind = b.dataset.k; syncForm(); } });
  function syncForm() {
    document.querySelectorAll('#fCovers button').forEach(b => b.classList.toggle('on', +b.dataset.c === fCover));
    document.querySelectorAll('#fKind button').forEach(b => b.classList.toggle('on', b.dataset.k === fKind));
  }
  window.openForm = function (id) {
    const j = id ? byId(id) : null;
    editId = j ? j.id : null;
    $('formTitle').textContent = j ? T('th_edit', 'تعديل الرحلة') : T('th_new', 'رحلة جديدة');
    $('fSave').textContent = j ? T('th_f_update', 'حفظ التعديل') : T('th_f_save', 'ابدأ الرحلة بسم الله');
    $('fName').value = j ? j.name : '';
    $('fWhy').value = j ? j.why || '' : '';
    $('fStart').value = $('fStart').dataset.def = toLocalInput(j ? cur(j).start : now());
    $('fStart').max = toLocalInput(now());
    fKind = j ? j.kind : 'quit';
    fCover = j ? j.cover || 1 : (S.journeys.length % COVERS.length) + 1;
    syncForm();
    openSheet('formSheet');
  };
  window.saveForm = function () {
    const name = $('fName').value.trim() || T('th_default_name', 'رحلة {n}', { n: num(S.journeys.length + 1) });
    const j0 = editId && byId(editId);
    let start = $('fStart').value === $('fStart').dataset.def ? (j0 ? cur(j0).start : now()) : new Date($('fStart').value).getTime();
    if (!isFinite(start) || start > now()) start = now();
    if (editId) {
      const j = byId(editId);
      Object.assign(j, { name, why: $('fWhy').value.trim(), kind: fKind, cover: fCover });
      if (cur(j).start !== start) { cur(j).start = start; cur(j).seen = MILES.filter(m => streakDays(cur(j)) >= m); }
    } else {
      const s = { start };
      s.seen = MILES.filter(m => streakDays(s) >= m);   // a back-dated start does not replay old milestones
      S.journeys.push({ id: 'j' + now().toString(36), name, why: $('fWhy').value.trim(), kind: fKind, cover: fCover, created: now(), streaks: [s] });
    }
    save(); closeSheet();
    if (window.curId) renderView();
    renderHome();
    toast(editId ? T('th_saved', 'حُفظت التعديلات') : T('th_started', 'بدأت رحلتك — أعانك الله وثبّتك'));
  };

  // renew resolve after a slip
  window.openRenew = function () {
    $('rWhen').value = $('rWhen').dataset.def = toLocalInput(now()); $('rWhen').max = toLocalInput(now());
    $('rNote').value = '';
    openSheet('renewSheet');
  };
  window.doRenew = function () {
    const j = byId(window.curId); if (!j) return;
    // an untouched field means "now" (the input itself only keeps minutes)
    let at = $('rWhen').value === $('rWhen').dataset.def ? now() : new Date($('rWhen').value).getTime();
    if (!isFinite(at) || at > now()) at = now();
    if (at < cur(j).start) at = cur(j).start;
    const c = cur(j);
    c.end = at; if ($('rNote').value.trim()) c.note = $('rNote').value.trim();
    j.streaks.push({ start: at, seen: [] });
    save(); closeSheet(); renderView();
    toast(T('th_renewed', 'جدّدت العزم — «التائب من الذنب كمن لا ذنب له»'));
  };

  // delete
  window.askDelete = function () {
    const j = byId(window.curId); if (!j) return;
    if (!confirm(T('th_del_confirm', 'حذف «{n}» وكل سجلّها نهائيًا؟', { n: j.name }))) return;
    S.journeys = S.journeys.filter(x => x.id !== j.id); save();
    closeView();
  };

  // ---- weak moment ----
  const DHIKR = ['سبحان الله', 'الحمد لله', 'لا إله إلا الله', 'الله أكبر', 'أستغفر الله', 'لا حول ولا قوة إلا بالله', 'حسبي الله ونعم الوكيل', 'يا مقلّب القلوب ثبّت قلبي على دينك'];
  const P_LEN = 600, RING = 2 * Math.PI * 72;
  let pLeft = P_LEN, pTimer = null;
  window.openWeak = function () {
    const ws = (window.curId ? [byId(window.curId)] : S.journeys).filter(j => j && j.why);
    $('weakWhy').innerHTML = ws.length ? ws.map(j => `<div class="w">${esc(j.why)}<small>${esc(j.name)}</small></div>`).join('')
      : `<div class="w">﴿وَٱصْبِرْ وَمَا صَبْرُكَ إِلَّا بِٱللَّهِ﴾<small>سورة النحل ١٢٧</small></div>`;
    document.querySelectorAll('#weakSheet .steps input').forEach(i => { i.checked = false; });
    resetPatience();
    openSheet('weakSheet');
  };
  function renderPatience() {
    $('pTime').textContent = `${two(Math.floor(pLeft / 60))}:${two(pLeft % 60)}`;
    $('pRing').style.strokeDasharray = RING; $('pRing').style.strokeDashoffset = RING * (1 - pLeft / P_LEN);
    $('pDhikr').textContent = DHIKR[Math.floor((P_LEN - pLeft) / 12) % DHIKR.length];
  }
  function resetPatience() { stopPatience(); pLeft = P_LEN; renderPatience(); $('pBtn').textContent = T('th_p_start', 'اصبر عشر دقائق'); }
  function stopPatience() { clearInterval(pTimer); pTimer = null; }
  window.togglePatience = function () {
    if (pTimer) { stopPatience(); $('pBtn').textContent = T('th_p_resume', 'تابع'); return; }
    if (pLeft <= 0) pLeft = P_LEN;
    $('pBtn').textContent = T('th_p_pause', 'إيقاف مؤقت');
    pTimer = setInterval(() => {
      pLeft--; renderPatience();
      if (pLeft <= 0) {
        stopPatience(); $('pBtn').textContent = T('th_p_again', 'مرة أخرى');
        toast(T('th_p_done', 'أحسنت؛ «ومن يتصبّر يصبّره الله»'));
        if (navigator.vibrate) navigator.vibrate(60);
      }
    }, 1000);
  };

  // ---- settings ----
  function syncSettings() {
    $('swSec').classList.toggle('on', !!S.settings.seconds);
    $('swHide').classList.toggle('on', !!S.settings.hideNumbers);
    $('swPin').classList.toggle('on', !!S.settings.pin);
  }
  window.openSettings = () => { syncSettings(); openSheet('setSheet'); };
  window.toggleSet = k => { S.settings[k] = !S.settings[k]; save(); syncSettings(); renderHome(); tick(); };
  window.exportData = function () {
    const data = JSON.stringify({ app: 'zad-thabat', v: 1, exported: new Date().toISOString(), journeys: S.journeys }, null, 1);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    a.download = `thabat-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $('importFile').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(t => {
      const d = JSON.parse(t);
      if (!d || !Array.isArray(d.journeys)) throw new Error('bad');
      const ok = d.journeys.filter(j => j && j.id && j.name && Array.isArray(j.streaks) && j.streaks.length && isFinite(j.streaks[0].start));
      if (!confirm(T('th_import_confirm', 'استبدال رحلاتك الحالية بـ {n} من النسخة؟', { n: num(ok.length) }))) return;
      S.journeys = ok; save(); renderHome(); closeSheet(); toast(T('th_imported', 'تم الاستيراد'));
    }).catch(() => toast(T('th_import_err', 'الملف غير صالح')));
    e.target.value = '';
  });
  window.wipeAll = function () {
    if (!confirm(T('th_wipe_confirm', 'حذف كل الرحلات والإعدادات من هذا الجهاز نهائيًا؟'))) return;
    S = { journeys: [], settings: { seconds: false, hideNumbers: false, pin: null } };
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    closeSheet(); renderHome(); toast(T('th_wiped', 'حُذفت البيانات'));
  };

  // ---- PIN lock (privacy from casual eyes on a shared phone; not encryption) ----
  async function hash(pin) {
    const salt = S.settings.salt || (S.settings.salt = Math.random().toString(36).slice(2));
    if (window.crypto && crypto.subtle) {
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pin));
      return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
    }
    let h = 0; for (const c of salt + pin) h = (h * 31 + c.charCodeAt(0)) | 0; return 'h' + h;
  }
  let pinMode = null, pinBuf = '', pinFirst = '';
  function buildKeypad() {
    $('keypad').innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9, 'x', 0, '⌫'].map(k => k === 'x' ? '<span></span>'
      : `<button type="button" data-k="${k}">${k === '⌫' ? '<svg class="i" viewBox="0 0 24 24"><path d="M21 5H8l-6 7 6 7h13z"/><path d="m16 9-6 6M10 9l6 6"/></svg>' : k}</button>`).join('');
  }
  function pinUi(msg) {
    document.querySelectorAll('#pinDots i').forEach((d, i) => d.classList.toggle('f', i < pinBuf.length));
    if (msg != null) $('pinMsg').textContent = msg;
  }
  function lock(mode) {
    pinMode = mode; pinBuf = ''; pinFirst = '';
    document.querySelector('#lock h2').textContent = mode === 'unlock' ? T('th_lock_title', 'أدخل الرمز') : T('th_pin_new', 'اختر رمزًا من ٤ أرقام');
    buildKeypad(); pinUi('');
    document.body.classList.add('locked');
  }
  $('keypad').addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const k = b.dataset.k;
    if (k === '⌫') { pinBuf = pinBuf.slice(0, -1); pinUi(); return; }
    if (pinBuf.length >= 4) return;
    pinBuf += k; pinUi();
    if (pinBuf.length < 4) return;
    if (pinMode === 'unlock') {
      if (await hash(pinBuf) === S.settings.pin) { document.body.classList.remove('locked'); pinBuf = ''; checkMilestones(); }
      else { $('pinDots').classList.add('shake'); setTimeout(() => $('pinDots').classList.remove('shake'), 400); pinBuf = ''; pinUi(T('th_pin_wrong', 'رمز غير صحيح')); }
    } else if (!pinFirst) {
      pinFirst = pinBuf; pinBuf = ''; document.querySelector('#lock h2').textContent = T('th_pin_again', 'أعد إدخال الرمز'); pinUi('');
    } else if (pinFirst === pinBuf) {
      S.settings.pin = await hash(pinBuf); save(); document.body.classList.remove('locked'); syncSettings();
      toast(T('th_pin_set', 'تم ضبط الرمز. إن نسيته فلا سبيل لاسترجاعه إلا بحذف البيانات.'));
    } else {
      pinFirst = ''; pinBuf = ''; document.querySelector('#lock h2').textContent = T('th_pin_new', 'اختر رمزًا من ٤ أرقام'); pinUi(T('th_pin_mismatch', 'الرمزان غير متطابقين'));
    }
  });
  window.togglePin = function () {
    if (S.settings.pin) { S.settings.pin = null; save(); syncSettings(); toast(T('th_pin_off', 'أُلغي القفل')); return; }
    closeSheet(); setTimeout(() => lock('set'), 300);
  };
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = now();
    else if (S.settings.pin && hiddenAt && now() - hiddenAt > 60e3) lock('unlock');
  });

  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2800);
  }

  // ---- start ----
  function renderAll() { renderHome(); renderDaily(); renderLib(); if (window.curId) renderView(); }
  if (S.settings.pin) lock('unlock');
  renderAll();
  checkMilestones();
  function onLang() { document.documentElement.dir = 'rtl'; document.documentElement.classList.toggle('ui-ltr', ['en', 'tr'].includes(lang())); renderAll(); buildKeypad(); }
  window.addEventListener('langchange', onLang);
  if (window.I18n) I18n.init().then(onLang, onLang);
})();
