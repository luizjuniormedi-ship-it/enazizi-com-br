import { test, expect, Page } from '@playwright/test';

const EMAIL = process.env.E2E_USER_EMAIL || process.env.E2E_ALUNO_EMAIL || '';
const PASSWORD = process.env.E2E_USER_PASSWORD || process.env.E2E_ALUNO_PASSWORD || '';

const routes = [
  '/dashboard',
  '/dashboard/enaflix',
  '/dashboard/sessao-estudo',
  '/dashboard/planner',
  '/dashboard/simulados',
  '/dashboard/banco-questoes',
  '/dashboard/gerador-questoes',
  '/dashboard/proficiencia',
  '/dashboard/flashcards',
  '/dashboard/banco-erros',
  '/dashboard/favoritos',
  '/dashboard/historico',
  '/dashboard/progress',
  '/dashboard/predictor',
  '/dashboard/radar-trajetoria',
  '/dashboard/minha-jornada',
  '/dashboard/mapa-dominio',
  '/dashboard/rankings',
  '/dashboard/resultados-oficiais',
  '/dashboard/simulacao-clinica',
  '/dashboard/plantao',
  '/dashboard/anamnese',
  '/dashboard/image-quiz',
  '/dashboard/prova-pratica',
  '/dashboard/videoaulas',
  '/dashboard/resumos',
  '/dashboard/apostilas',
  '/dashboard/uploads',
  '/dashboard/feynman',
  '/dashboard/mnemonico',
  '/dashboard/mapas-mentais',
  '/dashboard/configuracoes',
  '/dashboard/perfil',
  '/dashboard/learning-science',
  '/dashboard/clinical-evidence',
  '/dashboard/discursivas',
  '/dashboard/conquistas',
  '/professor',
  '/professor/simulados',
  '/professor/turmas',
  '/professor/alunos',
  '/professor/proficiencia/piloto',
];

const destructive = /\b(excluir|apagar|remover|deletar|sair|logout|pagar|comprar|confirmar|finalizar|enviar|publicar|salvar|cancelar assinatura)\b/i;
const noisyNetwork = /telemetry_events|alert_events|presence|favicon|manifest|analytics/i;

async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button:has-text("Entrar"), button:has-text("ENTRAR")');
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 });
  await page.evaluate(() => {
    localStorage.setItem('enazizi_v2_welcome_seen', 'true');
    localStorage.setItem('enazizi_v2_onboarding_done', 'true');
  });
}

test.describe('Auditoria global UX real', () => {
  test.skip(!EMAIL || !PASSWORD, 'Credenciais E2E ausentes');

  test('abre rotas e clica botões seguros dos módulos principais', async ({ page }) => {
    test.setTimeout(8 * 60_000);
    const findings: any[] = [];
    const consoleErrors: string[] = [];
    const httpErrors: string[] = [];

    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error' || /ErrorBoundary|TypeError|ReferenceError|Uncaught|STALL_|BOOT_LOOP|JSON/i.test(text)) {
        consoleErrors.push(`${page.url()} :: ${msg.type()} :: ${text}`.slice(0, 500));
      }
    });
    page.on('pageerror', (err) => consoleErrors.push(`${page.url()} :: pageerror :: ${err.message}`));
    page.on('response', (res) => {
      const status = res.status();
      const url = res.url();
      if (!noisyNetwork.test(url) && (status >= 500 || status === 403 || status === 404)) {
        httpErrors.push(`${status} ${url}`.slice(0, 500));
      }
    });

    await login(page);

    for (const route of routes) {
      const started = Date.now();
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((error) => {
        findings.push({ route, error: `goto: ${error.message}` });
      });
      await page.waitForLoadState('networkidle', { timeout: 9000 }).catch(() => {});
      await page.waitForTimeout(800);

      const bodyText = ((await page.locator('body').innerText().catch(() => '')) || '').trim();
      const buttonCount = await page.locator('button:visible').count().catch(() => 0);
      const contentVisible = bodyText.length > 120;
      const durationMs = Date.now() - started;

      const clicked: string[] = [];
      const buttons = page.locator('button:visible');
      const limit = Math.min(buttonCount, 18);
      for (let i = 0; i < limit; i++) {
        const button = buttons.nth(i);
        const label = ((await button.innerText().catch(() => '')) || (await button.getAttribute('aria-label').catch(() => '')) || '').trim();
        if (!label || destructive.test(label)) continue;
        const beforeUrl = page.url();
        await button.click({ timeout: 1500 }).catch(() => {});
        clicked.push(label.slice(0, 60));
        await page.waitForTimeout(120);
        if (page.url() !== beforeUrl && !page.url().includes(route.replace('/minha-jornada', '/radar-trajetoria'))) {
          await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
          await page.waitForTimeout(300);
        }
      }

      findings.push({
        route,
        durationMs,
        buttonCount,
        clickedCount: clicked.length,
        contentChars: bodyText.length,
        contentVisible,
        sampleClicks: clicked.slice(0, 8),
      });
    }

    console.log('[GLOBAL_UX_AUDIT]', JSON.stringify({ findings, consoleErrors, httpErrors }, null, 2));
    expect(findings.filter((f) => !f.contentVisible), JSON.stringify(findings.filter((f) => !f.contentVisible), null, 2)).toEqual([]);
  });
});
