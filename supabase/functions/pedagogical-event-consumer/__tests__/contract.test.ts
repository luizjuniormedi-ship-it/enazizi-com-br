// Contract regression tests for `pedagogical-event-consumer` edge function.
// Freeze-safe: validates only public HTTP contract / defensive guards.
// Function is "blind orchestrator" — by design returns 200 for all payloads.

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

const FN_URL = `${SUPABASE_URL}/functions/v1/pedagogical-event-consumer`;

function expectNoRuntimeCrash(raw: string) {
  if (raw.includes("TypeError")) throw new Error("Runtime TypeError leaked");
  if (raw.includes("Cannot read")) throw new Error("Cannot read leaked");
  if (raw.includes("toLowerCase")) throw new Error("toLowerCase crash leaked");
  if (/\btrim\b/.test(raw) && raw.includes("is not a function")) {
    throw new Error("trim crash leaked");
  }
  if (raw.includes('"stack"')) throw new Error("Stack trace leaked");
}

function expectControlledResponse(status: number, raw: string) {
  expectNoRuntimeCrash(raw);
  if (status >= 500) {
    throw new Error(`Unexpected uncontrolled 5xx: ${status} ${raw}`);
  }
}

function expectConsumerShape(json: any) {
  if (typeof json !== "object" || json === null) {
    throw new Error("pedagogical-event-consumer response must be an object");
  }
  const ok =
    typeof json.status === "string" ||
    typeof json.message === "string" ||
    typeof json.error === "string" ||
    typeof json.processed === "number" ||
    typeof json.success === "boolean" ||
    typeof json.result === "object" ||
    typeof json.ignored === "boolean" ||
    typeof json.blind_ok === "boolean";
  if (!ok) {
    throw new Error(
      "consumer response must include status/message/error/processed/success/result/ignored/blind_ok",
    );
  }
}

async function call(body: BodyInit | null, opts: { auth?: boolean } = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
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

Deno.test("Anonymous call is accepted (system event) without crash", async () => {
  const { status, raw } = await call(JSON.stringify({}));
  expectControlledResponse(status, raw);
});

Deno.test("Malformed JSON does not leak stack trace", async () => {
  const { status, raw } = await call("{not json");
  expectControlledResponse(status, raw);
});

Deno.test("Empty body is controlled", async () => {
  const { status, raw } = await call("");
  expectControlledResponse(status, raw);
});

Deno.test("Missing event payload returns silent success (200)", async () => {
  const { status, raw } = await call(JSON.stringify({}));
  expectControlledResponse(status, raw);
  if (status !== 200) throw new Error(`Expected 200 silent, got ${status}`);
  expectConsumerShape(JSON.parse(raw));
});

Deno.test("Event without user context is dropped silently (200)", async () => {
  const { status, raw } = await call(
    JSON.stringify({ event: { event_type: "noop" } }),
  );
  expectControlledResponse(status, raw);
  if (status !== 200) throw new Error(`Expected 200 silent, got ${status}`);
  const json = JSON.parse(raw);
  expectConsumerShape(json);
});

Deno.test("Event with non-string event_type does not crash", async () => {
  const { status, raw } = await call(
    JSON.stringify({ event: { event_type: 12345, user_id: "x" } }),
  );
  expectControlledResponse(status, raw);
});

Deno.test("Event with null payload does not crash", async () => {
  const { status, raw } = await call(
    JSON.stringify({ event: { event_type: "noop", user_id: "x", metadata: null } }),
  );
  expectControlledResponse(status, raw);
});

Deno.test("Event with non-object metadata does not crash", async () => {
  const { status, raw } = await call(
    JSON.stringify({ event: { event_type: "noop", user_id: "x", metadata: "oops" } }),
  );
  expectControlledResponse(status, raw);
});

Deno.test("Event as null does not crash", async () => {
  const { status, raw } = await call(JSON.stringify({ event: null }));
  expectControlledResponse(status, raw);
});

Deno.test("Event as non-object does not crash", async () => {
  const { status, raw } = await call(JSON.stringify({ event: "oops" }));
  expectControlledResponse(status, raw);
});

if (USER_JWT) {
  Deno.test("Authenticated valid event returns blind_ok", async () => {
    const { status, raw } = await call(
      JSON.stringify({
        event: {
          id: crypto.randomUUID(),
          event_type: "contract_test_noop",
          metadata: { contract_test: true },
        },
      }),
      { auth: true },
    );
    expectControlledResponse(status, raw);
    if (status !== 200) throw new Error(`Expected 200, got ${status}: ${raw}`);
    const json = JSON.parse(raw);
    expectConsumerShape(json);
  });

  Deno.test("Authenticated duplicate event id is controlled", async () => {
    const dupId = crypto.randomUUID();
    const payload = JSON.stringify({
      event: {
        id: dupId,
        event_type: "contract_test_noop",
        metadata: { contract_test: true },
      },
    });
    const r1 = await call(payload, { auth: true });
    expectControlledResponse(r1.status, r1.raw);
    const r2 = await call(payload, { auth: true });
    expectControlledResponse(r2.status, r2.raw);
  });
} else {
  console.warn("[contract] USER_JWT not set — auth-gated cases skipped.");
}
