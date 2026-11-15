// Masbaha: follows the app theme, and the dhikr picker sheet lists, searches and switches adhkar.
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8080';

async function open(page, theme) {
  await page.addInitScript(t => {
    try { localStorage.setItem('zad_lang', 'ar'); if (t) localStorage.setItem('themeMode', t); } catch (e) {}
  }, theme);
  await page.goto(`${BASE_URL}/pages/masbaha.html`, { waitUntil: 'load' });
}

test.describe('masbaha', () => {
  test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });

  for (const [stored, shown] of [['light', 'light'], ['sepia', 'sepia'], ['dark', 'dark'], ['plain-dark', 'dark'], ['warm', 'sepia']]) {
    test(`themeMode "${stored}" shows the ${shown} theme`, async ({ page }) => {
      await open(page, stored);
      await expect(page.locator('html')).toHaveAttribute('data-theme', shown);
    });
  }

  test('the theme can be changed from settings and is shared with the app', async ({ page }) => {
    await open(page, 'dark');
    await page.evaluate(() => toggleSettings());
    await page.click('[data-theme-swatch="sepia"]');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'sepia');
    await expect(page.locator('[data-theme-swatch="sepia"]')).toHaveClass(/active/);
    expect(await page.evaluate(() => localStorage.getItem('themeMode'))).toBe('sepia');
  });

  test('the picker lists every dhikr in groups, searches, and switches the counter', async ({ page }) => {
    await open(page, 'light');
    await page.click('#dhikrPickerBtn');
    await expect(page.locator('#dhikrSheet')).toHaveClass(/open/);
    const total = await page.evaluate(() => document.getElementById('dhikrSelect').options.length);
    expect(total).toBeGreaterThanOrEqual(17);
    await expect(page.locator('#dhikrList .dhikr-item')).toHaveCount(total);
    await expect(page.locator('#dhikrList .dhikr-group-label')).toHaveCount(4);
    await expect(page.locator('#dhikrList .dhikr-item.active')).toHaveCount(1);

    // search ignores diacritics and hamza forms
    await page.fill('#dhikrSearch', 'استغفر');
    await expect(page.locator('#dhikrList .dhikr-item')).toHaveCount(2);
    await page.fill('#dhikrSearch', 'ذي النون');
    await expect(page.locator('#dhikrList .dhikr-empty')).toHaveCount(1);
    await page.fill('#dhikrSearch', 'الظالمين');
    await page.click('#dhikrList .dhikr-item');

    await expect(page.locator('#dhikrSheet')).not.toHaveClass(/open/);
    await expect(page.locator('#dhikrText')).toHaveText('لا إله إلا أنت سبحانك إني كنت من الظالمين');
    await expect(page.locator('#hintBox')).toContainText('ذي النون');
    expect(await page.evaluate(() => localStorage.getItem('currentDhikr'))).toBe('dhannoon');

    await page.click('.progress-wrapper');
    await expect(page.locator('#count')).toHaveText('1');
  });

  test('power mode: taps count, a held press shows the exit ring under the finger and does not count', async ({ page }) => {
    await open(page, 'dark');
    await page.evaluate(() => enterPowerMode());
    const count = () => page.locator('#powerCount').innerText();
    const before = Number(await count());

    await page.mouse.click(200, 300);
    await expect(page.locator('#powerCount')).toHaveText(String(before + 1));
    await expect(page.locator('#exitCircle')).not.toHaveClass(/holding/);

    // hold, then let go early: the ring appears where the press is, nothing is counted
    await page.mouse.move(300, 220);
    await page.mouse.down();
    await page.waitForTimeout(600);
    await expect(page.locator('#exitCircle')).toHaveClass(/holding/);
    const pos = await page.evaluate(() => {
      const c = document.getElementById('exitCircle');
      return [c.style.getPropertyValue('--x'), c.style.getPropertyValue('--y')];
    });
    expect(pos).toEqual(['300px', '220px']);
    await page.mouse.up();
    await expect(page.locator('#exitCircle')).not.toHaveClass(/holding/);
    await expect(page.locator('#powerModeOverlay')).toHaveClass(/active/);
    await expect(page.locator('#powerCount')).toHaveText(String(before + 1));

    // near an edge the ring is kept on screen
    await page.mouse.move(5, 5);
    await page.mouse.down();
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => document.getElementById('exitCircle').style.getPropertyValue('--x'))).toBe('80px');
    await page.mouse.up();

    // hold three seconds: leaves the mode, and the lifted finger counts nothing
    await page.mouse.move(200, 400);
    await page.mouse.down();
    await expect(page.locator('#powerModeOverlay')).not.toHaveClass(/active/, { timeout: 4000 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    await expect(page.locator('#count')).toHaveText(String(before + 1));
  });

  test('the ring shows the round, the progress in it and the lit beads', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('currentDhikr', 'subhan'); localStorage.setItem('target_subhan', '33'); localStorage.setItem('counter_subhan', '45'); } catch (e) {} });
    await open(page, 'light');
    await expect(page.locator('#count')).toHaveText('45');
    await expect(page.locator('#countLabel')).toHaveText('الدورة 2');
    await expect(page.locator('#roundProgress')).toHaveText('12 من 33');
    await expect(page.locator('#beads .bead')).toHaveCount(33);
    await expect(page.locator('#beads .bead.lit')).toHaveCount(12);
    await expect(page.locator('#beads .bead.now')).toHaveCount(1);
    await expect(page.locator('#dhikrText')).toHaveText('سبحان الله');
  });

  test('undo takes back the last tap everywhere it was counted', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('currentDhikr', 'hamd'); } catch (e) {} });
    await open(page, 'dark');
    await expect(page.locator('#undoBtn')).toBeDisabled();
    const read = () => page.evaluate(() => {
      const day = (d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'))(new Date());
      const log = JSON.parse(localStorage.getItem('dhikr_log') || '{}')[day] || {};
      return [localStorage.getItem('counter_hamd'), localStorage.getItem('total_hamd'), localStorage.getItem('grand_total'), localStorage.getItem('masbaha_today'), (log.d || {}).hamd || 0, log.m || 0];
    });
    await page.click('#counterZone'); await page.click('#counterZone');
    expect(await read()).toEqual(['2', '2', '2', '2', 2, 2]);
    await page.click('#undoBtn');
    await expect(page.locator('#count')).toHaveText('1');
    expect(await read()).toEqual(['1', '1', '1', '1', 1, 1]);
    await page.click('#undoBtn');
    await expect(page.locator('#undoBtn')).toBeDisabled();
    await expect(page.locator('#countLabel')).toHaveText('اضغط للتسبيح');
  });

  test('the keyboard counts and takes back', async ({ page }) => {
    await open(page, 'dark');
    const start = Number(await page.locator('#count').innerText());
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('#count')).toHaveText(String(start + 2));
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#count')).toHaveText(String(start + 1));
    await expect(page.locator('#countAnnounce')).toHaveText(String(start + 1));
  });

  test('the target sheet sets a common count in one tap, or any number', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('currentDhikr', 'subhan'); } catch (e) {} });
    await open(page, 'sepia');
    await page.click('.act-target');
    await expect(page.locator('#targetSheet')).toHaveClass(/open/);
    await expect(page.locator('.target-chip.active')).toHaveText('33');
    await page.click('.target-chip:has-text("100")');
    await expect(page.locator('#targetSheet')).not.toHaveClass(/open/);
    expect(await page.evaluate(() => localStorage.getItem('target_subhan'))).toBe('100');
    await expect(page.locator('#targetBtnLabel')).toHaveText('الهدف 100');

    await page.click('.act-target');
    await page.fill('#targetInput', '0');
    await page.click('#targetSheet .btn-inline');
    await expect(page.locator('#targetSheet')).toHaveClass(/open/);     // refused
    await page.fill('#targetInput', '250');
    await page.press('#targetInput', 'Enter');
    await expect(page.locator('#targetSheet')).not.toHaveClass(/open/);
    await expect(page.locator('#roundProgress')).toHaveText('0 من 250');
  });

  test('the virtue shows its source on its own line', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('currentDhikr', 'dhannoon'); } catch (e) {} });
    await open(page, 'light');
    await expect(page.locator('#hintSource')).toHaveText('رواه الترمذي');
    await expect(page.locator('#hintBox')).not.toContainText('رواه');
  });

  test('statistics list the adhkar said, most first', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('total_hamd', '5'); localStorage.setItem('total_subhan', '40'); } catch (e) {} });
    await open(page, 'light');
    await page.evaluate(() => toggleSettings());
    await expect(page.locator('#grandTotalDisplay')).toHaveText('45');
    await page.click('.stats-details > summary');
    await expect(page.locator('#statsTable tr')).toHaveCount(2);
    await expect(page.locator('#statsTable tr').first()).toContainText('سبحان الله');
  });

  test('the arrows step through the adhkar in the picker order, and wrap around', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('currentDhikr', 'subhan'); } catch (e) {} });
    await open(page, 'light');
    await page.click('[data-i18n-aria="masbaha_next"]');
    await expect(page.locator('#dhikrText')).toHaveText('الحمد لله');
    await page.click('[data-i18n-aria="masbaha_prev"]');
    await page.click('[data-i18n-aria="masbaha_prev"]');
    await expect(page.locator('#dhikrText')).toHaveText('اللهم صلَّ على سيدنا محمد');   // the last one
    expect(await page.evaluate(() => localStorage.getItem('currentDhikr'))).toBe('salawat');
    // the cartouche is drawn to the card's size
    expect(await page.evaluate(() => document.getElementById('ctLinePath').getAttribute('d').length)).toBeGreaterThan(100);
  });

  test('a bookmarked dhikr is listed first in the picker', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('currentDhikr', 'dhannoon'); } catch (e) {} });
    await open(page, 'dark');
    await page.click('#favBtn');
    await expect(page.locator('#favBtn')).toHaveAttribute('aria-pressed', 'true');
    await page.click('#dhikrPickerBtn');
    await expect(page.locator('#dhikrList .dhikr-group-label').first()).toHaveText('المفضلة');
    await expect(page.locator('#dhikrList .dhikr-item').first()).toContainText('من الظالمين');
    await page.evaluate(() => closeDhikrSheet());
    await page.click('#favBtn');
    await expect(page.locator('#favBtn')).toHaveAttribute('aria-pressed', 'false');
  });

  test('custom adhkar appear in their own group', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('customDhikrs', JSON.stringify([{ id: 'custom_1', text: 'ذكر تجريبي' }])); } catch (e) {}
    });
    await open(page, 'dark');
    await page.click('#dhikrPickerBtn');
    await expect(page.locator('#dhikrList .dhikr-group-label')).toHaveCount(5);
    await expect(page.locator('#dhikrList .dhikr-group-label').last()).toHaveText('أذكاري الخاصة');
    await expect(page.locator('#dhikrList .dhikr-item').last()).toContainText('ذكر تجريبي');
  });
});
