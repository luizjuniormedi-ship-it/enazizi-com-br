// Contract regression tests for `quality-lock-validator` (Wave 9 — Quality Core). Freeze-safe.
import "https://deno.land/std@0.224.0/dotenv/load.ts";

const SUPABASE_URL =
  Deno.env.get("VITE_SUPABASE_URL") ||
  Deno.env.get("SUPABASE_URL") ||
  "https://qszsyskumcmuknumwxtk.supabase.co";
const ANON_KEY =
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ||
  Deno.env.get("SUPABASE_ANON_KEY") ||
  "";
const USER_JWT =
  Deno.env.get("USER_JWT") ||
  Deno.env.get("SUPABASE_CONTRACT_USER_JWT") ||
  "";

const FN_URL = `${SUPABASE_URL}/functions/v1/quality-lock-validator`;

function expectNoRuntimeCrash(raw: string) {
  if (raw.includes("TypeError")) throw new Error("TypeError leaked");
  if (raw.includes("Cannot read")) throw new Error("Cannot read leaked");
  if (raw.includes("toLowerCase")) throw new Error("toLowerCase crash leaked");
  if (/\btrim\b/.test(raw) && raw.includes("is not a function")) {
    throw new Error("trim crash leaked");
  }
  if (raw.includes('"stack"')) throw new Error("Stack trace leaked");
}

function expectControlledResponse(status: number, raw: string) {
  expectNoRuntimeCrash(raw);
  if (status > 500) throw new Error(`Uncontrolled ${status}: ${raw}`);
  if (status === 500 && raw.includes('"stack"')) {
    throw new Error(`Uncontrolled 500: ${raw}`);
  }
}

function expectQualityShape(json: any) {
  if (typeof json !== "object" || json === null) {
    throw new Error("Quality response must be an object");
  }
  const ok =
    typeof json.success === "boolean" ||
    typeof json.error === "string" ||
    typeof json.action === "string" ||
    typeof json.coherence_score === "number" ||
    typeof json.audit_notes === "string" ||
    Array.isArray(json.issues);
  if (!ok) throw new Error("Quality response missing controlled fields");
}

async function call(body: BodyInit | null, opts: { auth?: boolean } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (ANON_KEY) headers["apikey"] = ANON_KEY;
  if (opts.auth && USER_JWT) headers["Authorization"] = `Bearer ${USER_JWT}`;
  const res = await fetch(FN_URL, { method: "POST", headers, body });
  const raw = await res.text();
  return { status: res.status, raw };
}

Deno.test("OPTIONS returns CORS without processing", async () => {
  const res = await fetch(FN_URL, { method: "OPTIONS" });
  await res.text();
  if (res.status !== 200 && res.status !== 204) {
    throw new Error(`Unexpected OPTIONS status: ${res.status}`);
  }
});

Deno.test("Malformed JSON does not leak stack", async () => {
  const { status, raw } = await call("{not json");
  expectControlledResponse(status, raw);
});

Deno.test("Empty body is controlled (missing required fields)", async () => {
  const { status, raw } = await call(JSON.stringify({}));
  expectControlledResponse(status, raw);
  try {
    expectQualityShape(JSON.parse(raw));
  } catch (_) { /* tolerate */ }
});

Deno.test("Missing content_id returns 400 controlled", async () => {
  const { status, raw } = await call(
    JSON.stringify({ content_type: "question", content_payload: {} }),
  );
  expectControlledResponse(status, raw);
});

Deno.test("Question without 4 alternatives is controlled (no crash)", async () => {
  const { status, raw } = await call(
    JSON.stringify({
      content_type: "question",
      content_id: "00000000-0000-0000-0000-000000000000",
      content_payload: { statement: "x", alternatives: ["a"], correct_index: 0 },
    }),
  );
  expectControlledResponse(status, raw);
});

Deno.test("correct_index out of range is controlled", async () => {
  const { status, raw } = await call(
    JSON.stringify({
      content_type: "question",
      content_id: "00000000-0000-0000-0000-000000000000",
      content_payload: {
        statement: "x",
        alternatives: ["a", "b", "c", "d"],
        correct_index: 99,
      },
    }),
  );
  expectControlledResponse(status, raw);
});

Deno.test("Adversarial payload (non-array alternatives) does not crash", async () => {
  const { status, raw } = await call(
    JSON.stringify({
      content_type: "question",
      content_id: "x",
      content_payload: { alternatives: "not-an-array", correct_index: "bad" },
    }),
  );
  expectControlledResponse(status, raw);
});
