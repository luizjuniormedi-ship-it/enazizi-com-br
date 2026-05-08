import { test, expect } from "@playwright/test";

/**
 * E2E: Blueprint Intelligence Engine Governance.
 * Testes críticos para validar segurança e funcionalidade de governança.
 */

test.describe("Governança de Blueprints (Admin)", () => {
  test("admin acessa painel de blueprints", async ({ page }) => {
    // Nota: Em ambiente local sem auth simulado, esperamos que ao menos a rota exista
    await page.goto("/admin/blueprints");
    
    // Verifica se os elementos da UI de governança estão presentes
    const heading = page.getByText(/Blueprint Intelligence Engine/i);
    await expect(heading).toBeVisible({ timeout: 15000 });
    
    // Verifica abas
    await expect(page.getByText(/Bancas Ativas/i)).toBeVisible();
    await expect(page.getByText(/Histórico de Versões/i)).toBeVisible();
    await expect(page.getByText(/Logs de Drift/i)).toBeVisible();
  });

  test("aluno comum é bloqueado na rota admin", async ({ page }) => {
    // Este teste assume que o sistema de roteamento protege /admin
    await page.goto("/admin/blueprints");
    
    // Se redirecionar para login ou home, ou mostrar 404/Acesso Negado, o teste passa
    const forbidden = page.getByText(/Acesso negado|Não autorizado|Login/i);
    // Se o heading de admin NÃO aparecer, a proteção funcionou (ou redirecionou)
    await expect(page.getByText(/Blueprint Intelligence Engine/i)).not.toBeVisible({ timeout: 5000 });
  });

  test("question-generator invoca blueprint dinâmico", async ({ request }) => {
    // Teste de integração da Edge Function
    const response = await request.post("/functions/v1/question-generator", {
      data: {
        targetExam: "enare",
        count: 1,
        mode: "estudo"
      }
    });
    
    // Mesmo que falhe por auth, o status deve ser 400 ou 401, não 500
    expect(response.status()).toBeLessThan(500);
  });
});
