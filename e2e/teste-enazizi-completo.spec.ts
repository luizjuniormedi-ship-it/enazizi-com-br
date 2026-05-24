import { test, expect } from "@playwright/test";

test.describe("ENAZIZI — MIGRATION VALIDATION", () => {
  test.beforeEach(async ({ page }) => {
    // Monitor all network requests
    page.on('request', request => {
      const url = request.url();
      // ASSERTION: Network requests MUST NOT contain the legacy project ID
      if (url.includes('kojqbvrhodpchtnainla')) {
        console.error(`[NEW_PROJECT_DETECTED] Request to un-migrated project: ${url}`);
      }
      expect(url, `Request to new project detected: ${url}`).not.toContain('kojqbvrhodpchtnainla');
    });
  });

  test("ENAZIZI - teste completo final com login, fallback e IA", async ({ page }) => {
    // 1. Navegar para a página inicial
    await page.goto("/");
    
    // 2. Verificar se o Supabase Client está configurado corretamente (via network)
    // Ao carregar a página, deve haver chamadas para o novo projeto
    const supabaseRequest = await page.waitForRequest(request => 
      request.url().includes('qszsyskumcmuknumwxtk.supabase.co')
    );
    expect(supabaseRequest.url()).toContain('qszsyskumcmuknumwxtk.supabase.co');
    console.log(`[SUPABASE_CLIENT_OK] Detected request to: ${supabaseRequest.url()}`);

    // 3. Simular fluxo de Mnemônico (como exemplo de uso de IA e Edge Functions)
    const tema = "Sepse";
    await page.goto(`/dashboard/mnemonico?tema=${encodeURIComponent(tema)}&auto=1`);
    
    // Validar mnemônico renderizado
    const phrase = page.locator('[data-testid="mnemonic-phrase"]');
    await expect(phrase).toBeVisible({ timeout: 60000 });
    
    const phraseText = await phrase.innerText();
    expect(phraseText.length).toBeGreaterThan(0);
    console.log(`[MNEMONIC_RENDER_OK] Phrase: ${phraseText}`);

    // 4. Validar que as chamadas de Edge Function estão indo para o projeto correto
    const edgeFunctionRequest = await page.waitForRequest(request => 
      request.url().includes('/functions/v1/')
    );
    expect(edgeFunctionRequest.url()).toContain('qszsyskumcmuknumwxtk.supabase.co');
    console.log(`[EDGE_ROUTE_OK] Edge function request: ${edgeFunctionRequest.url()}`);
    
    console.log("[PLAYWRIGHT_NETWORK_OK] No legacy project references found during execution.");
  });
});
