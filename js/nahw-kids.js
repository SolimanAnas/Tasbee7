/* nahw-kids.js — «تعلم النحو خطوة خطوة»: graded grammar lessons for children and beginners.
   Data: data/nahw/kids.json (built and checked by scripts/build-nahw-kids.cjs).

   Views, by the address hash:
     (none)        the path: levels and their lessons, with stars and progress
     #l2/mafool    a lesson: rule, points, labelled examples, the parents' guide
     #l2/mafool/q  the lesson's practice questions
     #l2/test      the level test: its own questions + others drawn from its lessons
   Progress (best stars per lesson, best score per level test, last lesson) stays on the
   device (localStorage "nahwkids_progress"). */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const T = (k, f, p) => {
    if (window.I18n) { const v = I18n.t(k, p || {}); if (v && v !== k) return v; }
    let s = f;
    if (p) Object.keys(p).forEach(x => { s = String(s).split('{' + x + '}').join(p[x]); });
    return s;
  };
  const store = {
    get(k, d) { try { const v = localStorage.getItem('nahwkids_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('nahwkids_' + k, JSON.stringify(v)); } catch { /* storage blocked */ } },
  };
  if (window.ThemeManager) ThemeManager.init();
  window.setTheme = t => window.ThemeManager && ThemeManager.set(t);
  window.addEventListener('themechange', e => {
    document.querySelectorAll('.theme-dock .dot').forEach(d => d.classList.toggle('active', d.dataset.set === e.detail.theme));
  });

  const main = $('nkMain');
  const LEVEL_COLORS = ['#2f9e6b', '#2f7de1', '#c2410c', '#7c3aed', '#0f766e', '#be185d', '#b7791f', '#4f46e5', '#15803d'];
  const KIND = { 'اسم': 1, 'فعل': 2, 'حرف': 3 };
  const QUIZ_TEST = 10;
  let D = null;
  let P = (() => { const v = store.get('progress', null); return Object.assign({ stars: {}, tests: {}, last: null, open: null }, v && typeof v === 'object' ? v : {}); })();
  const save = () => store.set('progress', P);
  let inQuiz = false;

  // stars and ticks are drawn as SVG (the app keeps symbol characters out of its pages)
  const STAR = on => `<svg class="st${on ? ' on' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>`;
  const TICK = '<svg class="tk" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17 19 7"/></svg>';
  const starsHtml = n => '<span class="stars" role="img" aria-label="' + n + '/3">' + [0, 1, 2].map(i => STAR(i < n)).join('') + '</span>';
  const starsFor = pct => pct >= 0.9 ? 3 : pct >= 0.7 ? 2 : pct >= 0.4 ? 1 : 0;
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const isArabicWord = s => /[ً-ْ]/.test(s);   // a vowelled option is shown in the Arabic text face

  // a sentence: [word, label, after] → words with their labels under them
  function sentence(t, quran) {
    const used = {}; let next = 4;
    const cls = l => {
      if (!l) return '';
      if (KIND[l]) return 'k' + KIND[l];
      if (!used[l]) { used[l] = next; next = next >= 6 ? 1 : next + 1; }
      return 'k' + used[l];
    };
    return '<div class="snt' + (quran ? ' q' : '') + '">' + t.map(([w, l, a]) => l
      ? `<span class="w l ${cls(l)}"><span><i>${esc(w)}</i>${esc(a || '')}</span><small>${esc(l)}</small></span>`
      : `<span class="w">${esc(w + (a || ''))}</span>`).join('') + '</div>';
  }

  function find(lid, sid) {
    const L = D.levels.find(l => l.id === lid); if (!L) return {};
    const S = sid ? L.lessons.find(s => s.id === sid) : null;
    return { L, S, li: D.levels.indexOf(L), si: S ? L.lessons.indexOf(S) : -1 };
  }
  const key = (L, S) => L.id + '/' + S.id;

  // ---------- the path ----------
  function home() {
    const all = D.levels.flatMap(L => L.lessons.map(S => key(L, S)));
    const done = all.filter(k => P.stars[k] > 0).length;
    const stars = all.reduce((n, k) => n + (P.stars[k] || 0), 0);
    let cont = null;
    if (P.last) { const [l, s] = P.last.split('/'); const f = find(l, s); if (f.S) cont = f; }
    if (!cont) for (const L of D.levels) { const S = L.lessons.find(s => !(P.stars[key(L, s)] > 0)); if (S) { cont = find(L.id, S.id); break; } }
    const openId = P.open || (cont ? cont.L.id : D.levels[0].id);
    let h = `<section class="nk-hero">
      <div class="kick">${esc(T('nk_kicker', 'النحو خطوة خطوة'))}</div>
      <h1>${esc(T('nh_title', 'تعلم النحو'))}</h1>
      <p>${esc(T('nk_intro', 'تسعة مستويات تبدأ من الكلمة وتنتهي بالإعراب الكامل: في كل درس قاعدة قصيرة، وأمثلة ملوّنة من القرآن الكريم ومن الحياة، ونصائح للوالدين، وتمرين قصير، وفي آخر كل مستوى اختبار.'))}</p>
      <div class="nk-stats"><div><b>${done}/${all.length}</b><span>${esc(T('nk_lessons', 'درسًا'))}</span></div><div><b>${stars}</b><span>${esc(T('nk_stars', 'نجمة'))}</span></div></div>
      ${cont ? `<a class="nk-go" href="#${cont.L.id}/${cont.S.id}"><span>${esc(done ? T('nk_continue', 'تابع: {t}', { t: cont.S.title }) : T('nk_start', 'ابدأ الدرس الأول'))}</span> ‹</a>` : ''}
    </section>`;
    D.levels.forEach((L, li) => {
      const ks = L.lessons.map(S => key(L, S));
      const got = ks.reduce((n, k) => n + (P.stars[k] || 0), 0);
      const pct = Math.round(got / (ks.length * 3) * 100);
      const best = P.tests[L.id];
      h += `<section class="lv${L.id === openId ? ' open' : ''}" id="lv-${L.id}" style="--lc:${LEVEL_COLORS[li % LEVEL_COLORS.length]}">
        <button class="lv-head" aria-expanded="${L.id === openId}" data-lv="${L.id}"><span class="lv-n">${li + 1}</span>
          <span class="lv-t"><h2>${esc(L.title)}</h2><small>${esc(T('nk_level', 'المستوى {n}', { n: li + 1 }))} · ${esc(L.age)}</small></span>
          <span class="lv-p">${got}/${ks.length * 3} ${STAR(true)}</span>
          <svg class="lv-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
        <div class="lv-body"><p class="lv-goal">${esc(L.goal)}</p><div class="lv-bar"><i style="width:${pct}%"></i></div>
          ${L.lessons.map((S, si) => { const n = P.stars[key(L, S)] || 0; return `<a class="ls${n ? ' done' : ''}" href="#${L.id}/${S.id}"><span class="ls-n">${si + 1}</span><span class="ls-t">${esc(S.title)}</span>${starsHtml(n)}</a>`; }).join('')}
          <a class="ls test" href="#${L.id}/test"><span class="ls-n">${TICK}</span><span class="ls-t">${esc(T('nk_test', 'اختبار المستوى'))}</span>${best != null ? `<span class="ls-best">${esc(T('nk_best', 'أفضل نتيجة {p}٪', { p: best }))}</span>` : ''}</a>
        </div></section>`;
    });
    h += `<a class="nk-matn" href="nahw.html"><span>${esc(T('nk_matn', 'بعد الدروس: متن الآجرومية مع شرحٍ مبسّط'))}</span> ‹</a>
      <p class="nk-note">${esc(D.note)}</p>`;
    main.innerHTML = h;
    main.querySelectorAll('.lv-head').forEach(b => b.addEventListener('click', () => {
      const sec = b.closest('.lv'); const open = !sec.classList.contains('open');
      sec.classList.toggle('open', open); b.setAttribute('aria-expanded', open);
      if (open) { P.open = b.dataset.lv; save(); }
    }));
  }

  // ---------- a lesson ----------
  function lesson(f) {
    const { L, S, li, si } = f;
    P.last = key(L, S); P.open = L.id; save();
    const prev = si > 0 ? L.lessons[si - 1] : null;
    const next = si < L.lessons.length - 1 ? L.lessons[si + 1] : null;
    main.innerHTML = `
      <nav class="nk-crumb"><a href="#">‹ ${esc(T('nk_back', 'المستويات'))}</a><span>${esc(T('nk_level', 'المستوى {n}', { n: li + 1 }))} · ${esc(L.title)}</span></nav>
      <h1 class="nk-title">${esc(S.title)}</h1>
      <div class="nk-rule"><b>${esc(T('nk_rule', 'القاعدة'))}</b><p>${esc(S.rule)}</p></div>
      <ul class="nk-points">${S.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
      <h3 class="nk-h">${esc(T('nk_examples', 'أمثلة'))}</h3>
      ${S.ex.map(e => `<div class="nk-ex">${sentence(e.t, !!e.q)}${e.q ? `<div class="ex-ref">${esc(T('nk_surah', 'سورة {r}', { r: e.q }))}</div>` : ''}${e.n ? `<div class="ex-n">${esc(e.n)}</div>` : ''}</div>`).join('')}
      <details class="nk-parent"><summary><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="7" r="3"/><circle cx="17" cy="9" r="2.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M14 20c.2-2.6 1.6-4.6 3-4.6 1.8 0 3.5 1.9 4 4.6"/></svg>${esc(T('nk_parent', 'للوالدين'))}</summary>
        <p><b>${esc(T('nk_say', 'كيف تشرحه:'))}</b> ${esc(S.parent.say)}</p>
        <p><b>${esc(T('nk_play', 'نشاط:'))}</b> ${esc(S.parent.play)}</p></details>
      <a class="nk-btn primary" href="#${L.id}/${S.id}/q">${esc(T('nk_practice', 'تمرّن ({n} أسئلة)', { n: S.quiz.length }))}</a>
      <div class="nk-pager">${prev ? `<a href="#${L.id}/${prev.id}">› ${esc(T('nk_prev_lesson', 'الدرس السابق'))}</a>` : '<span></span>'}
        ${next ? `<a class="nx" href="#${L.id}/${next.id}">${esc(T('nk_next_lesson', 'الدرس التالي'))}: ${esc(next.title)} ‹</a>` : `<a class="nx" href="#${L.id}/test">${esc(T('nk_test', 'اختبار المستوى'))} ‹</a>`}</div>`;
  }

  // ---------- questions ----------
  function quiz(f, isTest) {
    const { L, S } = f;
    let qs;
    if (isTest) {
      const pool = shuffle(L.lessons.flatMap(s => s.quiz));
      qs = shuffle(L.test.concat(pool.slice(0, Math.max(0, QUIZ_TEST - L.test.length))));
    } else qs = S.quiz;
    const back = isTest ? '#' : `#${L.id}/${S.id}`;
    let i = 0, score = 0;
    inQuiz = true;

    function show() {
      const q = qs[i];
      const multi = q.k === 'tap' && q.t.filter(x => x[1]).length > 1;
      let body = '';
      if (q.k === 'tap') {
        body = `<div class="qz-s"><div class="snt${q.ref ? ' q' : ''}">${q.t.map((x, j) => `<button class="tw" data-j="${j}">${esc(x[0] + (x[2] || ''))}</button>`).join('')}</div>${q.ref ? `<div class="ex-ref">${esc(T('nk_surah', 'سورة {r}', { r: q.ref }))}</div>` : ''}</div>`;
      } else {
        if (q.s) body += `<div class="qz-s"><div class="snt">${q.s.map(x => `<span class="w"><span${x[1] ? ' class="hl"' : ''}>${esc(x[0])}</span></span>${x[2] ? `<span class="w">${esc(x[2])}</span>` : ''}`).join('')}</div></div>`;
        body += `<div class="qz-o">${shuffle([q.a, ...q.o]).map(o => `<button class="qo${isArabicWord(o) ? ' ar' : ''}" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
      }
      main.innerHTML = `
        <div class="qz-top"><a class="qz-x" href="${back}" aria-label="${esc(T('tj_close', 'إغلاق'))}"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></a>
          <div class="qz-bar"><i style="width:${i / qs.length * 100}%"></i></div><span class="qz-c">${i + 1}/${qs.length}</span></div>
        <div class="qz-name">${esc(isTest ? T('nk_test', 'اختبار المستوى') + ' · ' + L.title : S.title)}</div>
        <div class="qz-card"><p class="qz-p">${esc(q.p)}</p>${multi ? `<p class="qz-hint">${esc(T('nk_tap_many', 'الجواب أكثر من كلمة: اضغط عليها كلها ثم «تحقّق».'))}</p>` : ''}${body}
          <div class="qz-fb" id="qzFb" hidden></div></div>
        <button class="nk-btn primary" id="qzCheck" ${multi ? '' : 'hidden'}>${esc(T('nk_check', 'تحقّق'))}</button>
        <button class="nk-btn primary" id="qzNext" hidden>${esc(i < qs.length - 1 ? T('nk_next', 'التالي') : T('nk_result', 'النتيجة'))}</button>`;

      const done = (ok, right) => {
        if (ok) score++;
        const fb = $('qzFb');
        fb.className = 'qz-fb ' + (ok ? 'ok' : 'no');
        fb.innerHTML = ok ? `<b>${esc(T('nk_right', 'أحسنت!'))}</b>${q.why ? esc(q.why) : ''}`
          : `<b>${esc(T('nk_wrong', 'ليس تمامًا'))}</b>${right ? `${esc(T('nk_answer', 'الصواب:'))} <span class="${isArabicWord(right) ? 'ar' : ''}">${esc(right)}</span>` : ''}${q.why ? '<br>' + esc(q.why) : ''}`;
        fb.hidden = false;
        $('qzCheck').hidden = true;
        $('qzNext').hidden = false;
        $('qzNext').focus({ preventScroll: true });
        fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      };
      if (q.k === 'tap') {
        const btns = [...main.querySelectorAll('.tw')];
        const judge = () => {
          const sel = btns.filter(b => b.classList.contains('sel')).map(b => +b.dataset.j);
          const want = q.t.map((x, j) => x[1] ? j : -1).filter(j => j >= 0);
          const ok = sel.length === want.length && want.every(j => sel.includes(j));
          btns.forEach((b, j) => { b.disabled = true; if (want.includes(j)) b.classList.add('right'); else if (b.classList.contains('sel')) b.classList.add('wrong'); b.classList.remove('sel'); });
          done(ok, ok ? '' : want.map(j => q.t[j][0]).join('، '));
        };
        btns.forEach(b => b.addEventListener('click', () => { b.classList.toggle('sel'); if (!multi) judge(); }));
        $('qzCheck').addEventListener('click', () => { if (btns.some(b => b.classList.contains('sel'))) judge(); });
      } else {
        main.querySelectorAll('.qo').forEach(b => b.addEventListener('click', () => {
          const ok = b.dataset.o === q.a;
          main.querySelectorAll('.qo').forEach(x => { x.disabled = true; if (x.dataset.o === q.a) x.classList.add('right'); });
          if (!ok) b.classList.add('wrong');
          done(ok, ok ? '' : q.a);
        }));
      }
      $('qzNext').addEventListener('click', () => { i++; if (i < qs.length) { show(); window.scrollTo(0, 0); } else result(); });
    }

    function result() {
      inQuiz = false;
      const pct = score / qs.length;
      const n = starsFor(pct);
      let nextHref = '#', nextLabel = T('nk_back', 'المستويات');
      if (isTest) {
        P.tests[L.id] = Math.max(P.tests[L.id] || 0, Math.round(pct * 100));
        const nl = D.levels[D.levels.indexOf(L) + 1];
        if (nl) { nextHref = `#${nl.id}/${nl.lessons[0].id}`; nextLabel = T('nk_next_level', 'المستوى التالي'); P.open = nl.id; }
      } else {
        const k = key(L, S);
        P.stars[k] = Math.max(P.stars[k] || 0, n);
        const si = L.lessons.indexOf(S);
        const nx = L.lessons[si + 1];
        if (nx) { nextHref = `#${L.id}/${nx.id}`; nextLabel = T('nk_next_lesson', 'الدرس التالي'); } else { nextHref = `#${L.id}/test`; nextLabel = T('nk_test', 'اختبار المستوى'); }
      }
      save();
      const msg = n === 3 ? T('nk_great', 'ممتاز! أتقنت هذا الدرس.') : n >= 1 ? T('nk_good', 'جيد! راجع الأمثلة وحاول مرة أخرى لتنال ثلاث نجوم.') : T('nk_try', 'لا بأس، اقرأ القاعدة والأمثلة ثم حاول مرة أخرى.');
      main.innerHTML = `<div class="rs" id="nkResult"><div class="rs-stars" role="img" aria-label="${n}/3">${[0, 1, 2].map(x => STAR(x < n)).join('')}</div>
        <h2>${esc(T('nk_score', '{s} من {n}', { s: score, n: qs.length }))}</h2><p>${esc(msg)}</p>
        <a class="nk-btn primary" href="${nextHref}">${esc(nextLabel)}</a>
        <button class="nk-btn" id="nkRetry">${esc(T('nk_retry', 'أعد المحاولة'))}</button>
        ${isTest ? '' : `<a class="nk-btn" href="${back}">${esc(T('nk_review', 'راجع الدرس'))}</a>`}</div>`;
      $('nkRetry').addEventListener('click', () => { quiz(f, isTest); window.scrollTo(0, 0); });
    }
    show();
  }

  function route() {
    if (!D) return;
    inQuiz = false;
    const h = decodeURIComponent(location.hash.slice(1)).split('/');
    const f = h[0] ? find(h[0], h[1] && h[1] !== 'test' ? h[1] : null) : {};
    if (f.L && h[1] === 'test') quiz(f, true);
    else if (f.S && h[2] === 'q') quiz(f, false);
    else if (f.S) lesson(f);
    else home();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('langchange', () => { if (D && !inQuiz) { const y = window.scrollY; route(); window.scrollTo(0, y); } });

  fetch('../data/nahw/kids.json').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(d => { D = d; route(); })
    .catch(() => { main.innerHTML = `<p class="nk-loading">${esc(T('nk_error', 'تعذّر تحميل الدروس. تحقّق من الاتصال ثم أعد المحاولة.'))}</p>`; });
})();
