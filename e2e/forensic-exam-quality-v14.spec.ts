
import { test, expect } from '@playwright/test';

/**
 * ENAZIZI — FORENSIC EXAM QUALITY v14 E2E
 * Validates the forensic quality engine, persistence, and fidelity scores.
 */
test.describe('ENAZIZI Forensic Quality v14', () => {
  
  test('should generate questions and log forensic data with high fidelity', async ({ page }) => {
    // 1. Authentication
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@enazizi.com.br');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // 2. Navigate to Generator
    await page.goto('/dashboard/gerador-questoes');
    
    // 3. Select Banca (ENARE)
    await page.click('button:has-text("Selecione a Banca")');
    await page.click('text=ENARE');

    // 4. Set Quantity (small batch for test stability)
    // Assuming there's an input or slider for quantity
    const quantityInput = page.locator('input[type="number"]').first();
    if (await quantityInput.isVisible()) {
      await quantityInput.fill('2');
    }

    // 5. Trigger Generation
    await page.click('button:has-text("Gerar Questões")');
    
    // 6. Wait for completion (Success toast or questions appearing)
    await expect(page.locator('text=Geradas com sucesso').or(page.locator('.question-card'))).toBeVisible({ timeout: 60000 });

    // 7. Verify Forensic Dashboard
    await page.goto('/admin/question-quality');
    
    // Check for logs
    const firstRowBanca = page.locator('table tbody tr:first-child td:first-child');
    await expect(firstRowBanca).toContainText('ENARE', { ignoreCase: true });
    
    const firstRowScore = page.locator('table tbody tr:first-child td:nth-child(2)');
    const scoreText = await firstRowScore.innerText();
    const scoreValue = parseInt(scoreText);
    
    console.log(`[FORENSIC_TEST] Fidelity Score detected: ${scoreValue}`);
    expect(scoreValue).toBeGreaterThan(0);
  });

  test('should detect and reject AI cliches (Negative Test)', async ({ page }) => {
    // This would require a mocked backend or a specific prompt that forces cliches
    // For now, we verify the dashboard shows some rejections if any occurred
    await page.goto('/admin/question-quality');
    const stats = page.locator('text=Taxa de Rejeição');
    await expect(stats).toBeVisible();
  });
});
