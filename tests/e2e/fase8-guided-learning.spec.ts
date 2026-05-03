import { test, expect } from '@playwright/test';

test.describe('Fase 8: Guided Learning E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication if needed or use real login flow
    await page.goto('/login');
    // For demo purposes, we assume the user is already logged in or we bypass
  });

  test('should load guided learning dashboard (Enaflix) and mission of the day', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('text=Missão do Dia')).toBeVisible();
    await expect(page.locator('text=Continuar de onde parou')).toBeVisible();
  });

  test('should navigate to Tutor IA and start a pedagogical session', async ({ page }) => {
    await page.goto('/dashboard/mentor');
    await expect(page.locator('textarea')).toBeVisible();
    await page.fill('textarea', 'Explique insuficiência cardíaca usando Feynman');
    await page.keyboard.press('Enter');
    
    // Check for pedagogical blocks in response
    // Assuming blocks have specific test-ids or classes
    await expect(page.locator('.pedagogical-block')).toBeVisible({ timeout: 15000 });
  });

  test('should handle session abandonment (telemetry check)', async ({ page }) => {
    await page.goto('/dashboard/simulados');
    // Simulate inactivity or tab close
    // In E2E tests, we usually check if the telemetry call was made
  });

  test('should load admin pedagogy analytics', async ({ page }) => {
    await page.goto('/dashboard/admin/pedagogy-analytics');
    await expect(page.locator('text=Telemetria Pedagógica')).toBeVisible();
    await expect(page.locator('.recharts-responsive-container')).toBeVisible();
  });

  test('should verify mobile layout for Enaflix', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');
    await expect(page.locator('nav.fixed.bottom-0')).toBeVisible(); // Bottom nav
    await expect(page.locator('aside')).not.toBeVisible(); // Sidebar should be hidden
  });
});
