import { test, expect } from '@playwright/test';

const SUPABASE_PROJECT_REF = "qszsyskumcmuknumwxtk";
const SUPABASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co`;

test.describe('ENAZIZI Full System Validation v12', () => {
  
  test('Verify single Supabase project in requests', async ({ page }) => {
    const wrongProject = "kojqbvrhodpchtnainla";
    let detectedWrongProject = false;

    page.on('request', request => {
      const url = request.url();
      if (url.includes(wrongProject)) {
        detectedWrongProject = true;
        console.error(`[CRITICAL] Request to wrong Supabase project detected: ${url}`);
      }
      if (url.includes('supabase.co')) {
        console.log(`[NETWORK] ${request.method()} ${url}`);
      }
    });

    await page.goto('/');
    
    // Check global build variables if they are injected into window
    const buildInfo = await page.evaluate(() => {
      return {
        supabaseUrl: (window as any).VITE_SUPABASE_URL || 'unknown',
        projectRef: (window as any).VITE_SUPABASE_PROJECT_ID || 'unknown'
      };
    });
    
    console.log(`[BUILD_INFO] URL: ${buildInfo.supabaseUrl}, REF: ${buildInfo.projectRef}`);
    
    expect(detectedWrongProject).toBe(false);
    console.log('[SUPABASE_SINGLE_PROJECT_OK]');
  });

  test('Auth Flow & Dashboard Smoke', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);
    
    // Log in with E2E credentials from .env.e2e
    const email = process.env.E2E_ALUNO_EMAIL || 'luizjuniormedi@gmail.com';
    const password = process.env.E2E_ALUNO_PASSWORD || 'junior455@';
    
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await page.waitForURL(/\/dashboard/);
    console.log('[AUTH_SUCCESS] Dashboard reached');

    const criticalRoutes = [
      '/dashboard',
      '/dashboard/planner',
      '/dashboard/sessao-estudo',
      '/dashboard/simulados',
      '/dashboard/flashcards',
      '/dashboard/banco-erros',
      '/dashboard/mnemonico',
      '/dashboard/progress'
    ];

    for (const route of criticalRoutes) {
      console.log(`[SMOKE] Testing route: ${route}`);
      await page.goto(route);
      
      // Wait for content and check for errors
      await page.waitForLoadState('networkidle');
      
      const bodyText = await page.textContent('body');
      expect(bodyText?.toLowerCase()).not.toContain('error');
      expect(bodyText?.toLowerCase()).not.toContain('failed');
      expect(bodyText?.toLowerCase()).not.toContain('500');
      
      // Check for white screen
      const rootExists = await page.locator('#root').count();
      expect(rootExists).toBe(1);
    }
  });
});
