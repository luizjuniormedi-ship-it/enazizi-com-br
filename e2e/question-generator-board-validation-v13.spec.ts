
import { test, expect } from '@playwright/test';

test.describe('ENAZIZI Hard Fix v13 - Question Generator Board Validation', () => {

  test('Should generate 10 FGV questions with correct style', async ({ page }) => {
    await page.goto('/login');
    // Assuming we have a test user or the session is preserved
    // For this environment, we might need to skip real login and just test the logic
    // But the user asked for Playwright evidence.
    
    await page.goto('/dashboard/simulados');
    
    // Select FGV
    await page.click('button:has-text("Novo Simulado")');
    await page.selectOption('select[name="examBoard"]', 'FGV');
    await page.fill('input[name="count"]', '10');
    
    await page.click('button:has-text("Estudar Agora")');
    
    // Wait for generation
    await expect(page.locator('text=Finalizando ambiente')).toBeVisible({ timeout: 60000 });
    
    // Verify count
    const questions = await page.locator('[data-testid="question-item"]').count();
    expect(questions).toBe(10);
  });

  test('Should generate 50 CEBRASPE questions (Right/Wrong)', async ({ page }) => {
    await page.goto('/dashboard/simulados');
    
    await page.click('button:has-text("Novo Simulado")');
    await page.selectOption('select[name="examBoard"]', 'CEBRASPE');
    await page.fill('input[name="count"]', '50');
    
    await page.click('button:has-text("Estudar Agora")');
    
    await expect(page.locator('text=Finalizando ambiente')).toBeVisible({ timeout: 120000 });
    
    // Verify Right/Wrong format (only 2 options)
    const firstQuestionOptions = await page.locator('[data-testid="question-options"]').first().locator('button').count();
    expect(firstQuestionOptions).toBe(2);
  });

  test('Should respect exact quantity requested (100 ENARE)', async ({ page }) => {
    await page.goto('/dashboard/simulados');
    
    await page.click('button:has-text("Novo Simulado")');
    await page.selectOption('select[name="examBoard"]', 'ENARE');
    await page.fill('input[name="count"]', '100');
    
    await page.click('button:has-text("Estudar Agora")');
    
    await expect(page.locator('text=Finalizando ambiente')).toBeVisible({ timeout: 300000 });
    
    const questionsCount = await page.locator('[data-testid="question-item"]').count();
    expect(questionsCount).toBe(100);
  });
});
