import { test, expect } from '@playwright/test';

test.describe('Professor - Criação de Simulado', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/professor');
  });

  test('deve abrir o modal de criação e permitir criar rascunho apenas com título', async ({ page }) => {
    const createBtn = page.getByRole('button', { name: /novo simulado/i }).first();
    await createBtn.click();
    
    // Preencher título
    const titleInput = page.getByPlaceholder(/cardiologia/i);
    await titleInput.fill('Rascunho Rápido E2E');
    
    // Clicar em salvar rascunho (novo botão adicionado)
    const draftBtn = page.getByText(/salvar como rascunho/i);
    await expect(draftBtn).toBeVisible();
    await draftBtn.click();
    
    // Verificar se toast de sucesso aparece
    await expect(page.getByText(/rascunho salvo/i)).toBeVisible();
    await expect(page.getByText(/TRACE-/i)).toBeVisible();
  });

  test('deve passar pelo modal de confirmação para publicação completa', async ({ page }) => {
    await page.getByRole('button', { name: /novo simulado/i }).first().click();
    await page.getByPlaceholder(/cardiologia/i).fill('Publicação Completa E2E');
    
    // Adicionar questão manual para permitir revisão
    await page.getByRole('button', { name: /criar manual/i }).click();
    await page.getByPlaceholder(/paciente de 55 anos/i).fill('Questão teste E2E');
    await page.getByPlaceholder(/alternativa A/i).fill('Opção A');
    await page.getByPlaceholder(/alternativa B/i).fill('Opção B');
    await page.getByRole('button', { name: /adicionar questão/i }).click();

    // Clicar em revisar
    await page.getByRole('button', { name: /revisar e atribuir/i }).click();

    // Validar resumo de confirmação
    await expect(page.getByText(/confirmar publicação/i)).toBeVisible();
    await expect(page.getByText(/1 questões/i)).toBeVisible();

    // Confirmar criação
    const confirmBtn = page.getByRole('button', { name: /confirmar e publicar/i });
    await confirmBtn.click();
    
    // Deve mostrar sucesso
    await expect(page.getByText(/simulado criado/i)).toBeVisible();
  });

  test('não deve permitir publicação sem título', async ({ page }) => {
    await page.getByRole('button', { name: /novo simulado/i }).first().click();
    const draftBtn = page.getByText(/salvar como rascunho/i);
    
    // Tentar salvar rascunho sem título (limpar se houver default)
    const titleInput = page.getByPlaceholder(/cardiologia/i);
    await titleInput.fill('');
    
    await expect(draftBtn).toBeDisabled();
  });
});

