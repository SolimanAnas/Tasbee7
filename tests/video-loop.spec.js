// Background videos loop forward then backward (0 s -> 10 s -> 0 s -> ...), with no cut, when
// the «loop forward and back» setting is on (it is off by default: the plain loop).
//   - the built-in clips ship as <name>.pp.mp4 (scripts/gen-pingpong.cjs): the page plays them,
//     and falls back to the original if one is missing;
//   - a video the user adds gets its forward-and-back clip made in the browser (js/video-pingpong.js).
const { test, expect } = require('@playwright/test');
const path = require('path');

const BASE_URL = 'http://localhost:8080';
const BG = path.join(__dirname, '..', 'images', 'video-maker');
test.use({ serviceWorkers: 'block', viewport: { width: 412, height: 900 } });

function wav(seconds, rate = 8000) {
  const n = Math.round(seconds * rate), buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  return buf;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      if (sessionStorage.getItem('vmTestStarted')) return;
      sessionStorage.setItem('vmTestStarted', '1');
      localStorage.setItem('zad_lang', 'ar');
      localStorage.removeItem('vm_settings');
      if (!/default/.test(document.title + location.hash)) localStorage.setItem('vm_settings', JSON.stringify({ pingPong: true }));
      indexedDB.deleteDatabase('vm-user-backgrounds');
      indexedDB.deleteDatabase('vm-pingpong');
    } catch { /* storage blocked */ }
  });
  await page.route(url => !url.href.startsWith(BASE_URL) && !/everyayah\.com/.test(url.href), route => route.abort());
  await page.route(/everyayah\.com\/data\/.+\.mp3$/, route => route.fulfill({ status: 200, headers: { 'Content-Type': 'audio/wav', 'Access-Control-Allow-Origin': '*' }, body: wav(1.5) }));
});

async function open(page) {
  await page.goto(`${BASE_URL}/pages/video-maker.html`, { waitUntil: 'load' });
  await expect(page.locator('#vmBgs .bg-add')).toBeVisible({ timeout: 20000 });
}
const ready = page => page.waitForFunction(() => VM.bgVideo && VM.bgVideo.readyState >= 3 && VM.bgVideo.duration > 19.5, null, { timeout: 30000 })
  .then(() => page.waitForTimeout(400));
async function openSettings(page) {
  await page.locator('#vmSettingsBtn').click();
  await expect(page.locator('#vmSettingsSheet')).toHaveClass(/active/);
  await page.waitForTimeout(450);                                    // the sheet slides in
}
const duration = page => page.evaluate(() => VM.bgVideo && VM.bgVideo.readyState >= 1 ? VM.bgVideo.duration : 0);

// Mean absolute difference between the picture at two times of the background video (0..255).
async function frameDiff(page, t1, t2) {
  return page.evaluate(async ([a, b]) => {
    const v = VM.bgVideo;
    const cv = document.createElement('canvas'); cv.width = 160; cv.height = 90;
    const c = cv.getContext('2d', { willReadFrequently: true });
    // the picture at time t: wait until the player has presented that frame (a draw right after
    // a seek can still show the one before it)
    const grab = t => new Promise(res => {
      v.pause();
      const draw = () => { c.drawImage(v, 0, 0, 160, 90); res(c.getImageData(0, 0, 160, 90).data); };
      const timer = setTimeout(draw, 4000);
      const onFrame = (now, meta) => {
        if (Math.abs(meta.mediaTime - t) < 0.5 / 24 + 0.002) { clearTimeout(timer); draw(); }
        else v.requestVideoFrameCallback(onFrame);
      };
      v.requestVideoFrameCallback(onFrame);
      v.currentTime = t;
    });
    const A = await grab(a), B = await grab(b);
    let s = 0;
    for (let i = 0; i < A.length; i += 4) s += Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
    return s / (A.length / 4) / 3;
  }, [t1, t2]);
}

test('the setting is off by default: the original loops; switching it on plays the forward-and-back clip', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/video-maker.html#default`, { waitUntil: 'load' });
  await expect(page.locator('#vmBgs .bg-add')).toBeVisible({ timeout: 20000 });
  // the setting sits in the settings sheet (header)
  await page.locator('#vmSettingsBtn').click();
  await expect(page.locator('#vmSettingsSheet')).toHaveClass(/active/);
  await expect(page.locator('#vmPingPong')).not.toBeChecked();
  await page.keyboard.press('Escape');
  await page.locator('#vmBgs [data-bg="v:v4.mp4"]').click();
  await expect.poll(() => page.evaluate(() => VM.bgVideo && VM.bgVideo.src)).toMatch(/\/v4\.mp4$/);
  await expect.poll(() => duration(page), { timeout: 20000 }).toBeGreaterThan(9);
  expect(await duration(page)).toBeLessThan(11);
  await openSettings(page);
  await page.locator('#vmPingPong').check({ force: true });
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => VM.bgVideo && VM.bgVideo.src)).toMatch(/v4\.pp\.mp4$/);
  await expect.poll(() => duration(page), { timeout: 20000 }).toBeGreaterThan(19.5);
  expect(await page.evaluate(() => VM.state.pingPong)).toBe(true);
  // and off again
  await openSettings(page);
  await page.locator('#vmPingPong').uncheck({ force: true });
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => VM.bgVideo && VM.bgVideo.src)).toMatch(/\/v4\.mp4$/);
  // an added video makes no clip while it is off
  await page.setInputFiles('#vmBgFile', path.join(BG, 'v4.mp4'));
  await expect.poll(() => page.evaluate(() => VM.state.bg), { timeout: 30000 }).toMatch(/^v:user:.+\.mp4$/);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => VM.loopJob && VM.loopJob.id === VM.state.bg)).toBeFalsy();
});

test('a built-in video plays its forward-and-back clip', async ({ page }) => {
  await open(page);
  await page.locator('#vmBgs [data-bg="v:v4.mp4"]').click();
  await expect.poll(() => page.evaluate(() => VM.bgVideo && VM.bgVideo.src)).toMatch(/v4\.pp\.mp4$/);
  await expect.poll(() => duration(page), { timeout: 20000 }).toBeGreaterThan(19.5);
  expect(await duration(page)).toBeLessThan(20.5);              // 10 s forward + 10 s back, the two turning frames not repeated
  expect(await page.evaluate(() => VM.bgVideo.loop)).toBe(true);
});

test('the picture really runs forward then backward: the clip is a mirror of itself', async ({ page }) => {
  await open(page);
  await page.locator('#vmBgs [data-bg="v:v4.mp4"]').click();
  await ready(page);
  const T = await duration(page);
  // frame p and frame (total - p) show the same picture; frames far apart do not
  // (polled: a frame grabbed while the player is still settling is not the one asked for)
  await expect.poll(() => frameDiff(page, 100.5 / 24, T - 99.5 / 24), { timeout: 20000 }).toBeLessThan(4);
  const same = await frameDiff(page, 100.5 / 24, T - 99.5 / 24);
  const apart = await frameDiff(page, 100.5 / 24, 140.5 / 24);
  expect(apart).toBeGreaterThan(same * 2 + 5);
  // the loop point: the last picture is the one after the first (not a jump back to it)
  const step = await frameDiff(page, 100.5 / 24, 101.5 / 24);
  await expect.poll(() => frameDiff(page, T - 0.5 / 24, 0.5 / 24), { timeout: 20000 }).toBeLessThan(step * 3 + 3);
});

test('without the shipped clip the original still loops', async ({ page }) => {
  await page.route(/\.pp\.mp4$/, route => route.fulfill({ status: 404, body: '' }));
  await open(page);
  await page.locator('#vmBgs [data-bg="v:v3.mp4"]').click();
  await expect.poll(() => page.evaluate(() => VM.bgVideo && VM.bgVideo.src)).toMatch(/v3\.mp4$/);
  await expect.poll(() => duration(page), { timeout: 20000 }).toBeGreaterThan(9);
  expect(await duration(page)).toBeLessThan(11);
  expect(await page.evaluate(() => VM.bgVideo.loop)).toBe(true);
});

test("a video the user adds is made into a forward-and-back loop, once", async ({ page }) => {
  test.setTimeout(120000);
  await open(page);
  const can = await page.evaluate(() => PingPong.supported());
  test.skip(!can, 'no WebCodecs in this browser');
  await page.setInputFiles('#vmBgFile', path.join(BG, 'v4.mp4'));
  await expect.poll(() => page.evaluate(() => VM.state.bg), { timeout: 30000 }).toMatch(/^v:user:.+\.mp4$/);
  // it is made in the background (the original keeps looping meanwhile) …
  await expect.poll(() => page.evaluate(() => !!(VM.loopJob && VM.loopJob.done)), { timeout: 90000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => VM.bgVideo.src.startsWith('blob:') ? VM.bgVideo.duration : 0), { timeout: 20000 }).toBeGreaterThan(19.5);
  expect(await duration(page)).toBeLessThan(20.5);
  // … and runs forward then backward
  await page.waitForTimeout(400);
  const T = await duration(page);
  await expect.poll(() => frameDiff(page, 100.5 / 24, T - 99.5 / 24), { timeout: 20000 }).toBeLessThan(6);
  const same = await frameDiff(page, 100.5 / 24, T - 99.5 / 24);
  const apart = await frameDiff(page, 100.5 / 24, 140.5 / 24);
  expect(apart).toBeGreaterThan(same * 1.5 + 5);
  // the second time it comes from the cache: no second build
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('#vmBgs .bg-add')).toBeVisible({ timeout: 20000 });
  await expect.poll(() => page.evaluate(() => VM.bgVideo && VM.bgVideo.src.startsWith('blob:') ? VM.bgVideo.duration : 0), { timeout: 20000 }).toBeGreaterThan(19.5);
});

test('creating a video waits for the loop to be ready, then records it', async ({ page }) => {
  test.setTimeout(150000);
  await open(page);
  const can = await page.evaluate(() => PingPong.supported());
  test.skip(!can || !(await page.evaluate(() => !!window.MediaRecorder)), 'needs WebCodecs and MediaRecorder');
  await page.fill('#vmTo', '2');
  await page.locator('#vmTo').dispatchEvent('change');
  await page.setInputFiles('#vmBgFile', path.join(BG, 'v4.mp4'));
  await expect.poll(() => page.evaluate(() => VM.state.bg), { timeout: 30000 }).toMatch(/^v:user:.+\.mp4$/);
  await page.locator('#vmExport').click();                          // straight away: the loop is still being made
  await expect(page.locator('#vmResult')).toBeVisible({ timeout: 120000 });
  expect(await page.evaluate(() => VM.loopJob.done)).toBe(true);
  expect(await page.evaluate(() => VM.bgVideo.src.startsWith('blob:') && VM.bgVideo.duration > 19.5)).toBe(true);
});
