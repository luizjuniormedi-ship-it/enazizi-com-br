/**
 * Playwright — Fase 2 Mobile Hardening
 * Spec NÃO RODA EM CI durante o freeze. Skipado por padrão.
 *
 * Detecta regressões silenciosas em rotas críticas:
 * - overlays bloqueantes
 * - pointer-events-none sobre CTAs
 * - botões sem onClick
 *
 * Pós-freeze: ativar em CI varrendo rotas principais.
 */
import { test, expect, devices } from "@playwright/test";

const ENABLED = process.env.MOBILE_HARDENING_V2 === "on";

const CRITICAL_ROUTES = [
  "/missao-estudo",
  "/tutor",
  "/simulados",
  "/planner",
  "/predictor",
  "/banco-erros",
];

test.describe("Mobile Hardening v2 — overlay & dead-button regression", () => {
  test.skip(!ENABLED, "Skipped durante freeze (até pós-24/05/2026).");
  test.use({ ...devices["iPhone 13"] });

  for (const route of CRITICAL_ROUTES) {
    test(`rota ${route} sem overlays bloqueantes`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");

      const issues = await page.evaluate(async () => {
        // @ts-ignore — resolvido em runtime pelo Vite dev server
        const mod = await import("/src/mobile-hardening/utils/overlayDetector.ts");
        return mod.detectOverlayIssues(document.body).map((i: any) => ({
          type: i.type,
          message: i.message,
          tag: i.element.tagName,
        }));
      });

      expect(issues, JSON.stringify(issues, null, 2)).toEqual([]);
    });

    test(`rota ${route} sem botões mortos`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");

      const dead = await page.evaluate(async () => {
        // @ts-ignore — resolvido em runtime pelo Vite dev server
        const mod = await import(
          "/src/mobile-hardening/utils/clickableAssertions.ts"
        );
        return mod.detectDeadButtons(document.body).map((i: any) => ({
          reason: i.reason,
          message: i.message,
        }));
      });

      expect(dead, JSON.stringify(dead, null, 2)).toEqual([]);
    });
  }
});
