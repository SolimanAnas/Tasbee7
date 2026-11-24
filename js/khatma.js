/* khatma.js — «الختمة» (pages/khatma.html): the Qur'an wird of ثبات on a page of its own.

   One wird, kept in one place: the ثبات journeys (localStorage thabat_v1, read
   and written through js/wird-core.js), so this page, ثبات and the text mushaf
   (?wird=1) always show the same khatma. Started here, it is a ثبات journey too
   (plant, milestones and intention stay in ثبات).

   Also brought in from the rest of the app:
   • the mushaf's last page (lastPage / lastPageTime) — continue reading, and an
     offer to record the pages read past the wird's position;
   • the app's daily log (js/dhikr-stats.js: pages opened, tasbeeh, adhkar, the
     worship streak).

   Like the mushaf's wird bar, it never shows the journey's name or intention:
   ثبات can be PIN-locked. */
/* global SURAH_MAP */
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
  const lang = () => (window.I18n ? I18n.getLang() : 'ar');
  const num = n => Math.round(n).toLocaleString('en-US');     // Western digits, as in ثبات
  const W = window.WirdCore;
  const PAGES = W.PAGES;
  const DAY = 864e5;
  const dk = i => W.dayKey(W.noon() - i * DAY);                // the day i days ago
  const SURAHS = typeof SURAH_MAP !== 'undefined' ? SURAH_MAP : [];   // js/surah-map.js (a script-level const)
  const JUZ = [1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582];
  const juzOf = p => JUZ.filter(s => s <= p).length;
  function surahAt(p) {
    const starts = SURAHS.filter(x => x.page === p);
    return starts.length ? starts[0] : SURAHS.filter(x => x.page < p).pop() || SURAHS[0] || { name: '' };
  }
  const surahSpan = (a, b) => { const x = surahAt(a).name, y = surahAt(b).name; return x === y ? x : `${x} — ${y}`; };
  const wrap = p => ((p - 1) % PAGES + PAGES) % PAGES + 1;

  // 1 صفحة واحدة · 2 صفحتان · 3–10 صفحات · 11+ صفحة (and the same for days)
  const AR = { page: ['صفحة واحدة', 'صفحتان', 'صفحات', 'صفحة'], day: ['يوم واحد', 'يومان', 'أيام', 'يومًا'] };
  function counted(n, kind) {
    if (lang() === 'ar') {
      const f = AR[kind];
      return n === 1 ? f[0] : n === 2 ? f[1] : num(n) + ' ' + (n >= 3 && n <= 10 ? f[2] : f[3]);
    }
    return T('th_' + kind + (n === 1 ? '_one' : '_many'), '{n}', { n: num(n) });
  }
  const pages = n => counted(n, 'page');
  const days = n => counted(n, 'day');
  const LOC = { ar: 'ar-u-nu-latn', en: 'en', tr: 'tr', ur: 'ur-u-nu-latn', ckb: 'ckb-u-nu-latn' };
  function fmtDate(k, opts) {
    try { return new Intl.DateTimeFormat(LOC[lang()] || 'ar-u-nu-latn', opts || { day: 'numeric', month: 'long' }).format(new Date(k + 'T12:00')); } catch { return k; }
  }

  if (window.ThemeManager) ThemeManager.init();
  window.setTheme = t => window.ThemeManager && ThemeManager.set(t);
  window.addEventListener('themechange', e => {
    document.querySelectorAll('.theme-dock .dot').forEach(d => d.classList.toggle('active', d.dataset.set === e.detail.theme));
  });

  // ---------- state: the ثبات wird ----------
  let S = null, j = null;
  let amount = 0;                 // pages to record (today's stepper)
  let setup = { goal: 30, daily: 4, from: 'start' };
  function reload() { S = W.load(); j = W.wirdOf(S); }
  function persist() {
    try { W.save(S); } catch { toast(T('th_save_err', 'تعذّر الحفظ على هذا الجهاز')); return false; }
    if (window.DhikrStats) window.DhikrStats.sync();
    return true;
  }
  const log = () => j.quran.log;
  function streak() {
    let i = log()[dk(0)] ? 0 : 1, n = 0;
    while (log()[dk(i)]) { n++; i++; }
    return n;
  }
  function longest() {
    const ks = Object.keys(log()).sort(); let best = 0, run = 0, prev = null;
    ks.forEach(k => { const t = new Date(k + 'T12:00').getTime(); run = prev != null && Math.round((t - prev) / DAY) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = t; });
    return best;
  }
  const sumDays = n => { let s = 0; for (let i = 0; i < n; i++) s += log()[dk(i)] || 0; return s; };
  const total = () => Object.values(log()).reduce((a, b) => a + (b || 0), 0);
  // pages a day lately: the last 14 days, counted from the first day of the wird if it is newer
  function pace() {
    const age = Math.max(1, Math.min(14, Math.floor((W.noon() - new Date(new Date(j.created).setHours(12, 0, 0, 0)).getTime()) / DAY) + 1));
    return sumDays(age) / age;
  }
  function lastMushaf() {
    let p = 0, t = 0;
    try { p = parseInt(localStorage.getItem('lastPage'), 10); t = Number(localStorage.getItem('lastPageTime')) || 0; } catch { /* storage blocked */ }
    return p >= 1 && p <= PAGES ? { page: p, time: t } : null;
  }

  // ---------- render ----------
  function render() {
    reload();
    $('khBody').innerHTML = j ? wirdHtml() : setupHtml();
    $('khHero').innerHTML = j ? heroHtml() : setupHeroHtml();
    $('khActivity').innerHTML = activityHtml();
    if (!j) syncSetup();
  }

  function heroHtml() {
    const Q = j.quran, pct = (Q.pos - 1) / PAGES, R = 2 * Math.PI * 52, TD = W.today(j);
    const s = surahAt(Q.pos);
    let when;
    if (Q.goal) when = TD.overdue ? T('th_q_goal_late', 'مضى موعد الهدف — أكمل ما بقي، أو عدّل الهدف')
      : T('kh_goal_end', 'موعد الختم {d} · بقي {l}', { d: fmtDate(Q.goal.end), l: days(TD.daysLeft) });
    else when = T('th_q_eta', 'تتمّها بإذن الله نحو {d}', { d: fmtDate(W.addDays(W.dayKey(), Math.ceil((PAGES - Q.pos + 1) / Math.max(0.5, pace() || W.dailyFor(j))) - 1)) });
    return `
      <div class="kh-ring" role="img" aria-label="${esc(T('kh_ring_label', '{p}% من الختمة', { p: num(pct * 100) }))}">
        <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" class="r-bg"/><circle cx="60" cy="60" r="52" class="r-fg" style="stroke-dasharray:${R};stroke-dashoffset:${R * (1 - pct)}"/></svg>
        <span><b>${num(pct * 100)}<i>%</i></b><small>${esc(T('kh_of_khatma', 'من الختمة'))}</small></span>
      </div>
      <div class="kh-hero-txt">
        <div class="hero-kicker">${esc(T('th_q_khatma', 'الختمة {k}', { k: num(Q.khatmat + 1) }))}</div>
        <h1>${esc(T('kh_surah', 'سورة {s}', { s: s.name }))}</h1>
        <div class="hero-author">${esc(T('kh_pos', 'صفحة {p} · الجزء {j}', { p: num(Q.pos), j: num(juzOf(Q.pos)) }))}</div>
        <div class="kh-when ${Q.goal && TD.overdue ? 'late' : ''}">${esc(when)}</div>
        ${Q.khatmat ? `<div class="kh-done-n">${esc(T('th_q_khatmat', 'ختمات أتممتها: {n}', { n: num(Q.khatmat) }))}</div>` : ''}
      </div>`;
  }

  function wirdHtml() {
    const Q = j.quran, TD = W.today(j), today = W.dayKey();
    const end = wrap(TD.from + TD.target - 1);
    if (!amount) amount = Math.max(1, TD.left || TD.target);
    const a = Q.pos, b = wrap(a + amount - 1);
    const prog = Math.min(1, TD.read / TD.target);
    const canUndo = Q.undo && Q.undo.k === today;
    const yKey = dk(1);
    const missed = !TD.done && !log()[yKey] && Object.keys(log()).length > 0 && j.created < W.noon() - DAY / 2;
    const lm = lastMushaf();
    // the mushaf shows reading past the wird's position (recently, and not far ahead)
    const ahead = lm && lm.page > Q.pos && lm.page - Q.pos < 60 && Date.now() - lm.time < 2 * DAY ? lm.page - Q.pos + 1 : 0;
    return `
      <section class="kh-card kh-today ${TD.done ? 'is-done' : ''}">
        <div class="kh-head"><h2>${esc(T('th_q_wird_today', 'وِردُ اليوم'))}</h2>
          <span class="kh-pill">${esc(T('kh_range', 'ص {a}–{b}', { a: num(TD.from), b: num(end) }))}</span></div>
        <div class="kh-surahs">${esc(surahSpan(TD.from, end))}</div>
        <div class="kh-prog" role="progressbar" aria-valuemin="0" aria-valuemax="${TD.target}" aria-valuenow="${Math.min(TD.read, TD.target)}"><i style="width:${prog * 100}%"></i></div>
        <div class="kh-prog-txt"><span>${esc(T('kh_read_of', 'قرأت {r} من {t}', { r: num(Math.min(TD.read, TD.target)), t: pages(TD.target) }))}</span>
          ${Q.goal ? `<span>${esc(T('th_q_per_prayer', 'نحو {n} بعد كل صلاة', { n: pages(Math.max(1, Math.ceil(TD.target / 5))) }))}</span>` : ''}</div>
        ${TD.done ? `
          <div class="kh-ok"><svg viewBox="0 0 24 24"><path d="M5 12.5 10 17 19 7"/></svg>
            <div><b>${esc(T('th_q_done_title', 'أتممت وردك اليوم'))}</b><span>${esc(T('th_q_done_pages', 'قرأت {n}، تقبّل الله منك', { n: pages(TD.read) }))}</span></div></div>
          <div class="kh-acts">
            <a class="kh-btn" href="quran-text.html?page=${Q.pos}&wird=1">${esc(T('kh_keep_reading', 'واصل القراءة'))}</a>
            <button class="kh-btn ghost" data-act="more">${esc(T('th_q_more', 'قرأت المزيد؟ سجّل {n} أخرى', { n: pages(W.dailyFor(j)) }))}</button>
          </div>`
        : `
          <div class="kh-next">
            <div class="kh-next-range"><span>${esc(T('th_q_from', 'من صفحة'))}</span> <b>${num(a)}</b> <span>${esc(T('th_q_to', 'إلى'))}</span> <b>${num(b)}</b></div>
            <div class="kh-step" aria-label="${esc(T('kh_amount', 'عدد الصفحات'))}">
              <button type="button" data-act="minus" aria-label="−">−</button><span>${esc(pages(amount))}</span><button type="button" data-act="plus" aria-label="+">+</button>
            </div>
          </div>
          <div class="kh-acts">
            <a class="kh-btn" href="quran-text.html?page=${a}&wird=1"><svg viewBox="0 0 24 24"><path d="M4 5.5C6.5 4.5 9.5 4.6 12 6.4c2.5-1.8 5.5-1.9 8-.9V19c-2.5-1-5.5-.9-8 .9-2.5-1.8-5.5-1.9-8-.9z"/><path d="M12 6.4V19.9"/></svg>${esc(T('kh_read_now', 'اقرأ وردك في المصحف'))}</a>
            <button class="kh-btn gold" data-act="mark"><svg viewBox="0 0 24 24"><path d="M5 12.5 10 17 19 7"/></svg>${esc(T('th_q_mark', 'أتممت وردي'))}</button>
          </div>`}
        ${canUndo ? `<button class="kh-link" data-act="undo">${esc(T('th_q_undo', 'تراجع'))}</button>` : ''}
      </section>
      ${ahead && !TD.done ? `<section class="kh-card kh-hint">
          <div><b>${esc(T('kh_mushaf_ahead', 'وصلت في المصحف إلى صفحة {p}', { p: num(lm.page) }))}</b><span>${esc(T('kh_mushaf_ahead_sub', 'سجّل {n} من صفحة {a} إلى {b}؟', { n: pages(ahead), a: num(Q.pos), b: num(lm.page) }))}</span></div>
          <button class="kh-btn sm" data-act="ahead" data-n="${ahead}">${esc(T('kh_record', 'سجّل'))}</button>
        </section>` : ''}
      ${missed ? `<section class="kh-card kh-missed">
          <b>${esc(T('th_q_missed', 'فاتك وِرد الأمس؟'))}</b>
          <p class="kh-quote">«من نام عن حزبه أو عن شيءٍ منه، فقرأه فيما بين صلاة الفجر وصلاة الظهر، كُتب له كأنما قرأه من الليل» <small>رواه مسلم</small></p>
          <button class="kh-btn ghost sm" data-act="makeup">${esc(T('th_q_makeup', 'قرأتُه الآن قضاءً'))}</button>
        </section>` : ''}
      ${goalHtml(TD)}
      ${statsHtml()}
      ${chartHtml(TD)}
      ${heatHtml(TD)}
      <a class="kh-card kh-thabat" href="thabat.html?wird=1">
        <img src="../images/thabat/covers/mushaf-s.webp" alt="" onerror="this.remove()">
        <span><b>${esc(T('kh_in_thabat', 'وردك في «ثبات»'))}</b><small>${esc(T('kh_in_thabat_sub', 'النبتة والإنجازات ونيّتك، وتعديل الورد وموضعه'))}</small></span>
        <svg viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></svg>
      </a>`;
  }

  const GOALS = [7, 10, 15, 20, 30, 60];
  function goalHtml(TD) {
    const Q = j.quran, p = pace();
    const need = Q.goal ? TD.target : W.dailyFor(j);
    const ok = p >= need - 0.05;
    const cur = Q.goal ? Q.goal.days : 0;
    return `<section class="kh-card kh-goal">
        <div class="kh-head"><h2>${esc(T('kh_goal', 'هدف الختمة'))}</h2></div>
        <p class="kh-goal-now">${esc(Q.goal
          ? T('kh_goal_now', 'ختمة في {d}، تنتهي {e}', { d: days(Q.goal.days), e: fmtDate(Q.goal.end) })
          : T('kh_goal_free', 'بلا موعد: {n} كل يوم — {k}', { n: pages(W.dailyFor(j)), k: T('th_khatma_days', 'ختمة كل {n}', { n: days(Math.ceil(PAGES / W.dailyFor(j))) }) }))}</p>
        <div class="kh-pace">
          <div><small>${esc(T('kh_need', 'المطلوب يوميًا'))}</small><b>${esc(pages(need))}</b></div>
          <div><small>${esc(T('kh_pace', 'معدّلك مؤخرًا'))}</small><b>${esc(T('kh_per_day', '{n} / يوم', { n: (Math.round(p * 10) / 10).toLocaleString('en-US') }))}</b></div>
          <span class="kh-status ${ok ? 'ok' : 'late'}">${esc(ok ? T('kh_on_track', 'على الطريق') : T('kh_behind', 'زِد قليلًا'))}</span>
        </div>
        <div class="kh-chips" id="khGoalChips">${GOALS.map(d => `<button data-goal="${d}" class="${d === cur ? 'on' : ''}">${esc(days(d))}</button>`).join('')}
          <button data-goal="0" class="${cur ? '' : 'on'}">${esc(T('th_goal_none', 'بلا هدف'))}</button></div>
        <div class="kh-custom"><input type="number" id="khGoalN" min="1" max="3650" inputmode="numeric" placeholder="${esc(T('th_goal_custom_ph', 'عدد آخر من الأيام'))}" value="${cur && !GOALS.includes(cur) ? cur : ''}">
          <button class="kh-btn ghost sm" data-act="goal-n">${esc(T('kh_apply', 'تطبيق'))}</button></div>
        <p class="kh-note">${esc(T('kh_goal_note', 'يُحسب الهدف من موضعك اليوم، ويتعدّل الورد تلقائيًا إن تقدّمت أو تأخّرت.'))}</p>
      </section>`;
  }

  function statsHtml() {
    const Q = j.quran;
    const tiles = [
      [num(streak()), T('th_q_streak', 'أيام متتالية'), 'fire'],
      [num(longest()), T('kh_longest', 'أطول سلسلة'), 'trophy'],
      [num(sumDays(7)), T('kh_week_pages', 'صفحات هذا الأسبوع'), 'week'],
      [num(Object.keys(log()).length), T('kh_days_read', 'أيام القراءة'), 'cal'],
      [num(total()), T('kh_total_pages', 'صفحات سجّلتها'), 'book'],
      [num(Q.khatmat), T('kh_khatmat', 'ختمات تامّة'), 'star'],
    ];
    return `<section class="kh-stats">${tiles.map(([v, l, ic]) => `<div class="kh-tile"><i class="ic-${ic}" aria-hidden="true"></i><b>${v}</b><span>${esc(l)}</span></div>`).join('')}</section>`;
  }

  function chartHtml(TD) {
    const ds = []; for (let i = 13; i >= 0; i--) ds.push({ k: dk(i), v: log()[dk(i)] || 0, today: i === 0 });
    const target = TD.target;
    const max = Math.max(target, ...ds.map(d => d.v), 1);
    const best = Math.max(...ds.map(d => d.v));        // labelled: the best day and today only
    let wd;
    try { wd = new Intl.DateTimeFormat(LOC[lang()] || 'ar', { weekday: 'narrow' }); } catch { wd = null; }
    const label = d => (d.today ? T('kh_today', 'اليوم') : wd ? wd.format(new Date(d.k + 'T12:00')) : d.k.slice(8));
    return `<section class="kh-card kh-chart">
        <div class="kh-head"><h2>${esc(T('kh_last14', 'آخر أسبوعين'))}</h2><span class="kh-legend"><i></i>${esc(T('kh_target_line', 'ورد اليوم {n}', { n: num(target) }))}</span></div>
        <div class="kbars" role="img" aria-label="${esc(T('kh_chart_label', 'الصفحات المسجّلة في آخر ١٤ يومًا: {n}', { n: num(sumDays(14)) }))}" style="--t:${target / max}">
          ${ds.map(d => `<div class="kb${d.today ? ' today' : ''}${d.v >= target ? ' hit' : ''}" title="${esc(fmtDate(d.k, { weekday: 'long', day: 'numeric', month: 'long' }))}: ${esc(pages(d.v))}">
            <span class="v">${d.v && (d.today || d.v === best) ? num(d.v) : ''}</span><i style="height:${(d.v / max) * 100}%"></i><small>${esc(label(d))}</small></div>`).join('')}
          <div class="tline"></div>
        </div>
      </section>`;
  }

  function heatHtml(TD) {
    const cells = [];
    for (let i = 83; i >= 0; i--) {
      const k = dk(i), v = log()[k] || 0;
      const lvl = !v ? 0 : v < TD.target ? 1 : v < TD.target * 2 ? 2 : 3;
      cells.push(`<i class="l${lvl}${i === 0 ? ' t' : ''}" title="${esc(fmtDate(k))}: ${esc(pages(v))}"></i>`);
    }
    return `<section class="kh-card kh-heat">
        <div class="kh-head"><h2>${esc(T('kh_12weeks', 'آخر ١٢ أسبوعًا'))}</h2>
          <span class="kh-scale"><small>${esc(T('kh_less', 'أقل'))}</small><i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><small>${esc(T('kh_more', 'أكثر'))}</small></span></div>
        <div class="heat">${cells.join('')}</div>
      </section>`;
  }

  // the rest of the app: the mushaf's place and the daily log
  function activityHtml() {
    const sm = window.DhikrStats ? window.DhikrStats.summary() : null;
    const td = sm ? sm.days[sm.days.length - 1] : { q: 0, m: 0, a: 0 };
    const lm = lastMushaf();
    const tile = (v, l, href) => `<${href ? `a href="${href}"` : 'div'} class="kh-tile sm"><b>${num(v)}</b><span>${esc(l)}</span></${href ? 'a' : 'div'}>`;
    return `<h2 class="kh-sec">${esc(T('kh_app', 'من نشاطك في التطبيق'))}</h2>
      ${lm ? `<a class="kh-card kh-cont" href="quran-text.html?page=${lm.page}">
          <span class="kh-cont-ic"><svg viewBox="0 0 24 24"><path d="M4 5.5C6.5 4.5 9.5 4.6 12 6.4c2.5-1.8 5.5-1.9 8-.9V19c-2.5-1-5.5-.9-8 .9-2.5-1.8-5.5-1.9-8-.9z"/><path d="M12 6.4V19.9"/></svg></span>
          <span><b>${esc(T('kh_continue', 'تابع القراءة من صفحة {p}', { p: num(lm.page) }))}</b><small>${esc(surahAt(lm.page).name)} · ${esc(T('kh_juz', 'الجزء {j}', { j: num(juzOf(lm.page)) }))}</small></span>
          <svg class="chev" viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></svg></a>` : ''}
      <div class="kh-stats four">
        ${tile(td.q, T('kh_app_pages', 'صفحات تصفّحتها اليوم'), 'quran-text.html' + (lm ? '?page=' + lm.page : ''))}
        ${tile(td.m, T('kh_app_tasbih', 'تسبيحات اليوم'), 'masbaha.html')}
        ${tile(td.a, T('kh_app_azkar', 'أذكار اليوم'), 'azkar.html')}
        ${tile(sm ? sm.streak : 0, T('kh_app_streak', 'أيام عبادة متتالية'))}
      </div>
      ${sm ? `<p class="kh-week">${esc(T('kh_app_week', 'هذا الأسبوع: {q} صفحة · {m} تسبيحة · {a} ذكر', { q: num(sm.week.q), m: num(sm.week.m), a: num(sm.week.a) }))}</p>` : ''}`;
  }

  // ---------- start a khatma ----------
  function setupHeroHtml() {
    return `<div class="kh-hero-txt solo">
        <div class="hero-kicker">${esc(T('kh_title', 'الختمة'))}</div>
        <h1>${esc(T('kh_start_title', 'ابدأ ختمتك'))}</h1>
        <p class="hero-intro">${esc(T('kh_start_intro', 'اختر مدة الختمة، فيُحسب وردك اليومي ويتعدّل إن تقدّمت أو تأخّرت. يُحفظ الورد في «ثبات»، ويتابعه المصحف صفحةً صفحة.'))}</p>
      </div>`;
  }
  function setupHtml() {
    const lm = lastMushaf();
    return `<section class="kh-card kh-setup">
        <h2>${esc(T('kh_q_days', 'في كم يومًا تختم؟'))}</h2>
        <div class="kh-chips" id="khSetGoal">${GOALS.map(d => `<button data-goal="${d}">${esc(days(d))}</button>`).join('')}
          <button data-goal="0">${esc(T('kh_no_date', 'بلا موعد'))}</button></div>
        <div class="kh-custom"><input type="number" id="khSetGoalN" min="1" max="3650" inputmode="numeric" placeholder="${esc(T('th_goal_custom_ph', 'عدد آخر من الأيام'))}"></div>
        <div class="kh-daily" id="khSetDaily" hidden>
          <h3>${esc(T('kh_q_daily', 'كم صفحة كل يوم؟'))}</h3>
          <div class="kh-step"><button type="button" data-act="d-minus" aria-label="−">−</button><span id="khSetDailyN"></span><button type="button" data-act="d-plus" aria-label="+">+</button></div>
        </div>
        <h2>${esc(T('kh_q_from', 'من أين تبدأ؟'))}</h2>
        <div class="kh-from" id="khSetFrom">
          <button data-from="start"><b>${esc(T('kh_from_start', 'من سورة الفاتحة'))}</b><small>${esc(T('kh_from_start_sub', 'ختمة جديدة من أول المصحف'))}</small></button>
          ${lm && lm.page > 1 ? `<button data-from="${lm.page}"><b>${esc(T('kh_from_here', 'من موضعي في المصحف'))}</b><small>${esc(T('kh_pos', 'صفحة {p} · الجزء {j}', { p: num(lm.page), j: num(juzOf(lm.page)) }))} · ${esc(surahAt(lm.page).name)}</small></button>` : ''}
        </div>
        <p class="kh-plan" id="khSetPlan"></p>
        <button class="kh-btn gold wide" data-act="start">${esc(T('kh_start', 'ابدأ الختمة بسم الله'))}</button>
      </section>`;
  }
  const setupFrom = () => (setup.from === 'start' ? 1 : Math.max(1, Math.min(PAGES, +setup.from || 1)));
  function syncSetup() {
    document.querySelectorAll('#khSetGoal button').forEach(b => b.classList.toggle('on', +b.dataset.goal === setup.goal && !(setup.goal && $('khSetGoalN').value)));
    document.querySelectorAll('#khSetFrom button').forEach(b => b.classList.toggle('on', b.dataset.from === String(setup.from)));
    $('khSetDaily').hidden = !!setup.goal;
    $('khSetDailyN').textContent = pages(setup.daily);
    const left = PAGES - setupFrom() + 1;
    const per = setup.goal ? Math.ceil(left / setup.goal) : setup.daily;
    $('khSetPlan').textContent = setup.goal
      ? T('th_goal_hint', 'نحو {n} كل يوم ({p} بعد كل صلاة)، ويتعدّل الورد تلقائيًا إن تقدّمت أو تأخّرت', { n: pages(per), p: pages(Math.max(1, Math.ceil(per / 5))) })
      : T('th_khatma_days', 'ختمة كل {n}', { n: days(Math.ceil(PAGES / per)) });
  }
  function startKhatma() {
    reload();
    if (j) { render(); return; }      // one wird at a time (ثبات may have made one meanwhile)
    const t = Date.now(), pos = setupFrom();
    S = S || { journeys: [], settings: { seconds: false, hideNumbers: false, pin: null } };
    const jn = { id: 'j' + t.toString(36), name: T('th_q_default_name', 'وِردي من القرآن'), why: '', kind: 'quran', cover: 'mushaf', created: t,
      streaks: [{ start: t, seen: [] }], quran: { daily: setup.goal ? 1 : setup.daily, pos, start: pos, khatmat: 0, log: {} } };
    S.journeys.unshift(jn);
    if (setup.goal) W.setGoal(jn, setup.goal);
    if (!persist()) return;
    amount = 0;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast(T('th_q_started', 'بارك الله في وردك، ونفعك بالقرآن'));
  }

  // ---------- actions ----------
  function record(n, k) {
    reload(); if (!j) return;
    const { khatma } = W.record(j, n, k);
    if (!persist()) return;
    amount = 0;
    render();
    if (khatma) win(); else toast(k ? T('th_q_makeup_ok', 'سُجّل وِرد الأمس، تقبّل الله') : T('th_q_marked', 'تقبّل الله منك'));
  }
  function setGoal(d) {
    reload(); if (!j) return;
    if (d) W.setGoal(j, d); else delete j.quran.goal;
    if (!persist()) return;
    amount = 0; render();
    toast(d ? T('kh_goal_set', 'هدفك الآن: ختمة في {d}', { d: days(d) }) : T('kh_goal_off', 'ورد ثابت بلا موعد: {n} كل يوم', { n: pages(W.dailyFor(j)) }));
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act],[data-goal],[data-from]');
    if (!b || b.closest('#khWin') && !b.dataset.act) return;
    if (b.dataset.goal != null) {
      const d = +b.dataset.goal;
      if (b.closest('#khSetGoal')) { setup.goal = d; $('khSetGoalN').value = ''; syncSetup(); } else setGoal(d);
      return;
    }
    if (b.dataset.from != null) { setup.from = b.dataset.from; syncSetup(); return; }
    const TD = j ? W.today(j) : null;
    switch (b.dataset.act) {
      case 'minus': amount = Math.max(1, amount - 1); render(); break;
      case 'plus': amount = Math.min(PAGES, amount + 1); render(); break;
      case 'mark': record(amount || TD.left || TD.target); break;
      case 'more': record(W.dailyFor(j)); break;
      case 'ahead': record(+b.dataset.n); break;
      case 'makeup': record(W.dailyFor(j), dk(1)); break;
      case 'undo': reload(); if (j && W.undo(j) && persist()) { amount = 0; render(); } break;
      case 'goal-n': { const d = parseInt($('khGoalN').value, 10); if (d >= 1 && d <= 3650) setGoal(d); else $('khGoalN').focus(); break; }
      case 'd-minus': setup.daily = Math.max(1, setup.daily - 1); syncSetup(); break;
      case 'd-plus': setup.daily = Math.min(PAGES, setup.daily + 1); syncSetup(); break;
      case 'start': startKhatma(); break;
      case 'win-close': $('khWin').hidden = true; break;
    }
  });
  document.addEventListener('input', e => {
    if (e.target.id !== 'khSetGoalN') return;
    const d = parseInt(e.target.value, 10);
    if (d >= 1 && d <= 3650) setup.goal = d; else if (!e.target.value) setup.goal = 30;
    syncSetup();
  });

  function win() {
    const Q = j.quran;
    $('khWinTitle').textContent = T('th_q_khatma_done', 'ختمتَ القرآن، الحمد لله');
    $('khWinText').textContent = T('th_q_khatma_text', 'أتممت الختمة {n} بتوفيق الله، فابدأ الختمة التالية من سورة الفاتحة.', { n: num(Q.khatmat) });
    $('khWin').hidden = false;
  }
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600); }

  // ثبات or the mushaf may change the wird in another tab
  window.addEventListener('storage', e => { if (e.key === W.KEY || e.key === 'lastPage' || e.key === 'dhikr_log') render(); });
  window.addEventListener('pageshow', e => { if (e.persisted) render(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

  const go = () => render();
  if (window.I18n) I18n.init().then(go, go); else go();
  window.addEventListener('langchange', render);
  window.KhatmaPage = { render, get wird() { reload(); return j; } };
})();
