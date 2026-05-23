
import { test, expect } from '@playwright/test';

test.describe('AI Gateway Resilience', () => {
  test('should fallback to second provider when first returns 429', async ({ page }) => {
    // Mock 429 for the first attempt of generate-mnemonic
    let callCount = 0;
    await page.route('**/functions/v1/generate-mnemonic', async (route) => {
      callCount++;
      const body = JSON.parse(route.request().postData() || '{}');
      
      if (callCount === 1) {
        // Force 429 for the first model (gemini-2.5-flash-lite)
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({ 
            error: 'RESOURCE_EXHAUSTED',
            message: 'GenerateRequestsPerDayPerModel-FreeTier quota exceeded' 
          }),
        });
      } else {
        // Succeed for the second model
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              sigla: "TEST",
              frase_mnemonica: "This is a test mnemonic",
              associacoes_json: [
                { letra: "T", termo_original: "Test", representacao_no_mnemonico: "Test" },
                { letra: "E", termo_original: "Example", representacao_no_mnemonico: "Example" },
                { letra: "S", termo_original: "Sample", representacao_no_mnemonico: "Sample" },
                { letra: "T", termo_original: "Try", representacao_no_mnemonico: "Try" }
              ],
              score_final: 95
            }
          }),
        });
      }
    });

    await page.goto('/dashboard/mnemonicos');
    
    // Fill form
    await page.fill('input[placeholder*="Ex: ECG"]', 'Teste de Resiliência');
    await page.fill('textarea', 'Item 1\nItem 2\nItem 3');
    
    // Click generate
    await page.click('button:has-text("Gerar Mnemônico")');
    
    // Check for fallback message in the button if possible, or just check result
    // The button should briefly show "Trocando provedor de IA..."
    await expect(page.locator('button:has-text("Trocando provedor de IA...")').or(page.locator('text=TEST'))).toBeVisible();
    
    // Check final result
    await expect(page.locator('text=TEST')).toBeVisible();
    await expect(page.locator('text="This is a test mnemonic"')).toBeVisible();
  });

  test('should use cache for repeated prompts', async ({ page }) => {
    let callCount = 0;
    await page.route('**/functions/v1/generate-mnemonic', async (route) => {
      callCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            sigla: "CACHE",
            frase_mnemonica: "Recovered from cache",
            associacoes_json: [
              { letra: "C", termo_original: "C1", representacao_no_mnemonico: "C1" },
              { letra: "A", termo_original: "A1", representacao_no_mnemonico: "A1" },
              { letra: "C", termo_original: "C2", representacao_no_mnemonico: "C2" },
              { letra: "H", termo_original: "H1", representacao_no_mnemonico: "H1" },
              { letra: "E", termo_original: "E1", representacao_no_mnemonico: "E1" }
            ]
          }
        }),
      });
    });

    // We need to bypass the real supabase call for cache check or mock it
    // For simplicity, we just test that the second click is faster/shows cache badge if implemented
    
    await page.goto('/dashboard/mnemonicos');
    await page.fill('input[placeholder*="Ex: ECG"]', 'Cache Test');
    await page.fill('textarea', 'Item 1\nItem 2\nItem 3');
    
    await page.click('button:has-text("Gerar Mnemônico")');
    await expect(page.locator('text=CACHE')).toBeVisible();
    
    // Close and open again with same data
    await page.click('button:has-text("Fechar")');
    await page.click('button:has-text("Mnemônico")');
    await page.fill('input[placeholder*="Ex: ECG"]', 'Cache Test');
    await page.fill('textarea', 'Item 1\nItem 2\nItem 3');
    
    await page.click('button:has-text("Gerar Mnemônico")');
    
    // Check for cache hit message (if we implement a badge for it)
    await expect(page.locator('text=Resultado recuperado do cache').or(page.locator('text=Cache hit'))).toBeVisible();
  });
});
