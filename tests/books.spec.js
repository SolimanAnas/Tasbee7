// «تحميل كتب PDF» (pages/books.html): the «رسالة الحرمين» library — list, search, save for
// offline reading, the device file, delete — and its row in the home download center.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8080';
const LIB = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'books', 'risala.json'), 'utf8'));
test.use({ serviceWorkers: 'block', acceptDownloads: true });

test.beforeEach(async ({ page, context }) => {
  await context.addInitScript(() => { try { localStorage.setItem('zad_lang', 'ar'); } catch { /* storage blocked */ } });
  await page.route(url => !url.href.startsWith(BASE_URL), route => route.abort());
  // the publisher's PDFs: a small stand-in with CORS, as risala.prh.gov.sa sends it
  await page.route(/risala\.prh\.gov\.sa\/storage\/contents\/.+\.pdf$/, route => route.fulfill({
    status: 200, headers: { 'Content-Type': 'application/pdf', 'Access-Control-Allow-Origin': '*' }, body: '%PDF-1.4\n% test\n%%EOF\n',
  }));
});

test('the library: every book with its author, pages and size, in its category', async ({ page }) => {
  expect(LIB.books.length).toBeGreaterThanOrEqual(19);
  for (const b of LIB.books) {
    expect(b.title && b.author && b.desc && b.pages > 0 && b.size > 0).toBeTruthy();
    expect(b.pdf).toMatch(/^https:\/\/risala\.prh\.gov\.sa\/storage\/contents\/\d+\/.+\.pdf$/i);
    expect(fs.existsSync(path.join(__dirname, '..', b.cover))).toBe(true);
  }
  // the owner asked for these two to stay in the list
  expect(LIB.books.map(b => b.title)).toEqual(expect.arrayContaining(['حصن المسلم من أذكار الكتاب والسنة', 'الدعاء من الكتاب والسنة']));
  await page.goto(`${BASE_URL}/pages/books.html`, { waitUntil: 'load' });
  await expect(page.locator('.bk')).toHaveCount(LIB.books.length);
  await expect(page.locator('.bk-cat')).toHaveCount(LIB.cats.length);
  await expect(page.locator('#risala-106 .bk-author')).toContainText('بن باز');
  // search ignores the vowel marks
  await page.fill('#bkSearch', 'العثيمين');
  await expect(page.locator('.bk')).toHaveCount(LIB.books.filter(b => b.author.includes('العثيمين')).length);
  await page.fill('#bkSearch', '');
  await page.click('#bkChips [data-cat="hajj"]');
  await expect(page.locator('.bk')).toHaveCount(LIB.books.filter(b => b.cat === 'hajj').length);
});

test('download: kept on the device, handed to the downloads, listed, deleted', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/books.html`, { waitUntil: 'load' });
  const card = page.locator('#risala-106');
  const dl = page.waitForEvent('download');
  await card.locator('[data-act="save"]').click();
  expect((await dl).suggestedFilename()).toMatch(/\.pdf$/);
  await expect(card.locator('[data-act="del"]')).toBeVisible();
  await expect(page.locator('#stSaved')).toHaveText('1');
  const keys = await page.evaluate(async () => (await (await caches.open('quran-offline-books-v1')).keys()).map(r => r.url));
  expect(keys).toEqual([LIB.books.find(b => b.id === 'risala-106').pdf]);
  // offline, the saved book still opens (from the device)
  await page.context().setOffline(true);
  await page.evaluate(() => { window.__opened = []; window.open = u => { window.__opened.push(String(u)); return {}; }; });
  await card.locator('[data-act="read"]').first().click();
  await expect.poll(() => page.evaluate(() => window.__opened)).toEqual([expect.stringMatching(/^blob:/)]);
  await page.context().setOffline(false);
  await page.click('#bkChips [data-cat="saved"]');
  await expect(page.locator('.bk')).toHaveCount(1);
  // the download center counts it
  await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'load' });
  await page.evaluate(() => openDownloadsSheet());
  await expect(page.locator('#dlBooksDesc')).toContainText('1');
  await expect(page.locator('#dlBooks')).toHaveAttribute('onclick', /pages\/books\.html/);
  // delete
  await page.goto(`${BASE_URL}/pages/books.html`, { waitUntil: 'load' });
  page.once('dialog', d => d.accept());
  await page.locator('#risala-106 [data-act="del"]').click();
  await expect(page.locator('#risala-106 [data-act="save"]')).toBeVisible();
  await expect(page.locator('#stSaved')).toHaveText('0');
});

test('a reply that is not a PDF is never kept', async ({ page }) => {
  await page.route(/risala\.prh\.gov\.sa\/storage\/contents\/.+\.pdf$/, route => route.fulfill({ status: 200, headers: { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' }, body: '<html>error</html>' }));
  await page.goto(`${BASE_URL}/pages/books.html`, { waitUntil: 'load' });
  await page.locator('#risala-63 [data-act="save"]').click();
  await expect(page.locator('#toast')).toHaveClass(/show/);
  await expect(page.locator('#risala-63 [data-act="save"]')).toBeVisible();
  expect(await page.evaluate(async () => (await (await caches.open('quran-offline-books-v1')).keys()).length)).toBe(0);
});
