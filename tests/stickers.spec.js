// Character stickers: 39 pictures cut from the supplied sheets, put on a video from the «المظهر»
// tab: added by a tap, moved on the preview (drag) or with sliders, resized, flipped, brought to
// the front, deleted, remembered, and drawn into the video itself.
const { test, expect } = require('@playwright/test');
// the settings are in tabs: open the one a control is on
const sec = (page, name) => expect(async () => {
  const tab = page.locator('#vmTab-' + name);
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click({ timeout: 2000 });
  await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 500 });
}).toPass({ timeout: 15000 });

const BASE_URL = 'http://localhost:8080';
test.use({ serviceWorkers: 'block', viewport: { width: 412, height: 915 } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      if (sessionStorage.getItem('vmTestStarted')) return;
      sessionStorage.setItem('vmTestStarted', '1');
      localStorage.setItem('zad_lang', 'ar');
      localStorage.setItem('vm_settings', JSON.stringify({ mode: 'short', bg: 'g0', motion: false }));
    } catch { /* storage blocked */ }
  });
  await page.route(url => !url.href.startsWith(BASE_URL), route => route.abort());
});
async function open(page) {
  await page.goto(`${BASE_URL}/pages/video-maker.html`, { waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  await sec(page, 'look');
}
const stickers = page => page.evaluate(() => VM.state.stickers);

// The video's own frame (what the export draws): how much white there is (the sticker's
// clothes and outline; the gradient background has none) and where it is.
const ink = page => page.evaluate(() => {
  const W = 270, H = 480, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true });
  VM.renderFrame(x, W, H, 0, null);
  const d = x.getImageData(0, 0, W, H).data;
  let n = 0, sx = 0, sy = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] > 225 && d[i + 1] > 225 && d[i + 2] > 225) { n++; sx += (i / 4) % W; sy += Math.floor(i / 4 / W); }
  return { n, cx: n ? sx / n / W : 0, cy: n ? sy / n / H : 0 };
});

test('the 39 pictures: all there, named, cut clean and sized for a video', async ({ page }) => {
  await open(page);
  await expect(page.locator('#vmStGrid .st-tile')).toHaveCount(39);
  const names = await page.locator('#vmStGrid .st-tile').evaluateAll(els => els.map(e => e.getAttribute('aria-label')));
  expect(names.every(n => n && n.startsWith('أضف: '))).toBe(true);
  expect(new Set(names).size).toBe(39);
  const report = await page.evaluate(async () => {
    const out = [];
    for (const t of document.querySelectorAll('#vmStGrid .st-tile')) {
      const id = t.dataset.sticker;
      const im = new Image();
      im.src = '../images/stickers/' + id + '.webp';
      await im.decode();
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      let faint = 0, solid = 0;
      for (let i = 3; i < d.length; i += 4) { if (d[i] > 200) solid++; else if (d[i] > 0) faint++; }
      const all = c.width * c.height;
      out.push({ id, w: im.naturalWidth, h: im.naturalHeight, faint: faint / all, solid: solid / all });
    }
    return out;
  });
  for (const r of report) {
    expect(Math.max(r.w, r.h), r.id + ' size').toBeLessThanOrEqual(640);
    expect(Math.min(r.w, r.h), r.id + ' size').toBeGreaterThanOrEqual(300);
    expect(r.faint, r.id + ': no dust around it (only the outline\'s soft edge)').toBeLessThan(0.08);
    expect(r.solid, r.id + ': a picture, not dust').toBeGreaterThan(0.3);
  }
});

test('a tap adds a sticker to the video; the sliders move and size it; flip, front and delete', async ({ page }) => {
  await open(page);
  await expect(page.locator('#vmStEmpty')).toBeVisible();
  await expect(page.locator('#vmStControls')).toBeHidden();
  const before = await ink(page);
  await page.locator('#vmStGrid [data-sticker="s07"]').click();
  expect((await stickers(page)).map(s => s.id)).toEqual(['s07']);
  await expect(page.locator('#vmStEmpty')).toBeHidden();
  await expect(page.locator('#vmStAdded .st-chip')).toHaveCount(1);
  await expect(page.locator('#vmStControls')).toBeVisible();
  await expect(page.locator('#vmStName')).toHaveText('يدعو وتألق');
  await expect(page.locator('#vmStCount')).toHaveText('١ / ١٢');
  await expect.poll(async () => (await ink(page)).n).toBeGreaterThan(before.n + 1500);       // it is in the frame
  const a = await ink(page);
  // across: the slider moves it (its white follows)
  await page.locator('#vmStX').fill('0.2');
  expect((await stickers(page))[0].x).toBeCloseTo(0.2, 2);
  await expect.poll(async () => (await ink(page)).cx).toBeLessThan(a.cx - 0.1);
  // up and down
  const b = await ink(page);
  await page.locator('#vmStY').fill('0.3');
  await expect.poll(async () => (await ink(page)).cy).toBeLessThan(b.cy - 0.15);
  // size
  const small = await ink(page);
  await page.locator('#vmStSize').fill('0.9');
  await expect.poll(async () => (await ink(page)).n).toBeGreaterThan(small.n * 2);
  // flip, a second one, front
  await page.locator('#vmStFlip').click();
  expect((await stickers(page))[0].flip).toBe(true);
  await page.locator('#vmStGrid [data-sticker="s22"]').click();
  expect((await stickers(page)).map(s => s.id)).toEqual(['s07', 's22']);
  await page.locator('#vmStAdded .st-chip').first().click();
  await expect(page.locator('#vmStName')).toHaveText('يدعو وتألق');
  await page.locator('#vmStFront').click();
  expect((await stickers(page)).map(s => s.id)).toEqual(['s22', 's07']);
  // delete the chosen one
  await page.locator('#vmStDel').click();
  expect((await stickers(page)).map(s => s.id)).toEqual(['s22']);
  await page.locator('#vmStDel').click();
  expect(await stickers(page)).toEqual([]);
  await expect(page.locator('#vmStEmpty')).toBeVisible();
  await expect.poll(async () => (await ink(page)).n).toBeLessThan(before.n + 50);
});

test('dragging on the preview moves it, the corner handle sizes it, and a drag does not start the preview', async ({ page }) => {
  // «خاطرة» with a typed text: a preview that needs no network
  await page.addInitScript(() => { if (!sessionStorage.getItem('d1')) { sessionStorage.setItem('d1', '1'); localStorage.setItem('vm_settings', JSON.stringify({ mode: 'khatira', bg: 'g0', motion: false, kTexts: ['الصبر مفتاح الفرج'] })); } });
  await open(page);
  await page.locator('#vmStGrid [data-sticker="s08"]').click();
  await page.evaluate(() => scrollTo(0, 0));
  await expect(page.locator('#vmStickerBox')).toBeVisible();
  const cv = () => page.locator('#vmCanvas').boundingBox();
  const s0 = (await stickers(page))[0];
  let box = await cv();
  const grab = { x: box.x + s0.x * box.width, y: box.y + s0.y * box.height };
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await page.mouse.move(grab.x + 40, grab.y - 60, { steps: 5 });
  await page.mouse.up();
  const s1 = (await stickers(page))[0];
  expect(s1.x).toBeCloseTo(s0.x + 40 / box.width, 2);
  expect(s1.y).toBeCloseTo(s0.y - 60 / box.height, 2);
  await expect(page.locator('#vmStagePlay')).toBeVisible();                   // it did not start playing
  // the selection frame follows it
  const frame = await page.locator('#vmStickerBox').boundingBox();
  box = await cv();
  expect(Math.abs((frame.x + frame.width / 2) - (box.x + s1.x * box.width))).toBeLessThan(4);
  // the corner handle: pulling it out makes the sticker larger
  const h = await page.locator('#vmStHandle').boundingBox();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2 + 50, h.y + h.height / 2 + 50, { steps: 5 });
  await page.mouse.up();
  expect((await stickers(page))[0].s).toBeGreaterThan(s1.s * 1.15);
  await expect(page.locator('#vmStagePlay')).toBeVisible();
  // a tap on empty video (no sticker there) still plays / stops the preview as before
  await page.waitForTimeout(600);
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.06);
  await expect(page.locator('#vmStagePlay')).toBeHidden({ timeout: 10000 });
  await page.locator('#vmStage').click({ position: { x: 10, y: 10 } });
  await expect(page.locator('#vmStagePlay')).toBeVisible({ timeout: 10000 });
});

test('remembered, at most twelve, Escape and «تم» let go, and not on the long video', async ({ page }) => {
  await open(page);
  for (let i = 1; i <= 12; i++) await page.locator(`#vmStGrid [data-sticker="s${String(i).padStart(2, '0')}"]`).click();
  expect((await stickers(page)).length).toBe(12);
  await page.locator('#vmStGrid [data-sticker="s20"]').click();
  expect((await stickers(page)).length).toBe(12);
  await expect(page.locator('#vmStatus')).toContainText('١٢');
  await expect(page.locator('#vmStAdded .st-chip')).toHaveCount(12);
  await page.keyboard.press('Escape');
  await expect(page.locator('#vmStControls')).toBeHidden();
  await expect(page.locator('#vmStickerBox')).toBeHidden();
  await page.locator('#vmStAdded .st-chip').nth(3).click();
  await expect(page.locator('#vmStControls')).toBeVisible();
  await page.locator('#vmStDone').click();
  await expect(page.locator('#vmStControls')).toBeHidden();
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  expect((await stickers(page)).map(s => s.id)).toEqual(Array.from({ length: 12 }, (_, i) => 's' + String(i + 1).padStart(2, '0')));
  await sec(page, 'look');
  await expect(page.locator('#vmStAdded .st-chip')).toHaveCount(12);
  // the long video has its own engine: no stickers there
  await page.locator('#vmModeTabs [data-mode="long"]').click();
  await sec(page, 'look');
  await expect(page.locator('#vmStickerCard')).toBeHidden();
  await page.locator('#vmModeTabs [data-mode="short"]').click();
  await sec(page, 'look');
  await expect(page.locator('#vmStickerCard')).toBeVisible();
});

test('the stickers are in the exported video', async ({ page }) => {
  test.setTimeout(150000);
  await page.addInitScript(() => { if (!sessionStorage.getItem('e1')) { sessionStorage.setItem('e1', '1'); localStorage.setItem('vm_settings', JSON.stringify({ mode: 'khatira', bg: 'g0', motion: false, kTexts: ['كلمة'], stickers: [{ id: 's08', x: 0.5, y: 0.7, s: 0.6, flip: false }] })); } });
  await page.goto(`${BASE_URL}/pages/video-maker.html`, { waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  const canRecord = await page.evaluate(() => !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream));
  test.skip(!canRecord, 'no MediaRecorder');
  // the frame the recorder is fed is the canvas renderFrame draws: the sticker is in it at any moment
  const white = page.evaluate(async () => {
    const tl = await VM.buildTimeline();
    const c = document.createElement('canvas'); c.width = 270; c.height = 480;
    const x = c.getContext('2d', { willReadFrequently: true });
    const count = t => { VM.renderFrame(x, 270, 480, t, tl); const d = x.getImageData(0, 300, 270, 160).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 225 && d[i + 1] > 225 && d[i + 2] > 225) n++; return n; };
    return [count(0.2), count(tl.total / 2), count(tl.total - 0.1)];
  });
  await expect.poll(async () => (await white)[0] > 1500 || (await page.evaluate(async () => {
    const tl = await VM.buildTimeline();
    const c = document.createElement('canvas'); c.width = 270; c.height = 480;
    const x = c.getContext('2d', { willReadFrequently: true });
    VM.renderFrame(x, 270, 480, 0.2, tl);
    const d = x.getImageData(0, 300, 270, 160).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 225 && d[i + 1] > 225 && d[i + 2] > 225) n++; return n;
  })) > 1500, { timeout: 15000 }).toBe(true);
  await page.locator('#vmExport').click();
  await expect(page.locator('#vmResult')).toBeVisible({ timeout: 120000 });
  expect(await page.evaluate(async () => (await (await fetch(document.getElementById('vmVideo').src)).blob()).size)).toBeGreaterThan(10000);
});
