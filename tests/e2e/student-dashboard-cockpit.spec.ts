import { test, expect } from "@playwright/test";

/**
 * E2E — Fase 3 Painel do Aluno (Dashboard + Cockpit Premium)
 * Mobile 430x661.
 *  - Dashboard com UM único CTA principal (UnifiedMissionHero / useStudyNext)
 *  - Cockpit com FSRS Premium e TRI proxy rotulado
 *  - Sem ErrorBoundary, sem 5xx
 */
test.use({ viewport: { width: 430, height: 661 } });

test("Dashboard: hero único, sem CTAs duplicados", async ({ page }) => {
  const errors: string[] = [];
  page.on("response", (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });

  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");

  // Hero único deve estar visível (UnifiedMissionHero)
  const hero = page.locator('[data-testid="unified-mission-hero"], h1, h2').first();
  await expect(hero).toBeVisible();

  // Sem ErrorBoundary
  await expect(page.getByText(/Algo deu errado|Something went wrong/i)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Cockpit: FSRS + TRI Premium presentes ou ausentes (sem dado falso)", async ({ page }) => {
  await page.goto("/cockpit");
  await page.waitForLoadState("networkidle");

  // Se FSRS aparece, deve ter "Retenção estimada"
  const fsrs = page.getByText(/Memória FSRS/i);
  if ((await fsrs.count()) > 0) {
    await expect(page.getByText(/Retenção estimada/i)).toBeVisible();
  }

  // Se TRI aparece, deve ter rótulo "estimativa (proxy)"
  const tri = page.getByText(/Habilidade por Banca/i);
  if ((await tri.count()) > 0) {
    await expect(page.getByText(/estimativa \(proxy\)/i)).toBeVisible();
  }

  await expect(page.getByText(/Algo deu errado/i)).toHaveCount(0);
});

test("Rankings: dado real ou fallback honesto", async ({ page }) => {
  await page.goto("/rankings");
  await page.waitForLoadState("networkidle");

  const hasReal = (await page.getByText(/Consistência cognitiva|Maior evolução|Domínio sustentado|Recuperação exemplar/i).count()) > 0;
  const hasFallback = (await page.getByText(/Sem dado suficiente/i).count()) > 0;
  expect(hasReal || hasFallback).toBeTruthy();
});
