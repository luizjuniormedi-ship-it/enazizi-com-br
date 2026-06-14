// Smoke latency test for `tutor-v3-premium` (Wave Perf-1). Non-blocking by default.
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

const FN_URL = `${SUPABASE_URL}/functions/v1/tutor-v3-premium`;

const HEALTHCHECK_WARN_MS = 1500;
const FULL_WARN_MS = 12000;

async function postJson(body: any, opts: { auth?: boolean } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (ANON_KEY) headers["apikey"] = ANON_KEY;
  if (opts.auth && USER_JWT) headers["Authorization"] = `Bearer ${USER_JWT}`;
  const start = performance.now();
  const res = await fetch(FN_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  return {
    status: res.status,
    raw,
    ms: Math.round(performance.now() - start),
  };
}

Deno.test("healthcheck responds quickly (no AI)", async () => {
  const { status, raw, ms } = await postJson({ healthcheck: true }, { auth: !!USER_JWT });
  if (status !== 200) throw new Error(`Healthcheck status ${status}: ${raw}`);
  console.log(`[LATENCY] healthcheck totalMs=${ms}`);
  if (ms > HEALTHCHECK_WARN_MS) {
    console.warn(`[LATENCY_WARN] healthcheck ${ms}ms exceeds ${HEALTHCHECK_WARN_MS}ms`);
  }
});

if (USER_JWT) {
  Deno.test("full tutor request reports timings (debug=true)", async () => {
    const { status, raw, ms } = await postJson(
      {
        debug: true,
        message: "Olá, vamos começar uma aula curta sobre asma.",
        topic: "Asma",
        history: [],
        stream: false,
      },
      { auth: true },
    );
    console.log(`[LATENCY] full totalMs=${ms} status=${status}`);
    if (status >= 500) throw new Error(`Uncontrolled ${status}: ${raw.slice(0, 300)}`);
    if (ms > FULL_WARN_MS) {
      console.warn(`[LATENCY_WARN] full ${ms}ms exceeds ${FULL_WARN_MS}ms`);
    }
    try {
      const json = JSON.parse(raw);
      const t = json?.debug?.timings;
      if (t) {
        console.log(`[LATENCY_TIMINGS] ${JSON.stringify(t)}`);
      } else {
        console.warn("[LATENCY_TIMINGS] missing — instrumentação não retornou timings");
      }
    } catch (_) {
      // tolerate non-JSON during outage
    }
  });
} else {
  console.warn("[latency] USER_JWT not set — full request test skipped.");
}
