// Contract regression tests for `process-upload` edge function.
// Freeze-safe: only validates public HTTP contract / defensive guards.

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

const FN_URL = `${SUPABASE_URL}/functions/v1/process-upload`;

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
  if (status >= 500 && status !== 500) {
    throw new Error(`Unexpected uncontrolled 5xx: ${status} ${raw}`);
  }
  // 500 with controlled "Internal error" payload is allowed; raw 500 with stack is not.
  if (status === 500 && raw.includes('"stack"')) {
    throw new Error(`Uncontrolled 500: ${raw}`);
  }
}

function expectUploadProcessShape(json: any) {
  if (typeof json !== "object" || json === null) {
    throw new Error("process-upload response must be an object");
  }
  const ok =
    typeof json.status === "string" ||
    typeof json.message === "string" ||
    typeof json.error === "string" ||
    typeof json.uploadId === "string" ||
    typeof json.result === "object" ||
    typeof json.success === "boolean";
  if (!ok) {
    throw new Error(
      "process-upload response must include status/message/error/uploadId/result/success",
    );
  }
}

async function call(body: BodyInit | null, opts: { auth?: boolean; contentType?: string } = {}) {
  const headers: Record<string, string> = {
    "Content-Type": opts.contentType ?? "application/json",
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

Deno.test("Missing Authorization returns 401", async () => {
  const { status, raw } = await call(JSON.stringify({ uploadId: "x" }));
  expectControlledResponse(status, raw);
  if (status !== 401) throw new Error(`Expected 401, got ${status}: ${raw}`);
});

Deno.test("Malformed JSON does not leak stack trace", async () => {
  const { status, raw } = await call("{not json", { auth: true });
  expectControlledResponse(status, raw);
});

Deno.test("Empty body is controlled", async () => {
  const { status, raw } = await call("", { auth: true });
  expectControlledResponse(status, raw);
});

if (USER_JWT) {
  Deno.test("Missing uploadId returns controlled 400", async () => {
    const { status, raw } = await call(JSON.stringify({}), { auth: true });
    expectControlledResponse(status, raw);
    const json = JSON.parse(raw);
    expectUploadProcessShape(json);
    if (status !== 400) throw new Error(`Expected 400, got ${status}`);
  });

  Deno.test("Empty uploadId is controlled", async () => {
    const { status, raw } = await call(JSON.stringify({ uploadId: "" }), { auth: true });
    expectControlledResponse(status, raw);
    if (status !== 400) throw new Error(`Expected 400, got ${status}`);
  });

  Deno.test("Non-string uploadId does not crash", async () => {
    const { status, raw } = await call(JSON.stringify({ uploadId: 123 }), { auth: true });
    expectControlledResponse(status, raw);
    if (status !== 400) throw new Error(`Expected 400, got ${status}`);
  });

  Deno.test("Invalid uploadId shape is controlled", async () => {
    const { status, raw } = await call(JSON.stringify({ uploadId: "!!!!" }), { auth: true });
    expectControlledResponse(status, raw);
    if (status !== 400) throw new Error(`Expected 400, got ${status}`);
  });

  Deno.test("Unknown uploadId returns 404", async () => {
    const { status, raw } = await call(
      JSON.stringify({ uploadId: "00000000-0000-0000-0000-000000000000" }),
      { auth: true },
    );
    expectControlledResponse(status, raw);
    if (status !== 404) throw new Error(`Expected 404, got ${status}: ${raw}`);
  });

  Deno.test("Invalid module type does not crash", async () => {
    const { status, raw } = await call(
      JSON.stringify({ uploadId: "00000000-0000-0000-0000-000000000000", module: 12345 }),
      { auth: true },
    );
    expectControlledResponse(status, raw);
  });

  Deno.test("Metadata as non-object does not crash", async () => {
    const { status, raw } = await call(
      JSON.stringify({ uploadId: "00000000-0000-0000-0000-000000000000", metadata: "oops" }),
      { auth: true },
    );
    expectControlledResponse(status, raw);
  });
} else {
  console.warn("[contract] USER_JWT not set — auth-gated cases skipped.");
}
