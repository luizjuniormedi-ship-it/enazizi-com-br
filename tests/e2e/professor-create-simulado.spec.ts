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
    
    const modalTitle = page.getByText(/criar simulado/i);
    await expect(modalTitle).toBeVisible();
    
    // Verificar se o formulário básico está presente
    await expect(page.getByLabel(/título/i)).toBeVisible();
  });

  test('não deve permitir criação sem título', async ({ page }) => {
    await page.getByRole('button', { name: /novo simulado/i }).click();
    
    // Tentar criar direto
    const submitBtn = page.getByRole('button', { name: /criar e atribuir/i });
    // O botão pode estar desativado se não houver questões, então vamos adicionar uma manual primeiro
    await page.getByRole('button', { name: /criar manual/i }).click();
    await page.getByPlaceholder(/paciente de 55 anos/i).fill('Questão teste');
    await page.getByPlaceholder(/alternativa A/i).fill('Opção A');
    await page.getByPlaceholder(/alternativa B/i).fill('Opção B');
    await page.getByRole('button', { name: /adicionar questão/i }).click();

    // Limpar título padrão se houver
    await page.getByLabel(/título/i).fill('');
    
    await submitBtn.click();
    
    // Verificar se ErrorBoundary NÃO apareceu (o texto de erro padrão do ErrorBoundary não deve estar na tela)
    await expect(page.getByText(/algo deu errado/i)).not.toBeVisible();
    
    // Verificar se toast de erro apareceu
    const errorToast = page.getByText(/título obrigatório/i);
    await expect(errorToast).toBeVisible();
  });

  test('deve lidar com falha de notificação sem quebrar o fluxo principal', async ({ page }) => {
    // Simular falha na notificação via interceptação de rede se necessário, 
    // mas o teste foca em garantir que o frontend não quebra se a API responder sucesso para o simulado
    // mesmo que as notificações internas (no backend) falhem.
    
    await page.getByRole('button', { name: /novo simulado/i }).click();
    await page.getByLabel(/título/i).fill('Simulado Teste Notificação');
    
    // Adicionar questão
    await page.getByRole('button', { name: /criar manual/i }).click();
    await page.getByPlaceholder(/paciente de 55 anos/i).fill('Questão teste');
    await page.getByPlaceholder(/alternativa A/i).fill('Opção A');
    await page.getByPlaceholder(/alternativa B/i).fill('Opção B');
    await page.getByRole('button', { name: /adicionar questão/i }).click();
    
    // Criar
    const submitBtn = page.getByRole('button', { name: /criar e atribuir/i });
    await submitBtn.click();
    
    // Deve mostrar sucesso e fechar o modal (ou mostrar confirmação)
    await expect(page.getByText(/simulado criado/i)).toBeVisible();
    await expect(page.getByText(/criar simulado/i)).not.toBeVisible();
  });
});
