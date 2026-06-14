// Contract regression tests for `schedule-review` (Wave 8 — FSRS Core).
// NOTE: Function is marked DEPRECATED (orphan) in production. Hardening
// preserves its current public contract: returns controlled 500 with
// { error: message } on parse/internal failures — never leaks stack traces.

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

const FN_URL = `${SUPABASE_URL}/functions/v1/schedule-review`;

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
  // schedule-review may return controlled 500 with { error } — allow if no stack.
  if (status > 500) throw new Error(`Uncontrolled ${status}: ${raw}`);
  if (status === 500 && raw.includes('"stack"')) {
    throw new Error(`Uncontrolled 500: ${raw}`);
  }
}

function expectFsrsShape(json: any) {
  if (typeof json !== "object" || json === null) {
    throw new Error("FSRS response must be an object");
  }
  const ok =
    typeof json.status === "string" ||
    typeof json.message === "string" ||
    typeof json.error === "string" ||
    typeof json.success === "boolean" ||
    typeof json.result === "object" ||
    typeof json.review === "object" ||
    typeof json.nextReview === "string";
  if (!ok) throw new Error("FSRS response missing controlled fields");
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

Deno.test("Missing Authorization is controlled (401)", async () => {
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
  Deno.test("Missing required fields returns 400 controlled", async () => {
    const { status, raw } = await call(JSON.stringify({}), { auth: true });
    expectControlledResponse(status, raw);
    expectFsrsShape(JSON.parse(raw));
    if (status !== 400 && status !== 500) {
      throw new Error(`Expected 400/500, got ${status}: ${raw}`);
    }
  });

  Deno.test("tema_id non-string does not crash", async () => {
    const { status, raw } = await call(
      JSON.stringify({ tema_id: 12345, was_successful: true }),
      { auth: true },
    );
    expectControlledResponse(status, raw);
  });

  Deno.test("was_successful as null is controlled", async () => {
    const { status, raw } = await call(
      JSON.stringify({ tema_id: "x", was_successful: null }),
      { auth: true },
    );
    expectControlledResponse(status, raw);
  });

  Deno.test("Unknown tema_id (random uuid) is controlled", async () => {
    const { status, raw } = await call(
      JSON.stringify({
        tema_id: "00000000-0000-0000-0000-000000000000",
        was_successful: true,
      }),
      { auth: true },
    );
    expectControlledResponse(status, raw);
  });

  Deno.test("accuracy as non-number does not crash", async () => {
    const { status, raw } = await call(
      JSON.stringify({
        tema_id: "00000000-0000-0000-0000-000000000000",
        was_successful: false,
        accuracy: "oops",
      }),
      { auth: true },
    );
    expectControlledResponse(status, raw);
  });
} else {
  console.warn("[contract] USER_JWT not set — auth-gated cases skipped.");
}
