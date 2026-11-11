// The text mushaf: laid out from the app's own Quran text; fetched text is an
// enhancement that must match it; no connection is needed to read.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8080';
const ROOT = path.join(__dirname, '..');
const QURAN = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'quran.json'), 'utf8'));
const REMOTE = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'quran-encodings.json'), 'utf8'));
const stored = (s, a) => QURAN.find(v => v.surah === s && v.ayah === a).text_uthmani;

const PAGE_2 = ['2:1', '2:2', '2:3', '2:4', '2:5'];

test.use({ serviceWorkers: 'block' });

// Marks only (what the page's formatter may reorder or wrap) removed, so the
// comparison is about the words on screen.
const lettersOf = t => Array.from(t).filter(ch => { const c = ch.codePointAt(0); return (c >= 0x0621 && c <= 0x064A) || c === 0x0671; }).join('');

async function openPage(page, n) {
  await page.goto(`${BASE_URL}/pages/quran-text.html?page=${n}`, { waitUntil: 'load' });
  await expect(page.locator('.ayah-wrapper').first()).toBeVisible({ timeout: 20000 });
}

const ayahTexts = page => page.locator('.ayah-wrapper .ayah-text').allTextContents();
const blockNetwork = page => page.route(url => !url.href.startsWith(BASE_URL), route => route.abort());

function mockQuranCom(page, textByKey) {
  return page.route('**/api.quran.com/**', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ verses: Object.entries(textByKey).map(([verse_key, t]) => ({ verse_key, text_qpc_hafs: t, text_uthmani: t })) }),
  }));
}

function mockAudio(page, keys) {
  return page.route('**/api.alquran.cloud/v1/page/**', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ code: 200, data: { ayahs: keys.map(k => {
      const [s, a] = k.split(':').map(Number);
      return { numberInSurah: a, surah: { number: s }, audio: `https://audio.invalid/${s}/${a}.mp3` };
    }) } }),
  }));
}

test('reads with no connection: page 1 is Al-Fatihah from the local text', async ({ page }) => {
  await blockNetwork(page);
  await openPage(page, 1);

  const texts = await ayahTexts(page);
  expect(texts.length).toBe(7);
  texts.forEach((t, i) => expect(lettersOf(t)).toBe(lettersOf(stored(1, i + 1))));
  expect(await page.evaluate(() => pageTextSource)).toBe('local');
  await expect(page.locator('.surah-meta')).toContainText('7');
});

test('reads with no connection: last page, three surahs with their headers', async ({ page }) => {
  await blockNetwork(page);
  await openPage(page, 604);

  expect((await ayahTexts(page)).length).toBe(15);
  await expect(page.locator('.surah-separator')).toHaveCount(3);
  await expect(page.locator('.basmalah-container')).toHaveCount(3);
  // The basmala is drawn as its own line, not repeated inside ayah 1.
  const first = (await ayahTexts(page))[0];
  expect(lettersOf(first)).toBe(lettersOf(stored(112, 1).split(/\s+/).slice(4).join(' ')));
});

test('no connection: asking for the recitation says so and stays on the page', async ({ page }) => {
  await blockNetwork(page);
  await openPage(page, 2);
  await page.evaluate(() => playAyah(0));
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => currentPage)).toBe(2);
  expect(await page.evaluate(() => isPlaying)).toBe(false);
});

test('fetched text that matches the local text is shown, with audio matched by ayah', async ({ page }) => {
  const textByKey = Object.fromEntries(PAGE_2.map(k => [k, REMOTE[k].qpc]));
  await mockQuranCom(page, textByKey);
  // Audio list deliberately reversed: pairing must be by ayah, not by position.
  await mockAudio(page, PAGE_2.slice().reverse());
  await openPage(page, 2);

  expect(await page.evaluate(() => pageTextSource)).toBe('remote');
  const texts = await ayahTexts(page);
  texts.forEach((t, i) => expect(lettersOf(t)).toBe(lettersOf(textByKey[PAGE_2[i]])));
  expect(await page.evaluate(() => pageAudioUrls)).toEqual(PAGE_2.map(k => `https://audio.invalid/${k.replace(':', '/')}.mp3`));
});

test('fetched text in the wrong order is refused: the page shows the local text', async ({ page }) => {
  const good = Object.fromEntries(PAGE_2.map(k => [k, REMOTE[k].qpc]));
  await mockQuranCom(page, Object.assign({}, good, { '2:2': good['2:3'], '2:3': good['2:2'] }));
  await mockAudio(page, PAGE_2);
  await openPage(page, 2);

  expect(await page.evaluate(() => pageTextSource)).toBe('local');
  const texts = await ayahTexts(page);
  expect(lettersOf(texts[1])).toBe(lettersOf(stored(2, 2)));
  expect(lettersOf(texts[2])).toBe(lettersOf(stored(2, 3)));
  // The recitation is still available.
  expect(await page.evaluate(() => pageAudioUrls.filter(Boolean).length)).toBe(5);
});

test('fetched text carrying markup is refused and nothing is injected', async ({ page }) => {
  const good = Object.fromEntries(PAGE_2.map(k => [k, REMOTE[k].qpc]));
  await mockQuranCom(page, Object.assign({}, good, { '2:4': good['2:4'] + '<img src=x onerror="window.__injected=1">' }));
  await mockAudio(page, PAGE_2);
  await openPage(page, 2);

  expect(await page.evaluate(() => pageTextSource)).toBe('local');
  expect(await page.locator('#textContainer .ayah-text img').count()).toBe(0);
  expect(await page.evaluate(() => window.__injected)).toBeUndefined();
});

test('a page saved by an older version is not reused', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('quran_master_v49_2_ar.minshawi', JSON.stringify({ html: '<span class="ayah-wrapper"><span class="ayah-text">OLD</span></span>', audio: [], ayahsData: [] }));
    } catch (e) {}
  });
  await blockNetwork(page);
  await openPage(page, 2);
  expect((await ayahTexts(page)).join(' ')).not.toContain('OLD');
  expect(await page.evaluate(() => localStorage.getItem('quran_master_v49_2_ar.minshawi'))).toBeNull();
});

test('display formatting never adds or drops a character, for every ayah', async ({ page }) => {
  await blockNetwork(page);
  await openPage(page, 1);

  // Every ayah of the local text, plus the fetched encodings in the fixture.
  const inputs = QURAN.map(v => v.text_uthmani)
    .concat(Object.values(REMOTE).map(e => e.qpc), Object.values(REMOTE).map(e => e.uthmani));
  const outputs = await page.evaluate(texts => texts.map(t => {
    const el = document.createElement('div');
    el.innerHTML = cleanAndFormatAyahText(t);
    // Only the stop-mark wrapper may be markup.
    if (el.querySelector(':not(span.stop-mark)')) return null;
    return el.textContent;
  }), inputs);

  // The formatter may move spaces, reorder a vowel and its shadda, and drop the
  // ayah number some encodings append. The characters themselves must survive.
  const isSpace = c => c === 0x20 || c === 0xA0 || (c >= 0x09 && c <= 0x0D);
  const isNumberMark = c => (c >= 0x0660 && c <= 0x0669) || (c >= 0x06F0 && c <= 0x06F9) || c === 0x06DD;
  const bag = t => {
    const codes = Array.from(t, ch => ch.codePointAt(0)).filter(c => !isSpace(c));
    while (codes.length && isNumberMark(codes[codes.length - 1])) codes.pop();
    return codes.sort((a, b) => a - b).join(',');
  };
  let bad = [];
  outputs.forEach((out, i) => { if (out === null || bag(out) !== bag(inputs[i])) bad.push(i); });
  expect(bad).toEqual([]);
  expect(outputs.length).toBe(6236 + 280);
});

test.describe('pinch-to-zoom hint', () => {
  const hint = page => page.locator('#qtZoomHint');
  const shown = page => page.evaluate(() => document.getElementById('qtZoomHint').classList.contains('show'));

  test('appears over the first page, then fades by itself', async ({ page }) => {
    await blockNetwork(page);
    await page.goto(`${BASE_URL}/pages/quran-text.html?page=2`, { waitUntil: 'load' });
    await expect.poll(() => shown(page), { timeout: 6000 }).toBe(true);
    await expect(hint(page)).toContainText('بإصبعين');
    await expect.poll(() => shown(page), { timeout: 6000 }).toBe(false);
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('qtZoomHint')).opacity)).toBe('0');
  });

  test('a touch dismisses it at once', async ({ page }) => {
    await blockNetwork(page);
    await page.goto(`${BASE_URL}/pages/quran-text.html?page=2`, { waitUntil: 'load' });
    await expect.poll(() => shown(page), { timeout: 6000 }).toBe(true);
    await page.evaluate(() => document.dispatchEvent(new Event('touchstart')));
    expect(await shown(page)).toBe(false);
  });

  test('is shown only a few times, and never after the reader has pinched', async ({ page }) => {
    await blockNetwork(page);
    await page.addInitScript(() => { try { localStorage.setItem('qtZoomHintCount', '3'); } catch (e) {} });
    await page.goto(`${BASE_URL}/pages/quran-text.html?page=2`, { waitUntil: 'load' });
    await expect(page.locator('.ayah-wrapper').first()).toBeVisible();
    await page.waitForTimeout(1500);
    expect(await shown(page)).toBe(false);

    const second = await page.context().newPage();
    await blockNetwork(second);
    await second.addInitScript(() => { try { localStorage.setItem('qtZoomHintDone', '1'); } catch (e) {} });
    await second.goto(`${BASE_URL}/pages/quran-text.html?page=2`, { waitUntil: 'load' });
    await expect(second.locator('.ayah-wrapper').first()).toBeVisible();
    await second.waitForTimeout(1500);
    expect(await shown(second)).toBe(false);
  });
});
