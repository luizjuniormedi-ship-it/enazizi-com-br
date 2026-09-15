import { test, expect, type Page } from '@playwright/test';
import { loginAs } from './helpers/auth';

async function openTutor(page: Page) {
  await page.goto('/dashboard/mentor');
  await expect(page).toHaveURL(/\/dashboard\/sessao-estudo(?:\?|$)/);
  // Route transitions briefly retain the leaving page for its exit animation.
  // Assert the active Tutor screen instead of requiring only one transient DOM node.
  await expect(page.getByRole('heading', { name: /Tutor IA V3/i }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /O que vamos.*dominar hoje/i }).first()).toBeVisible();
}

async function selectSpecialty(page: Page, specialty: string) {
  await page.getByRole('combobox', { name: 'Especialidade' }).first().click();
  await page.getByRole('option', { name: specialty, exact: true }).click();
}

test.describe('Tutor IA Module E2E', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'student');
  });

  test('legacy Mentor route opens the canonical Tutor V3', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', message => {
      if (message.type() === 'error' && /ReferenceError|TypeError|Runtime Error/.test(message.text())) runtimeErrors.push(message.text());
    });
    page.on('response', response => {
      if (response.status() >= 500) runtimeErrors.push(`HTTP ${response.status()} ${response.url()}`);
    });

    await openTutor(page);
    expect(runtimeErrors).toHaveLength(0);
  });

  test('creates a contextualized session and receives a real AI response', async ({ page }) => {
    test.setTimeout(180_000);
    await openTutor(page);
    await selectSpecialty(page, 'Infectologia');
    await page.getByRole('textbox', { name: 'Tema ou assunto' }).first().fill('Protocolo de Sepse');

    const startedAt = Date.now();
    await page.getByRole('button', { name: 'Iniciar sessão de estudo' }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/sessao-estudo\/[0-9a-f-]+/i, { timeout: 20_000 });

    const response = page.getByTestId('tutor-response').last();
    await expect(response).toBeVisible({ timeout: 120_000 });
    const text = (await response.innerText()).trim();
    console.log(`Tutor response time: ${Date.now() - startedAt}ms`);

    expect(text.length).toBeGreaterThan(100);
    expect(text.toLowerCase()).not.toMatch(/erro inesperado|erro no serviço/);
    expect(text.toLowerCase()).toContain('sepse');
    expect(text).toContain('?');
  });

  test('quick specialty selection preserves the mandatory context gate', async ({ page }) => {
    await openTutor(page);
    await page.getByRole('button', { name: 'Cardiologia', exact: true }).first().click();
    await expect(page.getByRole('combobox', { name: 'Especialidade' }).first()).toContainText('Cardiologia');

    const start = page.getByRole('button', { name: 'Iniciar sessão de estudo' }).first();
    await expect(start).toBeDisabled();
    await page.getByRole('textbox', { name: 'Tema ou assunto' }).first().fill('Síndrome coronariana aguda');
    await expect(start).toBeEnabled();
  });
});
