// Editing tools of the video maker: the seek bar (and a preview that stands at a moment, each
// sticker only in its own time), undo / redo, line spacing, sticker corners / × / «حتى», the
// folding sticker picker, and turning the floating mini preview back on.
const { test, expect } = require('@playwright/test');
const sec = (page, name) => expect(async () => {
  const tab = page.locator('#vmTab-' + name);
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click({ timeout: 2000 });
  await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 500 });
}).toPass({ timeout: 15000 });

const BASE_URL = 'http://localhost:8080';
test.use({ serviceWorkers: 'block', viewport: { width: 412, height: 915 } });

const THREE = ['الصبر مفتاح الفرج', 'ومن يتق الله يجعل له مخرجاً', 'إن مع العسر يسراً'];
async function open(page, extra) {
  await page.addInitScript(extra => {
    if (sessionStorage.getItem('e')) return;
    sessionStorage.setItem('e', '1');
    localStorage.setItem('zad_lang', 'ar');
    localStorage.setItem('vm_settings', JSON.stringify(Object.assign({ mode: 'khatira', kContent: 'text', bg: 'g0', motion: false, caption: false, miniPreview: false }, extra)));
  }, extra || {});
  await page.route(url => !url.href.startsWith(BASE_URL), route => route.abort());
  await page.goto(`${BASE_URL}/pages/video-maker.html`, { waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
}
// how much of the stickers' white is in a vertical band of the live preview (x0..x1 as shares)
const band = (page, x0, x1) => page.evaluate(([x0, x1]) => {
  const cv = document.getElementById('vmCanvas'), x = cv.getContext('2d', { willReadFrequently: true });
  const a = Math.round(cv.width * x0), w = Math.round(cv.width * (x1 - x0)), y = Math.round(cv.height * 0.62);
  const d = x.getImageData(a, y, w, Math.round(cv.height * 0.3)).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 16) if (d[i] > 225 && d[i + 1] > 225 && d[i + 2] > 225) n++;
  return n;
}, [x0, x1]);
const seekTo = (page, share) => page.locator('#vmSeek').evaluate((el, v) => { el.value = String(Math.round(v * 1000)); el.dispatchEvent(new Event('input', { bubbles: true })); }, share);

test('the preview stands at a moment: each sticker only with its own line; the seek bar moves it, and play goes on from there', async ({ page }) => {
  await open(page, {
    kTexts: THREE,
    stickers: [{ id: 'h05', x: 0.18, y: 0.78, s: 0.3, line: 0 }, { id: 'h06', x: 0.5, y: 0.78, s: 0.3, line: 1 }, { id: 'h07', x: 0.82, y: 0.78, s: 0.3, line: 2 }],
  });
  await expect(page.locator('#vmSeekRow')).toBeVisible();
  const total = await page.evaluate(async () => (await VM.buildTimeline()).total);
  const spans = await page.evaluate(async () => (await VM.buildTimeline()).items.map(it => [it.start, it.end]));
  await expect(page.locator('#vmSeekTotal')).toHaveText(/[٠-٩]:[٠-٩]{2}/);
  // before any seeking: the first text on screen, and only its sticker
  await expect.poll(() => band(page, 0.04, 0.32)).toBeGreaterThan(150);
  expect(await band(page, 0.36, 0.64)).toBeLessThan(20);
  expect(await band(page, 0.68, 0.96)).toBeLessThan(20);
  // the middle of the second line: its sticker, not the others
  await seekTo(page, (spans[1][0] + spans[1][1]) / 2 / total);
  await expect.poll(() => band(page, 0.36, 0.64)).toBeGreaterThan(150);
  expect(await band(page, 0.04, 0.32)).toBeLessThan(20);
  expect(await band(page, 0.68, 0.96)).toBeLessThan(20);
  const label = await page.locator('#vmSeekNow').textContent();
  // play: from there, not from the start
  await page.locator('#vmPreview').click();
  await expect(page.locator('#vmStagePlay')).toBeHidden({ timeout: 10000 });
  const t = await page.evaluate(() => new Promise(r => setTimeout(() => r(+document.getElementById('vmSeek').value), 250)));
  expect(t / 1000 * total).toBeGreaterThan(spans[1][0] - 0.2);
  // stop: the preview stays at that moment
  await page.locator('#vmPreview').click();
  await expect(page.locator('#vmStagePlay')).toBeVisible({ timeout: 10000 });
  const v = +(await page.locator('#vmSeek').inputValue());
  expect(v / 1000 * total).toBeGreaterThan(spans[1][0] - 0.2);
  expect(await page.locator('#vmSeekNow').textContent()).not.toBe('٠:٠٠');
  expect(label).toMatch(/[٠-٩]:[٠-٩]{2}/);
  // a sticker that is not on screen at this moment cannot be grabbed: the tap goes to the video
  await page.evaluate(() => scrollTo(0, 0));
  const cv = await page.locator('#vmCanvas').boundingBox();
  await page.mouse.click(cv.x + cv.width * 0.18, cv.y + cv.height * 0.78);
  expect(await page.evaluate(() => VM.stickers.selected)).toBe(-1);
});

test('undo / redo: buttons and keyboard, across changes; a step back restores the controls too', async ({ page }) => {
  await open(page, { kTexts: ['الصبر مفتاح الفرج'] });
  await expect.poll(() => page.evaluate(() => VM.history.started)).toBe(true);
  await expect(page.locator('#vmUndo')).toBeDisabled();
  await expect(page.locator('#vmRedo')).toBeDisabled();
  await sec(page, 'text');
  await page.locator('#vmColors [data-color="#e6c068"]').click();
  await page.waitForTimeout(450);
  await page.locator('#vmLineGap').fill('2.2');
  await page.waitForTimeout(450);
  await sec(page, 'ayat');
  await page.locator('#vmKText0').fill('كلمة جديدة');
  await page.waitForTimeout(450);
  expect(await page.evaluate(() => VM.history)).toMatchObject({ undo: 3, redo: 0 });
  await expect(page.locator('#vmUndo')).toBeEnabled();
  // the text back
  await page.locator('#vmUndo').click();
  expect(await page.evaluate(() => VM.state.kTexts)).toEqual(['الصبر مفتاح الفرج']);
  await expect(page.locator('#vmKText0')).toHaveValue('الصبر مفتاح الفرج');
  // the spacing back (and its slider)
  await page.locator('#vmUndo').click();
  expect(await page.evaluate(() => VM.state.lineGap)).toBe(null);
  await expect(page.locator('#vmLineGap')).toHaveValue('1.45');
  // the colour back, with the keyboard (not in a text field)
  await page.locator('#vmTab-text').focus();
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(() => VM.state.color)).toBe('#ffffff');
  await expect(page.locator('#vmUndo')).toBeDisabled();
  // and forward again
  await page.keyboard.press('Control+Shift+z');
  expect(await page.evaluate(() => VM.state.color)).toBe('#e6c068');
  await page.locator('#vmRedo').click();
  expect(await page.evaluate(() => VM.state.lineGap)).toBe(2.2);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => VM.history)).toMatchObject({ undo: 2, redo: 1 });   // nothing taken for a new change
  // a new change drops what was ahead
  await sec(page, 'text');
  await page.locator('#vmColors [data-color="#a7f3d0"]').click();
  await page.waitForTimeout(450);
  expect(await page.evaluate(() => VM.history)).toMatchObject({ undo: 3, redo: 0 });
  // stickers too
  await sec(page, 'look');
  await page.locator('#vmStGrid [data-sticker="h01"]').click();
  await page.waitForTimeout(450);
  expect(await page.evaluate(() => VM.state.stickers.length)).toBe(1);
  await page.locator('#vmUndo').click();
  expect(await page.evaluate(() => VM.state.stickers.length)).toBe(0);
  await expect(page.locator('#vmStAdded .st-chip')).toHaveCount(0);
});

test('line spacing: the slider spreads the lines, for «خاطرة» and for ayat; remembered', async ({ page }) => {
  await open(page, { kTexts: ['ومن يتق الله يجعل له مخرجاً ويرزقه'] });
  // the rows with text in a frame: their spread from the first to the last
  const spread = () => page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 540; c.height = 960;
    const x = c.getContext('2d', { willReadFrequently: true });
    VM.renderFrame(x, 540, 960, 0, null);
    const d = x.getImageData(0, 0, 540, 960).data;
    let first = -1, last = -1;
    for (let y = 0; y < 960; y++) { let on = 0; for (let i = 0; i < 540; i += 3) { const k = (y * 540 + i) * 4; if (d[k] > 225 && d[k + 1] > 225 && d[k + 2] > 225) on++; } if (on > 2) { if (first < 0) first = y; last = y; } }
    return last - first;
  });
  await sec(page, 'text');
  await expect(page.locator('#vmLineGap')).toHaveValue('1.45');
  const normal = await spread();
  await page.locator('#vmLineGap').fill('1.1');
  const tight = await spread();
  await page.locator('#vmLineGap').fill('2.2');
  const airy = await spread();
  expect(tight).toBeLessThan(normal);
  expect(airy).toBeGreaterThan(normal * 1.2);
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  expect(await page.evaluate(() => VM.state.lineGap)).toBe(2.2);
  // ayat (the Shorts mode) follow it too
  const ayah = await page.evaluate(() => {
    VM.state.mode = 'short'; VM.state.from = 1; VM.state.to = 1; VM.state.surah = 2;
    const c = document.createElement('canvas'); c.width = 540; c.height = 960;
    const x = c.getContext('2d', { willReadFrequently: true });
    const rows = () => { VM.renderFrame(x, 540, 960, 0, null); const d = x.getImageData(0, 0, 540, 860).data; let first = -1, last = -1; for (let y = 0; y < 860; y++) { let on = 0; for (let i = 0; i < 540; i += 3) { const k = (y * 540 + i) * 4; if (d[k] > 225 && d[k + 1] > 225 && d[k + 2] > 225) on++; } if (on > 2) { if (first < 0) first = y; last = y; } } return last - first; };
    VM.state.lineGap = 1.2; const a = rows(); VM.state.lineGap = 2.4; const b = rows(); return [a, b];
  });
  expect(ayah[1]).toBeGreaterThanOrEqual(ayah[0]);
});

test('a sticker: either corner resizes, × on it deletes, the picker folds after adding; «حتى»: its line, the next sticker, the end, a second', async ({ page }) => {
  await open(page, { kTexts: THREE, miniPreview: false });
  await sec(page, 'look');
  await expect(page.locator('#vmStPickToggle')).toHaveAttribute('aria-expanded', 'true');
  await page.locator('#vmStGrid [data-sticker="h05"]').click();
  // folded once there is one (less to scroll); a tap opens it again
  await expect(page.locator('#vmStGrid')).toBeHidden();
  await expect(page.locator('#vmStPickToggle')).toHaveAttribute('aria-expanded', 'false');
  await page.locator('#vmStPickToggle').click();
  await expect(page.locator('#vmStGrid')).toBeVisible();
  await page.locator('#vmStGrid [data-sticker="h06"]').click();
  await page.locator('#vmStAdded .st-chip').first().click();
  await page.evaluate(() => scrollTo(0, 0));
  await expect(page.locator('#vmStickerBox')).toBeVisible();
  // the top corner handle: pulled out, the sticker grows
  const s0 = await page.evaluate(() => VM.state.stickers[0].s);
  const h = await page.locator('#vmStHandle2').boundingBox();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2 + 40, h.y + h.height / 2 - 40, { steps: 5 });
  await page.mouse.up();
  expect(await page.evaluate(() => VM.state.stickers[0].s)).toBeGreaterThan(s0 * 1.15);
  await expect(page.locator('#vmStagePlay')).toBeVisible();                 // not a tap on the video
  // «حتى» shows for a sticker with a line
  await page.locator('#vmStWith').selectOption('0');
  await expect(page.locator('#vmStUntilRow')).toBeVisible();
  await expect(page.locator('#vmStUntil')).toHaveValue('line');
  const spans = await page.evaluate(async () => (await VM.buildTimeline()).items.map(it => [it.start, it.end]));
  const shows = t => page.evaluate(([t]) => { const st = VM.state.stickers[0]; const tl = VM.timeline; const span = k => { const it = tl.items.find(x => x.ki === k); return it ? [Math.min(it.start, it.words[0].a - 0.35), it.end] : null; }; return !!VM.stickers.look(st, t, tl.total, span); }, [t]);
  const mid = k => (spans[k][0] + spans[k][1]) / 2;
  expect([await shows(mid(0)), await shows(mid(1)), await shows(mid(2))]).toEqual([true, false, false]);
  await page.locator('#vmStUntil').selectOption('end');
  expect(await page.evaluate(() => VM.state.stickers[0].until)).toBe('end');
  expect([await shows(mid(0)), await shows(mid(1)), await shows(mid(2))]).toEqual([true, true, true]);
  // until the next sticker: the second one shows with line 2 (index 2)
  await page.evaluate(() => { VM.state.stickers[1].line = 2; });
  await page.locator('#vmStUntil').selectOption('next');
  expect([await shows(mid(0)), await shows(mid(1)), await shows(mid(2))]).toEqual([true, true, false]);
  // a set second
  await page.locator('#vmStUntil').selectOption('time');
  await expect(page.locator('#vmStUntilAt')).toBeVisible();
  await page.locator('#vmStUntilAt').fill(String(Math.round(mid(1) * 10) / 10));
  await page.locator('#vmStUntilAt').dispatchEvent('change');
  expect(await page.evaluate(() => typeof VM.state.stickers[0].until)).toBe('number');
  expect([await shows(mid(0)), await shows(spans[1][0] + 0.1), await shows(spans[1][1] - 0.1)]).toEqual([true, true, false]);
  // × on the chosen sticker deletes it, and does not start the preview
  await page.evaluate(() => scrollTo(0, 0));
  await page.locator('#vmStBoxDel').click();
  expect(await page.evaluate(() => VM.state.stickers.map(s => s.id))).toEqual(['h06']);
  await expect(page.locator('#vmStagePlay')).toBeVisible();
});

test('the mini preview: × shrinks it (never lost); the setting turns it off and on', async ({ page }) => {
  await open(page, { kTexts: ['الصبر مفتاح الفرج'], miniPreview: true });
  await sec(page, 'text');
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await expect(page.locator('#vmMiniView')).toBeVisible();
  await page.locator('#vmMiniClose').click();
  await expect(page.locator('#vmMiniView')).toBeHidden();
  await expect(page.locator('#vmMiniOpen')).toBeVisible();
  await expect(page.locator('#vmStatus')).toContainText('اضغطه لإظهارها');
  expect(await page.evaluate(() => VM.state.miniPreview)).toBe(true);
  // the setting off: nothing at all
  await page.evaluate(() => scrollTo(0, 0));
  await page.locator('#vmSettingsBtn').click();
  await expect(page.locator('#vmMiniToggle')).toBeChecked();
  await page.locator('#vmMiniToggle').uncheck();
  await page.keyboard.press('Escape');
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await expect(page.locator('#vmMini')).toBeHidden();
  // on again (also after a reload): the full preview, not the shrunk button
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  await page.locator('#vmSettingsBtn').click();
  await expect(page.locator('#vmMiniToggle')).not.toBeChecked();
  await page.locator('#vmMiniToggle').check();
  await page.keyboard.press('Escape');
  await sec(page, 'text');
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await expect(page.locator('#vmMiniView')).toBeVisible();
  // an early version's "hidden for this visit" flag no longer hides it
  await page.evaluate(() => sessionStorage.setItem('vmMiniClosed', '1'));
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  await sec(page, 'text');
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await expect(page.locator('#vmMiniView')).toBeVisible();
});

test('«موضع النص»: top, middle or bottom, clear of the app name and the caption; «خاطرة» starts at the top', async ({ page }) => {
  await open(page, { kTexts: ['هون على نفسك يا صديقي'], color: '#ffffff' });
  await sec(page, 'text');
  await expect(page.locator('#vmTextAlign [data-ta="top"]')).toHaveAttribute('aria-pressed', 'true');   // «خاطرة»'s own
  // the rows of the frame with text in them (the app name above is left out)
  const rows = () => page.evaluate(() => {
    const W = 540, H = 960, base = 540, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true });
    VM.renderFrame(x, W, H, 0, null);
    const d = x.getImageData(0, 0, W, H).data;
    let first = -1, last = -1;
    for (let y = Math.ceil(base * 0.11); y < H; y++) { let on = 0; for (let i = 0; i < W; i += 3) { const k = (y * W + i) * 4; if (d[k] > 225 && d[k + 1] > 225 && d[k + 2] > 225) on++; } if (on > 2) { if (first < 0) first = y; last = y; } }
    return { first, last, H, base };
  });
  const top = await rows();
  expect(top.first).toBeGreaterThan(top.base * 0.11);        // under the app name
  expect(top.first).toBeLessThan(top.H * 0.2);                // and near the top
  await page.locator('#vmTextAlign [data-ta="bottom"]').click();
  expect(await page.evaluate(() => VM.state.textAlign)).toBe('bottom');
  const bottom = await rows();
  expect(bottom.last).toBeLessThan(bottom.H - bottom.base * 0.08);   // a margin below
  expect(bottom.last).toBeGreaterThan(bottom.H * 0.8);
  await page.locator('#vmTextAlign [data-ta="middle"]').click();
  const mid = await rows();
  expect(Math.abs((mid.first + mid.last) / 2 - mid.H * 0.5)).toBeLessThan(mid.H * 0.06);
  // with the caption on, the bottom stays clear of it
  await page.locator('#vmTextAlign [data-ta="bottom"]').click();
  const capped = await page.evaluate(() => { VM.state.caption = true; VM.state.sheikh = ''; return true; });
  expect(capped).toBe(true);
  const b2 = await rows();
  expect(b2.last).toBeLessThan(b2.H - b2.base * 0.26);
  // remembered
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  expect(await page.evaluate(() => VM.state.textAlign)).toBe('bottom');
});
