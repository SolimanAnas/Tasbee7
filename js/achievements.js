/* achievements.js — «إنجازاتي» on the home page (index.html, #statsSheet).

   Today's four counters stay at the top; below them:
   • a chart of one measure at a time (tasbeeh, adhkar or Qur'an pages) over
     7 days, 30 days, or everything kept (by month), with a tap-to-read value;
   • the period's totals: sum, daily average, best day, active days;
   • all-time totals and the longest streak of days with any worship;
   • the khatma (ثبات wird, js/wird-core.js): progress, linked to pages/khatma.html.

   Sources: the dated log of js/dhikr-stats.js (dhikr_log, kept 400 days:
   m = tasbeeh, a = adhkar, q = Qur'an pages opened), the masbaha's lifetime
   counter (grand_total) and the ثبات wird. Nothing is written here. */
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
  const num = n => Math.round(n).toLocaleString('en-US');
  const LOC = { ar: 'ar-u-nu-latn', en: 'en', tr: 'tr', ur: 'ur-u-nu-latn', ckb: 'ckb-u-nu-latn' };
  const fmt = (d, o) => { try { return new Intl.DateTimeFormat(LOC[lang()] || 'ar-u-nu-latn', o).format(d); } catch { return d.toDateString(); } };
  const two = n => String(n).padStart(2, '0');
  const keyOf = d => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
  const ago = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d; };

  const METRICS = {
    m: { k: 'ach_m_tasbih', f: 'تسبيح' },
    a: { k: 'ach_m_azkar', f: 'أذكار' },
    q: { k: 'ach_m_pages', f: 'صفحات القرآن' },
  };
  let period = 7, metric = 'm', focus = -1;
  try { metric = localStorage.getItem('ach_metric') || 'm'; period = +localStorage.getItem('ach_period') || 7; } catch { /* storage blocked */ }
  if (!METRICS[metric]) metric = 'm';
  if (![7, 30, 0].includes(period)) period = 7;

  function readLog() {
    if (window.DhikrStats) return window.DhikrStats.sync();
    try { return JSON.parse(localStorage.getItem('dhikr_log') || '{}') || {}; } catch { return {}; }
  }
  const val = (e, m) => (e && e[m]) || 0;
  const active = e => !!e && (val(e, 'm') + val(e, 'a') + val(e, 'q')) > 0;

  // the bars of the period: days, or months for "everything"
  function series(log) {
    if (period) {
      const out = [];
      for (let i = period - 1; i >= 0; i--) {
        const d = ago(i), e = log[keyOf(d)];
        out.push({ d, v: val(e, metric), today: i === 0, label: i === 0 ? T('ach_today', 'اليوم') : period === 7 ? fmt(d, { weekday: 'short' }) : String(d.getDate()) });
      }
      return out;
    }
    const keys = Object.keys(log).sort();
    const first = keys.length ? new Date(keys[0] + 'T12:00') : ago(0);
    const out = [];
    const m = new Date(first.getFullYear(), first.getMonth(), 1, 12);
    const now = ago(0);
    while (m <= now) {
      const ym = `${m.getFullYear()}-${two(m.getMonth() + 1)}`;
      let v = 0; keys.forEach(k => { if (k.startsWith(ym)) v += val(log[k], metric); });
      out.push({ d: new Date(m), v, month: true, today: m.getFullYear() === now.getFullYear() && m.getMonth() === now.getMonth(), label: fmt(m, { month: 'short' }) });
      m.setMonth(m.getMonth() + 1);
    }
    return out.slice(-14);
  }

  function longestStreak(log) {
    const ks = Object.keys(log).filter(k => active(log[k])).sort();
    let best = 0, run = 0, prev = null;
    ks.forEach(k => { const t = new Date(k + 'T12:00').getTime(); run = prev != null && Math.round((t - prev) / 864e5) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = t; });
    return best;
  }

  function render() {
    const box = $('achBody'); if (!box) return;
    const log = readLog();
    const S = series(log);
    const max = Math.max(1, ...S.map(x => x.v));
    const best = S.reduce((b, x) => (x.v > b.v ? x : b), { v: 0 });
    const sum = S.reduce((a, x) => a + x.v, 0);
    const daysIn = period || Object.keys(log).length || 1;
    const activeDays = period ? S.filter(x => x.v > 0).length : Object.keys(log).filter(k => val(log[k], metric) > 0).length;
    if (focus >= S.length) focus = -1;
    const f = focus >= 0 ? S[focus] : null;
    const when = x => (x.month ? fmt(x.d, { month: 'long', year: 'numeric' }) : x.today ? T('ach_today', 'اليوم') : fmt(x.d, { weekday: 'long', day: 'numeric', month: 'long' }));
    const mName = T(METRICS[metric].k, METRICS[metric].f);

    // all time
    const all = { m: 0, a: 0, q: 0 }, ks = Object.keys(log);
    ks.forEach(k => { all.m += val(log[k], 'm'); all.a += val(log[k], 'a'); all.q += val(log[k], 'q'); });
    let lifetime = 0;
    try { lifetime = parseInt(localStorage.getItem('grand_total') || '0', 10) || 0; } catch { /* storage blocked */ }
    const tasbih = Math.max(lifetime, all.m);
    const W = window.WirdCore, wird = W ? W.wirdOf(W.load()) : null;
    const wirdPages = wird ? Object.values(wird.quran.log).reduce((a, b) => a + (b || 0), 0) : 0;
    const daysActive = ks.filter(k => active(log[k])).length;

    box.innerHTML = `
      <div class="ach-sec">${esc(T('ach_stats', 'إحصاءاتي'))}</div>
      <div class="ach-seg" role="tablist" aria-label="${esc(T('ach_period', 'المدة'))}">
        ${[[7, T('ach_7', '٧ أيام')], [30, T('ach_30', '٣٠ يومًا')], [0, T('ach_all', 'الكل')]].map(([p, l]) => `<button role="tab" data-period="${p}" aria-selected="${p === period}" class="${p === period ? 'on' : ''}">${esc(l)}</button>`).join('')}
      </div>
      <div class="ach-metrics">
        ${Object.keys(METRICS).map(k => `<button data-metric="${k}" class="m-${k}${k === metric ? ' on' : ''}" aria-pressed="${k === metric}">${esc(T(METRICS[k].k, METRICS[k].f))}</button>`).join('')}
      </div>
      <div class="ach-chart">
        <div class="ach-read" aria-live="polite">${f
          ? `<b>${num(f.v)}</b> ${esc(mName)} · ${esc(when(f))}`
          : `<b>${num(sum)}</b> ${esc(mName)} · ${esc(period ? T('ach_in_days', 'في {n} يومًا', { n: num(period) }) : T('ach_since_start', 'منذ البداية'))}`}</div>
        <div class="ach-bars${S.length > 14 ? ' dense' : ''}" role="img" aria-label="${esc(mName)}: ${esc(S.map(x => x.label + ' ' + x.v).join('، '))}">
          ${S.map((x, i) => `<button class="ab${x.today ? ' today' : ''}${i === focus ? ' sel' : ''}" data-i="${i}" title="${esc(when(x))}: ${num(x.v)}" aria-label="${esc(when(x))}: ${num(x.v)}">
              <i style="height:${x.v ? Math.max(3, x.v / max * 100) : 0}%"></i><small>${esc(S.length > 14 && !x.today && i % 5 ? '' : x.label)}</small></button>`).join('')}
        </div>
      </div>
      <div class="ach-sum">
        <div><b>${num(sum)}</b><span>${esc(T('ach_total', 'المجموع'))}</span></div>
        <div><b>${sum / daysIn < 10 ? (Math.round(sum / daysIn * 10) / 10).toLocaleString('en-US') : num(sum / daysIn)}</b><span>${esc(T('ach_avg', 'المعدّل اليومي'))}</span></div>
        <div><b>${num(best.v)}</b><span>${esc(best.v ? T('ach_best_on', 'أفضل {p}: {d}', { p: period ? T('ach_day', 'يوم') : T('ach_month', 'شهر'), d: best.month ? fmt(best.d, { month: 'short' }) : fmt(best.d, { day: 'numeric', month: 'short' }) }) : T('ach_best', 'الأفضل'))}</span></div>
        <div><b>${num(activeDays)}</b><span>${esc(T('ach_active', 'أيام النشاط'))}</span></div>
      </div>
      <div class="ach-sec">${esc(T('ach_alltime', 'منذ البداية'))}</div>
      <div class="ach-totals">
        <div class="t-m"><b>${num(tasbih)}</b><span>${esc(T('ach_t_tasbih', 'تسبيحة'))}</span></div>
        <div class="t-a"><b>${num(all.a)}</b><span>${esc(T('ach_t_azkar', 'ذكرًا مقروءًا'))}</span></div>
        <div class="t-q"><b>${num(all.q)}</b><span>${esc(T('ach_t_pages', 'صفحة تصفّحتها'))}</span></div>
        <div><b>${num(longestStreak(log))}</b><span>${esc(T('ach_t_streak', 'أطول سلسلة أيام'))}</span></div>
        <div><b>${num(daysActive)}</b><span>${esc(T('ach_t_days', 'يوم عبادة'))}</span></div>
        <div><b>${num(wird ? wird.quran.khatmat : 0)}</b><span>${esc(T('ach_t_khatmat', 'ختمة تامّة'))}</span></div>
      </div>
      ${wird ? (() => {
        const Q = wird.quran, pct = Math.round((Q.pos - 1) / W.PAGES * 100), td = W.today(wird);
        return `<a class="ach-khatma" href="pages/khatma.html">
          <span class="ak-top"><b>${esc(T('ach_khatma', 'الختمة {k}', { k: num(Q.khatmat + 1) }))}</b><span>${num(pct)}%</span></span>
          <span class="ak-bar"><i style="width:${pct}%"></i></span>
          <small>${esc(td.done ? T('ach_wird_done', 'أتممت ورد اليوم') : T('ach_wird_left', 'ورد اليوم: بقي {n} من {t} صفحة', { n: num(td.left), t: num(td.target) }))} · ${esc(T('ach_wird_pages', '{n} صفحة سجّلتها في الورد', { n: num(wirdPages) }))}</small>
        </a>`;
      })() : `<a class="ach-khatma empty" href="pages/khatma.html"><span class="ak-top"><b>${esc(T('ach_khatma_start', 'ابدأ ختمةً بوردٍ يومي'))}</b><span>›</span></span></a>`}`;
  }

  document.addEventListener('click', e => {
    const box = $('achBody'); if (!box || !box.contains(e.target)) return;
    const p = e.target.closest('[data-period]'), m = e.target.closest('[data-metric]'), b = e.target.closest('.ab');
    if (p) { period = +p.dataset.period; focus = -1; try { localStorage.setItem('ach_period', String(period)); } catch { /* storage blocked */ } render(); }
    else if (m) { metric = m.dataset.metric; focus = -1; try { localStorage.setItem('ach_metric', metric); } catch { /* storage blocked */ } render(); }
    else if (b) { const i = +b.dataset.i; focus = focus === i ? -1 : i; render(); }
  });
  window.addEventListener('langchange', render);
  window.Achievements = { render };
})();
