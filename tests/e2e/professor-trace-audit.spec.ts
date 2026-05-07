import { test, expect } from '@playwright/test';

test.describe('Professor - Auditoria de Rastreio (Trace Audit)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/professor');
  });

  test('deve exibir trace_id em caso de erro', async ({ page }) => {
    const createBtn = page.getByRole('button', { name: /novo simulado/i });
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    
    // Interceptar a chamada da API e retornar um erro 500 para testar a exibição do Trace ID
    await page.route('**/functions/v1/professor-simulado', async route => {
      const body = route.request().postDataJSON();
      if (body?.action === 'create_simulado') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: "Erro simulado para teste de auditoria" })
        });
      } else {
        await route.continue();
      }
    });

    await page.getByLabel(/título/i).fill('Simulado Erro Teste');
    await page.getByRole('button', { name: /criar manual/i }).click();
    await page.getByPlaceholder(/paciente de 55 anos/i).fill('Questão de auditoria');
    await page.getByPlaceholder(/alternativa A/i).fill('Opção A');
    await page.getByPlaceholder(/alternativa B/i).fill('Opção B');
    await page.getByRole('button', { name: /adicionar questão/i }).click();

    await page.getByRole('button', { name: /criar e atribuir/i }).click();

    // Verificar se o toast de erro com Trace ID apareceu
    await expect(page.getByText(/código de rastreio/i)).toBeVisible();
    await expect(page.getByText(/TRACE-/)).toBeVisible();
    await expect(page.getByRole('button', { name: /copiar/i })).toBeVisible();
  });

  test('deve permitir acessar o painel de auditoria e realizar busca', async ({ page }) => {
    // Navegar para a aba de auditoria
    const auditTab = page.getByRole('tab', { name: /auditoria/i });
    await expect(auditTab).toBeVisible();
    await auditTab.click();
    
    await expect(page.getByText(/auditoria de operações/i)).toBeVisible();
    
    const input = page.getByPlaceholder(/cole o trace id aqui/i);
    await expect(input).toBeVisible();

    // Simular busca de um trace inexistente (UUID válido mas sem logs)
    const fakeTraceId = '12345678-1234-1234-1234-123456789012';
    await input.fill(fakeTraceId);
    await page.getByRole('button', { name: /buscar rastreio/i }).click();

    // O backend deve retornar lista vazia e o frontend mostrar toast informativo
    await expect(page.getByText(/nenhum log encontrado/i)).toBeVisible();
  });
});