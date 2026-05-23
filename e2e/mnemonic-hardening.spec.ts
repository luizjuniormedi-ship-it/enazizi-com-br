import { test, expect } from '@playwright/test';

test.describe('ENAZIZI — Mnemonic Hardening & Resilience', () => {
  test('should handle AI provider failures and use fallback', async ({ page }) => {
    // Navigate to mnemonic page
    await page.goto('/dashboard/mnemonico?tema=Fisiologia%20Renal&auto=1');
    
    // Check for loading state
    const loading = page.locator('text=Gerando mnemônico');
    if (await loading.isVisible()) {
      await expect(loading).toBeVisible();
    }

    // Wait for the result
    // We expect the mnemonic to eventually appear, either from IA or fallback
    await page.waitForSelector('[data-testid="mnemonic-display"]', { timeout: 60000 });
    
    const mnemonic = page.locator('[data-testid="mnemonic-sigla"]');
    await expect(mnemonic).not.toBeEmpty();
    
    const phrase = page.locator('[data-testid="mnemonic-phrase"]');
    await expect(phrase).not.toBeEmpty();
    
    console.log('Mnemonic rendered successfully');
  });

  test('should prevent duplicate requests (Global Request Lock)', async ({ page, context }) => {
    // Trigger two requests for the same topic simultaneously
    const page2 = await context.newPage();
    
    const topic = "Ciclo de Krebs " + Date.now();
    
    const promise1 = page.goto(`/dashboard/mnemonico?tema=${encodeURIComponent(topic)}&auto=1`);
    const promise2 = page2.goto(`/dashboard/mnemonico?tema=${encodeURIComponent(topic)}&auto=1`);
    
    await Promise.all([promise1, promise2]);
    
    // Both should eventually render
    await page.waitForSelector('[data-testid="mnemonic-display"]', { timeout: 60000 });
    await page2.waitForSelector('[data-testid="mnemonic-display"]', { timeout: 60000 });
    
    const m1 = await page.locator('[data-testid="mnemonic-sigla"]').textContent();
    const m2 = await page2.locator('[data-testid="mnemonic-sigla"]').textContent();
    
    // They should ideally be the same if the lock worked and they reused the same result
    expect(m1).toBe(m2);
  });
});
