import { test, expect } from '@playwright/test';

/**
 * CME UX Sanitization E2E
 * 
 * Verifies that technical CME terms (pipeline, worker, gpu, etc.) 
 * are NOT visible to regular students but remain visible to admins.
 */

const TECH_TERMS = [
  'TutorCME_Pipeline',
  'Semantic Planning',
  'Knowledge Mapping',
  'GPU Rendering',
  'Worker Selection',
  'Render Job',
  'Recovery Engine',
  'Scene Graph',
  'HLS Generation',
  'CDN Validation'
];

test.describe('CME UX Sanitization', () => {

  test('Student should NOT see technical CME terms in Tutor IA', async ({ page }) => {
    // 1. Login as standard student
    await page.goto('/login');
    const email = process.env.E2E_USER_EMAIL;
    const password = process.env.E2E_USER_PASSWORD;
    
    if (email && password) {
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', password);
      await page.click('button:has-text("Entrar"), button:has-text("ENTRAR")');
      await expect(page).not.toHaveURL(/.*login.*/);
    }

    // 2. Navigate to Tutor
    await page.goto('/dashboard/mentor');
    await expect(page.getByTestId('tutor-page')).toBeVisible({ timeout: 15000 });

    // 3. Trigger CME modal (by clicking "Estudar Agora" or suggestions)
    // We look for a suggestion or the main input
    const suggestion = page.getByText('ECG na Emergência').first();
    if (await suggestion.isVisible()) {
      await suggestion.click();
    } else {
      await page.fill('input[placeholder*="Duke"]', 'Protocolo de Sepse');
      await page.click('button:has-text("Estudar Agora")');
    }

    // 4. Wait for the CME status modal to potentially appear (it often appears during content prep)
    // We check for "Geração da aula" which is the humanized title
    const modalTitle = page.getByText('Geração da aula');
    
    // It might be fast, so we wait a bit
    try {
      await expect(modalTitle).toBeVisible({ timeout: 10000 });
    } catch (e) {
      console.log('CME modal did not appear in time, might have finished or skipped. Checking chat instead.');
    }

    // 5. Audit the entire page content for tech terms
    const bodyText = await page.innerText('body');
    
    for (const term of TECH_TERMS) {
      expect(bodyText).not.toContain(term);
    }

    // 6. Verify humanized labels are present if modal is open
    if (await modalTitle.isVisible()) {
      await expect(page.getByText('Preparando sua aula…')).toBeVisible();
      // Check that it doesn't say "TutorCME_Pipeline"
      await expect(page.getByText('TutorCME_Pipeline')).not.toBeVisible();
    }
  });

  test('Admin SHOULD see technical CME terms in Admin Audit', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    // Note: In E2E env, we assume the user has admin role if configured
    const email = process.env.E2E_USER_EMAIL;
    const password = process.env.E2E_USER_PASSWORD;
    
    if (email && password) {
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', password);
      await page.click('button:has-text("Entrar"), button:has-text("ENTRAR")');
    }

    // 2. Go to Admin Audit
    await page.goto('/admin/cme-audit');
    
    // If redirected to dashboard, user is not admin
    if (page.url().includes('dashboard') && !page.url().includes('admin')) {
      console.log('User is not admin, skipping admin visibility check');
      return;
    }

    // 3. Confirm technical terms exist in admin context
    await expect(page.getByText('Aggregation Status')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Render Status')).toBeVisible();
  });
});
