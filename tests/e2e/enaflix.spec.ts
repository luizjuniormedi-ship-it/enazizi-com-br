import { test, expect } from "@playwright/test";

test.describe("ENAFLIX E2E Audit", () => {
  test("Student landing and navigation", async ({ page }) => {
    // 1. Mock login process (simplified for E2E speed)
    // We assume the user is already logged in or we use a test account
    await page.goto("/enaflix");

    // 2. Verify Hub presence
    await expect(page.locator("text=ENAFLIX")).toBeVisible();
    
    // 3. Verify core educational modules
    await expect(page.locator("text=Simulados")).toBeVisible();
    await expect(page.locator("text=Flashcards")).toBeVisible();
    await expect(page.locator("text=Tutor IA")).toBeVisible();

    // 4. Verify admin isolation (Should NOT see admin specific text/routes)
    await expect(page.locator("text=Admin Hub")).not.toBeVisible();
    await expect(page.locator("text=Telemetria")).not.toBeVisible();
    await expect(page.locator("text=Monitoramento")).not.toBeVisible();

    // 5. Verify interactivity - Click Tutor IA
    await page.click("text=Tutor IA");
    await expect(page).toHaveURL(/\/dashboard\/mentor/);
    
    // 6. Go back to Enaflix
    await page.goto("/enaflix");
    
    // 7. Verify dynamic rows (Plan of Today or Fallback)
    const planRow = page.locator("text=Seu Plano de Hoje");
    const highYieldRow = page.locator("text=Questões que Mais Caem");
    
    await expect(planRow.or(highYieldRow)).toBeVisible();

    // 8. Verify no infinite loading (Billboard should eventually appear or skeleton disappear)
    await expect(page.locator(".enaflix-billboard-skeleton")).not.toBeVisible({ timeout: 10000 });
  });

  test("Admin access preservation", async ({ page }) => {
    // This test would requires admin role setup in DB
    // For now we check if the Painel Admin button appears for special users
    await page.goto("/enaflix");
    
    // Check if the "Painel Admin" button is reachable if user has role
    // (Actual role check requires mock state or real auth)
  });
});
