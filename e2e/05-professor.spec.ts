import { test, expect } from '@playwright/test';

test.describe('Painel do Professor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.E2E_PROFESSOR_EMAIL!);
    await page.fill('input[type="password"]', process.env.E2E_PROFESSOR_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(professor|dashboard)/, { timeout: 15000 });
  });

  test('Professor dashboard loads', async ({ page }) => {
    await page.goto('/professor');
    await page.waitForTimeout(3000);
    const body = await page.locator('body').textContent();
    expect(body!.length).toBeGreaterThan(50);
  });

  test('Turmas page loads', async ({ page }) => {
    await page.goto('/professor/turmas');
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).not.toHaveText('');
  });

  test('Alunos page loads', async ({ page }) => {
    await page.goto('/professor/alunos');
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).not.toHaveText('');
  });

  test('Questões page loads', async ({ page }) => {
    await page.goto('/professor/questoes');
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).not.toHaveText('');
  });

  test('Simulados page loads', async ({ page }) => {
    await page.goto('/professor/simulados');
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).not.toHaveText('');
  });

  test('Relatórios page loads', async ({ page }) => {
    await page.goto('/professor/relatorios');
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).not.toHaveText('');
  });

  test('Materiais page loads', async ({ page }) => {
    await page.goto('/professor/materiais');
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).not.toHaveText('');
  });

  test('Professor cannot access /admin', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForTimeout(3000);
    expect(page.url()).not.toContain('/admin/dashboard');
  });

  test('Criar simulado flow', async ({ page }) => {
    await page.goto('/professor/simulados');
    await page.waitForTimeout(2000);
    
    const createBtn = page.locator('button:has-text("Criar"), button:has-text("Novo")');
    if (await createBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await createBtn.first().click();
      await page.waitForTimeout(2000);
      // Modal or page should appear
      const dialog = page.locator('[role="dialog"], form, .modal');
      await expect(dialog.first()).toBeVisible({ timeout: 5000 });
    }
  });
});
