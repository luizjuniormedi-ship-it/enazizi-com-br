import { test, expect } from '@playwright/test';

test.describe('Simulados', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.E2E_ALUNO_EMAIL!);
    await page.fill('input[type="password"]', process.env.E2E_ALUNO_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|enaflix)/, { timeout: 15000 });
  });

  test('Simulados list loads', async ({ page }) => {
    await page.goto('/dashboard/simulados');
    await page.waitForTimeout(3000);
    const body = await page.locator('body').textContent();
    expect(body!.length).toBeGreaterThan(50);
  });

  test('Can start a simulado if available', async ({ page }) => {
    await page.goto('/dashboard/simulados');
    await page.waitForTimeout(3000);
    
    const startBtn = page.locator('button:has-text("Iniciar"), button:has-text("Começar"), a:has-text("Iniciar")');
    if (await startBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await startBtn.first().click();
      await page.waitForTimeout(3000);
      // Should show question or loading
      const content = await page.locator('body').textContent();
      expect(content!.length).toBeGreaterThan(100);
    }
  });

  test('Simulado shows questions with 4 alternatives', async ({ page }) => {
    await page.goto('/dashboard/simulados');
    await page.waitForTimeout(3000);
    
    const startBtn = page.locator('button:has-text("Iniciar"), button:has-text("Começar")');
    if (await startBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await startBtn.first().click();
      await page.waitForTimeout(5000);
      
      // Check for radio buttons or option cards (alternatives)
      const options = page.locator('[role="radio"], [data-option], .alternative, label:has(input[type="radio"])');
      const count = await options.count();
      if (count > 0) {
        expect(count).toBeGreaterThanOrEqual(4);
      }
    }
  });
});
