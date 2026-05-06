import { test, expect } from '@playwright/test';

/**
 * E2E tests for the Professor Simulado Creation Dialog.
 * Tests positioning, dragging, accessibility and full flow.
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
    const openBtn = page.getByRole('button', { name: /NOVO SIMULADO/i });
    await openBtn.click();
    
    // 4. Validate Dialog is open and at the top
    const dialog = page.getByTestId('create-simulado-dialog');
    await expect(dialog).toBeVisible();
    
    // Confirm it's always in DOM even if hidden (Radix standard)
    // but the test specifically checks for visibility.
    
    const boundingBox = await dialog.boundingBox();
    expect(boundingBox).not.toBeNull();
    // Initially should be at top-6 (approx 24px)
    expect(boundingBox!.y).toBeLessThan(100);
    
    // 5. Drag the dialog by the header
    const header = page.getByTestId('dialog-header');
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
    const closeBtn = page.getByRole('button', { name: /Close/i });
    await closeBtn.click();
    await expect(dialog).not.toBeVisible();
  });

  test('Create Simulado full flow validation', async ({ page }) => {
    await page.goto('/professor');
    await page.getByRole('button', { name: /NOVO SIMULADO/i }).click();
    
    const dialog = page.getByTestId('create-simulado-dialog');
    await expect(dialog).toBeVisible();
    
    // 1. Fill basic info
    const titleInput = page.getByPlaceholder('Nome do simulado');
    await titleInput.fill('Simulado E2E ' + Date.now());
    
    const descInput = page.getByPlaceholder(/Instruções/i);
    await descInput.fill('Descrição do simulado E2E');
    
    // 2. Configure questions (Manual mode for stability)
    await page.getByRole('button', { name: /Criar Manual/i }).click();
    
    const statementInput = page.getByPlaceholder(/Enunciado/i);
    await statementInput.fill('Qual a capital do Brasil?');
    
    const options = page.locator('input[placeholder^="Opção"]');
    await options.nth(0).fill('Brasília');
    await options.nth(1).fill('Rio de Janeiro');
    
    await page.getByRole('button', { name: /Adicionar Questão/i }).click();
    
    // 3. Confirm button "CRIAR E ATRIBUIR" is enabled
    const submitBtn = page.getByRole('button', { name: /CRIAR E ATRIBUIR/i });
    await expect(submitBtn).toBeEnabled();
    
    // 4. Click submit and check loading
    await submitBtn.click();
    await expect(page.getByText(/CRIANDO/i)).toBeVisible();
    
    // 5. Wait for success and dialog close
    await expect(dialog).not.toBeVisible({ timeout: 15000 });
    
    // 6. Confirm success toast or listing update
    await expect(page.getByText(/Simulado criado/i)).toBeVisible();
  });
});
