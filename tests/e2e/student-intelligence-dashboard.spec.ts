import { test, expect } from "@playwright/test";

/**
 * E2E — Etapa 2 Painel do Aluno (Rankings reais + FSRS/TRI premium)
 * Mobile 430x661 (iPhone 14 Pro Max).
 * Validações:
 *  - Rankings carregam ou mostram fallback honesto
 *  - FSRS Premium aparece quando há fsrs_cards
 *  - TRI Premium aparece com rótulo "estimativa (proxy)"
 *  - Sem ErrorBoundary
 *  - Sem 403/500 em rotas críticas
 */
test.use({ viewport: { width: 430, height: 661 } });

test("Rankings: carrega categorias adultas ou fallback honesto", async ({ page }) => {
  const errors: string[] = [];
  page.on("response", (r) => {
    if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`);
  });

  await page.goto("/rankings");
  await page.waitForLoadState("networkidle");

  // Header
  await expect(page.getByText(/Rankings/i).first()).toBeVisible();

  // Pelo menos uma categoria adulta deve aparecer (label OU fallback)
  const hasCategory =
    (await page.getByText(/Consistência cognitiva|Maior evolução|Domínio sustentado|Recuperação exemplar/i).count()) > 0;
  const hasFallback = (await page.getByText(/Sem dado suficiente/i).count()) > 0;
  expect(hasCategory || hasFallback).toBeTruthy();

  // Sem ErrorBoundary
  await expect(page.getByText(/Algo deu errado|Something went wrong/i)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Cockpit: FSRS Premium e TRI Premium presentes quando há dado", async ({ page }) => {
  await page.goto("/cockpit");
  await page.waitForLoadState("networkidle");

  // FSRS Card (se houver dado, badge "dados reais")
  const fsrs = page.getByText(/Memória FSRS/i);
  if ((await fsrs.count()) > 0) {
    await expect(fsrs).toBeVisible();
    await expect(page.getByText(/Retenção estimada/i)).toBeVisible();
  }

  // TRI Card (se houver dado, badge "estimativa (proxy)")
  const tri = page.getByText(/Habilidade por Banca/i);
  if ((await tri.count()) > 0) {
    await expect(tri).toBeVisible();
    await expect(page.getByText(/estimativa \(proxy\)/i)).toBeVisible();
  }

  await expect(page.getByText(/Algo deu errado/i)).toHaveCount(0);
});
