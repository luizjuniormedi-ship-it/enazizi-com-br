import { test, expect } from '@playwright/test';

test.describe('ENAZIZI Stress & Debug Suite v2', () => {
  
  test.beforeEach(async ({ page }) => {
    // Standard login for all tests
    await page.goto('/login');
    const email = 'test_qa_enazizi@example.com';
    const password = 'Enazizi@2026';
    
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button:has-text("Entrar"), button:has-text("ENTRAR")');
    // Onboarding gate might be visible
    await page.waitForURL(url => url.pathname.includes('/enaflix') || url.pathname.includes('/dashboard'), { timeout: 15000 });
  });

  test('Mnemonic Auto-Trigger Debug & Visual Check', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[MNEMONIC_')) {
        logs.push(text);
        console.log('MNEMONIC LOG:', text);
      }
    });

    // Navigate with auto=1
    await page.goto('/dashboard/mnemonico?tema=Critérios%20de%20Light&auto=1');
    
    // Check for auto-trigger log
    await expect.poll(() => logs.some(l => l.includes('[MNEMONIC_01_AUTO_TRIGGER]')), {
      message: 'MNEMONIC_01_AUTO_TRIGGER not found in logs',
      timeout: 10000,
    }).toBeTruthy();

    // Wait for the mnemonic result to appear in the DOM
    // We used data-testid="mnemonic-phrase" in the code
    const phrase = page.locator('[data-testid="mnemonic-phrase"]');
    await expect(phrase).toBeVisible({ timeout: 60000 });
    
    const textContent = await phrase.innerText();
    console.log('GENERATED MNEMONIC:', textContent);
    expect(textContent.length).toBeGreaterThan(10);
    
    // Validate final render logs
    expect(logs.some(l => l.includes('[MNEMONIC_06_RENDER]'))).toBeTruthy();
    
    await page.screenshot({ path: 'mnemonic-auto-success-v2.png' });
  });

  test('Assistant Decisions Concurrency & Refresh Stress', async ({ page }) => {
    const errorResponses: any[] = [];
    page.on('response', res => {
      if (res.url().includes('assistant_decisions')) {
        if (res.status() >= 400) {
          errorResponses.push({ url: res.url(), status: res.status() });
          console.error(`DB ERROR: ${res.status()} on ${res.url()}`);
        }
      }
    });

    await page.goto('/dashboard');
    
    // Stress navigation
    for (let i = 0; i < 3; i++) {
      await page.click('a[href*="perfil"]');
      await page.waitForTimeout(500);
      await page.click('a[href*="mnemonico"]');
      await page.waitForTimeout(500);
    }

    // Refresh multiple times to check for race conditions on boot telemetry
    await page.reload();
    await page.reload();

    // Filter for 409 (Conflict) and 400 (Bad Request - usually on_conflict mismatch)
    const conflicts = errorResponses.filter(r => r.status === 409 || r.status === 400);
    expect(conflicts).toHaveLength(0);
  });

  test('Tutor V3 Real AI Interaction & Content Check', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[TUTOR_')) logs.push(text);
    });

    await page.goto('/dashboard/ia-mentor');
    
    // Fill topic
    const input = page.locator('input[placeholder*="Duke"]');
    await input.fill('IAM');
    await page.click('button:has-text("Estudar Agora")');

    // Wait for transition to chat
    await expect(page.getByTestId('agent-input')).toBeVisible({ timeout: 20000 });
    
    // Wait for AI streaming content
    const responseLocator = page.locator('.prose').first();
    await expect(responseLocator).toBeVisible({ timeout: 45000 });
    
    // Ensure it's not a generic error
    const responseText = await responseLocator.innerText();
    console.log('TUTOR RESPONSE:', responseText);
    expect(responseText.toLowerCase()).not.toContain('erro inesperado');
    expect(responseText.length).toBeGreaterThan(100);
    
    // Check for pedagogical block rendering (e.g. bold titles)
    await expect(page.locator('.prose strong')).toBeVisible();

    await page.screenshot({ path: 'tutor-v3-success-v2.png' });
  });

  test('CORS module_sessions beforeunload logic', async ({ page }) => {
    const corsErrors: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('Access-Control-Allow-Origin')) {
        corsErrors.push(msg.text());
        console.error('CORS ERROR:', msg.text());
      }
    });

    await page.goto('/dashboard/mnemonico');
    await page.waitForTimeout(2000); // Allow session to init
    
    // Trigger unload
    await page.goto('about:blank');
    await page.waitForTimeout(1000);
    
    expect(corsErrors).toHaveLength(0);
  });

});
