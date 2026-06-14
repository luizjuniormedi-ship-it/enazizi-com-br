// ENAZIZI — Regression Contract Suite for question-generator
// Freeze-safe: tests only the public HTTP contract.
//
// Run:
//   USER_JWT=<token> deno test --allow-net --allow-env --allow-read \
//     supabase/functions/question-generator/__tests__/contract.test.ts

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
const URL_FN = `${SUPABASE_URL}/functions/v1/question-generator`;
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
  assert(!s.includes("toLowerCase"), "toLowerCase crash leaked");
  assert(!s.includes('"stack"'), "Stack trace leaked");
}

function expectControlledResponse(status: number, raw: string) {
  expectNoRuntimeCrash(raw);
  // 5xx only acceptable if it's the controlled `{success:false, error:"..."}`
  if (status >= 500) {
    assert(
      raw.includes('"success":false'),
      `Uncontrolled 5xx response: ${raw.slice(0, 200)}`,
    );
  }
}

function expectQuestionsShape(json: any) {
  if (!json || typeof json !== "object") return;
  if (Array.isArray(json.questions)) {
    assert(json.questions.length >= 0);
    assert(json.questions.length <= 100);
  }
  if (typeof json.requestedCount === "number") {
    assert(json.requestedCount >= 1 && json.requestedCount <= 100);
  }
  if (typeof json.generatedCount === "number") {
    assert(json.generatedCount >= 0 && json.generatedCount <= 100);
  }
}

// ── Always-on (no token) ────────────────────────────────────────────────
Deno.test("OPTIONS / CORS", async () => {
  const r = await fetch(URL_FN, { method: "OPTIONS" });
  await r.text();
  assert([200, 204].includes(r.status), `OPTIONS status=${r.status}`);
});

Deno.test("401 sem auth válida", async () => {
  const r = await call({}, { auth: false });
  assert([401, 403].includes(r.status), `expected 401/403 got ${r.status}`);
});

Deno.test("payload vazio não vaza crash", async () => {
  const r = await call({}, { auth: false });
  expectNoRuntimeCrash(r.raw);
});

// ── Token-gated scenarios ──────────────────────────────────────────────
const t = (name: string, fn: () => Promise<void>) =>
  Deno.test({ name, ignore: !HAS_USER, fn });

t("body vazio (autenticado) — sem crash", async () => {
  const r = await call({});
  expectControlledResponse(r.status, r.raw);
  expectQuestionsShape(r.json);
});

t("count negativo → clamped ≥ 1", async () => {
  const r = await call({ count: -5, specialty: "Cardiologia" });
  expectControlledResponse(r.status, r.raw);
  if (typeof r.json.requestedCount === "number") assert(r.json.requestedCount >= 1);
  expectQuestionsShape(r.json);
});

t("count 0 → default seguro", async () => {
  const r = await call({ count: 0, specialty: "Cardiologia" });
  expectControlledResponse(r.status, r.raw);
  expectQuestionsShape(r.json);
});

t("count gigante (99999) → clamp 100", async () => {
  const r = await call({ count: 99999, specialty: "Cardiologia" });
  expectControlledResponse(r.status, r.raw);
  if (typeof r.json.requestedCount === "number") assert(r.json.requestedCount <= 100);
  expectQuestionsShape(r.json);
});

t("count como string '7'", async () => {
  const r = await call({ count: "7", specialty: "Cardiologia" });
  expectControlledResponse(r.status, r.raw);
  expectQuestionsShape(r.json);
});

t("topics=[] não causa crash", async () => {
  const r = await call({ topics: [], count: 3 });
  expectControlledResponse(r.status, r.raw);
  expectQuestionsShape(r.json);
});

t("topics=[null,'','   '] sanitizados", async () => {
  const r = await call({ topics: [null, "", "   "], count: 3 });
  expectControlledResponse(r.status, r.raw);
  expectQuestionsShape(r.json);
});

t("aliases selectedTopics / selectedSubtopics", async () => {
  const r = await call({
    selectedTopics: ["Cardiologia"],
    selectedSubtopics: ["Arritmias"],
    count: 3,
  });
  expectControlledResponse(r.status, r.raw);
  expectQuestionsShape(r.json);
});

t("specialty inválida — fallback controlado", async () => {
  const r = await call({ specialty: "@@@inexistente@@@", count: 2 });
  expectControlledResponse(r.status, r.raw);
  expectQuestionsShape(r.json);
});

t("board inválido — não crasha", async () => {
  const r = await call({ examBoard: "BANCA_INEXISTENTE_ZZZ", count: 2 });
  expectControlledResponse(r.status, r.raw);
  expectQuestionsShape(r.json);
});

t("difficulty inválida — não crasha", async () => {
  const r = await call({ difficulty: "ultra-impossivel", count: 2 });
  expectControlledResponse(r.status, r.raw);
  expectQuestionsShape(r.json);
});

t("mode ai_generation — resposta controlada", async () => {
  const r = await call({ mode: "ai_generation", specialty: "Cardiologia", count: 2 });
  expectControlledResponse(r.status, r.raw);
  expectQuestionsShape(r.json);
});

t("payload com tipos errados — não crasha", async () => {
  const r = await call({
    count: { evil: true },
    topics: "not-an-array",
    specialty: 42,
  });
  expectControlledResponse(r.status, r.raw);
});

t("JSON inválido como body — não crasha", async () => {
  const r = await call("{not json", { auth: true });
  expectControlledResponse(r.status, r.raw);
});
