import { expect, test, type Page, type TestInfo } from '@playwright/test';

type BrowserProblem = {
  source: 'pageerror' | 'console' | 'http';
  message: string;
};

function observeBrowserProblems(page: Page, options: { ignoreExpectedAuth400?: boolean } = {}) {
  const problems: BrowserProblem[] = [];
  const seen = new Set<string>();

  const addProblem = (problem: BrowserProblem) => {
    const fingerprint = `${problem.source}:${problem.message}`;
    if (seen.has(fingerprint)) return;
    seen.add(fingerprint);
    problems.push(problem);
  };

  page.on('pageerror', (error) => {
    addProblem({ source: 'pageerror', message: error.message });
  });

  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = message.text();
      // Chromium also emits a generic console message for failed HTTP
      // responses. The response listener below records the precise URL/status.
      if (!text.includes('Failed to load resource: the server responded with a status of')) {
        addProblem({ source: 'console', message: text });
      }
    }
  });

  page.on('response', (response) => {
    if (response.status() >= 400) {
      const isExpectedAuth400 =
        options.ignoreExpectedAuth400 &&
        response.status() === 400 &&
        response.url().includes('/auth/v1/token');
      if (!isExpectedAuth400) {
        addProblem({
          source: 'http',
          message: `${response.status()} ${response.request().method()} ${response.url()}`,
        });
      }
    }
  });

  return problems;
}

async function attachProblems(testInfo: TestInfo, problems: BrowserProblem[]) {
  await testInfo.attach('browser-problems.json', {
    body: Buffer.from(JSON.stringify(problems, null, 2)),
    contentType: 'application/json',
  });
}

async function expectHealthyPage(page: Page) {
  await expect(page.locator('body')).toBeVisible();
  await expect(page.getByText(/Algo deu errado|Something went wrong/i)).toHaveCount(0);
}

test.describe('Simulacao de usuario visitante', () => {
  test('visita o site, tenta entrar e abre a recuperacao de senha', async ({ page }, testInfo) => {
    const problems = observeBrowserProblems(page, { ignoreExpectedAuth400: true });

    await test.step('Abrir a pagina inicial e entrar pelo CTA', async () => {
      await page.goto('/');
      await expectHealthyPage(page);
      const enterLink = page.getByRole('link', { name: /entrar/i }).first();
      await expect(enterLink).toBeVisible();
      await enterLink.click();
      await expect(page).toHaveURL(/\/login$/);
    });

    await test.step('Preencher credenciais invalidas como um usuario real', async () => {
      // Login.tsx currently renders visual labels without htmlFor/id association.
      // Use input semantics so the journey can continue while that a11y defect is tracked.
      await page.locator('input[type="email"]').fill(`qa-inexistente-${Date.now()}@example.invalid`);
      await page.locator('input[type="password"]').fill('senha-incorreta-qa');
      await page.getByRole('button', { name: /Entrar no Studio/i }).click();
      await expect(page.getByText(/Email ou senha incorretos|Erro ao entrar/i).first()).toBeVisible();
      await expect(page).toHaveURL(/\/login$/);
    });

    await test.step('Usar o link de recuperacao de senha', async () => {
      await page.getByRole('link', { name: /Esqueci minha senha/i }).click();
      await expect(page).toHaveURL(/\/forgot-password$/);
      await expect(page.getByRole('heading', { name: /Esqueci minha senha/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Enviar link/i })).toBeVisible();
    });

    await attachProblems(testInfo, problems);
    expect(problems, 'O navegador registrou erros de console, JavaScript ou HTTP 4xx/5xx').toEqual([]);
  });
});

test.describe('Simulacao de aluno autenticado', () => {
  const email = process.env.E2E_USER_EMAIL || process.env.E2E_ALUNO_EMAIL;
  const password = process.env.E2E_USER_PASSWORD || process.env.E2E_ALUNO_PASSWORD;

  test.skip(!email || !password, 'Configure E2E_USER_EMAIL/E2E_USER_PASSWORD em .env.e2e.local ou no CI.');

  test('faz login e navega por Simulados, Perfil e Tutor usando a interface', async ({ page }, testInfo) => {
    const problems = observeBrowserProblems(page);

    await test.step('Fazer login', async () => {
      await page.goto('/login');
      await page.locator('input[type="email"]').fill(email!);
      await page.locator('input[type="password"]').fill(password!);
      const authResponsePromise = page
        .waitForResponse(
          (response) =>
            response.request().method() === 'POST' &&
            response.url().includes('/auth/v1/token'),
          { timeout: 20_000 },
        )
        .catch(() => null);
      await page.getByRole('button', { name: /Entrar no Studio/i }).click();
      const authResponse = await authResponsePromise;
      if (!authResponse?.ok()) {
        const authBody = await authResponse?.json().catch(() => ({}));
        const authCode = authBody?.error_code || authBody?.code || 'desconhecido';
        const visibleMessage = await page.getByText(/Erro ao entrar|Email ou senha incorretos/i)
          .allTextContents();
        await attachProblems(testInfo, problems);
        // Clear credentials before Playwright captures the failure context.
        await page.locator('input[type="email"]').fill('');
        await page.locator('input[type="password"]').fill('');
        throw new Error(
          `Login do usuario E2E rejeitado. HTTP auth: ${authResponse?.status() ?? 'sem resposta'}; ` +
            `codigo: ${authCode}. ` +
            `Mensagem visivel: ${visibleMessage.join(' | ') || 'nenhuma'}`,
        );
      }
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 20_000 });
      await expectHealthyPage(page);
    });

    await test.step('Abrir Simulados pelo menu', async () => {
      const simulados = page.getByRole('link', { name: /^Simulados$/i }).first();
      await expect(simulados).toBeVisible();
      await simulados.click();
      await expect(page).toHaveURL(/\/dashboard\/simulados/);
      await expect(page.getByTestId('simulados-page')).toBeVisible();
      await expectHealthyPage(page);
    });

    await test.step('Abrir Meu Perfil pelo menu', async () => {
      const mobileProfile = page.getByTestId('nav-profile-button');
      const profile = (await mobileProfile.isVisible())
        ? mobileProfile
        : page.getByRole('link', { name: /Meu Perfil/i }).first();
      await expect(profile).toBeVisible();
      await profile.click();
      await expect(page).toHaveURL(/\/dashboard\/perfil/);
      await expectHealthyPage(page);
    });

    await test.step('Abrir Tutor IA pelo menu', async () => {
      // The responsive navigation names the same Tutor route "Missão" on mobile.
      // Keep this immersive destination last because it intentionally hides app menus.
      const mobileMission = page.getByRole('link', { name: /^Missão$/i });
      const tutor = (await mobileMission.isVisible())
        ? mobileMission
        : page.getByRole('link', { name: /Tutor IA/i }).first();
      await expect(tutor).toBeVisible();
      await tutor.click();
      await expect(page).toHaveURL(/\/dashboard\/sessao-estudo/);
      await expectHealthyPage(page);
    });

    await attachProblems(testInfo, problems);
    expect(problems, 'O navegador registrou erros de console, JavaScript ou HTTP 4xx/5xx').toEqual([]);
  });
});
