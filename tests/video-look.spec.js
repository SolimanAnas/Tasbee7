// The background's look: no dark tint over it any more, colours by a look and fine adjustments
// («ألوان الفيديو», folding, in «المظهر»), slideshows with videos as well as pictures, and the
// mini preview above the sticky tab bar.
const { test, expect } = require('@playwright/test');
const sec = (page, name) => expect(async () => {
  const tab = page.locator('#vmTab-' + name);
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click({ timeout: 2000 });
  await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 500 });
}).toPass({ timeout: 15000 });

const BASE_URL = 'http://localhost:8080';
test.use({ serviceWorkers: 'block', viewport: { width: 412, height: 915 } });

async function open(page, settings) {
  await page.addInitScript(st => {
    if (sessionStorage.getItem('l')) return;
    sessionStorage.setItem('l', '1');
    localStorage.setItem('zad_lang', 'ar');
    localStorage.setItem('vmMiniMin', '1');
    localStorage.setItem('vm_settings', JSON.stringify(Object.assign({ mode: 'khatira', kContent: 'text', kTexts: ['نص'], bg: 'i:14.webp', motion: false, miniPreview: false, caption: false, branding: false }, st)));
  }, settings || {});
  await page.route(url => !url.href.startsWith(BASE_URL), route => route.abort());
  await page.goto(`${BASE_URL}/pages/video-maker.html`, { waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
}
// a frame of the video, and the picture itself cover-fitted (no camera move): their colours
const frame = (page, grade) => page.evaluate(async grade => {
  await new Promise(r => setTimeout(r, 50));
  if (grade !== undefined) VM.state.grade = grade;
  const W = 108, H = 192, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true });
  VM.renderFrame(x, W, H, 0, null);
  const d = x.getImageData(0, 0, W, H).data;
  const band = (y0, y1, x0 = 0, x1 = W) => { let r = 0, g = 0, b = 0, n = 0; for (let y = y0; y < y1; y++) for (let xx = x0; xx < x1; xx++) { const i = (y * W + xx) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } return [r / n, g / n, b / n]; };
  // the picture alone, the same way
  const img = new Image(); img.src = '../images/video-maker/14.webp'; await img.decode();
  const c2 = document.createElement('canvas'); c2.width = W; c2.height = H;
  const y = c2.getContext('2d', { willReadFrequently: true });
  const k = Math.max(W / img.naturalWidth, H / img.naturalHeight), dw = img.naturalWidth * k, dh = img.naturalHeight * k;
  y.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  const e = y.getImageData(0, 0, W, H).data;
  let rawBottom = 0, n = 0;
  for (let yy = Math.round(H * 0.8); yy < H; yy++) for (let xx = 0; xx < W; xx++) { const i = (yy * W + xx) * 4; rawBottom += (e[i] + e[i + 1] + e[i + 2]) / 3; n++; }
  return { bottom: band(Math.round(H * 0.8), H), mid: band(Math.round(H * 0.55), Math.round(H * 0.7)), corner: band(0, 20, 0, 20), centre: band(86, 106, 44, 64), rawBottom: rawBottom / n };
}, grade);
const lum = ([r, g, b]) => (r + g + b) / 3;

test('no dark tint: the bottom of the picture is the picture', async ({ page }) => {
  await open(page);
  const f = await frame(page, null);
  expect(Math.abs(lum(f.bottom) - f.rawBottom)).toBeLessThan(4);
});

test('«ألوان الفيديو»: a look from thumbnails of this background, adjustments on top, the text untouched; remembered, undoable, from a script', async ({ page }) => {
  await open(page);
  await sec(page, 'look');
  // folded: one line; open: the looks as small pictures of this very background
  await expect(page.locator('#vmGradeBody')).toBeHidden();
  await page.locator('#vmGradeToggle').click();
  await expect(page.locator('#vmGradeLooks [data-look]')).toHaveCount(12);
  await expect.poll(() => page.evaluate(() => { const c = document.querySelector('#vmGradeLooks [data-look="warm"] canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i]; return s / (d.length / 4); })).toBeGreaterThan(20);
  const none = await frame(page, null);
  // black & white: no colour left
  await page.locator('#vmGradeLooks [data-look="bw"]').click();
  await expect(page.locator('#vmGradeNow')).toHaveText('أبيض وأسود');
  const bw = await frame(page);
  expect(Math.abs(bw.mid[0] - bw.mid[2])).toBeLessThan(3);
  // warm: redder against blue than as it was
  await page.locator('#vmGradeLooks [data-look="warm"]').click();
  const warm = await frame(page);
  expect(warm.mid[0] / warm.mid[2]).toBeGreaterThan(none.mid[0] / none.mid[2] * 1.08);
  // the vignette darkens the corners, not the middle
  await page.locator('#vmGradeBody [data-g="vignette"]').fill('1');
  const vig = await frame(page);
  expect(lum(vig.corner)).toBeLessThan(lum(warm.corner) * 0.75);
  expect(Math.abs(lum(vig.centre) - lum(warm.centre))).toBeLessThan(8);
  expect(await page.evaluate(() => VM.state.grade)).toMatchObject({ look: 'warm', vignette: 1 });
  // the text keeps its own colour (white stays white)
  const textWhite = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 540; c.height = 960; const x = c.getContext('2d', { willReadFrequently: true }); VM.state.grade = { look: 'noir', bright: -0.5, contrast: 0, sat: 0, warm: 0.5, fade: 0, vignette: 1 }; VM.renderFrame(x, 540, 960, 0, null); const d = x.getImageData(0, 0, 540, 960).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 245 && d[i + 1] > 245 && d[i + 2] > 245) n++; return n; });
  expect(textWhite).toBeGreaterThan(300);
  await page.evaluate(() => { VM.state.grade = { look: 'warm', bright: 0, contrast: 0, sat: 0, warm: 0, fade: 0, vignette: 1 }; });
  // remembered
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
  expect(await page.evaluate(() => VM.state.grade.look)).toBe('warm');
  await sec(page, 'look');
  await expect(page.locator('#vmGradeBody')).toBeVisible();                   // it stays open as it was left
  // back to the picture's own colours, and undone
  await expect.poll(() => page.evaluate(() => VM.history.started)).toBe(true);
  await page.locator('#vmGradeReset').click();
  expect(await page.evaluate(() => VM.state.grade)).toBe(null);
  await expect(page.locator('#vmGradeNow')).toHaveText('');
  await page.waitForTimeout(450);
  await page.locator('#vmUndo').click();
  expect(await page.evaluate(() => VM.state.grade && VM.state.grade.look)).toBe('warm');
  // a script names a look
  await sec(page, 'ayat');
  page.once('dialog', d => d.accept());
  await page.locator('#vmScFile').setInputFiles({ name: 's.txt', mimeType: 'text/plain', buffer: Buffer.from('@look: cinematic\nسطر') });
  await expect.poll(() => page.evaluate(() => VM.state.grade && VM.state.grade.look)).toBe('cinematic');
});

test('«عدة صور ومقاطع»: videos join the slideshow; each plays while its slide shows', async ({ page }) => {
  await open(page, { mode: 'khatira', kTexts: ['الأول هنا', 'والثاني هنا', 'والثالث هنا', 'والرابع هنا'] });
  await sec(page, 'look');
  await page.locator('#vmMultiBg').check({ force: true });
  await expect(page.locator('#vmMultiBg')).toBeChecked();
  // videos can be picked now (only the gradients sit out)
  await expect(page.locator('#vmBgs .bg-thumb[data-bg="v:v1.mp4"]')).not.toHaveClass(/off-in-multi/);
  await expect(page.locator('#vmBgs .bg-thumb[data-bg^="g"]').first()).toHaveClass(/off-in-multi/);
  await page.locator('#vmBgs .bg-thumb[data-bg="v:v1.mp4"]').click();
  expect(await page.evaluate(() => VM.state.bgs)).toEqual(['i:14.webp', 'v:v1.mp4']);
  await expect(page.locator('#vmBgs .bg-thumb[data-bg="v:v1.mp4"]')).toHaveAttribute('data-order', '2');
  await expect.poll(() => page.evaluate(() => VM.slideVideos.map(v => [v.id, v.ready]))).toEqual([['v:v1.mp4', true]]);
  // play: the video slide's video plays in the second half, not in the first
  await page.evaluate(() => scrollTo(0, 0));
  await page.locator('#vmStagePlay').click();
  await expect(page.locator('#vmStagePlay')).toBeHidden({ timeout: 10000 });
  const total = await page.evaluate(async () => (await VM.buildTimeline()).total);
  await expect.poll(() => page.evaluate(() => VM.slideVideos[0].paused)).toBe(true);   // the picture first
  await page.waitForTimeout(Math.max(0, total / 2 * 1000 + 600 - 400));
  await expect.poll(() => page.evaluate(() => VM.slideVideos[0].paused), { timeout: 4000 }).toBe(false);
  await page.locator('#vmPreview').click();
  await expect(page.locator('#vmStagePlay')).toBeVisible({ timeout: 10000 });
  expect(await page.evaluate(() => VM.slideVideos[0].paused)).toBe(true);
  // taken off: its decoder is given back
  await page.locator('#vmBgs .bg-thumb[data-bg="v:v1.mp4"]').click();
  expect(await page.evaluate(() => VM.slideVideos.length)).toBe(0);
});

test('the mini preview floats over the sticky tab bar', async ({ page }) => {
  await open(page, { miniPreview: true });
  const z = await page.evaluate(() => [+getComputedStyle(document.getElementById('vmMini')).zIndex, +getComputedStyle(document.getElementById('vmSecTabs')).zIndex, +getComputedStyle(document.querySelector('.action-bar')).zIndex]);
  expect(z[0]).toBeGreaterThan(z[1]);
  expect(z[0]).toBeGreaterThan(z[2]);
});
