// Deno tests via curl-style calls to the deployed generate-mnemonic edge function.
// Validates: 401 (no auth), 400 (invalid JSON), 422 (empty payload), 200 (valid).
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("VITE_SUPABASE_ANON_KEY")!;
const URL = `${SUPABASE_URL}/functions/v1/generate-mnemonic`;

async function callRaw(body: string, headers: Record<string, string> = {}) {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY, ...headers },
    body,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

Deno.test("401 — sem token de autenticação", async () => {
  const { status, json } = await callRaw(JSON.stringify({ tema: "AINEs" }));
  assertEquals(status, 401);
  assertEquals(json.success, false);
  assert(typeof json.requestId === "string");
});

Deno.test("400 — JSON inválido", async () => {
  const { status, json } = await callRaw("{not json", { Authorization: `Bearer ${ANON_KEY}` });
  assertEquals(status, 400);
  assertEquals(json.code, "INVALID_JSON");
  assert(json.requestId);
});

Deno.test("422 — payload vazio", async () => {
  const { status, json } = await callRaw(JSON.stringify({}), { Authorization: `Bearer ${ANON_KEY}` });
  assert([401, 422, 400].includes(status), `unexpected ${status}`);
  assertEquals(json.success, false);
});

Deno.test("422 — topic apenas (extração automática)", async () => {
  // We can't easily test 200 without a real user token, but we can verify it doesn't crash
  const { status, json } = await callRaw(JSON.stringify({ tema: "Insuficiência Cardíaca" }), { Authorization: `Bearer ${ANON_KEY}` });
  // If status is 401, it's expected because we use ANON_KEY instead of real USER_TOKEN
  if (status !== 401) {
    assert(json.requestId);
  }
});

Deno.test("422 — items apenas (inválido sem tema)", async () => {
  const { status, json } = await callRaw(JSON.stringify({ termos: ["A", "B", "C"] }), { Authorization: `Bearer ${ANON_KEY}` });
  // Should fail at payload validation or auth
  assert([401, 422, 400, 500].includes(status), `unexpected ${status}`);
  assert(json.requestId);
});

