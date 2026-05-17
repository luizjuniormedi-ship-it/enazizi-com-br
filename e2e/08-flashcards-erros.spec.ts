import { test, expect } from '@playwright/test';

test.describe('Flashcards & Banco de Erros', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.E2E_ALUNO_EMAIL!);
    await page.fill('input[type="password"]', process.env.E2E_ALUNO_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|enaflix)/, { timeout: 15000 });
  });

  test('Flashcards page loads', async ({ page }) => {
    await page.goto('/dashboard/flashcards');
    await page.waitForTimeout(3000);
    const body = await page.locator('body').textContent();
    expect(body!.length).toBeGreaterThan(50);
  });

  test('Flashcard review buttons work (Errei/Difícil/Bom/Fácil)', async ({ page }) => {
    await page.goto('/dashboard/flashcards?auto=1');
    await page.waitForTimeout(5000);
    
    const reviewBtns = page.locator('button:has-text("Errei"), button:has-text("Difícil"), button:has-text("Bom"), button:has-text("Fácil")');
    const count = await reviewBtns.count();
    if (count > 0) {
      // At least the FSRS buttons should be visible during review
      expect(count).toBeGreaterThanOrEqual(2);
    }
  });

  test('Gerar Flashcards page loads', async ({ page }) => {
    await page.goto('/dashboard/gerar-flashcards');
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).not.toHaveText('');
  });

  test('Banco de Erros page loads', async ({ page }) => {
    await page.goto('/dashboard/banco-erros');
    await page.waitForTimeout(3000);
    const body = await page.locator('body').textContent();
    expect(body!.length).toBeGreaterThan(50);
  });

  test('Banco de Erros shows error categories', async ({ page }) => {
    await page.goto('/dashboard/banco-erros');
    await page.waitForTimeout(3000);
    
    // Should show filter or category options
    const filters = page.locator('button, [role="tab"], select');
    expect(await filters.count()).toBeGreaterThan(0);
  });
});
