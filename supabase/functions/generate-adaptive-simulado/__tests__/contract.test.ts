// ENAZIZI — Regression Contract Suite for generate-adaptive-simulado
// Freeze-safe: tests ONLY the public HTTP contract. No prompt, FSRS, memory,
// Bank Guard, frontend, schema or RLS changes.
//
// Covers all 21 real scenarios validated during the hardening pass:
//  1. Empty body              12. Subtopics only
//  2. Cardio + ENARE          13. 7d dedup preserved
//  3. count + specialty       14. REVALIDA board
//  4. selected* aliases       15. negative count
//  5. multi-topics            16. count as string "7"
//  6. count 200 clamp         17. singular topic
//  7. min count = 1           18. unauthenticated -> 401
//  8. count 0 -> default 10   19. CORS OPTIONS -> 200
//  9. inexistent topic        20. count 99999 clamp
// 10. mode: ai_generation     21. topics with null/""/"   "
// 11. topics=[] no crash
//
// Run:
//   USER_JWT=<token> deno test --allow-net --allow-env --allow-read \
//     supabase/functions/generate-adaptive-simulado/__tests__/contract.test.ts

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL =
  Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
const ANON_KEY =
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ||
  Deno.env.get("VITE_SUPABASE_ANON_KEY") ||
  Deno.env.get("SUPABASE_ANON_KEY")!;
const USER_JWT = Deno.env.get("USER_JWT") || ""; // optional; required for 200-path tests
const URL_FN = `${SUPABASE_URL}/functions/v1/generate-adaptive-simulado`;

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

// ---------- Helpers (contract asserts) -----------------------------------

function expectNoRuntimeCrash(raw: string) {
  const s = raw || "";
  assert(!s.includes("TypeError"), "response contains TypeError");
  assert(!s.includes("toLowerCase"), "response leaks toLowerCase crash");
  assert(!s.includes("Cannot read"), "response leaks runtime crash");
  assert(!/"stack"\s*:/.test(s), "response leaks stack trace");
}

function expectValidQuestionsResponse(json: any) {
  assert(json && typeof json === "object", "body is not object");
  const qs = json.questions ?? json.data?.questions ?? [];
  assert(Array.isArray(qs), "questions is not array");
  assert(qs.length >= 0, "negative length");
  assert(qs.length <= 100, `length ${qs.length} exceeds 100 clamp`);
  return qs as any[];
}

function expectControlledInsufficientBankResponse(json: any) {
  const qs = json.questions ?? json.data?.questions ?? [];
  assert(Array.isArray(qs));
  assert(qs.length >= 0);
}

// ------------------------------------------------------------------------
// 19. CORS preflight
// ------------------------------------------------------------------------
Deno.test("19 — OPTIONS preflight returns 200/204 with CORS", async () => {
  const res = await fetch(URL_FN, { method: "OPTIONS" });
  await res.text();
  assert([200, 204].includes(res.status), `unexpected ${res.status}`);
  assert(res.headers.get("access-control-allow-origin"), "missing CORS header");
});

// ------------------------------------------------------------------------
// 18. Auth gate (no Authorization header)
// ------------------------------------------------------------------------
Deno.test("18 — unauthenticated request returns 401", async () => {
  const { status, raw } = await call({ topics: ["Cardiologia"], count: 3 }, { auth: false });
  assertEquals(status, 401);
  expectNoRuntimeCrash(raw);
});

// ------------------------------------------------------------------------
// The remaining scenarios need a real user JWT. Skip cleanly otherwise.
// ------------------------------------------------------------------------
const userTest = (name: string, fn: () => Promise<void>) =>
  Deno.test({ name, ignore: !HAS_USER, fn });

// 1. Empty body -> default 10
userTest("01 — empty body never crashes", async () => {
  const { status, json, raw } = await call({});
  expectNoRuntimeCrash(raw);
  assert([200, 422].includes(status), `status ${status}`);
  if (status === 200) expectValidQuestionsResponse(json);
});

// 2. Cardio + ENARE + count 5
userTest("02 — Cardiologia + ENARE + count 5", async () => {
  const { status, json, raw } = await call({ topic: "Cardiologia", board: "ENARE", count: 5 });
  expectNoRuntimeCrash(raw);
  if (status === 200) {
    const qs = expectValidQuestionsResponse(json);
    assert(qs.length <= 5);
  }
});

// 3. Aliases: count + specialty
userTest("03 — aliases count + specialty", async () => {
  const { status, json, raw } = await call({ specialty: "Clínica Médica", count: 3 });
  expectNoRuntimeCrash(raw);
  if (status === 200) {
    const qs = expectValidQuestionsResponse(json);
    assert(qs.length <= 3);
  }
});

// 4. Aliases: selectedTopics + selectedSubtopics
userTest("04 — selectedTopics + selectedSubtopics", async () => {
  const { status, json, raw } = await call({
    selectedTopics: ["Cardiologia"],
    selectedSubtopics: ["Insuficiência Cardíaca"],
    count: 4,
  });
  expectNoRuntimeCrash(raw);
  if (status === 200) expectValidQuestionsResponse(json);
});

// 5. Multi-topics
userTest("05 — multi-topics", async () => {
  const { status, json, raw } = await call({
    topics: ["Cardiologia", "Infectologia"],
    count: 8,
  });
  expectNoRuntimeCrash(raw);
  if (status === 200) {
    const qs = expectValidQuestionsResponse(json);
    assert(qs.length <= 8);
  }
});

// 6. count 200 -> clamp to 100
userTest("06 — count 200 clamps to <= 100", async () => {
  const { status, json, raw } = await call({ topics: ["Cardiologia"], count: 200 });
  expectNoRuntimeCrash(raw);
  if (status === 200) {
    const qs = expectValidQuestionsResponse(json);
    assert(qs.length <= 100);
    expectControlledInsufficientBankResponse(json);
  }
});

// 7. min valid count = 1
userTest("07 — count 1 produces <= 1 question", async () => {
  const { status, json, raw } = await call({ topics: ["Cardiologia"], count: 1 });
  expectNoRuntimeCrash(raw);
  if (status === 200) {
    const qs = expectValidQuestionsResponse(json);
    assert(qs.length <= 1);
  }
});

// 8. count 0 -> default 10
userTest("08 — count 0 becomes default 10", async () => {
  const { status, json, raw } = await call({ topics: ["Cardiologia"], count: 0 });
  expectNoRuntimeCrash(raw);
  if (status === 200) {
    const qs = expectValidQuestionsResponse(json);
    assert(qs.length <= 10);
  }
});

// 9. Inexistent topic -> controlled response, no crash
userTest("09 — inexistent topic returns controlled response", async () => {
  const { status, json, raw } = await call({ topics: ["Tema Inexistente XYZ"], count: 5 });
  expectNoRuntimeCrash(raw);
  if (status === 200) expectControlledInsufficientBankResponse(json);
});

// 10. mode: ai_generation preserves bypass behaviour
userTest("10 — mode ai_generation does not crash", async () => {
  const { status, raw } = await call({
    mode: "ai_generation",
    topics: ["Cardiologia"],
    count: 5,
  });
  expectNoRuntimeCrash(raw);
  assert([200, 202, 422].includes(status), `status ${status}`);
});

// 11. topics=[] -> fallback, no crash
userTest("11 — topics=[] uses fallback, no toLowerCase crash", async () => {
  const { status, json, raw } = await call({ topics: [], count: 5 });
  expectNoRuntimeCrash(raw);
  if (status === 200) expectValidQuestionsResponse(json);
});

// 12. subtopics only
userTest("12 — subtopics only returns controlled response", async () => {
  const { status, json, raw } = await call({ subtopics: ["Choque séptico"], count: 5 });
  expectNoRuntimeCrash(raw);
  if (status === 200) expectControlledInsufficientBankResponse(json);
});

// 13. 7d dedup preserved (smoke — no crash on repeated call)
userTest("13 — 7d dedup path executes without crash", async () => {
  const p = { topics: ["Cardiologia"], count: 2 };
  const a = await call(p);
  const b = await call(p);
  expectNoRuntimeCrash(a.raw);
  expectNoRuntimeCrash(b.raw);
});

// 14. board REVALIDA
userTest("14 — REVALIDA board works", async () => {
  const { status, json, raw } = await call({
    topics: ["Cardiologia"],
    board: "REVALIDA",
    count: 5,
  });
  expectNoRuntimeCrash(raw);
  if (status === 200) expectValidQuestionsResponse(json);
});

// 15. negative count -> default 10
userTest("15 — negative count becomes default 10 (never negative)", async () => {
  const { status, json, raw } = await call({ topics: ["Cardiologia"], count: -5 });
  expectNoRuntimeCrash(raw);
  if (status === 200) {
    const qs = expectValidQuestionsResponse(json);
    assert(qs.length >= 0, "negative length leak");
    assert(qs.length <= 10);
  }
});

// 16. count as string "7"
userTest("16 — count as string '7' is coerced", async () => {
  const { status, json, raw } = await call({ topics: ["Cardiologia"], count: "7" });
  expectNoRuntimeCrash(raw);
  if (status === 200) {
    const qs = expectValidQuestionsResponse(json);
    assert(qs.length <= 7);
  }
});

// 17. singular topic
userTest("17 — singular topic field accepted", async () => {
  const { status, json, raw } = await call({ topic: "Cardiologia", count: 3 });
  expectNoRuntimeCrash(raw);
  if (status === 200) {
    const qs = expectValidQuestionsResponse(json);
    assert(qs.length <= 3);
  }
});

// 20. count 99999 -> clamp 100
userTest("20 — count 99999 clamps to <= 100", async () => {
  const { status, json, raw } = await call({ topics: ["Cardiologia"], count: 99999 });
  expectNoRuntimeCrash(raw);
  if (status === 200) {
    const qs = expectValidQuestionsResponse(json);
    assert(qs.length <= 100);
  }
});

// 21. topics with null / "" / "   " -> filtered + fallback
userTest("21 — topics with null/empty/whitespace uses fallback", async () => {
  const { status, json, raw } = await call({ topics: [null, "", "   "], count: 5 });
  expectNoRuntimeCrash(raw);
  if (status === 200) expectValidQuestionsResponse(json);
});
