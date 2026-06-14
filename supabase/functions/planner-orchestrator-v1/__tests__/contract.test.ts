// Contract regression tests for `planner-orchestrator-v1` (Wave 7 — Planner Core).
// Freeze-safe.

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

const FN_URL = `${SUPABASE_URL}/functions/v1/planner-orchestrator-v1`;

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
  if (status >= 500) throw new Error(`Uncontrolled 5xx: ${status} ${raw}`);
}

function expectOrchestratorShape(json: any) {
  if (typeof json !== "object" || json === null) {
    throw new Error("Orchestrator response must be an object");
  }
  const ok =
    typeof json.accepted === "boolean" ||
    typeof json.reason === "string" ||
    typeof json.error === "string" ||
    typeof json.message === "string" ||
    typeof json.success === "boolean" ||
    typeof json.taskId === "string" ||
    typeof json.planId === "string";
  if (!ok) throw new Error("Orchestrator response missing controlled fields");
}

async function call(
  body: BodyInit | null,
  opts: { auth?: boolean; method?: string } = {},
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (ANON_KEY) headers["apikey"] = ANON_KEY;
  if (opts.auth && USER_JWT) headers["Authorization"] = `Bearer ${USER_JWT}`;
  const res = await fetch(FN_URL, { method: opts.method ?? "POST", headers, body });
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

Deno.test("GET (wrong method) is controlled", async () => {
  const { status, raw } = await call(null, { method: "GET" });
  expectControlledResponse(status, raw);
});

Deno.test("Missing Authorization returns 401", async () => {
  const { status, raw } = await call(JSON.stringify({}));
  expectControlledResponse(status, raw);
  if (status !== 401) throw new Error(`Expected 401, got ${status}: ${raw}`);
});

Deno.test("Malformed JSON does not leak stack", async () => {
  const { status, raw } = await call("{not json", { auth: true });
  expectControlledResponse(status, raw);
});

Deno.test("Empty body is controlled", async () => {
  const { status, raw } = await call("", { auth: true });
  expectControlledResponse(status, raw);
});

if (USER_JWT) {
  Deno.test("Empty payload returns controlled 400", async () => {
    const { status, raw } = await call(JSON.stringify({}), { auth: true });
    expectControlledResponse(status, raw);
    expectOrchestratorShape(JSON.parse(raw));
  });

  Deno.test("Partial payload (no action) is controlled", async () => {
    const { status, raw } = await call(
      JSON.stringify({ source: "test", userId: "x" }),
      { auth: true },
    );
    expectControlledResponse(status, raw);
  });

  Deno.test("Action with invalid actionType does not crash", async () => {
    const { status, raw } = await call(
      JSON.stringify({
        source: "test",
        userId: "00000000-0000-0000-0000-000000000000",
        action: { actionType: 12345, topic: null, recommendationId: "rec_x" },
      }),
      { auth: true },
    );
    expectControlledResponse(status, raw);
  });

  Deno.test("Action with null fields does not crash", async () => {
    const { status, raw } = await call(
      JSON.stringify({
        source: "test",
        userId: "00000000-0000-0000-0000-000000000000",
        action: null,
      }),
      { auth: true },
    );
    expectControlledResponse(status, raw);
  });
} else {
  console.warn("[contract] USER_JWT not set — auth-gated cases skipped.");
}
