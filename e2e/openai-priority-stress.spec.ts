
import { test, expect } from '@playwright/test';

/**
 * ENAZIZI — OpenAI Priority & Resilience Stress Test (v10)
 * Validates the primary OpenAI route and fallback reliability under load.
 */

test.describe('ENAZIZI AI Gateway Hardening v10', () => {
  test.setTimeout(600000); // 10 minutes for 20 iterations

  test('Mnemonic Generation — 20 Iterations Stress Test', async ({ page }) => {
    // 1. LOGIN
    await page.goto('https://enazizi.com/login');
    await page.fill('input[type="email"]', 'admin@enazizi.com.br');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);

    const topics = [
      "Critérios de Light",
      "Escala de Glasgow",
      "Tríade de Charcot",
      "Critérios de Duke",
      "Sinais de Appendicite"
    ];

    for (let i = 1; i <= 20; i++) {
      const topic = topics[i % topics.length];
      console.log(`[ITERATION ${i}/20] Testing Topic: ${topic}`);

      // Navigate with auto-trigger
      await page.goto(`https://enazizi.com/dashboard/mnemonico?tema=${encodeURIComponent(topic)}&auto=1`);

      // Wait for result or error/static fallback
      // v10 Requirement: Should never be a white screen or infinite spinner
      const result = page.locator('[data-testid="mnemonic-phrase"], [data-testid="mnemonic-sigla"], [data-testid="mnemonic-association"]').first();
      
      try {
        await expect(result).toBeVisible({ timeout: 45000 });
        console.log(`[SUCCESS] Iteration ${i} rendered correctly.`);
      } catch (err) {
        // Check if it's a known fallback or error card
        const errorCard = page.locator('[data-testid="mnemonic-error"]');
        if (await errorCard.isVisible()) {
          console.error(`[FAIL] Iteration ${i} showed error card.`);
          throw new Error(`Critical stability failure on iteration ${i}`);
        }
        console.error(`[TIMEOUT] Iteration ${i} timed out.`);
        throw err;
      }

      // Evidential Screenshot every 5 iterations
      if (i % 5 === 0) {
        await page.screenshot({ path: `e2e/evidencias/stress-v10-iter-${i}.png` });
      }
    }

    console.log('STRESS TEST V10 COMPLETED: 20/20 PASSES');
  });
});
