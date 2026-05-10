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
  'CDN Validation',
  'PIPELINE',
  'TELEMETRY',
  'CLUSTER-GPU'
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

    // 3. Trigger CME modal (by clicking suggestions or typing)
    // We try to find any suggestion first
    const suggestion = page.locator('button:has-text("ECG"), button:has-text("Sepse")').first();
    if (await suggestion.isVisible()) {
      await suggestion.click();
    } else {
      await page.fill('input[placeholder*="Duke"]', 'Protocolo de Sepse');
      await page.press('input[placeholder*="Duke"]', 'Enter');
    }

    // 4. Wait for the CME status modal to potentially appear
    const modalTitle = page.getByText('Geração da aula');
    
    // Check if it appears within 10s
    const modalAppeared = await modalTitle.isVisible({ timeout: 10000 }).catch(() => false);

    // 5. Audit the entire page content for tech terms (case insensitive regex check)
    const bodyText = await page.innerText('body');
    
    for (const term of TECH_TERMS) {
      // Use regex to avoid partial matches if necessary, but here we want to be strict
      const regex = new RegExp(term, 'i');
      expect(bodyText).not.toMatch(regex);
    }

    // 6. Verify humanized labels if modal is open
    if (modalAppeared) {
      // Should show friendly labels
      await expect(page.getByText('Preparando sua aula…')).toBeVisible();
      
      // Should NOT show tech headers
      await expect(page.getByText('TutorCME_Pipeline', { exact: false })).not.toBeVisible();
      await expect(page.getByText('Semantic Planning', { exact: false })).not.toBeVisible();
    }
  });

  test('Admin SHOULD see technical CME terms in Admin Audit', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    const email = process.env.E2E_USER_EMAIL;
    const password = process.env.E2E_USER_PASSWORD;
    
    if (email && password) {
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', password);
      await page.click('button:has-text("Entrar"), button:has-text("ENTRAR")');
    }

    // 2. Go to Admin Audit
    await page.goto('/admin/cme-audit');
    
    // 3. Check if we have access and see technical terms
    if (page.url().includes('admin/cme-audit')) {
      await expect(page.getByText('Aggregation Status')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Render Status')).toBeVisible();
    } else {
      console.log('Skipping admin check as current user is not an admin.');
    }
  });
});
