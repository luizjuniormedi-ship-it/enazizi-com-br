/**
 * ENAZIZI — AI Memory + Semantic Cache Activation v22
 *
 * Valida que perguntas semanticamente similares reaproveitam tutor_knowledge_memory
 * em vez de chamar OpenAI sempre.
 *
 * Execução: PLAYWRIGHT_TEST_BASE_URL=http://localhost:4173 npx playwright test e2e/ai-memory-cache-v22.spec.ts
 * Skips automaticamente se faltarem secrets.
 */
import { test, expect, request } from "@playwright/test";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
const E2E_EMAIL = process.env.E2E_USER_EMAIL || "";
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD || "";

test.describe("AI Memory + Semantic Cache (v22)", () => {
  test.skip(!SUPABASE_URL || !ANON || !E2E_EMAIL || !E2E_PASSWORD, "Missing E2E secrets");

  test("segunda pergunta similar volta da memória (fromMemory=true, reuse_count++)", async () => {
    const api = await request.newContext();

    // 1. Login para pegar JWT
    const loginRes = await api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      headers: { apikey: ANON, "Content-Type": "application/json" },
      data: { email: E2E_EMAIL, password: E2E_PASSWORD },
    });
    expect(loginRes.ok(), `login: ${await loginRes.text()}`).toBeTruthy();
    const { access_token } = await loginRes.json();

    const call = async (message: string) => {
      const r = await api.post(`${SUPABASE_URL}/functions/v1/tutor-v3-premium`, {
        headers: {
          Authorization: `Bearer ${access_token}`,
          apikey: ANON,
          "Content-Type": "application/json",
        },
        data: {
          message,
          topic: "Pneumonia",
          history: [],
          stream: false,
        },
        timeout: 60_000,
      });
      const body = await r.json().catch(() => ({}));
      return { status: r.status(), body };
    };

    const question = "Quais são os critérios de CURB-65 e quando indicar internação?";

    // 2. Primeira chamada: pode vir de memória ou OpenAI; o objetivo é GARANTIR que existe entry depois.
    const first = await call(question);
    expect(first.status).toBe(200);
    expect(first.body.content).toBeTruthy();

    // Pequena espera para o waitUntil persistir o save.
    await new Promise((r) => setTimeout(r, 3500));

    // 3. Segunda chamada com pergunta parafraseada — DEVE bater memória.
    const second = await call("Me explique os critérios do CURB 65 e critério de internação por pneumonia.");
    expect(second.status).toBe(200);

    // Aceita fromMemory=true OU (caso primeira já tenha sido memory) reuse_count incrementado.
    const hit = second.body.fromMemory === true || (second.body.memoryReuseCount ?? 0) >= 1;
    expect(hit, `expected memory hit; body=${JSON.stringify(second.body).slice(0, 400)}`).toBeTruthy();

    if (second.body.fromMemory) {
      expect(second.body.memoryId).toBeTruthy();
      expect(typeof second.body.memoryReuseCount).toBe("number");
      expect(typeof second.body.memoryQualityScore).toBe("number");
    }
  });
});
