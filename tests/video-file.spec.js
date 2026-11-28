// The video maker's header (nothing runs under its buttons), the preview that a tap does not
// start, the project in ⚙ Settings (new / open / save, each undoable) and «apply to all stickers».
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const sec = (page, name) => expect(async () => {
  const tab = page.locator('#vmTab-' + name);
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click({ timeout: 2000 });
  await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 500 });
}).toPass({ timeout: 15000 });

const BASE_URL = 'http://localhost:8080';
test.use({ serviceWorkers: 'block', viewport: { width: 412, height: 915 } });

async function open(page, extra, lang) {
  await page.addInitScript(([extra, lang]) => {
    if (sessionStorage.getItem('f')) return;
    sessionStorage.setItem('f', '1');
    localStorage.setItem('zad_lang', lang || 'ar');
    localStorage.setItem('vm_settings', JSON.stringify(Object.assign({ mode: 'khatira', kContent: 'text', bg: 'g0', motion: false, miniPreview: false }, extra)));
  }, [extra || {}, lang]);
  await page.route(url => !url.href.startsWith(BASE_URL), route => route.abort());
  await page.goto(`${BASE_URL}/pages/video-maker.html`, { waitUntil: 'load' });
  await expect(page.locator('#vmSurahLabel')).not.toBeEmpty({ timeout: 20000 });
}

for (const [w, lang] of [[320, 'ar'], [360, 'ar'], [412, 'en']]) {
  test(`the header at ${w} px (${lang}): the title sits between the buttons, whole`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 760 });
    await open(page, {}, lang);
    const r = await page.evaluate(() => {
      const box = el => el.getBoundingClientRect();
      const t = document.querySelector('.header-title'), a = box(document.querySelector('.header-actions')), h = box(document.querySelector('.header > a'));
      const tb = box(t);
      return { t: [tb.left, tb.right], a: [a.left, a.right], h: [h.left, h.right], cut: t.scrollHeight > t.clientHeight + 1 || t.scrollWidth > t.clientWidth + 1, text: t.textContent };
    });
    // no overlap with either side's buttons
    const [l, rgt] = r.t;
    expect(l >= Math.min(r.a[1], r.h[1]) - 0.5).toBe(true);
    expect(rgt <= Math.max(r.a[0], r.h[0]) + 0.5).toBe(true);
    expect(r.cut, 'the title is not cut off').toBe(false);
    expect(r.text).toBe(lang === 'ar' ? 'فيديو الآيات' : 'Video Maker');
  });
}

test('a tap on the preview does not start it (it is for editing); ▶ and «معاينة» play; a tap stops', async ({ page }) => {
  await open(page, { kTexts: ['الصبر مفتاح الفرج'] });
  await page.evaluate(() => scrollTo(0, 0));
  const cv = await page.locator('#vmCanvas').boundingBox();
  await page.mouse.click(cv.x + cv.width * 0.5, cv.y + cv.height * 0.4);
  await page.waitForTimeout(800);
  await expect(page.locator('#vmStagePlay')).toBeVisible();                  // still standing
  // ▶ on the preview: a real, named button
  await expect(page.locator('#vmStagePlay')).toHaveAttribute('aria-label', 'معاينة');
  await page.locator('#vmStagePlay').click();
  await expect(page.locator('#vmStagePlay')).toBeHidden({ timeout: 10000 });
  await page.mouse.click(cv.x + cv.width * 0.5, cv.y + cv.height * 0.4);      // a tap stops it
  await expect(page.locator('#vmStagePlay')).toBeVisible({ timeout: 10000 });
  // from the keyboard
  await page.locator('#vmStagePlay').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#vmStagePlay')).toBeHidden({ timeout: 10000 });
  await page.locator('#vmPreview').click();
  await expect(page.locator('#vmStagePlay')).toBeVisible({ timeout: 10000 });
});

test('⚙ Project: save a project, start new (asks first, undoable), open the project back; a wrong file is refused', async ({ page }) => {
  await open(page, { kTexts: ['الصبر مفتاح الفرج', 'ومن يتق الله'], kOpts: [{ a: 0, b: 3, font: 'ruqaa' }, null], color: '#e6c068', textAlign: 'bottom', lineGap: 1.8, stickers: [{ id: 'h05', x: 0.5, y: 0.75, s: 0.6, line: 0, until: 'next' }] });
  await expect.poll(() => page.evaluate(() => VM.history.started)).toBe(true);
  // save
  await page.locator('#vmSettingsBtn').click();
  await expect(page.locator('#vmSettingsSheet')).toHaveClass(/active/);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#vmFileSave').click()]);
  expect(dl.suggestedFilename()).toMatch(/^zad-video-\d{8}-\d{4}\.zadvideo$/);
  const file = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  expect(file.app).toBe('zad-video-maker');
  expect(file.settings.kTexts).toEqual(['الصبر مفتاح الفرج', 'ومن يتق الله']);
  expect(file.settings.stickers[0]).toMatchObject({ id: 'h05', line: 0, until: 'next' });
  await expect(page.locator('#vmSettingsSheet')).not.toHaveClass(/active/);
  // new: declined, nothing changes
  await page.locator('#vmSettingsBtn').click();
  page.once('dialog', d => d.dismiss());
  await page.locator('#vmFileNew').click();
  expect(await page.evaluate(() => VM.state.kTexts.length)).toBe(2);
  // new: a fresh start, in the same kind of video, keeping the app's own preferences
  page.once('dialog', d => d.accept());
  await page.locator('#vmFileNew').click();
  const fresh = await page.evaluate(() => ({ texts: VM.state.kTexts, st: VM.state.stickers.length, color: VM.state.color, align: VM.state.textAlign, mode: VM.state.mode, mini: VM.state.miniPreview }));
  expect(fresh).toEqual({ texts: [''], st: 0, color: '#ffffff', align: null, mode: 'khatira', mini: false });
  await sec(page, 'ayat');
  await expect(page.locator('#vmKText0')).toHaveValue('');
  // ... and undone
  await page.locator('#vmUndo').click();
  expect(await page.evaluate(() => [VM.state.kTexts.length, VM.state.stickers.length, VM.state.color])).toEqual([2, 1, '#e6c068']);
  await page.locator('#vmRedo').click();
  expect(await page.evaluate(() => VM.state.kTexts)).toEqual(['']);
  // open the saved project: everything back
  await page.locator('#vmSettingsBtn').click();
  page.once('dialog', d => d.accept());
  await page.locator('#vmFileInput').setInputFiles({ name: 'p.zadvideo', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await expect(page.locator('#vmStatus')).toContainText('فُتح المشروع');
  const back = await page.evaluate(() => ({ texts: VM.state.kTexts, opts: VM.state.kOpts, color: VM.state.color, align: VM.state.textAlign, gap: VM.state.lineGap, st: VM.state.stickers.map(s => [s.id, s.line, s.until]) }));
  expect(back).toEqual({ texts: ['الصبر مفتاح الفرج', 'ومن يتق الله'], opts: [{ a: 0, b: 3, font: 'ruqaa' }, null], color: '#e6c068', align: 'bottom', gap: 1.8, st: [['h05', 0, 'next']] });
  await sec(page, 'ayat');
  await expect(page.locator('#vmKText1')).toHaveValue('ومن يتق الله');
  // a file that is not a project
  await page.locator('#vmSettingsBtn').click();
  await page.locator('#vmFileInput').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await expect(page.locator('#vmStatus')).toContainText('ليس ملف مشروع');
  expect(await page.evaluate(() => VM.state.kTexts.length)).toBe(2);
  // unknown or bad values in a project are tidied like saved settings
  page.once('dialog', d => d.accept());
  await page.locator('#vmFileInput').setInputFiles({ name: 'y.zadvideo', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ app: 'zad-video-maker', settings: { kTexts: ['أ'], lineGap: 99, textAlign: 'sideways', stickers: [{ id: 'nope' }], future: 1 } })) });
  await expect(page.locator('#vmStatus')).toContainText('فُتح المشروع');
  expect(await page.evaluate(() => [VM.state.kTexts, VM.state.lineGap, VM.state.textAlign, VM.state.stickers.length, 'future' in VM.state])).toEqual([['أ'], 2.4, null, 0, false]);
});

test('a sticker\'s place, size and effect for all of them (not their timing)', async ({ page }) => {
  await open(page, {
    kTexts: ['أ ب ج', 'د هـ و'],
    stickers: [{ id: 'h05', x: 0.2, y: 0.3, s: 0.3, fx: 'fade', line: 0 }, { id: 'h06', x: 0.8, y: 0.8, s: 0.5, fx: 'pop', line: 1 }, { id: 'h07', x: 0.5, y: 0.5, s: 0.4, fx: 'zoom', from: 2, to: 4 }],
  });
  await sec(page, 'look');
  await page.locator('#vmStAdded .st-chip').first().click();
  await expect(page.locator('#vmStAll')).toBeEnabled();
  await page.locator('#vmStAll').click();
  const st = await page.evaluate(() => VM.state.stickers.map(s => [s.x, s.y, s.s, s.fx, s.line, s.from, s.to]));
  expect(st).toEqual([[0.2, 0.3, 0.3, 'fade', 0, 0, null], [0.2, 0.3, 0.3, 'fade', 1, 0, null], [0.2, 0.3, 0.3, 'fade', null, 2, 4]]);
  await expect(page.locator('#vmStatus')).toContainText('٢');
  await page.waitForTimeout(450);
  await page.locator('#vmUndo').click();
  expect(await page.evaluate(() => VM.state.stickers.map(s => s.fx))).toEqual(['fade', 'pop', 'zoom']);
  // alone, there is nothing to apply it to
  await page.evaluate(() => { VM.state.stickers.splice(1); VM.stickers.render(); });
  await page.locator('#vmStAdded .st-chip').first().click();
  await expect(page.locator('#vmStAll')).toBeDisabled();
});
