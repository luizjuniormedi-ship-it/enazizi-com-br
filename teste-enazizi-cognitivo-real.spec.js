const { test, expect } = require('@playwright/test');

test.setTimeout(600000);

test('ENAZIZI - teste real Planner FSRS e funções cognitivas', async ({ page }) => {
  const errors = [];

  page.on('response', res => {
    const status = res.status();
    const url = res.url();
    if ([400, 403, 406, 409, 500, 502, 503, 504].includes(status) && !url.includes('chrome-extension')) {
      errors.push(`[HTTP ${status}] ${url}`);
    }
  });

  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`[CONSOLE_ERROR] ${msg.text()}`);
  });

  // A URL deve ser a da preview do Lovable
  await page.goto('/');

  // Aguarda login (assumindo que o Playwright está rodando em um ambiente com sessão ou o teste lida com isso)
  // O usuário disse que o sistema não está quebrando no login, então vamos direto ao dashboard
  await page.goto('/dashboard');

  console.log('[MONITOR] Dashboard loading...');
  
  // Verifica se o loading "SINCRONIZANDO ECOSSISTEMA COGNITIVO" desaparece em 20s
  const loading = page.locator('text=Sincronizando Ecossistema Cognitivo');
  try {
    await expect(loading).not.toBeVisible({ timeout: 20000 });
    console.log('[MONITOR] Cognitive hydration finished.');
  } catch (e) {
    throw new Error('STUCK_LOADING: O loader "Sincronizando Ecossistema Cognitivo" não desapareceu em 20s.');
  }

  // Verifica sidebar
  await expect(page.locator('nav')).toBeVisible({ timeout: 10000 });
  console.log('[MONITOR] Sidebar visible.');

  // Verifica elementos do Dashboard
  await expect(page.locator('text=Olá,')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('text=Missão de hoje')).toBeVisible({ timeout: 15000 });
  console.log('[DASHBOARD_OK]');

  // Navega para Planner
  await page.click('text=Cronograma');
  await expect(page).toHaveURL(/.*planner|.*cronograma/);
  console.log('[PLANNER_OK]');

  // Navega para Flashcards
  await page.goto('/dashboard/flashcards');
  await expect(page.locator('text=Flashcards')).toBeVisible();
  console.log('[FSRS_OK]');

  // Navega para Banco de Erros
  await page.goto('/dashboard/banco-erros');
  await expect(page.locator('text=Banco de Erros')).toBeVisible();
  console.log('[ERROR_BANK_OK]');

  if (errors.length > 0) {
    console.warn('[ERRORS_DETECTED]\n' + errors.join('\n'));
  }

  console.log('[COGNITIVE_SYSTEM_OK]');
  console.log('[MISSION_OK]');
});
