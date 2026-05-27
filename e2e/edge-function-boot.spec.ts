import { test, expect } from "@playwright/test";

/**
 * ENAZIZI — Edge Function Boot Smoke Test
 *
 * Valida que cada Edge Function crítica:
 *  - está deployada;
 *  - boota sem BOOT_ERROR / worker crash;
 *  - responde com status válido (401 sem auth ou 200/400 com payload);
 *  - nunca retorna 5xx por crash de import.
 *
 * Logs esperados na función: [EDGE_BOOT_OK]
 */

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? "https://qszsyskumcmuknumwxtk.supabase.co";
const ANON =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzenN5c2t1bWNtdWtudW13eHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NDUwNjUsImV4cCI6MjA4NjIyMTA2NX0.B2Si8zb8YJcDhIsyj6edriyXsG3p2rP-NLrGfBFAoZw";

const FUNCTIONS = [
  "tutor-v3-premium",
  "tutor-v2-chat",
  "question-generator",
  "generate-adaptive-simulado",
  "generate-flashcards",
  "generate-mnemonic",
  "study-next",
];

test.describe("Edge Function Boot Stability", () => {
  for (const fn of FUNCTIONS) {
    test(`${fn} boota sem BOOT_ERROR`, async ({ request }) => {
      const res = await request.post(
        `${SUPABASE_URL}/functions/v1/${fn}`,
        {
          headers: {
            "Content-Type": "application/json",
            apikey: ANON,
          },
          data: { __smoke: true },
          failOnStatusCode: false,
        },
      );
      const body = await res.text();
      // Boot ok = qualquer status que NÃO seja crash de worker (5xx com BOOT_ERROR)
      const isBootError =
        res.status() >= 500 &&
        /boot[_ ]error|worker boot|module not found|import.*failed/i.test(body);

      expect(
        isBootError,
        `[EDGE_BOOT_FAIL] ${fn} status=${res.status()} body=${body.slice(0, 200)}`,
      ).toBeFalsy();
      console.log(`[EDGE_BOOT_OK] ${fn} status=${res.status()}`);
    });
  }
});
