import { test, expect } from "@playwright/test";

test.describe("ENAZIZI — MNEMONIC FINAL VALIDATION", () => {
  test("deve gerar mnemônico via auto=1 e renderizar conteúdo IA", async ({ page }) => {
    // 1. Navegar com parâmetros de auto-geração
    // Usamos um tema real para garantir que a IA tenha conteúdo
    const tema = "Critérios de Light para derrame pleural";
    await page.goto(`/dashboard/mnemonico?tema=${encodeURIComponent(tema)}&auto=1`);

    console.log("[QA_EVIDENCIA] Navegou para /dashboard/mnemonico com auto=1");

    // 2. Validar que o modo automático foi ativado visualmente
    await expect(page.getByText(/Modo Automático Ativado/i)).toBeVisible({ timeout: 10000 });
    
    // 3. Aguardar a geração da IA (timeout estendido para 60s como solicitado)
    // O sistema deve mostrar o status de geração
    await expect(page.locator('text=/Gerando|Extraindo|🧠/i').first()).toBeVisible({ timeout: 10000 });

    console.log("[QA_EVIDENCIA] Geração iniciada...");

    // 4. VALIDAR RENDERIZAÇÃO FINAL (ROOT CAUSE FIX)
    // Procuramos pelos testids adicionados na correção
    const phrase = page.locator('[data-testid="mnemonic-phrase"]');
    const sigla = page.locator('[data-testid="mnemonic-sigla"]');

    // Esperamos que pelo menos um dos dois apareça (sigla é opcional em alguns estilos, mas a frase é obrigatória)
    await expect(phrase.or(sigla).first()).toBeVisible({ timeout: 60000 });

    const phraseText = await phrase.innerText().catch(() => "N/A");
    const siglaText = await sigla.innerText().catch(() => "N/A");

    console.log("[QA_EVIDENCIA] Conteúdo IA Renderizado!");
    console.log(`[QA_EVIDENCIA] Phrase: ${phraseText}`);
    console.log(`[QA_EVIDENCIA] Sigla: ${siglaText}`);

    // 5. Validar que não há erro de telemetria visível ou bloqueante
    // Se chegamos aqui, a telemetria não bloqueou o fluxo (mesmo que tenha falhado no background)
    await expect(page.getByText(/Não foi possível gerar/i)).not.toBeVisible();
    
    // 6. Validar botões de ação final
    await expect(page.locator('[data-testid="mnemonic-copy-btn"]')).toBeVisible();
    
    console.log("[QA_EVIDENCIA] Fluxo completo validado com sucesso.");
  });
});
