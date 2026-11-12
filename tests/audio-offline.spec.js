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
