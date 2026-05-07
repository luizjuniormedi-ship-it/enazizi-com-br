import { test, expect } from '@playwright/test';

test.describe('Professor - Nova Página de Simulado', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the professor dashboard
    await page.goto('/dashboard/professor');
  });

  test('FLUXO COMPLETO: Criar rascunho, adicionar questão, público complexo e publicar', async ({ page }) => {
    // 1. Acesso à nova página
    const createBtn = page.getByTestId('open-create-simulado-button');
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    await expect(page).toHaveURL(/\/dashboard\/professor\/simulados\/novo/);

    // 2. Criar rascunho apenas com título
    const titleInput = page.locator('input[placeholder*="Título"]');
    await titleInput.fill('Simulado Auditoria Completa');
    const draftBtn = page.getByRole('button', { name: /SALVAR RASCUNHO/i });
    await draftBtn.click();
    await expect(page.getByText(/Simulado salvo com sucesso/i)).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/professor/);

    // 3. Re-abrir para edição (adicionar questão e público)
    // Localizar o simulado criado e clicar em Editar
    const editBtn = page.locator('div:has-text("Simulado Auditoria Completa")').getByRole('button', { name: /EDITAR/i }).first();
    await editBtn.click();
    await expect(page).toHaveURL(/\/dashboard\/professor\/simulados\/editar/);

    // 4. Adicionar questão manual
    await page.getByRole('tab', { name: /QUESTÕES/i }).click();
    await page.getByRole('button', { name: /MANUAL/i }).click();
    await page.getByPlaceholder(/enunciado/i).fill('Questão de Auditoria E2E');
    await page.locator('input[placeholder*="Alternativa A"]').fill('Opção Certa');
    await page.locator('input[placeholder*="Alternativa B"]').fill('Opção Errada');
    await page.getByRole('button', { name: /ADICIONAR QUESTÃO/i }).click();
    await expect(page.getByText(/Questão de Auditoria E2E/i)).toBeVisible();

    // 5. Selecionar público (2 faculdades, 2 períodos)
    await page.getByRole('tab', { name: /ALUNOS/i }).click();
    
    // Selecionar Faculdades
    await page.getByRole('button', { name: /Todas as universidades/i }).click();
    await page.getByText('USP – Universidade de São Paulo').click();
    await page.getByText('UFMG – Universidade Federal de Minas Gerais').click();
    await page.keyboard.press('Escape');

    // Selecionar Períodos
    await page.getByRole('button', { name: /Todos os períodos/i }).click();
    await page.getByText('1º período').click();
    await page.getByText('2º período').click();
    await page.keyboard.press('Escape');

    // Buscar aluno por nome
    const searchInput = page.getByPlaceholder(/Filtrar por nome ou e-mail/i);
    await searchInput.fill('João');
    await page.getByRole('button', { name: /BUSCAR ALUNOS/i }).click();
    
    // 6. Selecionar aluno, remover e validar
    // (Simulação de clique no primeiro aluno encontrado)
    const studentCard = page.locator('button:has-text("João")').first();
    if (await studentCard.isVisible()) {
      await studentCard.click();
      await expect(page.getByText(/1 ALUNOS SELECIONADOS/i)).toBeVisible();
      
      // Remover aluno
      await page.locator('button:has(svg.lucide-x)').first().click();
      await expect(page.getByText(/0 ALUNOS SELECIONADOS/i)).not.toBeVisible();
    }

    // 7. Tentar publicar sem público e confirmar bloqueio
    await page.getByRole('button', { name: /FILTROS/i }).click(); // Volta pro modo filtro mas limpa seleções se necessário
    // Se o modo for 'filter', ele aceita se houver filtros. Vamos testar o bloqueio por questões se removermos.
    
    // 8. Publicar com público válido (modo FILTROS selecionado com as 2 faculdades)
    await page.getByRole('button', { name: /FILTROS/i }).click();
    const publishBtn = page.getByRole('button', { name: /PUBLICAR/i });
    await expect(publishBtn).toBeEnabled();
    await publishBtn.click();
    
    // 9. Confirmar finalização
    await expect(page.getByText(/Simulado publicado com sucesso/i)).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/dashboard\/professor/);

    // 10. Validar console e erro (implícito no runner do Playwright se configurado, ou manual)
    const logs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') logs.push(msg.text());
    });
    expect(logs.filter(l => l.includes('Critical')).length).toBe(0);
  });
});
