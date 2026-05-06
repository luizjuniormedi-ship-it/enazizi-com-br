import { test, expect } from '@playwright/test';

/**
 * E2E tests for the Tutor IA (AIMentor) module.
 */
test.describe('Tutor IA Module E2E', () => {
  
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

  test('Navigate to Tutor and ensure no runtime errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (text.includes('ReferenceError') || text.includes('TypeError') || text.includes('Runtime Error')) {
          consoleErrors.push(text);
        }
      }
    });

    page.on('response', response => {
      if (response.status() >= 500) {
        consoleErrors.push(`Server error 500 on ${response.url()}`);
      }
    });

    // 2. Abrir Tutor
    await page.goto('/dashboard/mentor');
    
    // Confirm page loaded
    await expect(page.getByTestId('tutor-page')).toBeVisible({ timeout: 15000 });
    
    // Confirm no critical console errors
    expect(consoleErrors).toHaveLength(0);
  });

  test('Send a pedagogical mission message and verify AI response', async ({ page }) => {
    await page.goto('/dashboard/mentor');
    
    // Wait for the hero/start screen
    await expect(page.getByText(/O que vamos dominar hoje/i)).toBeVisible();
    
    // 3. Enviar mensagem
    const input = page.locator('input[placeholder*="Duke"]');
    await input.fill('Protocolo de Sepse');
    await page.click('button:has-text("Estudar Agora")');
    
    // Wait for cinematic loading and transition to chat
    await expect(page.getByTestId('agent-input')).toBeVisible({ timeout: 30000 });
    
    // Wait for first AI response
    // We expect the pedagogical hero to appear
    await expect(page.getByTestId('pedagogical-hero')).toBeVisible({ timeout: 60000 });
    
    // Check if progress is tracked
    const progress = page.getByTestId('pedagogical-hero').locator('.text-primary');
    await expect(progress).toBeVisible();
    
    // Confirm AI response text is appearing
    await expect(page.locator('.prose')).first().toBeVisible();
  });

  test('Quick actions work correctly', async ({ page }) => {
    await page.goto('/dashboard/mentor');
    
    // Send a message first to get into the chat if needed, 
    // or use the ones on the hero if they exist.
    // AIMentor.tsx has suggestions: ["ECG na Emergência", "Protocolo de Sepse", ...]
    
    const suggestion = page.getByText('ECG na Emergência');
    await expect(suggestion).toBeVisible();
    await suggestion.click();
    
    // Verify it transitions to chat
    await expect(page.getByTestId('agent-input')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('pedagogical-hero')).toBeVisible({ timeout: 60000 });
  });

});
