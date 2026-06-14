// ENAZIZI — Wave 3 Regression Contract Suite for tutor-v3-premium
// Freeze-safe: tests ONLY the public HTTP contract. No prompts, FSRS, memory,
// pedagogical logic, schema or RLS are exercised or modified.
//
// MODE A (no token): runs OPTIONS, 401 and structural no-crash checks.
// MODE B (USER_JWT / SUPABASE_CONTRACT_USER_JWT): runs the full battery.
//
// Run:
//   USER_JWT=<token> deno test --allow-net --allow-env --allow-read \
//     supabase/functions/tutor-v3-premium/__tests__/contract.test.ts

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
const URL_FN = `${SUPABASE_URL}/functions/v1/tutor-v3-premium`;
const HAS_USER = USER_JWT.length > 20;

async function call(
  body: unknown,
  opts: { auth?: boolean; raw?: boolean } = { auth: true },
) {
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

function expectTutorShape(json: any) {
  if (!json || typeof json !== "object") return;
  // Either a controlled error/envelope or a tutor-shaped payload.
  if (json.error || json.success === false || json.fallback) return;
  const hasMessage =
    typeof json.message === "string" ||
    typeof json.response === "string" ||
    typeof json.content === "string" ||
    typeof json.text === "string";
  // Tutor may legitimately return only metadata in some intents; we only
  // assert that, when present, the shape is sane.
  if (hasMessage) {
    assert(
      ["string"].includes(typeof (json.message ?? json.response ?? json.content ?? json.text)),
    );
  }
  if ("lessonComplete" in json) {
    assert(typeof json.lessonComplete === "boolean");
  }
  if ("currentBlock" in json && json.currentBlock !== null) {
    assert(typeof json.currentBlock === "string");
  }
}

// ── Always-on (no token) ────────────────────────────────────────────────

Deno.test("OPTIONS / CORS", async () => {
  const r = await fetch(URL_FN, { method: "OPTIONS" });
  await r.text();
  assert([200, 204].includes(r.status), `OPTIONS status=${r.status}`);
});

Deno.test("Unauthenticated request returns 401 (no auth header)", async () => {
  const r = await call({ message: "ping" }, { auth: false });
  expectNoRuntimeCrash(r.raw);
  assert(
    r.status === 401 || r.status === 403,
    `expected 401/403, got ${r.status}`,
  );
});

Deno.test("Healthcheck does not crash with anon token", async () => {
  const r = await call({ healthcheck: true });
  expectControlledResponse(r.status, r.raw);
});

Deno.test("Empty body — no runtime crash", async () => {
  const r = await call({});
  expectControlledResponse(r.status, r.raw);
});

Deno.test("Malformed JSON — controlled response", async () => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: ANON_KEY,
    Authorization: `Bearer ${HAS_USER ? USER_JWT : ANON_KEY}`,
  };
  const res = await fetch(URL_FN, {
    method: "POST",
    headers,
    body: "{not-json",
  });
  const text = await res.text();
  expectControlledResponse(res.status, text);
});

// ── Token-gated battery ─────────────────────────────────────────────────

Deno.test({
  name: "[token] Minimal valid payload returns controlled tutor envelope",
  ignore: !HAS_USER,
  fn: async () => {
    const r = await call({ message: "Olá", topic: "Hipertensão arterial" });
    expectControlledResponse(r.status, r.raw);
    expectTutorShape(r.json);
  },
});

Deno.test({
  name: "[token] Empty message does not crash",
  ignore: !HAS_USER,
  fn: async () => {
    const r = await call({ message: "", topic: "Diabetes mellitus" });
    expectControlledResponse(r.status, r.raw);
    expectTutorShape(r.json);
  },
});

Deno.test({
  name: "[token] Non-string message does not crash",
  ignore: !HAS_USER,
  fn: async () => {
    const r = await call({ message: 123, topic: "Asma" });
    expectControlledResponse(r.status, r.raw);
  },
});

Deno.test({
  name: "[token] Invalid intent — controlled fallback",
  ignore: !HAS_USER,
  fn: async () => {
    const r = await call({
      message: "explica",
      intent: "__nonexistent_intent__",
      topic: "Cetoacidose diabética",
    });
    expectControlledResponse(r.status, r.raw);
  },
});

Deno.test({
  name: "[token] Invalid currentBlock — no crash",
  ignore: !HAS_USER,
  fn: async () => {
    const r = await call({
      message: "continuar",
      currentBlock: "__not_a_block__",
      topic: "ICC",
    });
    expectControlledResponse(r.status, r.raw);
  },
});

Deno.test({
  name: "[token] Invalid sessionId — controlled error",
  ignore: !HAS_USER,
  fn: async () => {
    const r = await call({
      message: "oi",
      sessionId: "00000000-0000-0000-0000-000000000000",
      topic: "DPOC",
    });
    expectControlledResponse(r.status, r.raw);
  },
});

Deno.test({
  name: "[token] History as non-array does not crash",
  ignore: !HAS_USER,
  fn: async () => {
    const r = await call({
      message: "oi",
      history: "not-an-array",
      topic: "Pneumonia",
    });
    expectControlledResponse(r.status, r.raw);
  },
});

Deno.test({
  name: "[token] Response never leaks TypeError / stack",
  ignore: !HAS_USER,
  fn: async () => {
    const r = await call({
      message: { weird: true },
      currentBlock: 42,
      intent: ["x"],
      topic: null,
    });
    expectNoRuntimeCrash(r.raw);
  },
});
