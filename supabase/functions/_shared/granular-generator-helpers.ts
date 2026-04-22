// Sprint 4 — Granular generator helpers
// Safe-by-default: any failure inside these helpers causes the caller
// to fall back to the legacy pipeline. Never throw to the caller.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type BancaStatus = "pronta" | "parcial" | "nao_pronta" | "unknown";

export interface BancaCoverage {
  banca: string;
  status: BancaStatus;
  pct_subtopics: number | null;
  pct_specialties: number | null;
}

export interface TopicShare {
  specialty_id: string;
  specialty_nome: string;
  topic_id: string;
  topic_nome: string;
  weight: number;        // sum of curriculum_weights.peso for subtopics under this topic for the banca
  questions: number;     // allocated questions
}

export interface GranularPlan {
  banca: string;
  banca_status: BancaStatus;
  total_questions: number;
  shares: TopicShare[];
  coverage_pct_subtopics: number | null;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Normalize banca string to match curriculum_weights.banca convention. */
export function normalizeBanca(input?: string | null): string | null {
  if (!input) return null;
  const v = input.trim().toLowerCase();
  if (!v) return null;
  // Allow both "ENARE" and "enare", "USP-SP" / "usp_sp" etc.
  return v.replace(/\s+/g, "_").replace(/-/g, "_");
}

/** Read coverage status from Sprint 3 view. Never throws. */
export async function getBancaCoverage(bancaInput: string): Promise<BancaCoverage> {
  const banca = normalizeBanca(bancaInput);
  if (!banca) {
    return { banca: bancaInput, status: "unknown", pct_subtopics: null, pct_specialties: null };
  }
  try {
    const sb = admin();
    // Aggregate directly from the Sprint 3 view to avoid relying on RPC perms.
    const { data, error } = await sb
      .from("v_curriculum_coverage_by_banca")
      .select("banca, has_weight, subtopic_id, specialty_id")
      .ilike("banca", banca);
    if (error || !data || data.length === 0) {
      return { banca, status: "unknown", pct_subtopics: null, pct_specialties: null };
    }
    const totalSub = new Set(data.map((r: any) => r.subtopic_id)).size;
    const coveredSub = new Set(data.filter((r: any) => r.has_weight).map((r: any) => r.subtopic_id)).size;
    const totalSpec = new Set(data.map((r: any) => r.specialty_id)).size;
    const coveredSpec = new Set(
      data.filter((r: any) => r.has_weight).map((r: any) => r.specialty_id),
    ).size;

    const pctSub = totalSub > 0 ? (100 * coveredSub) / totalSub : 0;
    const pctSpec = totalSpec > 0 ? (100 * coveredSpec) / totalSpec : 0;

    let status: BancaStatus = "nao_pronta";
    if (pctSub >= 80 && pctSpec >= 90) status = "pronta";
    else if (pctSub >= 40 || pctSpec >= 60) status = "parcial";

    return { banca, status, pct_subtopics: pctSub, pct_specialties: pctSpec };
  } catch (_e) {
    return { banca: bancaInput, status: "unknown", pct_subtopics: null, pct_specialties: null };
  }
}

/**
 * Build a topic-level distribution for the given banca + total question count.
 * Granularity is intentionally TOPIC, not subtopic, per Sprint 4 decision.
 * Returns null on any failure → caller must fall back to legacy pipeline.
 */
export async function buildTopicDistribution(
  bancaInput: string,
  totalQuestions: number,
  specialtyHints?: string[],
): Promise<GranularPlan | null> {
  const banca = normalizeBanca(bancaInput);
  if (!banca || totalQuestions < 1) return null;

  try {
    const sb = admin();
    let q = sb
      .from("v_curriculum_coverage_by_banca")
      .select("banca, specialty_id, specialty_nome, topic_id, topic_nome, peso, has_weight")
      .ilike("banca", banca)
      .eq("has_weight", true);

    if (specialtyHints && specialtyHints.length > 0) {
      // OR ilike on specialty_nome; tolerate accent / case differences
      q = q.or(specialtyHints.map((s) => `specialty_nome.ilike.%${s}%`).join(","));
    }

    const { data, error } = await q;
    if (error || !data || data.length === 0) return null;

    // Aggregate per (specialty_id, topic_id)
    const byTopic = new Map<string, TopicShare>();
    for (const row of data as any[]) {
      const key = `${row.specialty_id}::${row.topic_id}`;
      const cur = byTopic.get(key);
      const peso = Number(row.peso) || 0;
      if (cur) {
        cur.weight += peso;
      } else {
        byTopic.set(key, {
          specialty_id: row.specialty_id,
          specialty_nome: row.specialty_nome,
          topic_id: row.topic_id,
          topic_nome: row.topic_nome,
          weight: peso,
          questions: 0,
        });
      }
    }

    const shares = Array.from(byTopic.values()).filter((s) => s.weight > 0);
    if (shares.length === 0) return null;

    const totalWeight = shares.reduce((acc, s) => acc + s.weight, 0);
    if (totalWeight <= 0) return null;

    // Proportional allocation with largest-remainder rounding
    let allocated = 0;
    const remainders: Array<{ idx: number; rem: number }> = [];
    shares.forEach((s, idx) => {
      const exact = (s.weight / totalWeight) * totalQuestions;
      const floor = Math.floor(exact);
      s.questions = floor;
      allocated += floor;
      remainders.push({ idx, rem: exact - floor });
    });
    let remaining = totalQuestions - allocated;
    remainders.sort((a, b) => b.rem - a.rem);
    for (let i = 0; i < remaining && i < remainders.length; i++) {
      shares[remainders[i].idx].questions += 1;
    }

    // Drop topics that ended with 0 questions for cleanliness
    const finalShares = shares.filter((s) => s.questions > 0)
      .sort((a, b) => b.questions - a.questions);

    const cov = await getBancaCoverage(bancaInput);

    return {
      banca,
      banca_status: cov.status,
      total_questions: totalQuestions,
      shares: finalShares,
      coverage_pct_subtopics: cov.pct_subtopics,
    };
  } catch (_e) {
    return null;
  }
}

/** Read the granular_generator_enabled flag. Defaults to false on any error. */
export async function isGranularEnabled(): Promise<boolean> {
  try {
    const sb = admin();
    const { data } = await sb
      .from("system_flags")
      .select("enabled")
      .eq("flag_key", "granular_generator_enabled")
      .maybeSingle();
    return Boolean(data?.enabled);
  } catch {
    return false;
  }
}

export interface RunLog {
  user_id?: string | null;
  endpoint: string;
  pipeline_used: "granular" | "legacy";
  banca?: string | null;
  banca_status?: string | null;
  requested_specialties?: string[] | null;
  requested_count?: number | null;
  generated_count?: number | null;
  topic_distribution?: unknown;
  fallback_triggered?: boolean;
  fallback_reason?: string | null;
  duration_ms?: number | null;
  status?: "success" | "fallback" | "error";
  error_message?: string | null;
  metadata?: Record<string, unknown>;
}

/** Fire-and-forget log. Never throws. */
export function logGeneratorRun(entry: RunLog): void {
  try {
    const sb = admin();
    void sb.from("granular_generator_runs").insert({
      user_id: entry.user_id ?? null,
      endpoint: entry.endpoint,
      pipeline_used: entry.pipeline_used,
      banca: entry.banca ?? null,
      banca_status: entry.banca_status ?? null,
      requested_specialties: entry.requested_specialties ?? null,
      requested_count: entry.requested_count ?? null,
      generated_count: entry.generated_count ?? null,
      topic_distribution: entry.topic_distribution ?? {},
      fallback_triggered: entry.fallback_triggered ?? false,
      fallback_reason: entry.fallback_reason ?? null,
      duration_ms: entry.duration_ms ?? null,
      status: entry.status ?? "success",
      error_message: entry.error_message ?? null,
      metadata: entry.metadata ?? {},
    }).then(({ error }) => {
      if (error) console.warn("[granular-log] insert failed:", error.message);
    });
  } catch (e) {
    console.warn("[granular-log] threw:", (e as Error).message);
  }
}

/**
 * Decide if the granular pipeline should run for this request.
 * Returns the plan when eligible, or null + reason when not.
 */
export async function planGranularOrFallback(opts: {
  banca?: string | null;
  totalQuestions: number;
  specialtyHints?: string[];
}): Promise<
  | { eligible: true; plan: GranularPlan }
  | { eligible: false; reason: string; banca_status?: BancaStatus; banca?: string }
> {
  if (!opts.banca) return { eligible: false, reason: "no_banca_provided" };

  const enabled = await isGranularEnabled();
  if (!enabled) return { eligible: false, reason: "flag_off", banca: opts.banca };

  const cov = await getBancaCoverage(opts.banca);
  if (cov.status !== "pronta") {
    return { eligible: false, reason: `banca_status_${cov.status}`, banca_status: cov.status, banca: opts.banca };
  }

  const plan = await buildTopicDistribution(opts.banca, opts.totalQuestions, opts.specialtyHints);
  if (!plan || plan.shares.length === 0) {
    return { eligible: false, reason: "empty_distribution", banca_status: cov.status, banca: opts.banca };
  }

  return { eligible: true, plan };
}

/** Build a structured prompt fragment describing the topic-level plan. */
export function renderPlanForPrompt(plan: GranularPlan): string {
  const lines = plan.shares.map(
    (s) => `- ${s.specialty_nome} → ${s.topic_nome}: ${s.questions} questão(ões)`,
  );
  return `DISTRIBUIÇÃO GRANULAR (banca ${plan.banca.toUpperCase()}, granularidade=topic):\n${lines.join("\n")}`;
}
