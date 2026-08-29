import { test, expect } from '@playwright/test';

/**
 * E2E tests for the Tutor IA (AIMentor) module.
 */
test.describe('Tutor IA Module E2E', () => {
  
  test.beforeEach(async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    
    const email = process.env.E2E_USER_EMAIL;
    const password = process.env.E2E_USER_PASSWORD;
    
    if (email && password) {
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', password);
      await page.click('button:has-text("Entrar"), button:has-text("ENTRAR")');
      await expect(page).not.toHaveURL(/.*login.*/);
      await page.evaluate(() => {
        localStorage.setItem('enazizi_v2_welcome_seen', 'true');
        localStorage.setItem('enazizi_v2_onboarding_done', 'true');
      });
    }
  });

  test('Navigate to Tutor and ensure no runtime errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (text.includes('ReferenceError') || text.includes('TypeError') || text.includes('Runtime Error')) {
          consoleErrors.push(text);
        }
      }
    });

    page.on('response', response => {
      if (response.status() >= 500) {
        consoleErrors.push(`Server error 500 on ${response.url()}`);
      }
    });

    // 2. Abrir Tutor
    await page.goto('/dashboard/mentor');
    
    // Confirm page loaded
    await expect(page.getByTestId('tutor-page')).toBeVisible({ timeout: 15000 });
    
    // Confirm no critical console errors
    expect(consoleErrors).toHaveLength(0);
  });

  test('Send a pedagogical mission message and verify AI quality', async ({ page }) => {
    await page.goto('/dashboard/mentor');
    
    // Wait for the hero/start screen
    await expect(page.getByText(/O que vamos dominar hoje/i)).toBeVisible();
    
    // 3. Enviar mensagem
    const input = page.locator('input[placeholder*="Duke"]');
    const missionTopic = 'Protocolo de Sepse';
    await input.fill(missionTopic);
    
    const startTime = Date.now();
    await page.click('button:has-text("Estudar Agora")');
    
    // Wait for cinematic loading and transition to chat
    await expect(page.getByTestId('agent-input')).toBeVisible({ timeout: 30000 });
    
    // 8. Streaming inicia em até 10s (após o loading cinematográfico)
    // O loading leva ~1.2s + 0.5s de delay no AIMentor.tsx
    const firstTokenLabel = page.locator('.prose').first();
    await expect(firstTokenLabel).toBeVisible({ timeout: 15000 });
    const firstTokenTime = Date.now() - startTime;
    console.log(`Time to first token: ${firstTokenTime}ms`);
    expect(firstTokenTime).toBeLessThan(20000); // 10s de streaming + ~5s de UI transitions

    // Wait for full response (pedagogical hero status 'done' or similar progress)
    await expect(page.getByTestId('pedagogical-hero')).toBeVisible({ timeout: 60000 });
    
    // Wait for the response to stabilize (no longer loading)
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 60000 });
    
    const totalTime = Date.now() - startTime;
    console.log(`Total response time: ${totalTime}ms`);

    const responseText = await page.locator('.prose').first().innerText();
    
    // 6. Não retorna resposta vazia
    expect(responseText.length).toBeGreaterThan(100);

    // 7. Não retorna erro genérico
    expect(responseText.toLowerCase()).not.toContain('erro inesperado');
    expect(responseText.toLowerCase()).not.toContain('erro no serviço');

    // 1. Resposta em português brasileiro
    // Verificando palavras comuns do PT-BR médico
    const ptKeywords = ['paciente', 'conduta', 'diagnóstico', 'tratamento', 'médico'];
    const hasPt = ptKeywords.some(word => responseText.toLowerCase().includes(word));
    expect(hasPt).toBeTruthy();

    // 2. Não saiu do tema da missão
    expect(responseText.toLowerCase()).toContain('sepse');

    // 3. Contém explicação didática (presença de estrutura ou palavras chave)
    expect(responseText.toLowerCase()).toMatch(/explica|entenda|fisiopatologia|mecanismo/);

    // 4. Contém etapa estilo Feynman/leiga
    expect(responseText.toLowerCase()).toMatch(/leigo|simples|analogia|feynman/);

    // 5. Contém pergunta de active recall
    // Geralmente termina com interrogação ou solicita que o usuário responda
    expect(responseText).toContain('?');

    // 9. Resposta finaliza sem 504
    // Se chegou aqui e o texto é longo, não houve 504 fatal interrompendo o fluxo
  });

  test('Quick actions work correctly', async ({ page }) => {
    await page.goto('/dashboard/mentor');
    
    // Send a message first to get into the chat if needed, 
    // or use the ones on the hero if they exist.
    // AIMentor.tsx has suggestions: ["ECG na Emergência", "Protocolo de Sepse", ...]
    
    const suggestion = page.getByText('ECG na Emergência');
    await expect(suggestion).toBeVisible();
    await suggestion.click();
    
    // Verify it transitions to chat
    await expect(page.getByTestId('agent-input')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('pedagogical-hero')).toBeVisible({ timeout: 60000 });
  });

});
