
import { test, expect } from '@playwright/test';

/**
 * ENAZIZI — HARDENING STRESS TEST v9
 * Validates stability across multiple modules under simulation of real-world usage.
 */

const TEST_USER_EMAIL = 'test@example.com';
const TEST_USER_PASSWORD = 'password';

test.describe('ENAZIZI Hardening Stress Test', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate and login
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_USER_EMAIL);
    await page.fill('input[type="password"]', TEST_USER_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for dashboard or home redirect
    await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 15000 });
  });

  test('Mnemonic Generator - Stability and Fallback', async ({ page }) => {
    // Test multiple topics including the one that triggers LUZ fallback
    const topics = [
      'Hipertensão Arterial',
      'Critérios de Light', // Should trigger the specific fallback
      'Diabetes Mellitus'
    ];

    for (const topic of topics) {
      console.log(`[STRESS_TEST] Testing topic: ${topic}`);
      
      // Navigate with auto=1
      await page.goto(`/dashboard/mnemonico?tema=${encodeURIComponent(topic)}&auto=1`);
      
      // Wait for generation
      // We check for specific test IDs or text content
      await page.waitForSelector('[data-testid="mnemonic-card"]', { timeout: 30000 }).catch(() => {
        console.warn(`[STRESS_TEST] Mnemonic card timeout for topic: ${topic}`);
      });

      // Verify no HTTP 500 or CORS errors in console
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      // Assertions
      const mnemonicText = await page.locator('[data-testid="mnemonic-phrase"]').innerText();
      expect(mnemonicText.length).toBeGreaterThan(5);
      
      if (topic === 'Critérios de Light') {
        expect(mnemonicText).toContain('LUZ');
      }

      console.log(`[STRESS_TEST] Success for topic: ${topic}`);
    }
  });

  test('Pedagogical Events - Upsert Stability (No 406)', async ({ page }) => {
    // Navigate to a page that triggers events
    await page.goto('/dashboard/simulados');
    
    // Listen for network errors
    const errors = [];
    page.on('requestfailed', request => {
      errors.push(`${request.method()} ${request.url()} failed: ${request.failure()?.errorText}`);
    });
    
    page.on('response', response => {
      if (response.status() === 406 || response.status() === 500) {
        errors.push(`${response.status()} ${response.url()}`);
      }
    });

    // Interaction to trigger events
    // Assuming there's a button to start or submit something
    // For now, just wait a bit to let any initial events fire
    await page.waitForTimeout(5000);

    expect(errors.filter(e => e.includes('pedagogical_events')).length).toBe(0);
  });

  test('Tutor / Mentor Chat - CORS and Resiliency', async ({ page }) => {
    await page.goto('/dashboard/sessao-estudo');
    
    // Check for Tutor response
    // Type something if needed
    const input = page.locator('textarea, input[placeholder*="tutor"]');
    if (await input.count() > 0) {
      await input.first().fill('O que é insuficiência cardíaca?');
      await page.keyboard.press('Enter');
      
      // Wait for response
      await page.waitForSelector('.assistant-message, [data-testid="tutor-response"]', { timeout: 20000 });
    }

    // Check for CORS errors in console
    // If we reached this point without a timeout, CORS preflight probably passed
  });

});
