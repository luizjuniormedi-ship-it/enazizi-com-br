// ENAZIZI — Wave 4 Regression Contract Suite for generate-flashcards
// Freeze-safe: tests ONLY the public HTTP contract. No prompts, FSRS,
// memory, schema or RLS are modified.
//
// MODE A (no token): OPTIONS, 401 and structural no-crash checks.
// MODE B (USER_JWT / SUPABASE_CONTRACT_USER_JWT): full battery.
//
// Run:
//   USER_JWT=<token> deno test --allow-net --allow-env --allow-read \
//     supabase/functions/generate-flashcards/__tests__/contract.test.ts

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL =
  Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
const ANON_KEY =
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ||
  Deno.env.get("VITE_SUPABASE_ANON_KEY") ||
  Deno.env.get("SUPABASE_ANON_KEY")!;
const USER_JWT =
  Deno.env.get("USER_JWT") ||
  Deno.env.get("SUPABASE_CONTRACT_USER_JWT") ||
  "";
const URL_FN = `${SUPABASE_URL}/functions/v1/generate-flashcards`;
const HAS_USER = USER_JWT.length > 20;

async function call(body: unknown, opts: { auth?: boolean } = { auth: true }) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: ANON_KEY,
  };
  if (opts.auth !== false) {
    headers["Authorization"] = `Bearer ${HAS_USER ? USER_JWT : ANON_KEY}`;
  }
  const res = await fetch(URL_FN, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = {};
  try { json = JSON.parse(text); } catch { /* keep raw */ }
  return { status: res.status, json, raw: text };
}

function expectNoRuntimeCrash(raw: string) {
  const s = raw || "";
  assert(!s.includes("TypeError"), "Runtime TypeError leaked");
  assert(!s.includes("Cannot read"), "Cannot read leaked");
  assert(!s.includes("toLowerCase is not"), "toLowerCase crash leaked");
  assert(!s.includes(".trim is not"), "trim crash leaked");
  assert(!/"stack"\s*:/.test(s), "Stack trace leaked");
}

function expectControlledResponse(status: number, raw: string) {
  expectNoRuntimeCrash(raw);
  if (status >= 500) {
    assert(
      raw.includes('"success":false') ||
        raw.includes('"error"') ||
        raw.includes('"fallback"'),
      `Uncontrolled 5xx response: ${raw.slice(0, 200)}`,
    );
  }
}

function expectFlashcardShape(card: any) {
  assert(card && typeof card === "object", "Flashcard must be an object");
  const hasFront =
    typeof card.front === "string" ||
    typeof card.question === "string" ||
    typeof card.prompt === "string";
  const hasBack =
    typeof card.back === "string" ||
    typeof card.answer === "string" ||
    typeof card.explanation === "string";
  assert(hasFront && hasBack, "Flashcard must include front/back or equivalents");
}

function expectFlashcardsEnvelope(json: any) {
  if (!json || typeof json !== "object") return;
  if (json.error || json.success === false) return;
  const arr = json.flashcards || json.cards || json.data;
  if (Array.isArray(arr)) {
    assert(arr.length <= 100, "Too many flashcards returned");
    for (const c of arr.slice(0, 3)) expectFlashcardShape(c);
  }
}

// ── Always-on (no token) ────────────────────────────────────────────────

Deno.test("OPTIONS / CORS", async () => {
  const r = await fetch(URL_FN, { method: "OPTIONS" });
  await r.text();
  assert([200, 204].includes(r.status), `OPTIONS status=${r.status}`);
});

Deno.test("Unauthenticated request returns 401/403", async () => {
  const r = await call({ topic: "x" }, { auth: false });
  expectNoRuntimeCrash(r.raw);
  assert(
    r.status === 401 || r.status === 403,
    `expected 401/403, got ${r.status}`,
  );
});

Deno.test("Empty body — no runtime crash", async () => {
  const r = await call({});
  expectControlledResponse(r.status, r.raw);
});

Deno.test("Malformed JSON — controlled response", async () => {
  const res = await fetch(URL_FN, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${HAS_USER ? USER_JWT : ANON_KEY}`,
    },
    body: "{not-json",
  });
  const text = await res.text();
  expectControlledResponse(res.status, text);
});

// ── Token-gated battery ─────────────────────────────────────────────────

Deno.test({
  name: "[token] Minimal valid payload returns controlled envelope",
  ignore: !HAS_USER,
  fn: async () => {
    const r = await call({ topic: "Hipertensão arterial", quantity: 2 });
    expectControlledResponse(r.status, r.raw);
    expectFlashcardsEnvelope(r.json);
  },
});

Deno.test({
  name: "[token] Empty topic does not crash",
  ignore: !HAS_USER,
  fn: async () => {
    const r = await call({ topic: "", quantity: 2 });
    expectControlledResponse(r.status, r.raw);
  },
});

Deno.test({
  name: "[token] Non-string topic does not crash",
  ignore: !HAS_USER,
  fn: async () => {
    const r = await call({ topic: 123, quantity: 2 });
    expectControlledResponse(r.status, r.raw);
  },
});

Deno.test({
  name: "[token] quantity=0 is handled safely",
  ignore: !HAS_USER,
  fn: async () => {
    const r = await call({ topic: "Asma", quantity: 0 });
    expectControlledResponse(r.status, r.raw);
  },
});

Deno.test({
  name: "[token] Negative quantity is clamped/controlled",
  ignore: !HAS_USER,
  fn: async () => {
    const r = await call({ topic: "Asma", quantity: -5 });
    expectControlledResponse(r.status, r.raw);
  },
});

Deno.test({
  name: "[token] Huge quantity is clamped/controlled",
  ignore: !HAS_USER,
  fn: async () => {
    const r = await call({ topic: "Asma", quantity: 10000 });
    expectControlledResponse(r.status, r.raw);
    expectFlashcardsEnvelope(r.json);
  },
});

Deno.test({
  name: "[token] quantity as numeric string is controlled",
  ignore: !HAS_USER,
  fn: async () => {
    const r = await call({ topic: "Asma", quantity: "2" });
    expectControlledResponse(r.status, r.raw);
  },
});

Deno.test({
  name: "[token] Invalid uploadId — controlled error",
  ignore: !HAS_USER,
  fn: async () => {
    const r = await call({
      topic: "DPOC",
      uploadId: "00000000-0000-0000-0000-000000000000",
      quantity: 1,
    });
    expectControlledResponse(r.status, r.raw);
  },
});

Deno.test({
  name: "[token] Adversarial payload never leaks TypeError / stack",
  ignore: !HAS_USER,
  fn: async () => {
    const r = await call({
      topic: { weird: true },
      discipline: ["x"],
      quantity: null,
      model: 42,
    });
    expectNoRuntimeCrash(r.raw);
  },
});
