// «الختمة» (pages/khatma.html): the ثبات wird on its own page, and «إنجازاتي» on the home page.
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8080';
test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await page.route(url => !url.href.startsWith(BASE_URL), route => route.abort());
});

const key = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const wird = (extra = {}) => ({ journeys: [{ id: 'jq', name: 'PRIVATE NAME', why: 'PRIVATE WHY', kind: 'quran', cover: 'mushaf', created: Date.now() - 10 * 864e5,
  streaks: [{ start: Date.now(), seen: [] }], quran: Object.assign({ daily: 4, pos: 50, start: 1, khatmat: 0, log: { [key(1)]: 4, [key(2)]: 5 } }, extra) }], settings: { pin: null } });

test('started here, the khatma is the ثبات wird (with its goal)', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/khatma.html`, { waitUntil: 'load' });
  await expect(page.locator('.kh-setup')).toBeVisible();
  await page.click('#khSetGoal [data-goal="15"]');
  await expect(page.locator('#khSetPlan')).toContainText('41');          // 604 pages in 15 days
  await page.click('[data-act="start"]');
  await expect(page.locator('.kh-today')).toBeVisible();
  const S = await page.evaluate(() => JSON.parse(localStorage.getItem('thabat_v1')));
  const j = S.journeys.find(x => x.kind === 'quran');
  expect(j.quran.pos).toBe(1);
  expect(j.quran.goal.days).toBe(15);
  expect(j.cover).toBe('mushaf');
  // ثبات opens the same wird
  await page.goto(`${BASE_URL}/pages/thabat.html?wird=1`, { waitUntil: 'load' });
  await expect(page.locator('#view')).toHaveClass(/qv/);
  await expect(page.locator('a.q-khatma-page')).toHaveAttribute('href', 'khatma.html');
});

test('the wird: today, record and undo, goal, stats — never the journey\'s name', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/khatma.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(s => localStorage.setItem('thabat_v1', JSON.stringify(s)), wird());
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('.kh-today')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('PRIVATE');
  await expect(page.locator('.kh-ring')).toContainText('8');              // (50-1)/604 ≈ 8%
  await expect(page.locator('.kh-today a.kh-btn')).toHaveAttribute('href', 'quran-text.html?page=50&wird=1');
  await page.click('[data-act="plus"]');                                   // 5 pages
  await page.click('[data-act="mark"]');
  await expect(page.locator('.kh-today')).toHaveClass(/is-done/);
  let Q = await page.evaluate(() => JSON.parse(localStorage.getItem('thabat_v1')).journeys[0].quran);
  expect(Q.pos).toBe(55);
  await page.click('[data-act="undo"]');
  Q = await page.evaluate(() => JSON.parse(localStorage.getItem('thabat_v1')).journeys[0].quran);
  expect(Q.pos).toBe(50);
  // a goal of 30 days
  await page.click('#khGoalChips [data-goal="30"]');
  Q = await page.evaluate(() => JSON.parse(localStorage.getItem('thabat_v1')).journeys[0].quran);
  expect(Q.goal.days).toBe(30);
  await expect(page.locator('.kh-goal-now')).toContainText('30');
  // stats from the log: 9 pages over two days
  await expect(page.locator('.kh-tile').nth(4)).toContainText('9');
  await expect(page.locator('.kb')).toHaveCount(14);
  await expect(page.locator('.heat i')).toHaveCount(84);
});

test('reading past the wird in the mushaf is offered for recording', async ({ page }) => {
  await page.goto(`${BASE_URL}/pages/khatma.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(s => { localStorage.setItem('thabat_v1', JSON.stringify(s)); localStorage.setItem('lastPage', '53'); localStorage.setItem('lastPageTime', String(Date.now())); }, wird());
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('.kh-hint')).toContainText('53');
  await page.click('[data-act="ahead"]');
  const Q = await page.evaluate(() => JSON.parse(localStorage.getItem('thabat_v1')).journeys[0].quran);
  expect(Q.pos).toBe(54);
  await expect(page.locator('.kh-cont')).toHaveAttribute('href', 'quran-text.html?page=53');
});

test('«إنجازاتي»: a chart over 7 / 30 days / everything, totals and the khatma', async ({ page }) => {
  await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(([s, k1, k2]) => {
    localStorage.setItem('thabat_v1', JSON.stringify(s));
    localStorage.setItem('dhikr_log', JSON.stringify({ [k1]: { m: 100, a: 5, q: 3 }, [k2]: { m: 40, a: 2, q: 1 } }));
    localStorage.setItem('grand_total', '5000');
    localStorage.setItem('zad_lang', 'ar');          // no first-run language sheet
  }, [wird(), key(1), key(40)]);
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => openStatsSheet());
  await expect(page.locator('#achBody .ab')).toHaveCount(7);
  await expect(page.locator('#achBody .ach-read')).toContainText('100');      // tasbeeh in 7 days
  await page.click('#achBody [data-period="30"]');
  await expect(page.locator('#achBody .ab')).toHaveCount(30);
  await page.click('#achBody [data-metric="a"]');
  await expect(page.locator('#achBody .ach-read')).toContainText('5');
  await page.click('#achBody [data-period="0"]');
  await expect(page.locator('#achBody .ach-read')).toContainText('7');        // adhkar since the start
  await expect(page.locator('#achBody .ach-totals')).toContainText('5,000');  // lifetime tasbeeh
  await expect(page.locator('#achBody .ach-khatma')).toHaveAttribute('href', 'pages/khatma.html');
  // tap a bar to read it
  await page.click('#achBody [data-period="7"]');
  await page.locator('#achBody .ab').nth(5).click();
  await expect(page.locator('#achBody .ab.sel')).toHaveCount(1);
});
