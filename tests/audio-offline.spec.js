// «تحميل المصحف كاملاً» on the audio page: a whole recitation saved for
// offline listening. Audio hosts are mocked with a small local mp3.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8080';
const MP3 = fs.readFileSync(path.join(__dirname, '..', 'assets', 'media', 'sleep-zikr', 'ar_99.mp3'));
const RECITERS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'json', 'audio-02.json'), 'utf8')).reciters;
const SMALL = RECITERS.find(r => r.id === 'abu-al-ainin-shisha');   // 5 tracks

async function mockAudioHosts(ctx, { fail = () => false } = {}) {
  await ctx.route(url => !url.href.startsWith(BASE_URL), async route => {
    const req = route.request();
    if (!/\.mp3(\?|$)/.test(req.url())) return route.abort();
    if (fail(req.url())) return route.fulfill({ status: 503, body: '' });
    const headers = { 'Content-Type': 'audio/mpeg', 'Content-Length': String(MP3.length), 'Access-Control-Allow-Origin': '*', 'Accept-Ranges': 'bytes' };
    if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers, body: '' });
    return route.fulfill({ status: 200, headers, body: MP3 });
  });
}

async function openOnReciter(page, reciter) {
  await page.addInitScript(url => {
    try { localStorage.setItem('zad_lang', 'ar'); localStorage.setItem('lastTrack', url); } catch (e) {}
  }, reciter.items[0].url);
  await page.goto(`${BASE_URL}/pages/audio.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.AudioOffline && AudioOffline.ready);
}

const cachedCount = page => page.evaluate(async () => (await (await caches.open('quran-audio-offline-v1')).keys()).length);

test.describe('full mushaf download', () => {
  test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });

  test('downloads every track of the reciter, marks it saved, and deletes it', async ({ page, context }) => {
    await mockAudioHosts(context);
    await openOnReciter(page, SMALL);
    await page.evaluate(() => caches.delete('quran-audio-offline-v1'));

    await page.evaluate(() => AudioOffline.openSheet());
    const card = page.locator('#offlineBody .offl-card');
    await expect(card).toContainText('5 سورة');
    await expect(card).toContainText('نحو');            // size estimate arrived
    await page.click('#offlineBody [data-act="start"]');

    await expect(card).toContainText('محفوظ للاستماع دون اتصال', { timeout: 20000 });
    expect(await cachedCount(page)).toBe(5);
    await expect(page.locator('#offlineRowSub')).toContainText('محفوظ');
    await expect(page.locator('#offlineBody .offl-row')).toHaveCount(1);

    // the surah list marks saved tracks
    await page.evaluate(() => openJuzSheet());
    await expect(page.locator('#selectionList .sel-sub').first()).toContainText('محفوظ');

    page.once('dialog', d => d.accept());
    await page.evaluate(() => AudioOffline.openSheet());
    await page.click('#offlineBody .offl-actions [data-act="delete"]');
    await expect.poll(() => cachedCount(page)).toBe(0);
    await expect(page.locator('#offlineBody .offl-row')).toHaveCount(0);
  });

  test('a saved recitation opens from the saved list, is marked and listed first among reciters', async ({ page, context }) => {
    await mockAudioHosts(context);
    await openOnReciter(page, SMALL);
    await page.evaluate(() => caches.delete('quran-audio-offline-v1'));
    await page.evaluate(() => AudioOffline.openSheet());
    await page.click('#offlineBody [data-act="start"]');
    await expect(page.locator('#offlineBody .offl-card')).toContainText('محفوظ للاستماع دون اتصال', { timeout: 20000 });

    // the player moves to another reciter…
    const smallIndex = await page.evaluate(id => appData.reciters.findIndex(r => r.id === id), SMALL.id);
    await page.evaluate(i => { selectReciter(i === 0 ? 1 : 0); prepareTrack(false, false); }, smallIndex);

    // …tapping the saved recitation brings it back and shows its tracks
    await page.evaluate(() => AudioOffline.openSheet());
    await page.click('#offlineBody .offl-row-main');
    await expect(page.locator('#selectionSheet')).toHaveClass(/active/);
    await expect(page.locator('#selectionSheetTitle')).toContainText('السورة');
    expect(await page.evaluate(() => selectedReciterIndex)).toBe(smallIndex);
    await expect(page.locator('#selectionList .selection-item')).toHaveCount(SMALL.items.length);
    expect(await page.evaluate(() => audio.paused)).toBe(true);   // loaded, not started

    // the reciter list puts it first, with the saved mark
    await page.evaluate(() => openReciterSheet());
    const first = page.locator('#selectionList .selection-item').first();
    await expect(first.locator('.sel-saved')).toHaveCount(1);
    await expect(first.locator('.sel-saved')).toHaveAttribute('aria-label', 'محفوظ');
    await expect(page.locator('#selectionList .sel-saved')).toHaveCount(1);
  });

  test('a failed file is reported and "resume" fetches only what is missing', async ({ page, context }) => {
    let failing = true;
    await mockAudioHosts(context, { fail: url => failing && /\/095\.mp3/.test(url) });
    await openOnReciter(page, SMALL);
    await page.evaluate(() => caches.delete('quran-audio-offline-v1'));
    await page.evaluate(() => AudioOffline.openSheet());
    await page.click('#offlineBody [data-act="start"]');
    const card = page.locator('#offlineBody .offl-card');
    await expect(card).toContainText('تعذّر تحميل 1', { timeout: 20000 });
    expect(await cachedCount(page)).toBe(4);

    failing = false;
    await page.click('#offlineBody [data-act="start"]');   // «متابعة التحميل»
    await expect(card).toContainText('محفوظ للاستماع دون اتصال', { timeout: 20000 });
    expect(await cachedCount(page)).toBe(5);
  });

  test('warns before using mobile data', async ({ page, context }) => {
    await mockAudioHosts(context);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'connection', { value: { type: 'cellular' }, configurable: true });
    });
    await openOnReciter(page, SMALL);
    await page.evaluate(() => AudioOffline.openSheet());
    await expect(page.locator('#offlineBody .offl-note.warn')).toContainText('بيانات الجوال');
    await expect(page.locator('#offlineBody [data-act="start"]')).toContainText('بيانات الجوال');
  });

  test('the card under the selectors opens the download and shows its state', async ({ page, context }) => {
    await mockAudioHosts(context);
    await openOnReciter(page, SMALL);
    await page.evaluate(() => caches.delete('quran-audio-offline-v1'));
    const card = page.locator('#offlineCard');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-state', 'idle');
    await expect(card).toContainText('تحميل المصحف كاملاً');
    await card.click();
    await expect(page.locator('#offlineSheet')).toHaveClass(/active/);
    await page.click('#offlineBody [data-act="start"]');
    await expect(card).toHaveAttribute('data-state', 'done', { timeout: 20000 });
    await expect(card).toContainText('محفوظ');
  });

  test('short surahs download first, the longest last; each file has its own bar', async ({ page, context }) => {
    const order = [];
    const tiny = MP3.subarray(0, 4096);
    await context.route(url => !url.href.startsWith(BASE_URL), async route => {
      const req = route.request();
      if (!/\.mp3(\?|$)/.test(req.url())) return route.abort();
      const headers = { 'Content-Type': 'audio/mpeg', 'Content-Length': String(tiny.length), 'Access-Control-Allow-Origin': '*' };
      if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers, body: '' });
      order.push(+(/(\d{3})\.mp3/.exec(req.url()) || [])[1]);
      await new Promise(r => setTimeout(r, 40));
      return route.fulfill({ status: 200, headers, body: tiny });
    });
    const big = RECITERS.find(r => r.id === 'abu-bakr-al-hajjaji');      // a full 114-surah recitation
    await page.addInitScript(url => { try { localStorage.setItem('zad_lang', 'ar'); localStorage.setItem('lastTrack', url); } catch (e) {} }, big.baseUrl + '001.mp3');
    await page.goto(`${BASE_URL}/pages/audio.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.AudioOffline && AudioOffline.ready);
    await page.evaluate(() => caches.delete('quran-audio-offline-v1'));
    await page.evaluate(() => AudioOffline.openSheet());
    await page.click('#offlineBody [data-act="start"]');
    await expect(page.locator('#offlFiles .offl-file').first()).toBeVisible();
    await expect(page.locator('#offlineBody .offl-card')).toContainText('محفوظ للاستماع دون اتصال', { timeout: 60000 });

    expect(order.length).toBeGreaterThan(100);
    // the first files are short surahs (Al-Fatihah is one of them); the
    // longest ones come last, Al-Baqarah among the final few
    const LONG = [2, 3, 4, 5, 6, 7, 9];
    order.slice(0, 15).forEach(n => expect(LONG).not.toContain(n));
    order.slice(0, 15).filter(n => n !== 1).forEach(n => expect(n).toBeGreaterThan(80));
    expect(order.slice(-4)).toEqual(expect.arrayContaining([2]));
  });

  test('the current-track download button is still there', async ({ page, context }) => {
    await mockAudioHosts(context);
    await openOnReciter(page, SMALL);
    await expect(page.locator('#downloadBtn')).toBeVisible();
  });
});

test('a saved surah plays with no connection (served by the service worker)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  let online = true;
  await ctx.route(url => !url.href.startsWith(BASE_URL), async route => {
    if (!online || !/\.mp3(\?|$)/.test(route.request().url())) return route.abort();
    return route.fulfill({ status: 200, headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(MP3.length), 'Access-Control-Allow-Origin': '*' }, body: MP3 });
  });
  const page = await ctx.newPage();
  await openOnReciter(page, SMALL);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'load' });               // now controlled by the service worker
  await page.waitForFunction(() => !!navigator.serviceWorker.controller && window.AudioOffline && AudioOffline.ready);
  await page.evaluate(() => AudioOffline.openSheet());
  await page.click('#offlineBody [data-act="start"]');
  await expect(page.locator('#offlineBody .offl-card')).toContainText('محفوظ للاستماع دون اتصال', { timeout: 20000 });

  online = false;
  const url = SMALL.items[2].url;
  const res = await page.evaluate(async u => {
    const r = await fetch(u, { headers: { Range: 'bytes=100-199' } });
    return { status: r.status, len: (await r.arrayBuffer()).byteLength };
  }, url);
  expect(res).toEqual({ status: 206, len: 100 });
  await ctx.close();
});

test('each surah\'s bar fills as its file arrives', async ({ browser }) => {
  const http = require('http');
  const slow = http.createServer((req, res) => {
    const size = 400000;
    res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': String(size), 'Access-Control-Allow-Origin': '*' });
    if (req.method === 'HEAD') return res.end();
    let sent = 0; const chunk = Buffer.alloc(16384, 0xff);
    const tick = () => { if (sent >= size) return res.end(); const c = chunk.subarray(0, Math.min(chunk.length, size - sent)); sent += c.length; res.write(c); setTimeout(tick, 30); };
    tick();
  });
  await new Promise(r => slow.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${slow.address().port}/r/`;
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  await ctx.route('**/json/audio-01.json', async route => {
    const res = await route.fetch(); const d = await res.json();
    d.reciters.forEach(r => { if (r.id === 'basit_murattal') r.baseUrl = base; });
    route.fulfill({ response: res, json: d });
  });
  await ctx.route(url => !url.href.startsWith(BASE_URL) && !url.href.startsWith(base), r => r.abort());
  await ctx.addInitScript(u => { try { localStorage.setItem('zad_lang', 'ar'); localStorage.setItem('lastTrack', u); } catch (e) {} }, base + '001.mp3');
  const page = await ctx.newPage();
  await page.goto(`${BASE_URL}/pages/audio.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.AudioOffline && AudioOffline.ready);
  await page.evaluate(() => AudioOffline.openSheet());
  await page.click('#offlineBody [data-act="start"]');
  // a bar part-way: neither empty nor full
  await expect.poll(() => page.$$eval('#offlFiles .offl-file-pct', els => els.map(e => parseInt(e.textContent, 10)).some(p => p > 0 && p < 100)), { timeout: 15000 }).toBe(true);
  await page.click('#offlineBody [data-act="pause"]');
  await ctx.close();
  slow.close();
});
