// «تعلم النحو خطوة خطوة»: the path of levels, a lesson, a full practice run that earns
// three stars (answers taken from the data), and the level test.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8080';
const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'nahw', 'kids.json'), 'utf8'));
const PAGE = `${BASE_URL}/pages/nahw-kids.html`;
test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await page.route(url => !url.href.startsWith(BASE_URL), route => route.abort());
});

test('the path lists every level and every lesson, with a test per level', async ({ page }) => {
  await page.goto(PAGE, { waitUntil: 'load' });
  await expect(page.locator('.lv')).toHaveCount(D.levels.length);
  const lessons = D.levels.reduce((n, l) => n + l.lessons.length, 0);
  await expect(page.locator('.ls:not(.test)')).toHaveCount(lessons);
  await expect(page.locator('.ls.test')).toHaveCount(D.levels.length);
  await expect(page.locator('.lv.open')).toHaveCount(1);
  await page.click('#lv-l3 .lv-head');
  await expect(page.locator('#lv-l3')).toHaveClass(/open/);
});

test('a lesson shows its rule, labelled examples (Quranic ones with their surah) and the parents\' guide', async ({ page }) => {
  const S = D.levels[1].lessons.find(s => s.id === 'mafool');
  await page.goto(`${PAGE}#l2/mafool`, { waitUntil: 'load' });
  await expect(page.locator('.nk-title')).toHaveText(S.title);
  await expect(page.locator('.nk-rule p')).toHaveText(S.rule);
  await expect(page.locator('.nk-ex')).toHaveCount(S.ex.length);
  await expect(page.locator('.nk-ex').nth(2).locator('.ex-ref')).toContainText('العلق');
  await expect(page.locator('.nk-ex').nth(2).locator('.w.l').nth(1)).toContainText('مفعول به');
  await page.click('.nk-parent summary');
  await expect(page.locator('.nk-parent p').first()).toContainText(S.parent.say);
});

async function answer(page, q) {
  if (q.k === 'tap') {
    const want = q.t.map((x, j) => (x[1] ? j : -1)).filter(j => j >= 0);
    for (const j of want) await page.click(`.tw[data-j="${j}"]`);
    if (want.length > 1) await page.click('#qzCheck');
  } else {
    await page.locator('.qo').filter({ hasText: new RegExp('^' + q.a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).click();
  }
  await expect(page.locator('#qzFb')).toHaveClass(/ok/);
  await page.click('#qzNext');
}

test('answering every question right gives three stars, remembered on the path', async ({ page }) => {
  for (const [lid, sid] of [['l1', 'anwa'], ['l3', 'khamsa']]) {
    const S = D.levels.find(l => l.id === lid).lessons.find(s => s.id === sid);
    await page.goto(`${PAGE}#${lid}/${sid}/q`, { waitUntil: 'load' });
    for (const q of S.quiz) await answer(page, q);
    await expect(page.locator('#nkResult .rs-stars .st.on')).toHaveCount(3);
    await expect(page.locator('#nkResult h2')).toContainText(String(S.quiz.length));
  }
  await page.goto(PAGE, { waitUntil: 'load' });
  await expect(page.locator('a.ls[href="#l1/anwa"] .stars .st.on')).toHaveCount(3);
  await expect(page.locator('.nk-stats b').first()).toHaveText(`2/${D.levels.reduce((n, l) => n + l.lessons.length, 0)}`);
});

test('a wrong answer shows the right one; the level test has 10 questions', async ({ page }) => {
  await page.goto(`${PAGE}#l1/anwa/q`, { waitUntil: 'load' });
  await page.click('.tw[data-j="1"]');      // «الْوَلَدُ» is not the verb
  await expect(page.locator('#qzFb')).toHaveClass(/no/);
  await expect(page.locator('#qzFb')).toContainText('يَلْعَبُ');
  await expect(page.locator('.tw.right')).toHaveCount(1);
  await page.goto(`${PAGE}#l2/test`, { waitUntil: 'load' });
  await expect(page.locator('.qz-c')).toHaveText('1/10');
});

test('no horizontal scroll on a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 340, height: 720 });
  for (const h of ['', '#l8/shart', '#l9/irab_filiyya/q']) {
    await page.goto(`${PAGE}${h}`, { waitUntil: 'load' });
    await expect(page.locator('main > *').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
