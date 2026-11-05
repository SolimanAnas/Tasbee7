// «ثبات» (pages/thabat.html): journeys are private, local, and a slip never wipes the record.
const { test, expect } = require('@playwright/test');

const URL = 'http://localhost:8080/pages/thabat.html';
const DAY = 864e5;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('zad_lang', 'ar'); } catch (e) {} });
});

test('new journey is saved locally and shown on the list', async ({ page }) => {
  await page.goto(URL);
  await page.evaluate(() => localStorage.removeItem('thabat_v1'));
  await page.reload();
  await expect(page.locator('#journeys .empty')).toBeVisible();
  await page.locator('.hero .btn.primary').click();
  await page.fill('#fName', 'رحلة اختبار');
  await page.fill('#fWhy', 'سبب خاص');
  await page.locator('#fSave').click();
  await expect(page.locator('.j-card .j-name')).toHaveText('رحلة اختبار');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('thabat_v1')));
  expect(saved.journeys).toHaveLength(1);
  expect(saved.journeys[0].why).toBe('سبب خاص');
  expect(saved.journeys[0].streaks).toHaveLength(1);
});

test('renewing resolve keeps past days in the record', async ({ page }) => {
  await page.goto(URL);
  await page.evaluate(D => {
    localStorage.setItem('thabat_v1', JSON.stringify({ journeys: [
      { id: 'jt', name: 'ر', why: '', kind: 'quit', cover: 1, created: Date.now() - 20 * D,
        streaks: [{ start: Date.now() - 20 * D, seen: [1, 3, 7, 14] }] }], settings: {} }));
  }, DAY);
  await page.reload();
  await page.locator('.j-card').click();
  await expect(page.locator('#view')).toHaveClass(/open/);
  await page.evaluate(() => openRenew());
  await page.fill('#rNote', 'ملاحظة');
  await page.locator('#renewSheet .btn.primary').click();
  const j = await page.evaluate(() => JSON.parse(localStorage.getItem('thabat_v1')).journeys[0]);
  expect(j.streaks).toHaveLength(2);
  expect(j.streaks[0].end).toBeTruthy();
  expect(j.streaks[0].note).toBe('ملاحظة');
  // total days still counts the 20 days before the slip
  await expect(page.locator('.grid3 .mini b').first()).toHaveText('20');
  await expect(page.locator('.hist .h')).toHaveCount(1);
});

test('back-dated journey does not replay old milestones', async ({ page }) => {
  await page.goto(URL);
  await page.evaluate(() => localStorage.removeItem('thabat_v1'));
  await page.reload();
  await page.evaluate(() => openForm());
  await page.fill('#fName', 'قديمة');
  await page.evaluate(() => { document.getElementById('fStart').value = '2020-01-01T10:00'; });
  await page.locator('#fSave').click();
  await page.waitForTimeout(400);
  await expect(page.locator('#mileModal')).not.toHaveClass(/open/);
});

test('PIN lock hides the page until the right code', async ({ page }) => {
  await page.goto(URL);
  await page.evaluate(() => localStorage.removeItem('thabat_v1'));
  await page.reload();
  await page.evaluate(() => togglePin());
  await expect(page.locator('body')).toHaveClass(/locked/);
  const tap = async code => { for (const d of code) await page.locator(`#keypad button[data-k="${d}"]`).click(); };
  await tap('1234'); await tap('1234');
  await expect(page.locator('body')).not.toHaveClass(/locked/);
  await page.reload();
  await expect(page.locator('body')).toHaveClass(/locked/);
  await tap('0000');
  await expect(page.locator('body')).toHaveClass(/locked/);
  await tap('1234');
  await expect(page.locator('body')).not.toHaveClass(/locked/);
});

test('a long journey name never makes the page wider than the phone', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 340, height: 740 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const n = Date.now();
    localStorage.setItem('thabat_v1', JSON.stringify({ journeys: [{ id: 'jl', name: 'المداومة على الصلاة في جماعة في المسجد كل يوم بإذن الله',
      why: '', kind: 'keep', cover: 2, created: n, streaks: [{ start: n - 6e4, seen: [] }] }], settings: {} }));
  });
  await page.goto(URL);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(340);
  // a journey a minute old counts minutes, not "0 days"
  await expect(page.locator('.j-days span')).toHaveText('دقيقة');
  await page.locator('.j-card').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(340);
  await ctx.close();
});
