
import { test, expect } from '@playwright/test';

test.describe('AI Gateway Stress Test & Resilience', () => {
  test('should handle massive concurrent AI requests without crashing', async ({ page }) => {
    // 1. Login
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'teste@enazizi.com.br');
    await page.fill('input[type="password"]', '123456');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await expect(page).toHaveURL(/.*dashboard/);

    console.log('--- STARTING AI STRESS TEST (30 CONCURRENT REQUESTS) ---');

    // 2. Simulate 30 concurrent mnemonic generations
    const requests = Array.from({ length: 30 }).map((_, i) => {
      const topic = `Stress Test Topic ${i} ${Math.random().toString(36).substring(7)}`;
      return page.evaluate(async (t) => {
        const { supabase } = window as any;
        return supabase.functions.invoke('generate-mnemonic', {
          body: { tema: t, auto_extract_terms: true }
        });
      }, topic);
    });

    const results = await Promise.allSettled(requests);

    const successCount = results.filter(r => r.status === 'fulfilled' && (r.value as any).data?.success).length;
    const failureCount = results.length - successCount;

    console.log(`STRESS TEST RESULTS: Success: ${successCount}, Failure: ${failureCount}`);

    // We expect at least some to succeed due to fallbacks, and none should crash the browser
    expect(successCount).toBeGreaterThan(0);
    
    // 3. Verify Fallback Logic in Logs (simulated via console check if we had logs)
    // In a real scenario, we'd check if any 429 was handled and retried with fallback
    
    // 4. Check for "High Demand" or "Fallback" messages in the UI (if we implemented them)
    // For now, just ensure the app is still responsive
    await page.click('button:has-text("Mnemônico")');
    await expect(page.locator('text=Gerar Mnemônico Visual')).toBeVisible();
  });

  test('should use cache for repeated prompts', async ({ page }) => {
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'teste@enazizi.com.br');
    await page.fill('input[type="password"]', '123456');
    await page.click('button[type="submit"]');

    const topic = "Cache Test Topic " + Date.now();

    // First call (cold)
    const start1 = Date.now();
    await page.evaluate(async (t) => {
      const { supabase } = window as any;
      return supabase.functions.invoke('generate-mnemonic', {
        body: { tema: t, auto_extract_terms: true }
      });
    }, topic);
    const duration1 = Date.now() - start1;

    // Second call (hot - should be cached)
    const start2 = Date.now();
    await page.evaluate(async (t) => {
      const { supabase } = window as any;
      return supabase.functions.invoke('generate-mnemonic', {
        body: { tema: t, auto_extract_terms: true }
      });
    }, topic);
    const duration2 = Date.now() - start2;

    console.log(`Cold call: ${duration1}ms, Hot call: ${duration2}ms`);
    expect(duration2).toBeLessThan(duration1);
  });
});
