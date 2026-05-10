/**
 * Playwright — Fase 2 Mobile Hardening
 * Spec NÃO RODA EM CI durante o freeze. Skipado por padrão.
 *
 * Cobertura:
 * - HeaderSafe respeita env(safe-area-inset-top)
 * - FooterSafe respeita env(safe-area-inset-bottom)
 * - KeyboardSafeContainer compensa visualViewport ao abrir teclado simulado
 *
 * Para rodar localmente pós-freeze:
 *   MOBILE_HARDENING_V2=on npx playwright test mobile-safe-area
 */
import { test, expect, devices } from "@playwright/test";

const ENABLED = process.env.MOBILE_HARDENING_V2 === "on";

test.describe("Mobile Hardening v2 — safe-area", () => {
  test.skip(!ENABLED, "Skipped durante freeze (até pós-24/05/2026).");

  test.use({ ...devices["iPhone 13"] });

  test("HeaderSafe não fica atrás da status bar", async ({ page }) => {
    // Página de demo a ser criada pós-freeze em /dev/mobile-hardening
    await page.goto("/dev/mobile-hardening");
    const header = page.getByTestId("header-safe-demo");
    const top = await header.evaluate((el) => el.getBoundingClientRect().top);
    expect(top).toBeGreaterThanOrEqual(0);

    const paddingTop = await header.evaluate(
      (el) => parseFloat(getComputedStyle(el).paddingTop) || 0
    );
    expect(paddingTop).toBeGreaterThan(0);
  });

  test("FooterSafe respeita safe-area-bottom", async ({ page }) => {
    await page.goto("/dev/mobile-hardening");
    const footer = page.getByTestId("footer-safe-demo");
    const paddingBottom = await footer.evaluate(
      (el) => parseFloat(getComputedStyle(el).paddingBottom) || 0
    );
    // Em iPhone 13: home indicator ~34px + extra default 16
    expect(paddingBottom).toBeGreaterThanOrEqual(34);
  });

  test("KeyboardSafeContainer compensa teclado virtual", async ({ page }) => {
    await page.goto("/dev/mobile-hardening");
    const input = page.getByTestId("keyboard-safe-input");
    await input.focus();

    // Simula resize do visualViewport (teclado abrindo).
    await page.evaluate(() => {
      Object.defineProperty(window.visualViewport, "height", {
        configurable: true,
        get: () => window.innerHeight - 300,
      });
      window.visualViewport?.dispatchEvent(new Event("resize"));
    });

    const paddingBottom = await page
      .getByTestId("keyboard-safe-container")
      .evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom) || 0);
    expect(paddingBottom).toBeGreaterThan(200);
  });
});
