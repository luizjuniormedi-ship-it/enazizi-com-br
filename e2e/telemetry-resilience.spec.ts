import { test, expect } from '@playwright/test';

test.describe('ENAZIZI — CORS & Telemetry Resilience', () => {
  test('should render mnemonic even if telemetry fails (CORS Resilience)', async ({ page }) => {
    // Intercept pedagogical-event-consumer to simulate CORS error or failure
    await page.route('**/functions/v1/pedagogical-event-consumer', route => {
      // Return a response without CORS headers to simulate the policy block
      route.fulfill({
        status: 200,
        headers: {
          // Missing Access-Control-Allow-Origin
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: true })
      });
    });

    // Navigate to mnemonic page with auto=1
    await page.goto('/dashboard/mnemonico?tema=Hipertensao&auto=1');
    
    // Check if mnemonic is generated and rendered
    // If telemetry failure was blocking, the result would never be set or the UI would freeze
    await page.waitForSelector('[data-testid="mnemonic-display"]', { timeout: 60000 });
    
    const mnemonic = page.locator('[data-testid="mnemonic-sigla"]');
    await expect(mnemonic).not.toBeEmpty();
    
    console.log('[PLAYWRIGHT_VALIDATION] Mnemonic rendered successfully despite telemetry intercept.');
  });

  test('should not have console errors for CORS in normal flow', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().includes('CORS')) {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/dashboard/mnemonico?tema=Diabetes&auto=1');
    await page.waitForSelector('[data-testid="mnemonic-display"]', { timeout: 60000 });

    // Ensure no CORS errors in console
    expect(consoleErrors.length).toBe(0);
    console.log('[PLAYWRIGHT_VALIDATION] No CORS errors detected in console.');
  });
});
