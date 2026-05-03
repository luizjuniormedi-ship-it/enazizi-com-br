import { test, expect } from '@playwright/test';

test.describe('Tutor Video Recommendation System', () => {
  test.beforeEach(async ({ page }) => {
    // Login flow is usually handled in global setup, but ensure we are on the right page
    await page.goto('/tutor-ia');
  });

  test('Recommend video for Pericardite', async ({ page }) => {
    const input = page.locator('textarea[placeholder*="Pergunte"]');
    await input.fill('me explica pericardite');
    await page.keyboard.press('Enter');

    // Wait for AI response and card
    const videoCard = page.locator('text=Recomendação ENAFLIX');
    await expect(videoCard).toBeVisible({ timeout: 15000 });
    
    // Check if the title mentions Pericardite
    await expect(page.locator('text=Pericardite')).toBeVisible();
    
    // Test click and navigation
    const watchButton = page.locator('text=Assistir Agora');
    await watchButton.click();
    
    // Should navigate to video lesson page
    await expect(page).toHaveURL(/\/dashboard\/videoaulas\/.+/);
  });

  test('Recommend video for FA (Fibrilação Atrial)', async ({ page }) => {
    const input = page.locator('textarea[placeholder*="Pergunte"]');
    await input.fill('o que é FA?');
    await page.keyboard.press('Enter');

    const videoCard = page.locator('text=Recomendação ENAFLIX');
    await expect(videoCard).toBeVisible({ timeout: 15000 });
    
    // Should match Fibrilação Atrial through synonyms
    await expect(page.locator('text=Fibrilação Atrial')).toBeVisible();
  });

  test('No video for non-existing medical topic', async ({ page }) => {
    const input = page.locator('textarea[placeholder*="Pergunte"]');
    await input.fill('quem descobriu o brasil?');
    await page.keyboard.press('Enter');

    // Recommendation card should NOT appear
    const videoCard = page.locator('text=Recomendação ENAFLIX');
    await expect(videoCard).not.toBeVisible({ timeout: 5000 });
  });

  test('Telemetria persistence check', async ({ page }) => {
    // This would require checking the DB or an admin panel
    // In a real E2E, we could check network requests to ensure telemetry was sent
    const telemetryRequest = page.waitForRequest(request => 
      request.url().includes('tutor_video_recommendation_telemetry') && request.method() === 'POST'
    );
    
    const input = page.locator('textarea[placeholder*="Pergunte"]');
    await input.fill('IAM');
    await page.keyboard.press('Enter');
    
    const request = await telemetryRequest;
    expect(request).toBeDefined();
  });
});
