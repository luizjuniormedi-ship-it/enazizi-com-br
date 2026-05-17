import { test, expect } from '@playwright/test';

test.describe('Autenticação', () => {
  test('Login page renders correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('Register page renders correctly', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('Login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'invalid@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await expect(page.locator('[role="alert"], .text-destructive, [data-sonner-toast]')).toBeVisible({ timeout: 10000 });
  });

  test('Login with valid credentials redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.E2E_ALUNO_EMAIL!);
    await page.fill('input[type="password"]', process.env.E2E_ALUNO_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|enaflix)/, { timeout: 15000 });
    expect(page.url()).toMatch(/\/(dashboard|enaflix)/);
  });

  test('Forgot password page works', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('Logout works', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.E2E_ALUNO_EMAIL!);
    await page.fill('input[type="password"]', process.env.E2E_ALUNO_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|enaflix)/, { timeout: 15000 });
    
    // Find and click logout
    const logoutBtn = page.locator('button:has-text("Sair"), [aria-label="Sair"], [data-testid="logout"]');
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await page.waitForURL(/\/(login|auth|\/)/, { timeout: 10000 });
    }
  });

  test('Unauthenticated user is redirected from dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/(login|auth)/, { timeout: 10000 });
  });

  test('Aluno cannot access /admin', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.E2E_ALUNO_EMAIL!);
    await page.fill('input[type="password"]', process.env.E2E_ALUNO_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|enaflix)/, { timeout: 15000 });
    
    await page.goto('/admin');
    // Should redirect away or show access denied
    await page.waitForTimeout(3000);
    expect(page.url()).not.toContain('/admin/dashboard');
  });

  test('Aluno cannot access /professor', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.E2E_ALUNO_EMAIL!);
    await page.fill('input[type="password"]', process.env.E2E_ALUNO_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|enaflix)/, { timeout: 15000 });
    
    await page.goto('/professor');
    await page.waitForTimeout(3000);
    expect(page.url()).not.toMatch(/\/professor\/(dashboard|turmas)/);
  });
});
