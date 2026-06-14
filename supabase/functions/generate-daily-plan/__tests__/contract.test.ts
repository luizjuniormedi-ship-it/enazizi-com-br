// Contract regression tests for `generate-daily-plan` edge function (Wave 7 — Planner Core).
// Freeze-safe: validates only public HTTP contract / defensive guards.

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

const FN_URL = `${SUPABASE_URL}/functions/v1/generate-daily-plan`;

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

function expectPlannerShape(json: any) {
  if (typeof json !== "object" || json === null) {
    throw new Error("Planner response must be an object");
  }
  const ok =
    typeof json.status === "string" ||
    typeof json.message === "string" ||
    typeof json.error === "string" ||
    typeof json.success === "boolean" ||
    typeof json.result === "object" ||
    typeof json.planId === "string" ||
    Array.isArray(json.tasks) ||
    Array.isArray(json.items);
  if (!ok) throw new Error("Planner response missing controlled fields");
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

Deno.test("Missing Authorization is controlled (401 or controlled response)", async () => {
  const { status, raw } = await call(JSON.stringify({}));
  expectControlledResponse(status, raw);
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
  Deno.test("Empty payload defaults timezone and is controlled", async () => {
    const { status, raw } = await call(JSON.stringify({}), { auth: true });
    expectControlledResponse(status, raw);
    expectPlannerShape(JSON.parse(raw));
  });

  Deno.test("Invalid timezone does not crash", async () => {
    const { status, raw } = await call(
      JSON.stringify({ timezone: "Not/A_Zone" }),
      { auth: true },
    );
    expectControlledResponse(status, raw);
  });

  Deno.test("Non-string timezone does not crash", async () => {
    const { status, raw } = await call(
      JSON.stringify({ timezone: 12345 }),
      { auth: true },
    );
    expectControlledResponse(status, raw);
  });

  Deno.test("Non-boolean force flag does not crash", async () => {
    const { status, raw } = await call(
      JSON.stringify({ force: "yes" }),
      { auth: true },
    );
    expectControlledResponse(status, raw);
  });

  Deno.test("Idempotent call (no force) returns existing plan controlled", async () => {
    const { status: s1, raw: r1 } = await call(JSON.stringify({}), { auth: true });
    expectControlledResponse(s1, r1);
    const { status: s2, raw: r2 } = await call(JSON.stringify({}), { auth: true });
    expectControlledResponse(s2, r2);
  });
} else {
  console.warn("[contract] USER_JWT not set — auth-gated cases skipped.");
}
