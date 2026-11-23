// Audio and radio players on wide, short landscape screens: car head units
// (800×480 to 1920×720) and phones held sideways. One screen with no
// scrolling; the player in two balanced columns with a line between — the
// title and the controls on the reading side, the art beside them — radio's
// live indicator above the station name, the pickers in view and alike (an
// icon tile on the reading side of each), big tap targets; phones in
// portrait keep their layout. Also: the shuffle icon is the 🔀 shape.
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8080';
const CAR = [[800, 480], [1024, 600], [1280, 720], [1920, 720]];
const SIDEWAYS = [[844, 390], [740, 360]];

async function open(page, file, { width, height, lang = 'ar' }) {
  await page.setViewportSize({ width, height });
  await page.addInitScript(l => { try { localStorage.setItem('themeMode', 'dark'); localStorage.setItem('zad_lang', l); } catch (e) {} }, lang);
  await page.route(u => !u.href.startsWith(BASE_URL), route => route.abort());
  await page.goto(`${BASE_URL}/pages/${file}`, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  return page.evaluate(() => {
    const box = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
    const de = document.documentElement;
    // the controls column: its own box, or (audio, where its parts sit on the card's
    // grid) the parts beside the art — not the seek bar / error along the bottom
    const column = () => {
      const c = box('.hero-controls'); if (c && c.w) return c;
      const parts = ['.track-info', '.controls-main', '.controls-secondary'].map(box).filter(r => r && r.w);
      return { l: Math.min(...parts.map(r => r.l)), r: Math.max(...parts.map(r => r.r)), t: Math.min(...parts.map(r => r.t)), b: Math.max(...parts.map(r => r.b)) };
    };
    return {
      overflow: Math.max(de.scrollHeight, document.body.scrollHeight) - innerHeight, vh: innerHeight,
      now: box('.hero-now'), controls: column(), pickers: box('.sel-row') || box('.app > .sel-card'),
      play: box('.play-pause-btn'), skip: box('.skip-btn'), action: box('.controls-secondary .action-btn'),
      title: box('#nowSurah') || box('#nowStation'),
      divider: getComputedStyle(document.querySelector('.hero-now')).borderInlineStartStyle,
      sideDisplay: getComputedStyle(document.querySelector('.hero-side')).display,
      badge: box('#liveBadge'),
      cards: [...document.querySelectorAll('.sel-row > .sel-card, .app > .sel-card')].filter(c => c.offsetParent).map(c => {
        const r = c.getBoundingClientRect(), icon = c.querySelector('.sel-icon, .offl-entry-icon'), text = c.querySelector('.sel-text');
        const ib = icon && icon.offsetWidth ? icon.getBoundingClientRect() : null, tb = text.getBoundingClientRect();
        return { h: r.height, iconStart: !!ib && (getComputedStyle(document.documentElement).direction === 'rtl' ? ib.left >= tb.right - 1 : ib.right <= tb.left + 1) };
      }),
      mini: !!document.querySelector('.mini.show'),
    };
  });
}

test.describe('players on landscape screens', () => {
  test.use({ serviceWorkers: 'block', hasTouch: true });

  for (const file of ['audio.html', 'radio.html']) {
    for (const [width, height] of [...CAR, ...SIDEWAYS]) {
      const car = height >= 480;
      test(`${file} ${width}×${height}: one screen, two columns, big targets`, async ({ page }) => {
        const s = await open(page, file, { width, height });
        expect(s.overflow, 'no scrolling').toBeLessThanOrEqual(1);
        expect(s.sideDisplay).toBe('flex');
        // side by side, the controls on the reading side (right in Arabic), a line between
        expect(s.controls.l).toBeGreaterThanOrEqual(s.now.r - 1);
        expect(s.divider).toBe('solid');
        // the title at the top of the controls
        expect(s.title.l).toBeGreaterThanOrEqual(s.controls.l - 1);
        expect(s.title.r).toBeLessThanOrEqual(s.controls.r + 1);
        expect(Math.abs((s.now.t + s.now.b) / 2 - (s.controls.t + s.controls.b) / 2)).toBeLessThan(s.vh * 0.25);
        expect(s.pickers.b).toBeLessThanOrEqual(s.vh);
        expect(s.play.w).toBeGreaterThanOrEqual(car ? 72 : 60);    // phones sideways: still well over 44 px
        expect(s.skip.w).toBeGreaterThanOrEqual(car ? 56 : 46);
        expect(Math.min(s.action.w, s.action.h)).toBeGreaterThanOrEqual(44);   // the lighter secondary bar
        expect(s.mini).toBe(false);
        // the pickers alike: the same height, an icon tile on the reading side of each
        for (const c of s.cards) {
          expect(Math.abs(c.h - s.cards[0].h)).toBeLessThanOrEqual(1);
          expect(c.iconStart).toBe(true);
        }
        // radio: the live indicator just above the station name, over the controls
        if (file === 'radio.html') {
          expect(s.badge.b).toBeLessThanOrEqual(s.title.t + 1);
          expect(s.title.t - s.badge.b).toBeLessThan(40);
          expect(Math.abs((s.badge.l + s.badge.r) / 2 - (s.controls.l + s.controls.r) / 2)).toBeLessThan(4);
        }
      });
    }

    test(`${file} on a phone in portrait keeps one column`, async ({ page }) => {
      const s = await open(page, file, { width: 390, height: 844 });
      expect(s.sideDisplay).toBe('contents');
      expect(s.play.w).toBeLessThan(80);
    });
  }

  test('English: the columns mirror (controls on the left, art on the right)', async ({ page }) => {
    const s = await open(page, 'audio.html', { width: 1024, height: 600, lang: 'en' });
    expect(s.now.l).toBeGreaterThanOrEqual(s.controls.r - 1);
    expect(s.overflow).toBeLessThanOrEqual(1);
  });

  test('audio: the reciter under the art follows the reciter shown, and stays out of portrait', async ({ page }) => {
    await open(page, 'audio.html', { width: 1280, height: 720 });
    await page.evaluate(() => { document.getElementById('nowReciter').innerText = 'محمد صديق المنشاوي (مجود)'; });
    await expect(page.locator('.art-caption')).toHaveText('محمد صديق المنشاوي (مجود)');
    await expect(page.locator('.art-caption')).toHaveAttribute('aria-hidden', 'true');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.art-caption')).toBeHidden();
  });

  test('audio: a recitation that can\'t load shows its message in place of the progress bar', async ({ page }) => {
    await open(page, 'audio.html', { width: 800, height: 480 });
    await page.evaluate(() => { document.getElementById('trackError').hidden = false; });
    await expect(page.locator('.progress-section')).toBeHidden();
    await page.evaluate(() => { document.getElementById('trackError').hidden = true; });
    await expect(page.locator('.progress-section')).toBeVisible();
  });

  test('radio: a long station name wraps in full instead of scrolling, also after turning the phone', async ({ page }) => {
    await open(page, 'radio.html', { width: 390, height: 844 });
    await page.setViewportSize({ width: 800, height: 480 });
    await page.waitForTimeout(300);
    const t = await page.evaluate(() => {
      const e = document.getElementById('nowStation');
      return { ticker: e.classList.contains('ticker-active'), full: e.textContent === e.dataset.text, lines: Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)) };
    });
    expect(t.ticker).toBe(false);
    expect(t.full).toBe(true);
    expect(t.lines).toBeLessThanOrEqual(2);
  });

  test('radio: the station list opens as a centred panel on a wide screen', async ({ page }) => {
    await open(page, 'radio.html', { width: 1280, height: 720 });
    await page.evaluate(() => openStationSheet());
    await page.waitForTimeout(600);
    const r = await page.locator('#stationSheet').boundingBox();
    expect(r.width).toBeLessThanOrEqual(760);
    expect(Math.abs(r.x + r.width / 2 - 640)).toBeLessThan(2);
  });
});

test.describe('layout button and seek bar', () => {
  test.use({ serviceWorkers: 'block', hasTouch: true });
  const state = page => page.evaluate(() => ({
    wide: document.documentElement.classList.contains('player-wide'),
    pressed: document.getElementById('layoutBtn').getAttribute('aria-pressed'),
    saved: localStorage.getItem('playerLayout'),
  }));

  test('on a car screen the button switches to the vertical layout and back, and it is remembered', async ({ page }) => {
    await open(page, 'audio.html', { width: 1280, height: 720 });
    expect(await state(page)).toEqual({ wide: true, pressed: 'true', saved: null });
    await page.locator('#layoutBtn').click();
    await expect.poll(() => state(page)).toEqual({ wide: false, pressed: 'false', saved: 'tall' });
    await page.reload({ waitUntil: 'load' });
    expect(await state(page)).toEqual({ wide: false, pressed: 'false', saved: 'tall' });   // before the first paint
    await page.locator('#layoutBtn').click();
    await expect.poll(() => state(page)).toEqual({ wide: true, pressed: 'true', saved: 'wide' });
  });

  test('an upright screen wide enough for two columns (a foldable) switches to the wide layout; radio follows', async ({ page }) => {
    await open(page, 'audio.html', { width: 818, height: 889 });
    expect((await state(page)).wide).toBe(false);
    await page.locator('#layoutBtn').click();
    await expect.poll(() => state(page)).toEqual({ wide: true, pressed: 'true', saved: 'wide' });
    expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(1);
    await page.goto(`${BASE_URL}/pages/radio.html`, { waitUntil: 'load' });
    expect(await state(page)).toEqual({ wide: true, pressed: 'true', saved: 'wide' });
  });

  test('regular phones have no layout button, in either orientation; big screens do', async ({ page }) => {
    for (const [width, height] of [[390, 844], [844, 390], [412, 915]]) {
      await open(page, 'audio.html', { width, height });
      await expect(page.locator('#layoutBtn')).toBeHidden();
    }
    for (const [width, height] of [[818, 889], [800, 480], [1280, 720]]) {
      await open(page, 'radio.html', { width, height });
      await expect(page.locator('#layoutBtn')).toBeVisible();
    }
  });

  test('the seek bar runs along the bottom of the player, under both columns, almost the full width', async ({ page }) => {
    for (const [width, height] of [[1280, 720], [800, 480], [844, 390]]) {
      await open(page, 'audio.html', { width, height });
      const r = await page.evaluate(() => {
        document.getElementById('trackError').hidden = true;
        const b = s => document.querySelector(s).getBoundingClientRect();
        const card = b('.hero-card'), bar = b('.progress-section'), now = b('.hero-now'), sec = b('.controls-secondary');
        return { cardW: card.width, barW: bar.width, barTop: bar.top, nowBottom: now.bottom, secBottom: sec.bottom, barBottom: bar.bottom, cardBottom: card.bottom,
          overflow: document.documentElement.scrollHeight - innerHeight };
      });
      expect(r.barW / r.cardW).toBeGreaterThan(0.85);
      expect(r.barTop).toBeGreaterThanOrEqual(r.nowBottom - 1);
      expect(r.barTop).toBeGreaterThanOrEqual(r.secBottom);
      expect(r.barBottom).toBeLessThanOrEqual(r.cardBottom);
      expect(r.overflow).toBeLessThanOrEqual(1);
    }
  });

  test('the seek bar paints played and buffered on its track, so the taller wide-layout slider shows no block', async ({ page }) => {
    await open(page, 'audio.html', { width: 1000, height: 720 });
    const r = await page.evaluate(() => {
      Object.defineProperty(audio, 'duration', { configurable: true, get: () => 1411 });
      Object.defineProperty(audio, 'currentTime', { configurable: true, get: () => 68, set: () => {} });
      Object.defineProperty(audio, 'buffered', { configurable: true, get: () => ({ length: 1, start: () => 0, end: () => 190 }) });
      updateProgressBar();
      const bar = document.getElementById('progress');
      return { inline: bar.style.background, box: getComputedStyle(bar).backgroundImage, height: parseFloat(getComputedStyle(bar).height),
        pct: parseFloat(bar.style.getPropertyValue('--pct')), buf: parseFloat(bar.style.getPropertyValue('--buf')) };
    });
    expect(r.height).toBeGreaterThan(20);          // the big touch area
    expect(r.inline).toBe('');                      // nothing painted on the slider box
    expect(r.box).toBe('none');
    expect(r.pct).toBeCloseTo(68 / 1411 * 100, 1);
    expect(r.buf).toBeCloseTo(190 / 1411 * 100, 1);
  });
});

test.describe('player icons', () => {
  test('the shuffle icon is the 🔀 shape (two arrows swapping lanes) on every player page', async ({ request }) => {
    for (const file of ['audio.html', 'audio-download.html', 'audio2.html', 'audio3.html']) {
      const html = await (await request.get(`${BASE_URL}/pages/${file}`)).text();
      expect(html, file).toContain('M2 16.5h3C9.6 16.5 10.4 7.5 15 7.5h6');            // one arrow over the other
      expect(html, file).not.toContain('x1="4" y1="20" x2="21" y2="3"');                 // the old diagonal (an ✕)
    }
  });
});
