// Quran v2 (pages/quran-v2.html) — full functional test suite
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:8080';

// Track console errors (404s, etc.) during each test
let consoleErrors = [];

test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(`[PAGE_ERROR] ${err.message}`);
  });
  page.on('response', response => {
    if (response.status() >= 400) {
      consoleErrors.push(`[${response.status()}] ${response.url()}`);
    }
  });
});

async function loadPage(page) {
  const response = await page.goto(`${BASE_URL}/pages/quran-v2.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 20000,
  });
  // Allow late-loading resources (images, fonts, CDN scripts)
  await page.waitForTimeout(2000);
  return response;
}

// ========== 1. PAGE LOADS WITH NO ERRORS ==========

test('quran-v2.html loads with HTTP 200', async ({ page }) => {
  const response = await loadPage(page);
  expect(response.status()).toBe(200);
});

test('quran-v2.html has a non-empty title', async ({ page }) => {
  await loadPage(page);
  const title = await page.title();
  expect(title.length).toBeGreaterThan(0);
});

test('quran-v2.html loads with zero resource errors', async ({ page }) => {
  await loadPage(page);
  // Only check response-based 404s (they include the URL).
  // Console "Failed to load resource" messages lack the URL and are duplicates.
  const resourceErrors = consoleErrors.filter(e =>
    (e.includes('404') && !e.includes('Failed to load')) ||
    e.includes('ERR_ABORTED') ||
    e.includes('PAGE_ERROR')
  );
  const relevant = resourceErrors.filter(e =>
    !e.includes('favicon') &&
    !e.includes('googleapis.com') &&
    !e.includes('/quran/medina/') &&
    !e.includes('/quran/tajweed/') &&
    !e.includes('/quran/medina_') &&
    !e.includes('/json/audio-')
  );
  expect(relevant, `Resource errors:\n${relevant.join('\n')}`).toEqual([]);
});

// ========== 2. CRITICAL DOM ELEMENTS ==========

test('all critical DOM elements are present', async ({ page }) => {
  await loadPage(page);
  const ids = [
    'quranContainer', 'menuDrawer', 'menuToggleBtn', 'menuCloseBtn', 'juzList',
    'searchOverlay', 'searchToggleBtn', 'searchInput', 'searchResults', 'voiceSearchEntry',
    'bookmarksOverlay', 'bookmarkToggleBtn', 'bookmarksList',
    'settingsPanel', 'showTajweedCheck', 'mushafVersionSelect', 'pageLayoutSelect',
    'reciterSelect', 'autoScrollSelect',
    'scrollToTopBtn', 'infoBtn', 'infoModal', 'langToggleBtn',
    'tasmeePanel', 'tasmeeToggleBtn', 'tasmeeToggleMainBtn',
    'tasmeeFromSurah', 'tasmeeFromAyah', 'tasmeeGoBtn', 'tasmeeRecBtn', 'tasmeeRecentBtn',
    'tasmeeLiveText', 'tasmeeWordTiles', 'tasmeeResults',
    'tasmeeScoreDisplay', 'tasmeeMistakeCount', 'tasmeeTotalWords', 'tasmeeMistakesList',
    'tasmeeProgressFill', 'tasmeeCurrentPageIndicator', 'tasmeeStageContainer',
    'tasmeeSavedToast', 'tasmeeHesitationBar', 'hesitationPercent',
    'weakWordsPill', 'weakWordBackdrop', 'wwdList', 'wwdCloseBtn', 'shareSessionBtn',
    'tasmeeLoadedSession'
  ];
  for (const id of ids) {
    const el = await page.$(`#${id}`);
    expect(el, `Element #${id} not found`).toBeTruthy();
  }
});

// ========== 3. v2-SPECIFIC ELEMENTS ==========

test('v2 badge is visible in top title', async ({ page }) => {
  await loadPage(page);
  const badges = await page.locator('.v2-badge').count();
  expect(badges).toBeGreaterThanOrEqual(1);
  const badgeText = await page.locator('.v2-badge').first().textContent();
  expect(badgeText.trim()).toBe('v2');
});

test('language toggle button exists and has SVG icon', async ({ page }) => {
  await loadPage(page);
  const btn = await page.$('#langToggleBtn');
  expect(btn).toBeTruthy();
  const svgCount = await page.locator('#langToggleBtn svg').count();
  expect(svgCount).toBe(1);
});

// ========== 4. UI INTERACTIONS ==========

test('menu drawer opens and closes', async ({ page }) => {
  await loadPage(page);
  const drawer = page.locator('#menuDrawer');
  await expect(drawer).toBeHidden();
  await page.click('#menuToggleBtn');
  await expect(drawer).toBeVisible();
  await page.click('#menuCloseBtn');
  await expect(drawer).toBeHidden();
});

test('search overlay opens and closes', async ({ page }) => {
  await loadPage(page);
  const overlay = page.locator('#searchOverlay');
  await expect(overlay).toBeHidden();
  await page.click('#searchToggleBtn');
  await expect(overlay).toBeVisible();
  // Search input should get focus
  await page.waitForTimeout(200);
  await page.click('#searchCloseBtn');
  await expect(overlay).toBeHidden();
});

test('bookmarks overlay opens and closes', async ({ page }) => {
  await loadPage(page);
  const overlay = page.locator('#bookmarksOverlay');
  await expect(overlay).toBeHidden();
  await page.click('#bookmarkToggleBtn');
  await expect(overlay).toBeVisible();
  await page.click('#bookmarksCloseBtn');
  await expect(overlay).toBeHidden();
});

test('settings panel toggles open and closed', async ({ page }) => {
  await loadPage(page);
  const panel = page.locator('#settingsPanel');
  await expect(panel).not.toHaveClass(/open/);
  await page.click('#settingsToggleBtn');
  await expect(panel).toHaveClass(/open/);
  await page.click('#settingsToggleBtn');
  await expect(panel).not.toHaveClass(/open/);
});

test('settings values are present in dropdowns', async ({ page }) => {
  await loadPage(page);
  // Mushaf version should have 5 options
  const versionOpts = await page.locator('#mushafVersionSelect option').count();
  expect(versionOpts).toBe(5);
  // Page layout should have 2 options
  const layoutOpts = await page.locator('#pageLayoutSelect option').count();
  expect(layoutOpts).toBe(2);
  // Reciter should have 6 options (5 reciters + "no audio")
  const reciterOpts = await page.locator('#reciterSelect option').count();
  expect(reciterOpts).toBe(6);
  // Auto scroll should have 4 options
  const scrollOpts = await page.locator('#autoScrollSelect option').count();
  expect(scrollOpts).toBe(4);
});

test('tasmee panel toggle button works', async ({ page }) => {
  await loadPage(page);
  const panel = page.locator('#tasmeePanel');
  // Panel should be visible by default (not collapsed)
  await expect(panel).not.toHaveClass(/tpv2-collapsed/);
  // Toggle via the panel toggle button
  await page.click('#tasmeeToggleBtn');
  await expect(panel).toHaveClass(/tpv2-collapsed/);
  // Re-open via the main toggle button
  await page.click('#tasmeeToggleMainBtn');
  await expect(panel).not.toHaveClass(/tpv2-collapsed/);
});

test('weak word sheet opens and closes', async ({ page }) => {
  await loadPage(page);
  const backdrop = page.locator('#weakWordBackdrop');
  await expect(backdrop).not.toHaveClass(/open/);
  // Try opening via backdrop API call (JS)
  await page.evaluate(() => {
    // Open the weak word sheet by calling the internal function
    var backdrop = document.getElementById('weakWordBackdrop');
    if (backdrop) backdrop.classList.add('open');
  });
  await expect(backdrop).toHaveClass(/open/);
  // Close via close button
  await page.click('#wwdCloseBtn');
  await expect(backdrop).not.toHaveClass(/open/);
});

test('weak word sheet re-opens via backdrop click-outside', async ({ page }) => {
  await loadPage(page);
  const backdrop = page.locator('#weakWordBackdrop');
  await page.evaluate(() => {
    var backdrop = document.getElementById('weakWordBackdrop');
    if (backdrop) backdrop.classList.add('open');
  });
  await expect(backdrop).toHaveClass(/open/);
  // Click the backdrop (not the sheet) to close
  await backdrop.click({ position: { x: 10, y: 10 } });
  await expect(backdrop).not.toHaveClass(/open/);
});

test('info modal opens and closes', async ({ page }) => {
  await loadPage(page);
  const modal = page.locator('#infoModal');
  await expect(modal).toBeHidden();
  await page.click('#infoBtn');
  await expect(modal).toBeVisible();
  await page.click('#infoModalClose');
  await expect(modal).toBeHidden();
});

test('scroll to top button exists and is clickable', async ({ page }) => {
  await loadPage(page);
  const btn = page.locator('#scrollToTopBtn');
  await expect(btn).toBeVisible();
  // Should not throw
  await btn.click();
});

// ========== 5. i18n ATTRIBUTES ==========

test('user-facing elements have data-i18n attributes', async ({ page }) => {
  await loadPage(page);
  const count = await page.locator('[data-i18n]').count();
  expect(count).toBeGreaterThan(20);
  // Check specific critical i18n keys
  const keys = await page.evaluate(() => {
    const els = document.querySelectorAll('[data-i18n]');
    return [...new Set([...els].map(el => el.getAttribute('data-i18n')))].sort();
  });
  expect(keys).toContain('quran_page_title');
  expect(keys).toContain('tasmee_title');
  expect(keys).toContain('quran_settings');
  expect(keys).toContain('tasmee_session_saved');
  expect(keys).toContain('tasmee_weak_words');
  expect(keys).toContain('tasmee_hesitation');
  expect(keys).toContain('quran_voice_search');
});

test('i18n aria-labels are present on icon buttons', async ({ page }) => {
  await loadPage(page);
  const count = await page.locator('[data-i18n-aria]').count();
  expect(count).toBeGreaterThanOrEqual(5);
});

test('i18n placeholders are present on inputs', async ({ page }) => {
  await loadPage(page);
  const count = await page.locator('[data-i18n-placeholder]').count();
  expect(count).toBeGreaterThanOrEqual(2);
});

// ========== 6. MUSHAPH RENDERING ==========

test('mushaf pages are rendered in the container', async ({ page }) => {
  await loadPage(page);
  const pages = await page.locator('#quranContainer .q-page').count();
  expect(pages).toBe(604);
});

test('first and last mushaf page images load', async ({ page }) => {
  await loadPage(page);
  const firstImg = page.locator('#page-1 .page-img').first();
  await expect(firstImg).toBeVisible();
  // Scroll to the last page so it renders in viewport
  await page.evaluate(() => {
    const el = document.getElementById('page-604');
    if (el) el.scrollIntoView();
  });
  await page.waitForTimeout(500);
  const lastImg = page.locator('#page-604 .page-img').first();
  await expect(lastImg).toBeVisible();
});

// ========== 7. JUZ LIST ==========

test('juz list has 30 items in menu drawer', async ({ page }) => {
  await loadPage(page);
  await page.click('#menuToggleBtn');
  const items = await page.locator('#juzList .menu-item').count();
  expect(items).toBe(30);
});

// ========== 8. TASMEE PANEL STRUCTURE ==========

test('tasmee panel has correct inner elements', async ({ page }) => {
  await loadPage(page);
  const panel = page.locator('#tasmeePanel');
  // Header area
  expect(await panel.locator('.tpv2-header').count()).toBe(1);
  // Controls
  expect(await panel.locator('#tasmeeFromSurah').count()).toBe(1);
  expect(await panel.locator('#tasmeeFromAyah').count()).toBe(1);
  expect(await panel.locator('#tasmeeGoBtn').count()).toBe(1);
  expect(await panel.locator('#tasmeeRecBtn').count()).toBe(1);
  expect(await panel.locator('#tasmeeRecentBtn').count()).toBe(1);
  // Body area
  expect(await panel.locator('#tasmeeLiveText').count()).toBe(1);
  expect(await panel.locator('#tasmeeWordTiles').count()).toBe(1);
  expect(await panel.locator('#tasmeeResults').count()).toBe(1);
  // v2 features
  expect(await panel.locator('#tasmeeHesitationBar').count()).toBe(1);
  expect(await panel.locator('#weakWordsPill').count()).toBe(1);
  expect(await panel.locator('#shareSessionBtn').count()).toBe(1);
  expect(await panel.locator('#tasmeeLoadedSession').count()).toBe(1);
});

// ========== 9. TASMEE PANEL SCORE DISPLAY ==========

test('tasmee results section shows initial placeholder state', async ({ page }) => {
  await loadPage(page);
  const results = page.locator('#tasmeeResults');
  await expect(results).toBeHidden();
  // Initial score display text
  const score = await page.locator('#tasmeeScoreDisplay').textContent();
  expect(score).toBe('95%');
  const mistakeCount = await page.locator('#tasmeeMistakeCount').textContent();
  expect(mistakeCount).toBe('0');
  const totalWords = await page.locator('#tasmeeTotalWords').textContent();
  expect(totalWords).toBe('0');
  // Progress should be at 0% (check inline style; computed may be 0px)
  const progress = await page.locator('#tasmeeProgressFill');
  await expect(progress).toHaveAttribute('style', 'width:0%');
});

// ========== 10. HESITATION BAR ==========

test('hesitation bar is hidden by default', async ({ page }) => {
  await loadPage(page);
  const bar = page.locator('#tasmeeHesitationBar');
  await expect(bar).toBeHidden();
});

// ========== 11. WEAK WORDS PILL ==========

test('weak words pill is hidden when no weak words exist', async ({ page }) => {
  await loadPage(page);
  const pill = page.locator('#weakWordsPill');
  await expect(pill).toBeHidden();
});

test('weak words sheet shows empty state when no words', async ({ page }) => {
  await loadPage(page);
  // Trigger proper openWeakWordSheet() which calls renderWeakWordsSheet()
  await page.evaluate(() => {
    if (window.openWeakWordSheet) {
      window.openWeakWordSheet();
    }
  });
  const emptyMsg = await page.locator('#wwdList .wwd-empty').count();
  expect(emptyMsg).toBe(1);
});

// ========== 12. VOICE SEARCH ENTRY ==========

test('voice search entry is hidden in search overlay by default', async ({ page }) => {
  await loadPage(page);
  const entry = page.locator('#voiceSearchEntry');
  await expect(entry).toBeHidden();
});

// ========== 13. LANGUAGE TOGGLE ==========

test('language toggle stores preference in localStorage', async ({ page }) => {
  await loadPage(page);
  // Default should be Arabic (set by initI18n on page load)
  const lang = await page.evaluate(() => localStorage.getItem('tasmee_lang'));
  expect(lang).toBe('ar');
  await page.click('#langToggleBtn');
  await page.waitForTimeout(200);
  const newLang = await page.evaluate(() => localStorage.getItem('tasmee_lang'));
  expect(newLang).toBe('en');
});

// ========== 14. LOCALSTORAGE SETTINGS ==========

test('settings persist to localStorage on dropdown change', async ({ page }) => {
  await loadPage(page);
  // Change mushaf version
  await page.selectOption('#mushafVersionSelect', 'tajweed');
  await page.waitForTimeout(200);
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem('quran_tasbeeh_settings');
    return raw ? JSON.parse(raw) : null;
  });
  expect(stored).not.toBeNull();
  expect(stored.musHafVersion).toBe('tajweed');
});

// ========== 15. AYAH MENU POPUP ==========

test('ayah menu exists with correct buttons', async ({ page }) => {
  await loadPage(page);
  const menu = page.locator('#ayahMenu');
  await expect(menu).toBeHidden();
  // Verify buttons exist
  expect(await page.locator('#playAyahBtn').count()).toBe(1);
  expect(await page.locator('#bookmarkAyahBtn').count()).toBe(1);
  expect(await page.locator('#tasmeeAyahBtn').count()).toBe(1);
});

// ========== 16. SHARE SESSION BUTTON ==========

test('share session button exists in tasmee results', async ({ page }) => {
  await loadPage(page);
  // Button exists inside #tasmeeResults (hidden by default) — check presence, not visibility
  const count = await page.locator('#shareSessionBtn').count();
  expect(count).toBe(1);
});

// ========== 17. NO JS ERRORS ON LOAD ==========

test('zero console errors during initialization', async ({ page }) => {
  await loadPage(page);
  const jsErrors = consoleErrors.filter(e =>
    !e.includes('404') &&
    !e.includes('Failed to load resource') &&
    !e.includes('font') &&
    !e.includes('favicon') &&
    !e.includes('googleapis')
  );
  expect(jsErrors, `Console errors:\n${jsErrors.join('\n')}`).toEqual([]);
});

// ========== 18. PAGE STRUCTURE ==========

test('page has correct RTL layout', async ({ page }) => {
  await loadPage(page);
  const dir = await page.locator('html').getAttribute('dir');
  expect(dir).toBe('rtl');
  const lang = await page.locator('html').getAttribute('lang');
  expect(lang).toBe('ar');
});

test('page has correct meta tags for SEO', async ({ page }) => {
  await loadPage(page);
  const description = await page.locator('meta[name="description"]').getAttribute('content');
  expect(description.length).toBeGreaterThan(20);
  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewport).toContain('maximum-scale=1.0');
});

// ========== 19. SCRIPT LOAD VERIFICATION ==========

test('expected JS modules are loaded (script tags exist)', async ({ page }) => {
  await loadPage(page);
  const scripts = await page.evaluate(() => {
    return [...document.querySelectorAll('script[src]')].map(s => s.getAttribute('src'));
  });
  expect(scripts).toContain('../js/tasmee-matcher.js');
  expect(scripts).toContain('../js/tasmee-store.js');
  expect(scripts).toContain('../js/i18n.js');
  // v2 uses inline locale definitions, not separate script files
  // tasmee-pro-v2.js should NOT be loaded (removed for v2)
  expect(scripts).not.toContain('../js/tasmee-pro-v2.js');
});

// ========== 20. CONSOLE FREE ==========

test('no unexpected console errors across all interactions', async ({ page }) => {
  await loadPage(page);
  // Perform a sequence of interactions
  await page.click('#menuToggleBtn');
  await page.waitForTimeout(200);
  await page.click('#menuCloseBtn');

  await page.click('#searchToggleBtn');
  await page.waitForTimeout(200);
  await page.click('#searchCloseBtn');

  await page.click('#bookmarkToggleBtn');
  await page.waitForTimeout(200);
  await page.click('#bookmarksCloseBtn');

  await page.click('#settingsToggleBtn');
  await page.waitForTimeout(200);
  await page.click('#settingsToggleBtn');

  await page.click('#tasmeeToggleBtn');
  await page.waitForTimeout(200);
  await page.click('#tasmeeToggleMainBtn');

  await page.click('#infoBtn');
  await page.waitForTimeout(200);
  await page.click('#infoModalClose');

  // Open and close weak word sheet via JS
  await page.evaluate(() => {
    var wwdBackdrop = document.getElementById('weakWordBackdrop');
    if (wwdBackdrop) wwdBackdrop.classList.add('open');
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    var wwdBackdrop = document.getElementById('weakWordBackdrop');
    if (wwdBackdrop) wwdBackdrop.classList.remove('open');
  });

  // Wait for any async operations
  await page.waitForTimeout(500);

  const jsErrors = consoleErrors.filter(e =>
    !e.includes('404') &&
    !e.includes('Failed to load resource') &&
    !e.includes('font') &&
    !e.includes('favicon') &&
    !e.includes('googleapis') &&
    !e.includes('mushaf') &&
    !e.includes('ERR_ABORTED')
  );
  expect(jsErrors, `Console errors after interactions:\n${jsErrors.join('\n')}`).toEqual([]);
});
