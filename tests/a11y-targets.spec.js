// Touch targets and keyboard access on the busiest screens (P1-3).
// For every control visible on first load:
//   • it can be reached with the keyboard and has an accessible name;
//   • its tap area is at least 24 × 24 px (WCAG 2.2 AA, 2.5.8), and at least
//     44 px in one direction and 36 px in the other — the toolbar buttons that
//     touch each other are 38 px wide by 44 px tall. A target that reaches the
//     edge of the screen counts as tall (or wide) enough in that direction.
// The header links with the surah / juz / page names are text links in a tight
// header and are checked for keyboard access and names only.
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8080';
const PAGES = ['pages/quran.html', 'pages/quran-text.html?page=2', 'pages/takrar.html', 'pages/audio.html', 'pages/azkar.html?type=morning'];
const TEXT_LINKS = ['surahName', 'juzName', 'pageName', 'surahProgressBar'];

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

for (const p of PAGES) {
  test(`${p}: controls are named, reachable by keyboard and big enough to tap`, async ({ page }) => {
    await page.addInitScript(() => {
      try {
        ['quranV3DlDone', 'zoom_hint_dismissed', 'takrarWelcomeSeen', 'tpv2_marker_hint', 'qtZoomHintDone'].forEach(k => localStorage.setItem(k, '1'));
      } catch (e) {}
    });
    await page.route(url => !url.href.startsWith(BASE_URL), route => route.abort());
    await page.goto(`${BASE_URL}/${p}`, { waitUntil: 'load' });
    await page.waitForTimeout(1500);

    const controls = await page.evaluate(() => {
      const sel = 'button,a[href],[onclick],input:not([type=hidden]),select,[role=button],[role=switch]';
      const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
      const owns = (el, x, y) => { const t = document.elementFromPoint(x, y); return !!t && (t === el || el.contains(t)); };
      const centreOwned = el => { const r = el.getBoundingClientRect(); return owns(el, r.left + r.width / 2, r.top + r.height / 2); };
      return [...document.querySelectorAll(sel)].filter(vis).filter(centreOwned)
        .filter(el => !el.parentElement.closest('button,a[href],[role=button]'))
        .filter(el => !/event\.target\s*={2,3}\s*this|^event\.stopPropagation\(\);?$/.test((el.getAttribute('onclick') || '').trim()))
        .filter(el => !(el.querySelector('a[href],button,input,select,[onclick],[role=button]')))
        .map(el => {
          const r = el.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          const ext = (dx, dy) => { let d = 0; while (d < 40 && owns(el, cx + dx * (d + 1), cy + dy * (d + 1))) d++; return d; };
          const L = ext(-1, 0), R = ext(1, 0), T = ext(0, -1), B = ext(0, 1);
          let w = L + R + 1, h = T + B + 1;
          // A target that reaches the edge of the screen can't be overshot in
          // that direction: a finger landing past it still lands on it.
          const EDGE = 3;
          if (cy - T <= EDGE || cy + B >= innerHeight - EDGE) h = Math.max(h, 44);
          if (cx - L <= EDGE || cx + R >= innerWidth - EDGE) w = Math.max(w, 44);
          const name = (el.getAttribute('aria-label') || el.getAttribute('title') || (el.labels && el.labels[0] && el.labels[0].textContent) || el.textContent || el.getAttribute('placeholder') || '').trim();
          return { id: el.id, desc: el.outerHTML.slice(0, 90), w: Math.round(w), h: Math.round(h), named: !!name, focusable: el.tabIndex >= 0 };
        });
    });

    expect(controls.length).toBeGreaterThan(3);
    const problems = [];
    for (const c of controls) {
      if (!c.named) problems.push('no name: ' + c.desc);
      if (!c.focusable) problems.push('not reachable by keyboard: ' + c.desc);
      if (TEXT_LINKS.includes(c.id)) continue;
      const small = Math.min(c.w, c.h), large = Math.max(c.w, c.h);
      if (small < 24 || large < 44 || small < 36) {
        // a slider is a strip: 24 px tall is enough when it is wide
        if (!(c.desc.startsWith('<input type="range"') && c.h >= 24)) problems.push(`tap area ${c.w}×${c.h}: ${c.desc}`);
      }
    }
    expect(problems).toEqual([]);
  });
}

test('adhkar page can be zoomed with two fingers', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/azkar.html?type=morning`, { waitUntil: 'domcontentloaded' });
  const viewport = await page.getAttribute('meta[name="viewport"]', 'content');
  expect(viewport).not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/);
});

test('a tappable div works with the keyboard and a switch reports its state', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('takrarWelcomeSeen', '1'); } catch (e) {} });
  await page.route(url => !url.href.startsWith(BASE_URL), route => route.abort());
  await page.goto(`${BASE_URL}/pages/takrar.html`, { waitUntil: 'load' });
  const sw = page.locator('#rangeSwitch');
  await expect(sw).toHaveAttribute('role', 'switch');
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  expect((await sw.getAttribute('aria-label')) || '').not.toBe('');
  await sw.focus();
  await page.keyboard.press('Enter');
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press(' ');
  await expect(sw).toHaveAttribute('aria-checked', 'false');
});
