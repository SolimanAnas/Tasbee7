// Tasmee' Pro v2 (pages/quran.html) — text-rendered masking panel
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8080';
const VIEWPORTS = [
  { name: 'small phone', width: 360, height: 640 },
  { name: 'iPhone 12',   width: 390, height: 844 },
  { name: 'large phone', width: 412, height: 915 },
  { name: 'tablet',      width: 768, height: 1024 },
];

// open the page, dismiss first-run modals, wait for the DB, open the panel
async function openPanel(page, quranPage) {
  await page.goto(`${BASE_URL}/pages/quran.html?page=${quranPage}`, {
    waitUntil: 'domcontentloaded', timeout: 20000,
  });
  await page.evaluate(() => {
    try { dlSkip(); } catch (e) {}
    const dl = document.getElementById('dlModal');
    if (dl) dl.style.display = 'none';
  });
  await page.waitForFunction(() => typeof dbReady !== 'undefined' && dbReady, null, { timeout: 20000 });
  await page.evaluate(async (p) => { await _v2LoadQuranText(); await _v2Open(p); }, quranPage);
  await page.waitForFunction(() => window._tpv2 && _tpv2.words.length > 0, null, { timeout: 15000 });
  await page.waitForTimeout(300);
}

test('panel renders 15 text lines with masked words and visible medallions (p287)', async ({ page }) => {
  await openPanel(page, 287);
  expect(await page.locator('#tpv2PageHost > *').count()).toBe(15);
  const masked = await page.locator('#tpv2PageHost .tpv2-word.masked').count();
  expect(masked).toBeGreaterThan(50);
  // medallions never masked: digits-only (the font ligates them into the sign)
  const markers = await page.locator('#tpv2PageHost .tpv2-marker').count();
  expect(markers).toBeGreaterThanOrEqual(8);
  expect(await page.locator('#tpv2PageHost .tpv2-marker').first().textContent()).toMatch(/^[٠-٩]+$/);
});

test('tapping a medallion starts the session from that ayah', async ({ page }) => {
  await openPanel(page, 287);
  const r = await page.evaluate(() => {
    _v2StartFromAyah(17, 53);
    const range = _tpv2.ayahRanges['17_53'];
    return {
      ptr: _tpv2.ptr,
      rangeStart: range.start,
      revealedBefore: document.querySelectorAll('#tpv2PageHost .tpv2-word:not(.masked)').length,
    };
  });
  expect(r.ptr).toBe(r.rangeStart);
  expect(r.ptr).toBeGreaterThan(0);
  expect(r.revealedBefore).toBe(r.rangeStart); // everything before is context
});

test('masked words keep layout: transparent color, non-zero width', async ({ page }) => {
  await openPanel(page, 287);
  const word = page.locator('#tpv2PageHost .tpv2-word.masked').first();
  const { color, width } = await word.evaluate(el => ({
    color: getComputedStyle(el).color,
    width: el.getBoundingClientRect().width,
  }));
  expect(color).toBe('rgba(0, 0, 0, 0)');
  expect(width).toBeGreaterThan(0);
});

test('stream transcript reveals words in order; skipped word flagged missed (p2)', async ({ page }) => {
  await openPanel(page, 2);
  const r = await page.evaluate(() => {
    _tpHandleStreamResult({ transcript: 'الم ذلك الكتاب لا فيه هدى للمتقين' });
    return {
      ptr: _tpv2.ptr,
      missed: document.querySelectorAll('.tpv2-word.missed').length,
      revealed: document.querySelectorAll('#tpv2PageHost .tpv2-word:not(.masked)').length,
    };
  });
  expect(r.ptr).toBe(8);          // through "للمتقين", with "ريب" skipped
  expect(r.missed).toBe(1);
  expect(r.revealed).toBe(8);

  // sliding-window transcript (worker sends only the last ~7s): overlapping
  // tail words are ignored, new words keep advancing the pointer
  const r2 = await page.evaluate(() => {
    _tpHandleStreamResult({ transcript: 'هدى للمتقين الذين يؤمنون بالغيب' });
    return { ptr: _tpv2.ptr };
  });
  expect(r2.ptr).toBe(11);
});

test('final result reveals through the ayah; wrong ayah counts an error', async ({ page }) => {
  await openPanel(page, 287);
  const r = await page.evaluate(() => {
    _aiHandleResult({ surah: 17, ayah: 50, surahName: 'الإسراء' });
    const afterOk = { ptr: _tpv2.ptr, errors: _tpv2.errors };
    _aiHandleResult({ surah: 18, ayah: 1, surahName: 'الكهف' }); // not on page
    return { afterOk, errorsAfterWrong: _tpv2.errors };
  });
  expect(r.afterOk.ptr).toBeGreaterThan(0);
  expect(r.afterOk.errors).toBe(0);
  expect(r.errorsAfterWrong).toBe(1);
});

test('surah headers and basmalas render on multi-surah page (p604)', async ({ page }) => {
  await openPanel(page, 604);
  expect(await page.locator('.tpv2-surah-header').count()).toBe(3);
  expect(await page.locator('.tpv2-basmala').count()).toBe(3);
});

test('peek mode ghosts hidden words; undo controls re-mask', async ({ page }) => {
  await openPanel(page, 287);
  const r = await page.evaluate(() => {
    _tpHandleStreamResult({ transcript: 'قل كونوا حجارة أو حديدا' });
    const revealed = _tpv2.ptr;
    tpPrev();
    const afterPrev = _tpv2.ptr;
    tpSkipBack();
    const afterSkip = _tpv2.ptr;
    tpToggleText();
    return { revealed, afterPrev, afterSkip,
             peek: document.getElementById('tpv2PageHost').classList.contains('peek') };
  });
  expect(r.revealed).toBe(5);
  expect(r.afterPrev).toBe(4);
  expect(r.afterSkip).toBe(0);   // back to start of ayah 50
  expect(r.peek).toBe(true);
});

for (const vp of VIEWPORTS) {
  test(`no overlap or clipping at ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await openPanel(page, 287);
    const r = await page.evaluate(() => {
      const dock = document.querySelector('.tpv2-dock').getBoundingClientRect();
      const host = document.getElementById('tpv2PageHost');
      const kids = [...document.querySelectorAll('.tpv2-dock > *')].map(c => c.getBoundingClientRect());
      let overlap = false;
      for (let i = 0; i < kids.length - 1; i++) {
        for (let j = i + 1; j < kids.length; j++) {
          if (Math.min(kids[i].right, kids[j].right) - Math.max(kids[i].left, kids[j].left) > 1) overlap = true;
        }
      }
      let lineOverflow = 1;
      if (typeof _v2LineRatio === 'function') lineOverflow = _v2LineRatio(host);
      return {
        overlap,
        dockInside: dock.left >= 0 && dock.right <= innerWidth && dock.bottom <= innerHeight,
        contentClear: host.getBoundingClientRect().bottom <= dock.top,
        lineOverflow,
      };
    });
    expect(r.overlap, 'dock buttons overlap').toBe(false);
    expect(r.dockInside, 'dock clipped by viewport').toBe(true);
    expect(r.contentClear, 'page content hidden behind dock').toBe(true);
    expect(r.lineOverflow, 'text line overflows page').toBeLessThanOrEqual(1.01);
  });
}

test('normal reading mode unaffected: mushaf image still renders', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/quran.html?page=3`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.evaluate(() => {
    try { dlSkip(); } catch (e) {}
    const dl = document.getElementById('dlModal');
    if (dl) dl.style.display = 'none';
  });
  await expect(page.locator('#pageImg')).toBeVisible();
  expect(await page.locator('#tasmeeProPanel').isVisible()).toBe(false);
});
