/* nahw.js — «تعلم النحو»: a matn of grammar with a simple sharh per unit.
   Data: data/nahw/<matn>.json (built and checked by scripts/build-nahw.cjs). */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const T = (k, f) => { if (window.I18n) { const v = I18n.t(k); if (v && v !== k) return v; } return f; };
  const store = {
    get(k, d) { try { const v = localStorage.getItem('nahw_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('nahw_' + k, JSON.stringify(v)); } catch { /* storage blocked */ } },
  };
  if (window.ThemeManager) ThemeManager.init();
  window.setTheme = t => window.ThemeManager && ThemeManager.set(t);
  window.addEventListener('themechange', e => {
    document.querySelectorAll('.theme-dock .dot').forEach(d => d.classList.toggle('active', d.dataset.set === e.detail.theme));
  });

  const MATNS = ['ajurrumiyya'];
  const id = MATNS.includes(new URLSearchParams(location.search).get('matn')) ? new URLSearchParams(location.search).get('matn') : MATNS[0];
  let size = store.get('size', 100);

  function applySize() {
    document.documentElement.style.setProperty('--k', size / 100);
    $('nhSize').textContent = size + '%';
  }
  function render(M) {
    $('nhTitle').textContent = M.title;
    $('nhAuthor').textContent = M.author;
    $('nhNote').textContent = M.sharhNote;
    let html = '', ci = 0;
    M.units.forEach(u => {
      if (ci < M.chapters.length && M.chapters[ci].from === u.n) {
        html += `<h2 class="ch-title" id="c-${ci}">${esc(M.chapters[ci].title)}</h2>`; ci++;
      }
      html += `<article class="unit" id="u-${u.n}"><span class="u-num">${u.n}</span><div class="u-text">${esc(u.t)}</div><div class="u-sharh"><b>${esc(T('nh_sharh', 'الشرح'))}:</b>${esc(u.sharh)}</div></article>`;
    });
    $('nhList').innerHTML = html;
    $('nhChaps').innerHTML = M.chapters.map((c, i) => `<button class="nh-chap" data-c="${i}">${esc(c.title.replace(/^بَابُ\s*/, '').replace(/^فَصْلٌ:?\s*/, ''))}</button>`).join('');
    $('nhChaps').addEventListener('click', e => {
      const b = e.target.closest('.nh-chap'); if (!b) return;
      const el = $('c-' + b.dataset.c); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('nhSrc').innerHTML = `<h3>${esc(T('nh_sources', 'المصدر'))}</h3><p>${esc(M.source)}</p><p><a href="${esc(M.sourceUrl)}" target="_blank" rel="noopener">${esc(M.sourceUrl)}</a></p>`;
    const heads = [...document.querySelectorAll('.ch-title')];
    const mark = () => {
      let on = 0; heads.forEach((h, i) => { if (h.getBoundingClientRect().top < 190) on = i; });
      document.querySelectorAll('.nh-chap').forEach((b, i) => b.classList.toggle('on', i === on));
      const cur = document.querySelector('.nh-chap.on'); if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
    };
    let t = 0; window.addEventListener('scroll', () => { cancelAnimationFrame(t); t = requestAnimationFrame(mark); }, { passive: true });
    mark();
  }

  $('nhHide').checked = store.get('hide', false);
  document.body.classList.toggle('no-sharh', $('nhHide').checked);
  $('nhHide').addEventListener('change', e => { document.body.classList.toggle('no-sharh', e.target.checked); store.set('hide', e.target.checked); });
  $('nhSmaller').addEventListener('click', () => { size = Math.max(80, size - 10); store.set('size', size); applySize(); });
  $('nhLarger').addEventListener('click', () => { size = Math.min(180, size + 10); store.set('size', size); applySize(); });
  applySize();
  fetch('../data/nahw/' + id + '.json').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(render)
    .catch(() => { $('nhList').innerHTML = `<p class="hero-note">${esc(T('nh_error', 'تعذّر تحميل المتن. تحقق من الاتصال ثم أعد المحاولة.'))}</p>`; });
})();
