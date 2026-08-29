import { test, expect, type Page } from '@playwright/test';

async function openTutor(page: Page) {
  await page.goto('/dashboard/mentor');
  await expect(page).toHaveURL(/\/dashboard\/sessao-estudo(?:\?|$)/);
  await expect(page.getByRole('heading', { name: /Tutor IA V3/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/O que vamos.*dominar hoje/i)).toBeVisible();
}

async function selectSpecialty(page: Page, specialty: string) {
  await page.getByRole('combobox', { name: 'Especialidade' }).click();
  await page.getByRole('option', { name: specialty, exact: true }).click();
}

test.describe('Tutor IA Module E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    const email = process.env.E2E_USER_EMAIL;
    const password = process.env.E2E_USER_PASSWORD;
    if (!email || !password) throw new Error('E2E_USER_EMAIL e E2E_USER_PASSWORD são obrigatórios');

    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button:has-text("Entrar"), button:has-text("ENTRAR")');
    await expect(page).not.toHaveURL(/.*login.*/);
    await page.evaluate(() => {
      localStorage.setItem('enazizi_v2_welcome_seen', 'true');
      localStorage.setItem('enazizi_v2_onboarding_done', 'true');
    });
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
    await page.getByRole('textbox', { name: 'Tema ou assunto' }).fill('Protocolo de Sepse');

    const startedAt = Date.now();
    await page.getByRole('button', { name: 'Iniciar sessão de estudo' }).click();
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
    await page.getByRole('button', { name: 'Cardiologia', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Especialidade' })).toContainText('Cardiologia');

    const start = page.getByRole('button', { name: 'Iniciar sessão de estudo' });
    await expect(start).toBeDisabled();
    await page.getByRole('textbox', { name: 'Tema ou assunto' }).fill('Síndrome coronariana aguda');
    await expect(start).toBeEnabled();
  });
});
