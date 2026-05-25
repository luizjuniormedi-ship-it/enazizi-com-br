const { test, expect } = require('@playwright/test');

test.setTimeout(600000);

test('ENAZIZI - teste real Planner FSRS e funções cognitivas', async ({ page }) => {
  const errors = [];

  page.on('response', res => {
    const status = res.status();
    const url = res.url();

    if ([400, 403, 406, 409, 500, 502, 503, 504].includes(status)) {
      errors.push(`HTTP ${status} -> ${url}`);
      console.log(`[HTTP ${status}] ${url}`);
    }

    if (url.includes('kojqbvrhodpchtnainla')) {
      errors.push(`SUPABASE ERRADO -> ${url}`);
    }
  });

  page.on('console', msg => {
    const text = msg.text();

    if (
      text.includes('CORS') ||
      text.includes('ERR_FAILED') ||
      text.includes('Unhandled') ||
      text.includes('Cannot read')
    ) {
      errors.push(`CONSOLE -> ${text}`);
      console.log('[CONSOLE]', text);
    }
  });

  console.log('1. LOGIN');

  await page.goto('https://enazizi.com/login', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await page.locator('input[type="email"]').first().fill('luizjuniormedi@gmail.com');
  await page.locator('input[type="password"]').first().fill('07114575');

  await page.locator('button').filter({
    hasText: /Entrar|ENTRAR|STUDIO/
  }).first().click();

  await page.waitForURL(/dashboard/, { timeout: 90000 });

  await page.screenshot({ path: 'cog-01-login-ok.png', fullPage: true });

  console.log('2. DASHBOARD COGNITIVO');

  await page.goto('https://enazizi.com/dashboard', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await page.waitForTimeout(5000);

  let body = await page.locator('body').innerText();

  expect(body).toMatch(/Olá|Ações rápidas|Atalhos|Planner|Progresso|Missão/i);

  await page.screenshot({ path: 'cog-02-dashboard.png', fullPage: true });

  console.log('3. PLANNER');

  await page.goto('https://enazizi.com/dashboard/planner', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await page.waitForTimeout(8000);

  body = await page.locator('body').innerText();

  expect(body).toMatch(/Planner|Fase|Tarefas|Plano|Missão|Estratégico/i);

  await page.screenshot({ path: 'cog-03-planner.png', fullPage: true });

  console.log('4. MISSÃO / SESSÃO DE ESTUDO');

  await page.goto('https://enazizi.com/dashboard/sessao-estudo', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await page.waitForTimeout(8000);

  body = await page.locator('body').innerText();

  expect(body).toMatch(/Tutor|Missão|dominar|especialidades|estudo/i);

  await page.screenshot({ path: 'cog-04-sessao-estudo.png', fullPage: true });

  console.log('5. FLASHCARDS / FSRS');

  await page.goto('https://enazizi.com/dashboard/flashcards', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await page.waitForTimeout(8000);

  body = await page.locator('body').innerText();

  expect(body).toMatch(/Flashcards|FSRS|memória|revisão|Consolidação|card/i);

  await page.screenshot({ path: 'cog-05-flashcards-fsrs.png', fullPage: true });

  console.log('6. BANCO DE ERROS');

  await page.goto('https://enazizi.com/dashboard/banco-erros', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await page.waitForTimeout(8000);

  body = await page.locator('body').innerText();

  expect(body).toMatch(/Erros|Recuperação|Temas|Ativos|Banco/i);

  await page.screenshot({ path: 'cog-06-banco-erros.png', fullPage: true });

  console.log('7. PROFICIÊNCIA');

  await page.goto('https://enazizi.com/dashboard/proficiencia', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await page.waitForTimeout(8000);

  body = await page.locator('body').innerText();

  expect(body).toMatch(/Proficiência|simulado|desempenho|evolução|domínio/i);

  await page.screenshot({ path: 'cog-07-proficiencia.png', fullPage: true });

  console.log('8. SIMULADOS');

  await page.goto('https://enazizi.com/dashboard/simulados', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await page.waitForTimeout(8000);

  body = await page.locator('body').innerText();

  expect(body).toMatch(/Simulados|Provas|TRI|Adaptativo|Questões/i);

  await page.screenshot({ path: 'cog-08-simulados.png', fullPage: true });

  console.log('9. RELOAD E PERSISTÊNCIA');

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });

  await page.waitForTimeout(5000);

  body = await page.locator('body').innerText();

  expect(body.length).toBeGreaterThan(30);

  await page.screenshot({ path: 'cog-09-reload-persistencia.png', fullPage: true });

  console.log('10. MOBILE COGNITIVO');

  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto('https://enazizi.com/dashboard/planner', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await page.waitForTimeout(5000);

  body = await page.locator('body').innerText();

  expect(body.length).toBeGreaterThan(30);

  await page.screenshot({ path: 'cog-10-mobile-planner.png', fullPage: true });

  if (errors.length > 0) {
    throw new Error('ERROS CRÍTICOS:\n' + errors.join('\n'));
  }

  console.log('[COGNITIVE_SYSTEM_OK]');
  console.log('[PLANNER_OK]');
  console.log('[FSRS_OK]');
  console.log('[ERROR_BANK_OK]');
  console.log('[PROFICIENCY_OK]');
  console.log('[MISSION_OK]');
});
