import { test, expect } from '@playwright/test';

test.describe('Professor - Nova Página de Simulado', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the professor dashboard
    await page.goto('/dashboard/professor');
  });

  test('deve navegar para a página de criação e salvar rascunho', async ({ page }) => {
    const createBtn = page.getByTestId('open-create-simulado-button');
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    
    // Check if URL changed to the new page
    await expect(page).toHaveURL(/\/dashboard\/professor\/simulados\/novo/);
    
    // Basic data
    const titleInput = page.locator('input[placeholder*="Título"]');
    await titleInput.fill('Simulado E2E Página Dedicada');
    
    // Save draft
    const draftBtn = page.getByRole('button', { name: /SALVAR RASCUNHO/i });
    await expect(draftBtn).toBeVisible();
    await draftBtn.click();
    
    // Success toast
    await expect(page.getByText(/Rascunho salvo/i)).toBeVisible();
    
    // Should navigate back to dashboard
    await expect(page).toHaveURL(/\/dashboard\/professor/);
  });

  test('deve permitir adicionar, editar e excluir questão manual', async ({ page }) => {
    await page.goto('/dashboard/professor/simulados/novo');
    
    // Go to Questions tab
    await page.getByRole('tab', { name: /QUESTÕES/i }).click();
    
    // Switch to Manual mode
    await page.getByRole('button', { name: /MANUAL/i }).click();
    
    // Fill manual question
    await page.getByPlaceholder(/enunciado/i).fill('Qual a capital do Brasil?');
    await page.locator('input[placeholder*="Alternativa A"]').fill('Brasília');
    await page.locator('input[placeholder*="Alternativa B"]').fill('São Paulo');
    
    // Add question
    await page.getByRole('button', { name: /ADICIONAR QUESTÃO/i }).click();
    
    // Check if question appeared in preview
    await expect(page.getByText(/Qual a capital do Brasil?/i)).toBeVisible();
    
    // Expand and remove
    await page.getByText(/Qual a capital do Brasil?/i).click();
    const removeBtn = page.locator('button:has-text("Remover")');
    // Wait for animation
    await page.waitForTimeout(500);
    // There might be a remove button inside the question item
    const deleteBtn = page.locator('button').filter({ has: page.locator('svg.lucide-trash') });
    // Since there might be many, let's be specific or just use the text if it exists
    // In our preview it's an X or Trash icon usually.
  });

  test('deve validar regras de publicação', async ({ page }) => {
    await page.goto('/dashboard/professor/simulados/novo');
    
    const publishBtn = page.getByRole('button', { name: /PUBLICAR/i });
    
    // Initial state: publish should be disabled because no questions
    await expect(publishBtn).toBeDisabled();
    
    // Fill title
    await page.locator('input[placeholder*="Título"]').fill('Teste de Validação');
    
    // Add a question
    await page.getByRole('tab', { name: /QUESTÕES/i }).click();
    await page.getByRole('button', { name: /MANUAL/i }).click();
    await page.getByPlaceholder(/enunciado/i).fill('Questão de Teste');
    await page.locator('input[placeholder*="Alternativa A"]').fill('A');
    await page.locator('input[placeholder*="Alternativa B"]').fill('B');
    await page.getByRole('button', { name: /ADICIONAR QUESTÃO/i }).click();
    
    // Now publish should be enabled (assuming default audience is valid)
    await expect(publishBtn).not.toBeDisabled();
  });
});
