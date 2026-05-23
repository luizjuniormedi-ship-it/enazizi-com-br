import { test, expect } from '@playwright/test';

test.describe('ENAZIZI Stress & Debug Suite', () => {
  
  test.beforeEach(async ({ page }) => {
    // Standard login for all tests
    await page.goto('/login');
    const email = 'test_qa_enazizi@example.com';
    const password = 'Enazizi@2026';
    
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button:has-text("Entrar"), button:has-text("ENTRAR")');
    await expect(page).not.toHaveURL(/.*login.*/);
  });

  test('Mnemonic Auto-Trigger Debug', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.startsWith('[MNEMONIC_')) logs.push(text);
      console.log('Browser log:', text);
    });

    // Navigate with auto=1
    await page.goto('/dashboard/mnemonico?tema=Critérios%20de%20Light&auto=1');
    
    // Check for auto-trigger log
    await expect.poll(() => logs.some(l => l.includes('[MNEMONIC_01_AUTO_TRIGGER]')), {
      message: 'MNEMONIC_01_AUTO_TRIGGER not found in logs',
      timeout: 10000,
    }).toBeTruthy();

    // Check for payload
    await expect.poll(() => logs.some(l => l.includes('[MNEMONIC_02_PAYLOAD]')), {
      timeout: 5000,
    }).toBeTruthy();

    // Wait for response and render
    await expect(page.locator('[data-testid="mnemonic-phrase"]')).toBeVisible({ timeout: 45000 });
    
    // Validate final render logs
    expect(logs.some(l => l.includes('[MNEMONIC_06_RENDER]'))).toBeTruthy();
    
    await page.screenshot({ path: 'mnemonic-auto-success.png' });
  });

  test('Assistant Decisions Concurrency & Refresh Stress', async ({ page }) => {
    const errorCodes: number[] = [];
    page.on('response', res => {
      if (res.url().includes('assistant_decisions')) {
        if (res.status() >= 400) errorCodes.push(res.status());
      }
    });

    await page.goto('/dashboard');
    
    // Trigger multiple events or rapid navigation to stress assistant_decisions
    for (let i = 0; i < 5; i++) {
      await page.goto('/dashboard/perfil');
      await page.goto('/dashboard/mnemonico');
    }

    // Refresh multiple times
    await page.reload();
    await page.reload();

    // Validate zero 409/400
    expect(errorCodes.filter(c => c === 409 || c === 400)).toHaveLength(0);
  });

  test('Tutor V3 Real AI Interaction', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.startsWith('[TUTOR_')) logs.push(text);
    });

    await page.goto('/dashboard/ia-mentor');
    
    // Fill topic
    const input = page.locator('input[placeholder*="Duke"]');
    await input.fill('IAM');
    await page.click('button:has-text("Estudar Agora")');

    // Wait for transition to chat
    await expect(page.getByTestId('agent-input')).toBeVisible({ timeout: 20000 });
    
    // Wait for AI streaming completion
    await expect(page.locator('.prose').first()).toBeVisible({ timeout: 30000 });
    
    const responseText = await page.locator('.prose').first().innerText();
    expect(responseText.length).toBeGreaterThan(50);
    
    // Verify Tutor logs
    expect(logs.some(l => l.includes('[TUTOR_01_SEND_CLICKED]'))).toBeTruthy();
    expect(logs.some(l => l.includes('[TUTOR_22_FRONTEND_DATA_RECEIVED]'))).toBeTruthy();

    await page.screenshot({ path: 'tutor-v3-success.png' });
  });

  test('CORS module_sessions closing tab check', async ({ page }) => {
    const corsErrors: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('Access-Control-Allow-Origin')) corsErrors.push(msg.text());
    });

    await page.goto('/dashboard/mnemonico');
    
    // Simulate navigation away to trigger beforeunload logic
    await page.goto('about:blank');
    
    // If we had a real way to check the network request from a closed tab, we would.
    // For now, we ensure no console errors appeared during the session or navigation.
    expect(corsErrors).toHaveLength(0);
  });

});
