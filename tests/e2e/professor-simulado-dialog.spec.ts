import { test, expect } from '@playwright/test';

/**
 * E2E tests for the Professor Simulado Creation Dialog.
 * Tests positioning, dragging, and accessibility.
 */
test.describe('Professor Simulado Creation Dialog E2E', () => {
  
  test.beforeEach(async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    
    const email = process.env.E2E_USER_EMAIL;
    const password = process.env.E2E_USER_PASSWORD;
    
    if (email && password) {
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', password);
      await page.click('button:has-text("Entrar"), button:has-text("ENTRAR")');
      await expect(page).not.toHaveURL(/.*login.*/);
    }
  });

  test('Create Simulado Dialog positioning and interaction', async ({ page }) => {
    // 2. Navigate to Professor Dashboard
    await page.goto('/professor');
    
    // 3. Click "NOVO SIMULADO"
    const openBtn = page.getByText(/NOVO SIMULADO/i);
    await openBtn.click();
    
    // 4. Validate Dialog is open and at the top
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    
    const boundingBox = await dialog.boundingBox();
    expect(boundingBox).not.toBeNull();
    // Initially should be at top-6 (approx 24px)
    expect(boundingBox!.y).toBeLessThan(100);
    
    // 5. Drag the dialog by the header
    const header = dialog.locator('header');
    const startX = boundingBox!.x + boundingBox!.width / 2;
    const startY = boundingBox!.y + 20; // Click near the top of the header
    
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 100, startY + 50);
    await page.mouse.up();
    
    const newBox = await dialog.boundingBox();
    expect(newBox!.x).toBeGreaterThan(boundingBox!.x);
    expect(newBox!.y).toBeGreaterThan(boundingBox!.y);
    
    // 6. Test accessibility: Close with ESC
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    
    // 7. Reopen and close with X button
    await openBtn.click();
    await expect(dialog).toBeVisible();
    const closeBtn = dialog.locator('button:has-text("Close"), .sr-only:has-text("Close")').locator('..');
    await closeBtn.click();
    await expect(dialog).not.toBeVisible();
  });

  test('Create Simulado Dialog internal scrolling and footer visibility', async ({ page }) => {
    await page.goto('/professor');
    await page.getByText(/NOVO SIMULADO/i).click();
    
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    
    // Fill title to ensure form is interactable
    const titleInput = dialog.locator('input[placeholder="Nome do simulado"]');
    await titleInput.fill('Simulado E2E Test');
    
    // Scroll the body
    const scrollableBody = dialog.locator('.overflow-y-auto');
    await scrollableBody.evaluate((el) => el.scrollTop = 500);
    
    // Footer should still be visible and fixed
    const footer = dialog.locator('footer');
    await expect(footer).toBeVisible();
    
    // Check if footer stayed at bottom (approx)
    const dialogBox = await dialog.boundingBox();
    const footerBox = await footer.boundingBox();
    expect(footerBox!.y + footerBox!.height).toBeCloseTo(dialogBox!.y + dialogBox!.height, 1);
  });
});
