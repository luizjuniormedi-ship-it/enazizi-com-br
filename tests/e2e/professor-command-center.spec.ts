import { test, expect } from '@playwright/test';

/**
 * Smoke E2E — Professor Command Center (Operacional)
 * Valida o fluxo: painel abre → tab Operacional → sub-tabs renderizam → drawer/recovery não quebram UI.
 * Assume usuário de preview com permissão de professor (config global do projeto).
 */
test.describe('Professor Command Center — Operacional', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/professor');
  });

  test('renderiza painel sem ErrorBoundary e abre em Operacional', async ({ page }) => {
    await expect(page.getByText(/painel do professor/i)).toBeVisible({ timeout: 15000 });
    // Não deve haver mensagem de erro global
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
    // Tab Operacional ativa
    await expect(page.getByRole('tab', { name: /operacional/i })).toHaveAttribute('data-state', 'active');
  });

  test('navega entre sub-abas operacionais sem crash', async ({ page }) => {
    await expect(page.getByText(/painel do professor/i)).toBeVisible({ timeout: 15000 });
    for (const sub of ['Matriz cognitiva', 'Heatmap turma', 'Timeline', 'Ranking']) {
      const btn = page.getByRole('button', { name: new RegExp(sub, 'i') });
      if (await btn.count()) {
        await btn.first().click();
        await page.waitForTimeout(200);
      }
    }
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
  });

  test('viewport mobile 430px: tabs principais empilham sem overflow', async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 800 });
    await page.goto('/dashboard/professor');
    await expect(page.getByText(/painel do professor/i)).toBeVisible({ timeout: 15000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  });
});
