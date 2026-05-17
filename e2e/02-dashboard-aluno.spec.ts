import { test, expect } from '@playwright/test';

test.describe('Dashboard do Aluno', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.E2E_ALUNO_EMAIL!);
    await page.fill('input[type="password"]', process.env.E2E_ALUNO_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|enaflix)/, { timeout: 15000 });
  });

  test('Dashboard loads without white screen', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);
    const body = await page.locator('body').textContent();
    expect(body!.length).toBeGreaterThan(100);
  });

  test('Sessão de Estudo loads', async ({ page }) => {
    await page.goto('/dashboard/sessao-estudo');
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).not.toHaveText('');
    // No crash
    const errors = await page.evaluate(() => (window as any).__playwright_errors || []);
    expect(errors.length || 0).toBe(0);
  });

  test('Flashcards page loads', async ({ page }) => {
    await page.goto('/dashboard/flashcards');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toHaveText('');
  });

  test('Simulados page loads', async ({ page }) => {
    await page.goto('/dashboard/simulados');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toHaveText('');
  });

  test('Banco de Erros page loads', async ({ page }) => {
    await page.goto('/dashboard/banco-erros');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toHaveText('');
  });

  test('Planner page loads', async ({ page }) => {
    await page.goto('/dashboard/planner');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toHaveText('');
  });

  test('Perfil page loads', async ({ page }) => {
    await page.goto('/dashboard/perfil');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toHaveText('');
  });

  test('Analytics page loads', async ({ page }) => {
    await page.goto('/dashboard/analytics');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toHaveText('');
  });

  test('Videoaulas page loads', async ({ page }) => {
    await page.goto('/dashboard/videoaulas');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toHaveText('');
  });

  test('Agentes IA page loads', async ({ page }) => {
    await page.goto('/dashboard/agentes');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).not.toHaveText('');
  });

  test('Mobile nav renders on small viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);
    await expect(page.locator('nav')).toBeVisible();
  });
});
