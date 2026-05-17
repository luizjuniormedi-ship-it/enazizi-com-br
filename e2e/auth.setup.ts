/**
 * ENAZIZI E2E — Auth Setup
 * 
 * Cria sessões autenticadas para cada perfil.
 * Configure as variáveis de ambiente:
 *   E2E_ALUNO_EMAIL / E2E_ALUNO_PASSWORD
 *   E2E_PROFESSOR_EMAIL / E2E_PROFESSOR_PASSWORD
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD
 */
import { test as setup, expect } from '@playwright/test';

const PROFILES = [
  { name: 'aluno', email: process.env.E2E_ALUNO_EMAIL!, password: process.env.E2E_ALUNO_PASSWORD! },
  { name: 'professor', email: process.env.E2E_PROFESSOR_EMAIL!, password: process.env.E2E_PROFESSOR_PASSWORD! },
  { name: 'admin', email: process.env.E2E_ADMIN_EMAIL!, password: process.env.E2E_ADMIN_PASSWORD! },
];

for (const profile of PROFILES) {
  setup(`authenticate as ${profile.name}`, async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', profile.email);
    await page.fill('input[type="password"]', profile.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|enaflix|admin|professor)/, { timeout: 15000 });
    await page.context().storageState({ path: `e2e/.auth/${profile.name}.json` });
  });
}
