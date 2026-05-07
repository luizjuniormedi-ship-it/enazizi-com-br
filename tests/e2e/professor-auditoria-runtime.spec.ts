import { test, expect } from '@playwright/test';

test.describe('Professor Dashboard Auditoria', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/professor');
  });

  test('deve carregar a dashboard e KPIs básicos', async ({ page }) => {
    await expect(page.getByText(/painel do professor/i)).toBeVisible();
    await expect(page.getByText(/simulados/i).first()).toBeVisible();
    await expect(page.getByText(/alunos atribuídos/i)).toBeVisible();
  });

  test('deve abrir o modal de novo simulado e permitir digitar título', async ({ page }) => {
    const novoBtn = page.getByRole('button', { name: /novo simulado/i });
    await novoBtn.click();
    
    await expect(page.getByText(/criar simulado/i).first()).toBeVisible();
    
    const titleInput = page.getByPlaceholder(/simulado mensal/i);
    await titleInput.fill('Auditoria Playwright');
    await expect(titleInput).toHaveValue('Auditoria Playwright');
  });

  test('deve navegar entre as abas principais', async ({ page }) => {
    // Aba Casos Plantão
    const plantaoTab = page.getByRole('tab', { name: /casos plantão/i });
    await plantaoTab.click();
    await expect(page.getByText(/casos plantão/i).first()).toBeVisible();

    // Aba BI
    const biTab = page.getByRole('tab', { name: /bi/i });
    await biTab.click();
    await expect(page.getByText(/resumo executivo/i)).toBeVisible();
  });

  test('deve validar o scroll interno do modal de simulado', async ({ page }) => {
    await page.getByRole('button', { name: /novo simulado/i }).click();
    const modalBody = page.getByTestId('dialog-body');
    
    // Verificar se o container do body existe
    await expect(modalBody).toBeVisible();
    
    // Tentar rolar para o final do modal (onde ficam as configurações de agendamento)
    await modalBody.evaluate(el => el.scrollTo(0, el.scrollHeight));
    
    await expect(page.getByText(/prazos e tempo/i)).toBeInViewport();
  });
});