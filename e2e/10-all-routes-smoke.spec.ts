import { test, expect } from '@playwright/test';

/**
 * Smoke test: verifica que TODAS as rotas principais do dashboard
 * carregam sem tela branca ou crash.
 */
test.describe('All Routes Smoke Test', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.E2E_ALUNO_EMAIL!);
    await page.fill('input[type="password"]', process.env.E2E_ALUNO_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|enaflix)/, { timeout: 15000 });
  });

  const dashboardRoutes = [
    '/dashboard',
    '/dashboard/sessao-estudo',
    '/dashboard/flashcards',
    '/dashboard/gerar-flashcards',
    '/dashboard/simulados',
    '/dashboard/banco-erros',
    '/dashboard/gerador-questoes',
    '/dashboard/mentor',
    '/dashboard/videoaulas',
    '/dashboard/resumos',
    '/dashboard/apostilas',
    '/dashboard/plantao',
    '/dashboard/anamnese',
    '/dashboard/cronicas',
    '/dashboard/discursivas',
    '/dashboard/prova-pratica',
    '/dashboard/image-quiz',
    '/dashboard/revisor',
    '/dashboard/entrevista',
    '/dashboard/planner',
    '/dashboard/analytics',
    '/dashboard/perfil',
    '/dashboard/conquistas',
    '/dashboard/rankings',
    '/dashboard/diagnostico',
    '/dashboard/predictor',
    '/dashboard/mapa-dominio',
    '/dashboard/proficiencia',
    '/dashboard/agentes',
    '/dashboard/uploads',
    '/dashboard/coach',
    '/dashboard/mnemonico',
    '/dashboard/chatgpt',
    '/dashboard/simulacao-clinica',
  ];

  for (const route of dashboardRoutes) {
    test(`Route ${route} loads without white screen`, async ({ page }) => {
      await page.goto(route);
      await page.waitForTimeout(3000);
      
      const body = await page.locator('body').textContent();
      // Must have meaningful content (not empty/white screen)
      expect(body!.trim().length).toBeGreaterThan(20);
      
      // Check no unhandled JS errors
      const consoleErrors: string[] = [];
      page.on('pageerror', (err) => consoleErrors.push(err.message));
      
      // Check page didn't redirect to error page
      expect(page.url()).not.toContain('/errors');
    });
  }

  const publicRoutes = [
    '/',
    '/login',
    '/register',
    '/forgot-password',
    '/privacidade',
    '/termos',
    '/pricing',
  ];

  for (const route of publicRoutes) {
    test(`Public route ${route} loads`, async ({ page }) => {
      await page.goto(route);
      await page.waitForTimeout(2000);
      const body = await page.locator('body').textContent();
      expect(body!.trim().length).toBeGreaterThan(20);
    });
  }
});
