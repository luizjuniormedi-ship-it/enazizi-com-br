import { test, expect, devices } from '@playwright/test';

test.describe('Mobile Responsiveness', () => {
  test.use({ ...devices['iPhone 14'] });

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.E2E_ALUNO_EMAIL!);
    await page.fill('input[type="password"]', process.env.E2E_ALUNO_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|enaflix)/, { timeout: 15000 });
  });

  test('Mobile nav bar is visible', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);
    const nav = page.locator('nav.fixed, nav[class*="bottom"]');
    await expect(nav).toBeVisible();
  });

  test('Dashboard is usable on mobile', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);
    
    // No horizontal scroll
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });

  test('Tutor IA is usable on mobile', async ({ page }) => {
    await page.goto('/dashboard/sessao-estudo');
    await page.waitForTimeout(3000);
    
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });

  test('Simulados page is usable on mobile', async ({ page }) => {
    await page.goto('/dashboard/simulados');
    await page.waitForTimeout(2000);
    
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });

  test('Flashcards page is usable on mobile', async ({ page }) => {
    await page.goto('/dashboard/flashcards');
    await page.waitForTimeout(2000);
    
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });

  test('Login page is usable on mobile', async ({ page }) => {
    await page.goto('/login');
    await page.waitForTimeout(1000);
    
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });
});
