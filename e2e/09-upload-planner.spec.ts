import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Upload & Planner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.E2E_ALUNO_EMAIL!);
    await page.fill('input[type="password"]', process.env.E2E_ALUNO_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|enaflix)/, { timeout: 15000 });
  });

  test('Uploads page loads', async ({ page }) => {
    await page.goto('/dashboard/uploads');
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).not.toHaveText('');
  });

  test('Upload area is visible', async ({ page }) => {
    await page.goto('/dashboard/uploads');
    await page.waitForTimeout(3000);
    
    const uploadArea = page.locator('input[type="file"], [data-testid="upload"], button:has-text("Upload"), button:has-text("Enviar")');
    expect(await uploadArea.count()).toBeGreaterThan(0);
  });

  test('Planner page loads', async ({ page }) => {
    await page.goto('/dashboard/planner');
    await page.waitForTimeout(3000);
    const body = await page.locator('body').textContent();
    expect(body!.length).toBeGreaterThan(50);
  });

  test('Planner shows calendar or task list', async ({ page }) => {
    await page.goto('/dashboard/planner');
    await page.waitForTimeout(3000);
    
    // Should have some interactive elements
    const elements = page.locator('button, [role="checkbox"], [role="tab"]');
    expect(await elements.count()).toBeGreaterThan(2);
  });

  test('Cronograma page loads', async ({ page }) => {
    await page.goto('/dashboard/cronograma');
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).not.toHaveText('');
  });
});
