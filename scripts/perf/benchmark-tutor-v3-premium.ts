// Perf-4: Real latency benchmark for `tutor-v3-premium`.
// Non-destructive, warning-only, safe to run against staging or prod.
// Usage:
//   USER_JWT=... deno run --allow-net --allow-env --allow-write \
//     scripts/perf/benchmark-tutor-v3-premium.ts
//
// Env vars:
//   TUTOR_FUNCTION_URL | SUPABASE_FUNCTIONS_URL  (default: prod ENAZIZI)
//   USER_JWT | SUPABASE_CONTRACT_USER_JWT       (required for non-healthcheck)
//   SUPABASE_PUBLISHABLE_KEY | SUPABASE_ANON_KEY (apikey header)
//   TUTOR_BENCH_RUNS                             (default: 5)
//
// NEVER prints prompt/memory/RAG/JWT contents — only numeric metrics.

import "https://deno.land/std@0.224.0/dotenv/load.ts";

const RUNS = Number(Deno.env.get("TUTOR_BENCH_RUNS") ?? 5);
const BASE_URL =
  Deno.env.get("TUTOR_FUNCTION_URL") ||
  (Deno.env.get("SUPABASE_FUNCTIONS_URL")
    ? `${Deno.env.get("SUPABASE_FUNCTIONS_URL")}/tutor-v3-premium`
    : "https://qszsyskumcmuknumwxtk.supabase.co/functions/v1/tutor-v3-premium");
const JWT =
  Deno.env.get("USER_JWT") ||
  Deno.env.get("SUPABASE_CONTRACT_USER_JWT") ||
  "";
const ANON =
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ||
  Deno.env.get("SUPABASE_ANON_KEY") ||
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ||
  "";

type RunResult = {
  ok: boolean;
  totalMs: number;
  aiMs: number;
  inputChars: number;
  fallbackUsed: boolean;
  timedOut: boolean;
  trimmed: boolean;
  status: number;
};

type Scenario = {
  name: string;
  body: Record<string, unknown>;
  auth: boolean;
};

function bigHistory(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: "x".repeat(400) + ` msg${i}`,
  }));
}

const SCENARIOS: Scenario[] = [
  { name: "healthcheck", auth: false, body: { healthcheck: true } },
  {
    name: "tutor_minimal",
    auth: true,
    body: {
      debug: true,
      message: "Olá, vamos começar uma aula curta sobre asma.",
      topic: "Asma",
      history: [],
      stream: false,
    },
  },
  {
    name: "continue_block",
    auth: true,
    body: {
      debug: true,
      message: "Pode continuar.",
      topic: "Asma",
      history: bigHistory(2),
      stream: false,
    },
  },
  {
    name: "student_question",
    auth: true,
    body: {
      debug: true,
      message:
        "Qual a diferença entre asma e DPOC em relação à reversibilidade da obstrução? Explique também os critérios espirométricos.",
      topic: "Asma",
      history: bigHistory(4),
      stream: false,
    },
  },
  {
    name: "oversized_history",
    auth: true,
    body: {
      debug: true,
      message: "Continuar.",
      topic: "Asma",
      history: bigHistory(20),
      stream: false,
    },
  },
];

async function callOnce(scn: Scenario): Promise<RunResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (ANON) headers["apikey"] = ANON;
  if (scn.auth && JWT) headers["Authorization"] = `Bearer ${JWT}`;
  const start = performance.now();
  let status = 0;
  let json: any = null;
  try {
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(scn.body),
    });
    status = res.status;
    const raw = await res.text();
    try { json = JSON.parse(raw); } catch { /* tolerate */ }
  } catch (_e) {
    // network error
  }
  const totalMs = Math.round(performance.now() - start);
  const t = json?.debug ?? {};
  const ai = t.aiTimings ?? {};
  const cs = t.contextStats ?? {};
  return {
    ok: status >= 200 && status < 500,
    totalMs,
    aiMs: Number(ai.totalAiMs ?? t.timings?.aiMs ?? 0),
    inputChars: Number(cs.totalInputChars ?? 0),
    fallbackUsed: !!ai.fallbackUsed,
    timedOut: !!ai.timedOut,
    trimmed: !!cs.contextTrimmed,
    status,
  };
}

function pct(arr: number[], p: number) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}
const avg = (a: number[]) => (a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : 0);
const rate = (a: boolean[]) => (a.length ? Math.round((a.filter(Boolean).length / a.length) * 100) : 0);

async function benchmark() {
  console.log(`[BENCH] url=${BASE_URL} runs=${RUNS} jwt=${JWT ? "yes" : "no"}`);
  const summary: Array<{ name: string; runs: RunResult[] }> = [];
  for (const scn of SCENARIOS) {
    const runs: RunResult[] = [];
    for (let i = 0; i < (scn.name === "healthcheck" ? Math.max(3, RUNS) : RUNS); i++) {
      const r = await callOnce(scn);
      runs.push(r);
      console.log(`[BENCH] ${scn.name} #${i + 1} status=${r.status} totalMs=${r.totalMs} aiMs=${r.aiMs} chars=${r.inputChars} trimmed=${r.trimmed} fallback=${r.fallbackUsed} timeout=${r.timedOut}`);
    }
    summary.push({ name: scn.name, runs });
  }

  const lines: string[] = [];
  lines.push(`# Tutor V3 Premium Benchmark — Latest`);
  lines.push("");
  lines.push(`## Summary`);
  lines.push("");
  lines.push(`- Date: ${new Date().toISOString()}`);
  lines.push(`- Function: \`tutor-v3-premium\``);
  lines.push(`- URL: \`${BASE_URL}\``);
  lines.push(`- Scenarios: ${SCENARIOS.length}`);
  lines.push(`- Runs per scenario: ${RUNS}`);
  lines.push(`- JWT available: ${JWT ? "yes" : "no"}`);
  lines.push("");
  lines.push(`## Results by Scenario`);
  lines.push("");
  lines.push(`| Scenario | runs | avg | p50 | p95 | p99 | min | max | avgAiMs | fallback% | timeout% | avgInputChars | trimmed% |`);
  lines.push(`|---|---|---|---|---|---|---|---|---|---|---|---|---|`);

  const findings: string[] = [];
  let slowest = { name: "-", p95: 0 };
  let aiDominant = false;
  let trimmedAny = false;
  let fallbackHigh = false;
  let timeoutSeen = false;

  for (const s of summary) {
    const totals = s.runs.map(r => r.totalMs);
    const ais = s.runs.map(r => r.aiMs);
    const chars = s.runs.map(r => r.inputChars);
    const fbs = s.runs.map(r => r.fallbackUsed);
    const tos = s.runs.map(r => r.timedOut);
    const trs = s.runs.map(r => r.trimmed);
    const p95 = pct(totals, 95);
    const fbRate = rate(fbs);
    const toRate = rate(tos);
    const trRate = rate(trs);
    const avgAi = avg(ais);
    const avgTotal = avg(totals);
    if (p95 > slowest.p95) slowest = { name: s.name, p95 };
    if (avgAi > 0.6 * avgTotal && avgTotal > 1500) aiDominant = true;
    if (trRate > 0) trimmedAny = true;
    if (fbRate >= 30) fallbackHigh = true;
    if (toRate > 0) timeoutSeen = true;

    lines.push(
      `| ${s.name} | ${s.runs.length} | ${avgTotal} | ${pct(totals, 50)} | ${p95} | ${pct(totals, 99)} | ${Math.min(...totals)} | ${Math.max(...totals)} | ${avgAi} | ${fbRate}% | ${toRate}% | ${avg(chars)} | ${trRate}% |`,
    );
  }

  // cold vs warm: first run vs avg of rest in tutor_minimal
  const minimal = summary.find(s => s.name === "tutor_minimal");
  let coldDelta = 0;
  if (minimal && minimal.runs.length > 1) {
    const cold = minimal.runs[0].totalMs;
    const warm = avg(minimal.runs.slice(1).map(r => r.totalMs));
    coldDelta = cold - warm;
    findings.push(`Cold vs warm (tutor_minimal): cold=${cold}ms warm_avg=${warm}ms delta=${coldDelta}ms`);
  }
  findings.push(`Slowest scenario by p95: \`${slowest.name}\` (${slowest.p95}ms)`);
  findings.push(`AI dominant (avgAiMs > 60% of avgTotal): ${aiDominant ? "yes" : "no"}`);
  findings.push(`Fallback >=30%: ${fallbackHigh ? "yes" : "no"}`);
  findings.push(`Any timeout observed: ${timeoutSeen ? "yes" : "no"}`);
  findings.push(`Context trimming triggered: ${trimmedAny ? "yes" : "no"}`);

  lines.push("");
  lines.push(`## Findings`);
  lines.push("");
  for (const f of findings) lines.push(`- ${f}`);

  let rec = "READY_FOR_NEXT_FUNCTION";
  if (timeoutSeen || aiDominant || fallbackHigh) rec = "PROVIDER_LATENCY_DOMINANT";
  else if (trimmedAny) rec = "CONTEXT_STILL_TOO_LARGE";
  else if (coldDelta > 1500) rec = "COLD_START_DOMINANT";

  lines.push("");
  lines.push(`## Recommendation`);
  lines.push("");
  lines.push(`\`${rec}\``);
  lines.push("");

  const out = lines.join("\n");
  console.log("\n" + out);

  try {
    await Deno.mkdir("docs/go-live/perf-results", { recursive: true });
    await Deno.writeTextFile("docs/go-live/perf-results/tutor-v3-premium-benchmark-latest.md", out);
    console.log("[BENCH] wrote docs/go-live/perf-results/tutor-v3-premium-benchmark-latest.md");
  } catch (e) {
    console.warn("[BENCH_WRITE_FAIL]", (e as Error).message);
  }
}

await benchmark();
