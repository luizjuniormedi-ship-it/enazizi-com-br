import { test, expect } from "@playwright/test";

// E2E: Mnemonic Studio resilience.
// Goal: verify page renders, shows form, and never crashes ErrorBoundary.

test.describe("Gerador de Mnemônicos", () => {
  test("abre a tela e renderiza formulário", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    await page.goto("/dashboard/mnemonic-studio");
    await expect(page.getByRole("heading", { name: /mnemônicos/i })).toBeVisible({ timeout: 15000 });

    // Sem ErrorBoundary visível
    await expect(page.getByText(/Algo deu errado/i)).not.toBeVisible();
    expect(consoleErrors.filter((e) => !/ResizeObserver/.test(e))).toHaveLength(0);
  });

  test("erro amigável quando tema é vazio", async ({ page }) => {
    await page.goto("/dashboard/mnemonic-studio");
    const generateBtn = page.getByRole("button", { name: /gerar/i }).first();
    if (await generateBtn.isVisible().catch(() => false)) {
      await generateBtn.click();
      // Mensagem de validação aparece (toast ou inline)
      await expect(page.locator("text=/tema|obrigatório|informe/i").first()).toBeVisible({ timeout: 5000 });
    }
  });
});
