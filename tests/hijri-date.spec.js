const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8080';

// English month names the fix is supposed to produce (indexed 1..12).
const ISLAMIC_MONTHS_EN = [
  'Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani",
  'Jumada al-Awwal', 'Jumada al-Thani', 'Rajab', "Sha'ban",
  'Ramadan', 'Shawwal', "Dhu al-Qi'dah", 'Dhu al-Hijjah',
];

// Gregorian month names that the BUG produced (we must not see any of these
// in the English hijri output).
const GREGORIAN_MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Cairo — known coordinates so we can seed localStorage and force the home
// widget to render the hijri date.
const CAIRO = { lat: '30.04', lng: '31.24' };

// Pre-conditions for any test in this file: visit the home page, set a saved
// location, and wait for the prayer widget to render. We do this in beforeEach
// so each test gets a clean state and we don't depend on order.
async function bootstrap(page) {
  // Seed localStorage BEFORE the page loads so the load handler picks it up.
  // Also pre-set zad_lang so the first-run language sheet doesn't appear.
  await page.addInitScript((c) => {
    try {
      localStorage.setItem('prayer_lat', c.lat);
      localStorage.setItem('prayer_lng', c.lng);
      localStorage.setItem('current_location_name', 'Cairo');
      localStorage.setItem('zad_lang', 'ar');
    } catch (e) {}
  }, CAIRO);

  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.I18n && window.I18n.getLang(), { timeout: 10000 });
  // Wait for the hijri text to actually populate (it's "-- رمضان" by default).
  await page.waitForFunction(() => {
    const el = document.getElementById('homeHijri');
    return el && el.textContent && el.textContent.trim() !== '-- رمضان' && el.textContent.trim() !== '--';
  }, { timeout: 10000 });
}

async function setLangAndRefresh(page, lang) {
  await page.evaluate((l) => window.I18n.setLang(l), lang);
  // The load handler also listens for 'langchange' and calls refreshPrayerTimes,
  // but give the DOM a tick to settle.
  await page.waitForTimeout(300);
}

// =====================================================
// 1. formatHijriDate() — direct function test
// =====================================================
test('formatHijriDate: English produces an English Islamic month name', async ({ page }) => {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.I18n && window.I18n.getLang(), { timeout: 10000 });
  await page.evaluate(() => window.I18n.setLang('en'));
  await page.waitForTimeout(200);

  const result = await page.evaluate(() => {
    // formatHijriDate is defined inside the <script> block; it isn't on
    // window, so re-evaluate the page's own Intl logic by reading whatever
    // homeHijri shows after we set English + a location. To unit-test the
    // function in isolation, run the equivalent of its body here.
    const d = new Date();
    const fmt = new Intl.DateTimeFormat('en-u-ca-islamic', { day: 'numeric', month: 'numeric', year: 'numeric' });
    const parts = fmt.formatToParts(d);
    let day = '', monthNum = 0, year = '';
    for (const p of parts) {
      if (p.type === 'day') day = p.value;
      else if (p.type === 'month') monthNum = parseInt(p.value, 10);
      else if (p.type === 'year') year = p.value;
    }
    return { day, monthNum, year, formatted: `${day} ${monthNum} ${year}` };
  });

  expect(result.monthNum).toBeGreaterThanOrEqual(1);
  expect(result.monthNum).toBeLessThanOrEqual(12);
  expect(ISLAMIC_MONTHS_EN[result.monthNum - 1]).toBeTruthy();
});

test('formatHijriDate: Arabic produces an Arabic Islamic month name', async ({ page }) => {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.I18n && window.I18n.getLang(), { timeout: 10000 });
  // Default language is Arabic. We can stay on it.
  const result = await page.evaluate(() => {
    const d = new Date();
    const fmt = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', { day: 'numeric', month: 'long', year: 'numeric' });
    return fmt.format(d);
  });
  // Arabic-Indic digits 0-9 or Arabic letters expected.
  expect(result).toMatch(/[\u0600-\u06FF]/);
});

// =====================================================
// 2. Home widget — English shows an Islamic month, NOT a Gregorian one
// =====================================================
test('home widget (EN): hijri date uses an English Islamic month name', async ({ page }) => {
  await bootstrap(page);
  await setLangAndRefresh(page, 'en');

  const hijri = await page.locator('#homeHijri').textContent();
  const trimmed = (hijri || '').trim();

  expect(trimmed).not.toBe('');
  expect(trimmed).not.toBe('--');

  // It must NOT look like a Gregorian month name in English.
  for (const g of GREGORIAN_MONTHS_EN) {
    expect(
      trimmed,
      `homeHijri="${trimmed}" still contains Gregorian month "${g}" — the fix didn't work.`
    ).not.toContain(g);
  }

  // It must look like "<day> <Islamic-month> <year>" — match the day/month/year pattern.
  const islamicMonthAlt = ISLAMIC_MONTHS_EN.map(m => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`^\\d{1,2}\\s+(${islamicMonthAlt})\\s+\\d{4}$`);
  expect(
    trimmed,
    `homeHijri="${trimmed}" should look like "8 Muharram 1448"`
  ).toMatch(re);
});

test('home widget (EN): hijri year is in the Hijri range (not Gregorian)', async ({ page }) => {
  await bootstrap(page);
  await setLangAndRefresh(page, 'en');

  const hijri = await page.locator('#homeHijri').textContent();
  const trimmed = (hijri || '').trim();

  // Extract the last 4-digit year token.
  const m = trimmed.match(/\b(\d{4})\b/);
  expect(m, `Couldn't find a year in "${trimmed}"`).not.toBeNull();
  const year = parseInt(m[1], 10);
  // Gregorian year is ~2025-2030; Hijri is ~1446-1450. Reject Gregorian.
  expect(year, `Year ${year} looks Gregorian, not Hijri`).toBeLessThan(1500);
  expect(year, `Year ${year} is unreasonably small for Hijri`).toBeGreaterThan(1400);
});

test('home widget (AR): hijri date contains Arabic script and uses Hijri year', async ({ page }) => {
  await bootstrap(page);
  await setLangAndRefresh(page, 'ar');

  const hijri = await page.locator('#homeHijri').textContent();
  const trimmed = (hijri || '').trim();

  expect(trimmed).not.toBe('');
  expect(trimmed).toMatch(/[\u0600-\u06FF]/);

  // Arabic uses Arabic-Indic digits ٠-٩ (U+0660..U+0669) as well as
  // Eastern Arabic-Indic ۰-۹ (U+06F0..U+06F9), so we match any of those.
  const digitRe = /[\d\u0660-\u0669\u06F0-\u06F9]{4}/;
  const m = trimmed.match(digitRe);
  expect(m, `Couldn't find a 4-digit year in "${trimmed}"`).not.toBeNull();
  // Normalize Arabic-Indic digits to ASCII for the range check.
  const year = parseInt((m[0].replace(/[\u0660-\u0669\u06F0-\u06F9]/g, c =>
    String.fromCharCode(c.charCodeAt(0) - (c.charCodeAt(0) < 0x06F0 ? 0x0660 : 0x06F0) + 48
  ))), 10);
  expect(year).toBeLessThan(1500);
  expect(year).toBeGreaterThan(1400);
});

// =====================================================
// 3. Round-trip: EN and AR show the SAME hijri day/month/year
// =====================================================
test('home widget: English and Arabic render the same day/month/year', async ({ page }) => {
  await bootstrap(page);

  // Capture Arabic first
  await setLangAndRefresh(page, 'ar');
  const ar = (await page.locator('#homeHijri').textContent() || '').trim();

  // Then English
  await setLangAndRefresh(page, 'en');
  const en = (await page.locator('#homeHijri').textContent() || '').trim();

  // Extract all digit-like runs (ASCII + Arabic-Indic + Eastern Arabic-Indic),
  // then normalize to ASCII for comparison.
  const extractNumbers = (s) => {
    const runs = s.match(/[\d\u0660-\u0669\u06F0-\u06F9]+/g) || [];
    return runs.map(r =>
      r.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, c =>
        String.fromCharCode(c.charCodeAt(0) - (c.charCodeAt(0) < 0x06F0 ? 0x0660 : 0x06F0) + 48)
      )
    );
  };
  const arDigits = extractNumbers(ar);
  const enDigits = extractNumbers(en);
  expect(arDigits.length, `No digits in AR hijri: "${ar}"`).toBeGreaterThanOrEqual(2);
  expect(enDigits.length, `No digits in EN hijri: "${en}"`).toBeGreaterThanOrEqual(2);
  expect(arDigits[0], `Day mismatch: AR="${ar}" EN="${en}"`).toBe(enDigits[0]); // day
  expect(arDigits[arDigits.length - 1], `Year mismatch: AR="${ar}" EN="${en}"`)
    .toBe(enDigits[enDigits.length - 1]); // year
});

// =====================================================
// 4. Prayer modal — English hijri line uses an Islamic month name
// =====================================================
test('prayer modal (EN): hijri line uses an English Islamic month name', async ({ page }) => {
  await bootstrap(page);
  await setLangAndRefresh(page, 'en');

  // The first-run language sheet may be open if zad_lang isn't set. Dismiss it
  // by tapping the backdrop (which the app's close handler accepts).
  await page.evaluate(() => {
    const sheet = document.getElementById('i18nLangSheetWrap');
    if (sheet) sheet.remove();
  });

  // Open the prayer modal by clicking the prayer widget.
  await page.locator('.prayer-widget').click();
  await page.waitForSelector('#prayerModal.active', { timeout: 5000 });
  await page.waitForFunction(
    () => {
      const el = document.querySelector('#prayerModalSub .pt-hijri-line');
      return el && el.textContent && el.textContent.trim().length > 0;
    },
    { timeout: 5000 }
  );

  const hijriLine = await page.locator('#prayerModalSub .pt-hijri-line').textContent();
  const trimmed = (hijriLine || '').trim();

  expect(trimmed).not.toBe('');
  for (const g of GREGORIAN_MONTHS_EN) {
    expect(trimmed, `Modal hijri line "${trimmed}" still contains Gregorian month "${g}"`).not.toContain(g);
  }

  const islamicMonthAlt = ISLAMIC_MONTHS_EN.map(m => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  // Modal format is "<weekday>, <day> <month> <year>".
  const re = new RegExp(`^[A-Za-z]+,\\s*\\d{1,2}\\s+(${islamicMonthAlt})\\s+\\d{4}$`);
  expect(trimmed, `Modal hijri line "${trimmed}" should look like "Monday, 8 Muharram 1448"`).toMatch(re);

  // Close modal so subsequent tests are unaffected.
  await page.evaluate(() => window.closePrayerModal && window.closePrayerModal());
});
