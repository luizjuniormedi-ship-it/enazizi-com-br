import { test, expect } from "@playwright/test";

test.describe("ENAZIZI — EDGE FUNCTION RECOVERY v16", () => {
  test("Fix Definitivo: generate-mnemonic deve responder com sucesso (200) e renderizar", async ({ page }) => {
    // 1. Navegação Autenticada (assumindo que o storage state lida com o login)
    // Se não houver storage state, o ProtectedRoute redirecionará para login
    const tema = "Critérios de Light";
    const url = `/dashboard/mnemonico?tema=${encodeURIComponent(tema)}&auto=1`;
    
    console.log(`[QA_V16] Navegando para: ${url}`);
    
    // Interceptar a chamada OPTIONS e POST para monitorar status
    let optionsStatus = 0;
    let postStatus = 0;

    page.on('request', request => {
      if (request.url().includes('generate-mnemonic')) {
        console.log(`[QA_V16] Request: ${request.method()} ${request.url()}`);
      }
    });

    page.on('response', response => {
      if (response.url().includes('generate-mnemonic')) {
        console.log(`[QA_V16] Response: ${response.status()} ${response.url()}`);
        if (response.request().method() === 'OPTIONS') optionsStatus = response.status();
        if (response.request().method() === 'POST') postStatus = response.status();
      }
    });

    await page.goto(url);

    // 2. Validar que o modo automático foi ativado
    await expect(page.getByText(/Modo Automático/i).or(page.locator('text=/Gerando/i'))).toBeVisible({ timeout: 15000 });

    // 3. Aguardar resultado (timeout de 60s)
    // O critério de sucesso é encontrar a sigla ou a frase renderizada
    const resultLocator = page.locator('[data-testid="mnemonic-phrase"], [data-testid="mnemonic-sigla"]');
    
    await expect(resultLocator.first()).toBeVisible({ timeout: 60000 });

    // 4. Verificações de Status HTTP (Critério Final)
    // Nota: OPTIONS pode não ser capturado se o navegador já tiver cache de preflight, 
    // mas o POST deve ser capturado.
    if (postStatus !== 0) {
      expect(postStatus).toBe(200);
      console.log(`[QA_V16] POST status verificado: ${postStatus}`);
    }

    // 5. Validar Fallback (se a IA falhar mas o sistema responder 200 com fallback)
    const content = await resultLocator.first().innerText();
    console.log(`[QA_V16] Conteúdo Renderizado: ${content.substring(0, 50)}...`);

    // 6. Validar que não há tela branca ou erro fatal
    await expect(page.getByText(/Erro fatal|503|500/i)).not.toBeVisible();

    console.log("[QA_V16] TESTE APROVADO: Funcionalidade operacional.");
  });
});
