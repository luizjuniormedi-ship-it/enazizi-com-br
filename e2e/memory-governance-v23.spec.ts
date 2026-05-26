/**
 * e2e/memory-governance-v23.spec.ts
 * Smoke test do observatório de memória v23:
 *  - admin acessa /admin/memory-health
 *  - dashboard renderiza KPIs
 *  - botão "Rodar Drift Analysis" não quebra
 *  - link para /admin/memory-hallucinations funciona
 */
import { test, expect } from "@playwright/test";

test.describe("Memory Governance v23", () => {
  test.use({ storageState: "playwright/.auth/admin.json" });

  test("dashboard /admin/memory-health renderiza", async ({ page }) => {
    await page.goto("/admin/memory-health");
    await expect(page.getByRole("heading", { name: /Memory Health Observatory/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Reuse/i).first()).toBeVisible();
    await expect(page.getByText(/Quality & Promotion Funnel/i)).toBeVisible();
    await expect(page.getByText(/Drift & Decay/i)).toBeVisible();
    await expect(page.getByText(/Cost \(últimos 30d\)/i)).toBeVisible();
    await expect(page.getByText(/Safety/i)).toBeVisible();
  });

  test("drift analysis manual executa", async ({ page }) => {
    await page.goto("/admin/memory-health");
    await page.getByRole("button", { name: /Rodar Drift Analysis/i }).click();
    // ok se aparecer toast (sucesso ou erro tratado), não deve travar
    await page.waitForTimeout(2500);
    await expect(page.getByRole("heading", { name: /Memory Health Observatory/i })).toBeVisible();
  });

  test("hallucination forensics carrega", async ({ page }) => {
    await page.goto("/admin/memory-hallucinations");
    await expect(page.getByRole("heading", { name: /Hallucination Forensics/i })).toBeVisible({ timeout: 10_000 });
  });
});
