import { test, expect } from '@playwright/test';

test.describe('Performance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.E2E_ALUNO_EMAIL!);
    await page.fill('input[type="password"]', process.env.E2E_ALUNO_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|enaflix)/, { timeout: 15000 });
  });

  test('Dashboard loads in under 5 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  test('Tutor IA loads in under 5 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/dashboard/sessao-estudo');
    await page.waitForLoadState('networkidle');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  test('Simulados loads in under 5 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/dashboard/simulados');
    await page.waitForLoadState('networkidle');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  test('No excessive bundle size (main chunk < 2MB)', async ({ page }) => {
    const responses: { url: string; size: number }[] = [];
    page.on('response', async (response) => {
      if (response.url().includes('.js') && response.status() === 200) {
        const body = await response.body().catch(() => Buffer.alloc(0));
        responses.push({ url: response.url(), size: body.length });
      }
    });
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    for (const r of responses) {
      // No single JS chunk should exceed 2MB
      expect(r.size).toBeLessThan(2 * 1024 * 1024);
    }
  });

  test('Landing page loads in under 3 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(3000);
  });
});
