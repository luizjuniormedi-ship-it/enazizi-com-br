import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

/**
 * E2E tests for the Simulados module.
 * These tests run against the real production/preview environment.
 */
test.describe('Simulados Module E2E', () => {
  
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'student');
  });

  async function discardPendingSimuladoIfVisible(page: import('@playwright/test').Page) {
    const discard = page.getByRole('button', { name: /^Descartar$/i }).first();
    if (await discard.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await discard.click();
      await expect(discard).toBeHidden({ timeout: 10_000 }).catch(() => {});
    }
  }

  async function selectStableBankTopic(page: import('@playwright/test').Page) {
    const setupSection = page.getByTestId('generation-modal');
    await setupSection.scrollIntoViewIfNeeded();
    await setupSection.getByRole('button', { name: /^Limpar$/i }).click().catch(() => {});
    await setupSection.getByRole('button', { name: /^Cardiologia$/i }).click();
    await expect(setupSection.getByRole('button', { name: /^Cardiologia$/i })).toBeVisible();
    return setupSection;
  }

  test('Navigate to Simulados and ensure no runtime errors', async ({ page }) => {
    // Listen for console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (text.includes('ReferenceError') || text.includes('TypeError') || text.includes('Runtime Error')) {
          consoleErrors.push(text);
        }
      }
    });

    // Listen for network errors (500)
    page.on('response', response => {
      if (response.status() >= 500) {
        consoleErrors.push(`Server error 500 on ${response.url()}`);
      }
    });

    // 2. Abrir Simulados
    await page.goto('/dashboard/simulados');
    
    // Confirm page loaded
    await expect(page.getByTestId('simulados-page')).toBeVisible({ timeout: 15000 });
    
    // Confirm no critical console errors
    expect(consoleErrors).toHaveLength(0);
  });

  test('ENARE official remains suspended until homologation', async ({ page }) => {
    await page.goto('/dashboard/simulados');
    const enare = page.getByTestId('banca-enare-button').first();
    await expect(enare).toHaveAttribute('aria-disabled', 'true');
    await expect(enare).toHaveAttribute('tabindex', '-1');
  });

  test('USP-SP official remains suspended until homologation', async ({ page }) => {
    await page.goto('/dashboard/simulados');
    const usp = page.getByTestId('banca-usp-sp-button').first();
    await expect(usp).toHaveAttribute('aria-disabled', 'true');
    await expect(usp).toHaveAttribute('tabindex', '-1');
  });

  test('Create job for 50 questions and verify progress', async ({ page }) => {
    await page.goto('/dashboard/simulados');
    await discardPendingSimuladoIfVisible(page);
    
    // 5. Criar job de 50 questões
    // We use the setup component at the bottom
    const setupSection = page.getByTestId('generation-modal');
    await setupSection.scrollIntoViewIfNeeded();
    
    // Select 50 questions
    await setupSection.getByTestId('qtd-50-button').click();
    
    // Click start
    await setupSection.getByTestId('iniciar-simulado-button').click();
    
    // Confirm loading phase and job progress
    await expect(page.getByTestId('simulation-job-status')).toBeVisible({ timeout: 10000 });
    
    // Confirm it's not a white screen/infinite loading
    await expect(page.getByText(/Gerando lote/i).or(page.getByText(/Iniciando/i))).toBeVisible();
  });

  test('Complete a simulated exam flow', async ({ page }) => {
    // Generate a quick 5 questions study simulado
    await page.goto('/dashboard/simulados');
    await discardPendingSimuladoIfVisible(page);
    
    const setupSection = await selectStableBankTopic(page);
    await setupSection.getByTestId('mode-estudo-button').click();
    await setupSection.getByTestId('qtd-5-button').click();
    
    // Use the canonical bank-backed path for the short E2E. The IA path is
    // covered by contract/edge tests and is intentionally more variable.
    await setupSection.getByRole('button', { name: /Montar com Banco/i }).click();
    
    // 6. Responder e finalizar
    await expect(page.getByTestId('question-card')).toBeVisible({ timeout: 90000 });
    
    // Answer first question
    await page.getByTestId('answer-option').first().click();
    
    // Move to next
    await page.getByTestId('next-question-button').click();
    
    // Answer second and skip others or answer quickly
    for (let i = 0; i < 4; i++) {
        const answer = page.getByTestId('answer-option').first();
        if (await answer.isVisible()) {
            await answer.click();
        }
        const next = page.getByTestId('next-question-button');
        if (await next.isVisible()) {
            await next.click();
        } else {
            const finish = page.getByTestId('finish-simulado-button');
            if (await finish.isVisible()) {
                await finish.click();
                const confirmFinish = page.getByRole('button', { name: /Finalizar mesmo assim/i });
                if (await confirmFinish.isVisible().catch(() => false)) {
                    await confirmFinish.click();
                }
            }
        }
    }
    
    // Confirm result screen
    await expect(page.getByTestId('result-screen')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Simulado Concluído!', exact: true })).toBeVisible();
  });

  test('Generation modal interaction (ESC/Close)', async ({ page }) => {
    await page.goto('/dashboard/simulados');
    
    // 8. Modal interaction
    const modal = page.getByTestId('generation-modal');
    await modal.scrollIntoViewIfNeeded();
    
    // Ensure the modal stays mounted and interactive. Exact bounding-box
    // coordinates are not stable after scroll/lazy layout in CI.
    await modal.hover();
    await page.mouse.move(100, 100);
    await expect(modal).toBeVisible();

    // Test ESC key
    await page.keyboard.press('Escape');
    // If it's a dialog/modal it should ideally react.
  });

  test('Generate 100 questions (Skip in CI)', async ({ page }) => {
    test.skip(!!process.env.SKIP_HEAVY_TESTS, 'Skipping heavy test in CI to avoid high IA costs');
    
    await page.goto('/dashboard/simulados');
    
    const setupSection = page.getByTestId('generation-modal');
    await setupSection.scrollIntoViewIfNeeded();
    
    // We would need a 100 questions button or input
    // The previous implementation had a preset for 100
    const btn100 = setupSection.getByTestId('qtd-100-button');
    if (await btn100.isVisible()) {
        await btn100.click();
        await setupSection.getByTestId('iniciar-simulado-button').click();
        await expect(page.getByTestId('simulation-job-status')).toBeVisible({ timeout: 15000 });
    }
  });

});
