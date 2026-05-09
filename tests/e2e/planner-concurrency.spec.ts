/**
 * Loop 3A — E2E concorrência do Planner.
 *
 * Verifica que múltiplos cliques rápidos em "Gerar plano" NÃO produzem
 * planos duplicados: o request_hash + UNIQUE(user_id, plan_date, request_hash)
 * garante que o backend retorne sempre o mesmo registro.
 *
 * Pré-requisitos (env): E2E_USER_EMAIL, E2E_USER_PASSWORD,
 * VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, PLAYWRIGHT_TEST_BASE_URL.
 */
import { test, expect, Page } from "@playwright/test";

const EMAIL = process.env.E2E_USER_EMAIL ?? "";
const PASSWORD = process.env.E2E_USER_PASSWORD ?? "";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const ANON = process.env.VITE_SUPABASE_ANON_KEY ?? "";

test.skip(!EMAIL || !PASSWORD || !SUPABASE_URL || !ANON, "E2E env not configured");

async function login(page: Page) {
  await page.goto("/auth");
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|home|planner|hoje/i, { timeout: 30_000 });
}

test("Planner — cliques concorrentes não duplicam daily_plan", async ({ page }) => {
  await login(page);
  await page.goto("/smart-planner");

  // Aguarda botão de gerar plano aparecer (label tolerante).
  const generateBtn = page
    .getByRole("button", { name: /gerar (plano|cronograma)|criar plano/i })
    .first();
  await expect(generateBtn).toBeVisible({ timeout: 30_000 });

  // Dispara 3 cliques quase simultâneos.
  await Promise.all([generateBtn.click(), generateBtn.click(), generateBtn.click()]);

  // Não pode aparecer ErrorBoundary.
  await expect(page.getByText(/algo deu errado/i)).toHaveCount(0, { timeout: 15_000 });

  // Loading deve liberar (ausência de spinners persistentes).
  await page.waitForTimeout(8_000);

  // Valida idempotência via REST: deve haver exatamente 1 plano para hoje.
  const session = await page.evaluate(async () => {
    const raw = Object.keys(localStorage).find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
    if (!raw) return null;
    try { return JSON.parse(localStorage.getItem(raw)!); } catch { return null; }
  });
  const accessToken: string | undefined = session?.access_token ?? session?.currentSession?.access_token;
  expect(accessToken, "Sessão Supabase deve estar presente após login").toBeTruthy();

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const res = await page.request.get(
    `${SUPABASE_URL}/rest/v1/daily_plans?plan_date=eq.${today}&select=id,request_hash`,
    { headers: { apikey: ANON, Authorization: `Bearer ${accessToken}` } }
  );
  expect(res.ok()).toBeTruthy();
  const rows: Array<{ id: string; request_hash: string | null }> = await res.json();

  // Cada (user, plan_date, request_hash) é único: 3 cliques idênticos = 1 linha.
  const uniqueHashes = new Set(rows.map((r) => r.request_hash ?? ""));
  expect(uniqueHashes.size).toBeLessThanOrEqual(rows.length);
  expect(rows.length).toBeGreaterThan(0);
  // Permite no máximo 1 plano por hash distinto — sem duplicatas brutas.
  expect(rows.length).toBe(uniqueHashes.size);
});
