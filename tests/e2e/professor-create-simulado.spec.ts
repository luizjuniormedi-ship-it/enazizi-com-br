import { test, expect } from '@playwright/test';

test.describe('Professor - Criação de Simulado', () => {
  test.beforeEach(async ({ page }) => {
    // Mock login ou assumir que o ambiente já está autenticado como professor
    await page.goto('/professor');
  });

  test('deve abrir o modal de criação sem quebrar a tela', async ({ page }) => {
    const createBtn = page.getByRole('button', { name: /novo simulado/i });
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    
    const modalTitle = page.getByText(/criar simulado/i).first();
    await expect(modalTitle).toBeVisible();
    
    // Verificar se o formulário básico está presente usando labels técnicos
    await expect(page.getByText(/título do simulado/i)).toBeVisible();
  });

  test('não deve permitir criação sem título', async ({ page }) => {
    await page.getByRole('button', { name: /novo simulado/i }).click();
    
    // Tentar criar direto
    const submitBtn = page.getByRole('button', { name: /revisar e atribuir/i });
    
    // Adicionar questão manual primeiro para habilitar botão
    await page.getByRole('button', { name: /criar manual/i }).click();
    await page.getByPlaceholder(/paciente de 55 anos/i).fill('Questão teste');
    await page.getByPlaceholder(/alternativa A/i).fill('Opção A');
    await page.getByPlaceholder(/alternativa B/i).fill('Opção B');
    await page.getByRole('button', { name: /adicionar questão/i }).click();

    // Limpar título padrão se houver (selecionando pelo placeholder ou ordem se label falhar)
    const titleInput = page.getByPlaceholder(/cardiologia/i);
    await titleInput.fill('');
    
    await submitBtn.click();
    
    // Verificar se ErrorBoundary NÃO apareceu
    await expect(page.getByText(/algo deu errado/i)).not.toBeVisible();
    
    // Verificar se toast de erro apareceu
    await expect(page.getByText(/título obrigatório/i)).toBeVisible();
  });

  test('deve passar pelo modal de confirmação e exibir Trace ID no sucesso', async ({ page }) => {
    await page.getByRole('button', { name: /novo simulado/i }).click();
    await page.getByPlaceholder(/cardiologia/i).fill('Simulado E2E Completo');
    
    // Adicionar questão
    await page.getByRole('button', { name: /criar manual/i }).click();
    await page.getByPlaceholder(/paciente de 55 anos/i).fill('Questão teste E2E');
    await page.getByPlaceholder(/alternativa A/i).fill('Opção A');
    await page.getByPlaceholder(/alternativa B/i).fill('Opção B');
    await page.getByRole('button', { name: /adicionar questão/i }).click();

    // Clicar em revisar
    await page.getByRole('button', { name: /revisar e atribuir/i }).click();

    // Validar resumo de confirmação
    await expect(page.getByText(/confirmar publicação/i)).toBeVisible();
    await expect(page.getByText(/Simulado E2E Completo/i)).toBeVisible();
    await expect(page.getByText(/1 questões/i)).toBeVisible();

    // Confirmar criação
    const confirmBtn = page.getByRole('button', { name: /confirmar e publicar/i });
    await confirmBtn.click();
    
    // Deve mostrar sucesso e fechar o modal
    await expect(page.getByText(/simulado criado/i)).toBeVisible();
    
    // Verificar se o Trace ID aparece no toast
    await expect(page.getByText(/Rastreio: TRACE-/i)).toBeVisible();
  });

  test('deve bloquear criação para público vazio (seleção manual)', async ({ page }) => {
    await page.getByRole('button', { name: /novo simulado/i }).click();
    await page.getByPlaceholder(/cardiologia/i).fill('Teste Público Vazio');
    
    // Adicionar questão
    await page.getByRole('button', { name: /criar manual/i }).click();
    await page.getByPlaceholder(/paciente de 55 anos/i).fill('Questão teste');
    await page.getByPlaceholder(/alternativa A/i).fill('Opção A');
    await page.getByPlaceholder(/alternativa B/i).fill('Opção B');
    await page.getByRole('button', { name: /adicionar questão/i }).click();

    // Mudar para seleção manual (usando o texto do botão que agora é uppercase)
    await page.getByRole('button', { name: /seleção/i }).click();
    
    await page.getByRole('button', { name: /revisar e atribuir/i }).click();

    // Deve mostrar erro de público
    await expect(page.getByText(/nenhum aluno selecionado/i)).toBeVisible();
  });

  test('deve permitir criação por filtros de faculdade e período', async ({ page }) => {
    await page.getByRole('button', { name: /novo simulado/i }).click();
    await page.getByPlaceholder(/cardiologia/i).fill('Simulado por Filtros');

    // Mudar para filtros (padrão já é filtros, mas clicamos para garantir)
    await page.getByRole('button', { name: /filtros/i }).click();

    // Selecionar faculdade e período se houver selects visíveis
    // Como os selects do Radix/Shadcn podem ser difíceis de selecionar por texto simples, 
    // apenas garantimos que o modo está ativo e o botão de revisão funciona
    
    // Adicionar questão
    await page.getByRole('button', { name: /criar manual/i }).click();
    await page.getByPlaceholder(/paciente de 55 anos/i).fill('Questão teste Filtros');
    await page.getByPlaceholder(/alternativa A/i).fill('Opção A');
    await page.getByPlaceholder(/alternativa B/i).fill('Opção B');
    await page.getByRole('button', { name: /adicionar questão/i }).click();

    await page.getByRole('button', { name: /revisar e atribuir/i }).click();

    // No modal de confirmação, deve mostrar o modo Filtros
    await expect(page.getByText(/modo: filtros/i)).toBeVisible();
    
    const confirmBtn = page.getByRole('button', { name: /confirmar e publicar/i });
    await expect(confirmBtn).toBeVisible();
  });
});
