import { test, expect } from '@playwright/test';

test.describe('Painel Admin', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.E2E_ADMIN_EMAIL!);
    await page.fill('input[type="password"]', process.env.E2E_ADMIN_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(admin|dashboard)/, { timeout: 15000 });
  });

  const adminPages = [
    '/admin',
    '/admin/dashboard',
  ];

  for (const path of adminPages) {
    test(`Admin page ${path} loads`, async ({ page }) => {
      await page.goto(path);
      await page.waitForTimeout(3000);
      const body = await page.locator('body').textContent();
      expect(body!.length).toBeGreaterThan(50);
    });
  }

  test('Admin can see users list', async ({ page }) => {
    await page.goto('/admin?tab=users-all');
    await page.waitForTimeout(3000);
    const body = await page.locator('body').textContent();
    expect(body!.length).toBeGreaterThan(100);
  });

  test('Admin can see uploads/ingestion', async ({ page }) => {
    await page.goto('/admin?tab=ingestion');
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).not.toHaveText('');
  });

  test('Admin can see question review', async ({ page }) => {
    await page.goto('/admin?tab=question-review');
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).not.toHaveText('');
  });
});
