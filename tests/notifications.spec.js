const { test, expect } = require('@playwright/test');

// Headless Chromium denies Notification by default and the property is
// read-only, so we swap the entire constructor with a mock that reports
// "granted" and stores calls for later inspection.
async function mockNotifications(page) {
  await page.addInitScript(() => {
    const shown = [];
    window.__mockNotif = {
      shown,
      last()  { return shown[shown.length - 1] || null; },
      clear() { shown.length = 0; },
    };

    window.Notification = function Notification(title, options) {
      shown.push({ title, options });
      Object.assign(this, { title, ...options });
      this.close = () => {};
    };
    window.Notification.permission = 'granted';
    window.Notification.requestPermission = () => Promise.resolve('granted');
  });
}

test.describe('Notification System', () => {

  test('SW is registered and active on notifications page', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/pages/notifications.html');

    await page.waitForFunction(() => {
      return typeof NotificationSystem !== 'undefined'
        && NotificationSystem.swRegistration
        && NotificationSystem.swRegistration.active
        && NotificationSystem.swRegistration.active.state === 'activated';
    }, { timeout: 15000 });

    const swState = await page.evaluate(() => {
      const sw = NotificationSystem.swRegistration;
      return { registered: !!sw, activeState: sw?.active?.state || null };
    });
    expect(swState.registered).toBe(true);
    expect(swState.activeState).toBe('activated');
    expect(errors).toEqual([]);
  });

  test('showNotification via SW succeeds without errors', async ({ page }) => {
    await mockNotifications(page);

    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/pages/notifications.html');

    await page.waitForFunction(() => {
      return typeof NotificationSystem !== 'undefined'
        && NotificationSystem.swRegistration
        && NotificationSystem.swRegistration.active
        && NotificationSystem.swRegistration.active.state === 'activated';
    }, { timeout: 15000 });

    const result = await page.evaluate(async () => {
      const ok = await NotificationSystem.showNotification('Test Notification', {
        body: 'Test body',
        tag: 'test',
        forceQuiet: true,
        forceEnable: true,
        data: { url: './index.html', type: 'test' },
      });
      return { ok, error: NotificationSystem._lastError };
    });

    expect(result.ok).toBe(true);
    expect(result.error).toBeNull();
    expect(errors).toEqual([]);
  });

  test('testNotification button triggers no console errors', async ({ page }) => {
    await mockNotifications(page);

    const errors = [];
    const dialogs = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        // Chrome emits this in headless/incognito when Push API is used
        const t = msg.text();
        if (t.includes('Push API') || t.includes('incognito') || t.includes('crbug.com')) return;
        errors.push(t);
      }
    });
    page.on('pageerror', err => {
      const t = err.message || String(err);
      if (t.includes('Push API') || t.includes('incognito') || t.includes('crbug.com')) return;
      errors.push(t);
    });
    page.on('dialog', dialog => { dialogs.push(dialog.message()); dialog.accept(); });

    await page.goto('/pages/notifications.html');

    await page.waitForFunction(() => {
      return typeof NotificationSystem !== 'undefined'
        && NotificationSystem.swRegistration
        && NotificationSystem.swRegistration.active
        && NotificationSystem.swRegistration.active.state === 'activated';
    }, { timeout: 15000 });

    const testBtn = page.locator('button.btn-primary');
    await testBtn.click();
    await page.waitForTimeout(2000);

    expect(errors).toEqual([]);
    expect(dialogs.length).toBeGreaterThan(0);
    const last = dialogs[dialogs.length - 1];
    expect(last).toMatch(/نجاح|success|successfully|تم/i);
  });

  test('showNotification falls back to Notification API when SW fails', async ({ page }) => {
    await mockNotifications(page);

    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/pages/notifications.html');

    await page.waitForFunction(() => {
      return typeof NotificationSystem !== 'undefined'
        && NotificationSystem.swRegistration
        && NotificationSystem.swRegistration.active
        && NotificationSystem.swRegistration.active.state === 'activated';
    }, { timeout: 15000 });

    // Null the SW registration so showNotification falls through to
    // the Notification API fallback.
    const result = await page.evaluate(async () => {
      const orig = NotificationSystem.swRegistration;
      NotificationSystem.swRegistration = null;
      // Also clear active so the for-loop wait also bails:
      const ok = await NotificationSystem.showNotification('Fallback Test', {
        body: 'Fallback body',
        tag: 'test-fallback',
        forceQuiet: true,
        forceEnable: true,
      });
      NotificationSystem.swRegistration = orig;
      return { ok, error: NotificationSystem._lastError };
    });

    // Should succeed via the Notification API fallback
    expect(result.ok).toBe(true);
    expect(errors).toEqual([]);
  });
});
