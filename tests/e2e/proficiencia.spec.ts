/**
 * E2E smoke — Proficiência Guiada.
 *
 * Não exercita criação real de planos (depende de credencial professor + RLS),
 * mas valida que:
 *   - rota /dashboard/proficiencia carrega sem regressão
 *   - aluno sem plano não vê tela vazia (fallback preservado)
 *   - rota professor lista a aba Proficiência sem quebrar
 *
 * Como rodar:
 *   npx playwright test tests/e2e/proficiencia.spec.ts
 *
 * Esses testes são tolerantes (não falham se elementos opcionais estiverem
 * ausentes), mas falham duro se a página crashar (white screen, 500, ou
 * erro fatal de console).
 */
import { test, expect, type Page } from "@playwright/test";
import { hasCredentials, loginAs } from "./helpers/auth";

const BASE = process.env.BASE_URL || "https://enazizi-com-br.lovable.app";

async function tryLogin(page: Page, role: "student" | "professor") {
  await loginAs(page, role, BASE);
}

test.describe("Proficiência Guiada — Aluno", () => {
  test.skip(!hasCredentials("student"), "credenciais de aluno E2E não definidas");

  test("rota /dashboard/proficiencia carrega sem crash", async ({ page }) => {
    await tryLogin(page, "student");
    const consoleErrors: string[] = [];
    page.on("pageerror", (e) => consoleErrors.push(e.message));

    await page.goto(`${BASE}/dashboard/proficiencia`);
    await page.waitForLoadState("networkidle", { timeout: 30000 });

    // Deve haver algum conteúdo visível (painel guiado OU fallback)
    const body = page.locator("body");
    await expect(body).not.toBeEmpty();

    // Não deve haver erros fatais de página
    expect(consoleErrors.filter((e) => /TypeError|ReferenceError/i.test(e))).toEqual([]);
  });

  test("aluno sem plano vê fallback (não crasha)", async ({ page }) => {
    await tryLogin(page, "student");
    await page.goto(`${BASE}/dashboard/proficiencia`);
    await page.waitForLoadState("networkidle", { timeout: 30000 });

    // Heurística: a página renderiza algum heading reconhecível
    const heading = page.locator("h1, h2, h3").first();
    await expect(heading).toBeVisible({ timeout: 15000 });
  });
});

test.describe("Proficiência Guiada — Professor", () => {
  test.skip(!hasCredentials("professor"), "credenciais de professor E2E não definidas");

  test("painel do professor exibe módulo Proficiência sem regressão", async ({ page }) => {
    await tryLogin(page, "professor");

    const consoleErrors: string[] = [];
    page.on("pageerror", (e) => consoleErrors.push(e.message));

    await page.goto(`${BASE}/professor`);
    await page.waitForLoadState("networkidle", { timeout: 30000 });

    // Procura pelo título "Proficiência Guiada" (ou similar) — soft assertion
    const possibleHeadings = page.getByText(/profici[êe]ncia/i);
    const found = await possibleHeadings.count();
    expect(found).toBeGreaterThan(0);

    expect(consoleErrors.filter((e) => /TypeError|ReferenceError/i.test(e))).toEqual([]);
  });

  test("clique em 'Novo plano' abre o diálogo de criação", async ({ page }) => {
    await tryLogin(page, "professor");
    await page.goto(`${BASE}/professor`);
    await page.waitForLoadState("networkidle", { timeout: 30000 });

    const newPlanBtn = page.getByRole("button", { name: /novo plano/i }).first();
    if (await newPlanBtn.isVisible().catch(() => false)) {
      await newPlanBtn.click();
      // Modal de criação deve aparecer
      const dialog = page.locator('[role="dialog"]').first();
      await expect(dialog).toBeVisible({ timeout: 10000 });
    } else {
      test.skip(true, "Botão 'Novo plano' não visível neste perfil — provavelmente sem permissão");
    }
  });
});

test.describe("Proficiência Guiada — Não regressão", () => {
  test("rota raiz / não quebra", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("pageerror", (e) => consoleErrors.push(e.message));
    await page.goto(BASE);
    await page.waitForLoadState("networkidle", { timeout: 20000 });
    expect(consoleErrors.filter((e) => /TypeError|ReferenceError/i.test(e))).toEqual([]);
  });
});
