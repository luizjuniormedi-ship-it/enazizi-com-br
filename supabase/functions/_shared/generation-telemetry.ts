// Sprint 5 — Observabilidade & Telemetria do Gerador
// Wrapper fino sobre logGeneratorRun que adiciona campos de telemetria
// (perfil, modo, batches, taxa de erro) e roteia em A/B determinístico.
// Fire-and-forget: nunca lança.

import { logGeneratorRun, type RunLog } from "./granular-generator-helpers.ts";

export type GenerationMode =
  | "simulado_adaptive"
  | "simulado_real"
  | "treino"
  | "prova_real"
  | "questao_avulsa"
  | "outro";

export interface TelemetryRunInput extends RunLog {
  user_profile?: string | null;
  generation_mode?: GenerationMode | string | null;
  batch_count?: number | null;
  /** total de batches que falharam dividido por batch_count, em [0,1] */
  batch_error_rate?: number | null;
  /** força um bucket A/B; se ausente, é calculado a partir do user_id */
  ab_bucket?: "bucket_a" | "bucket_b" | null;
}

/** Determinístico: hash simples do user_id → bucket. Mantém estabilidade entre requests. */
export function assignAbBucket(userId?: string | null): "bucket_a" | "bucket_b" {
  if (!userId) return Math.random() < 0.5 ? "bucket_a" : "bucket_b";
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return h % 2 === 0 ? "bucket_a" : "bucket_b";
}

/**
 * Loga um run no `granular_generator_runs` com os campos extras de telemetria
 * em `metadata` (a tabela já tem batch_count/user_profile/generation_mode/etc.
 * como colunas reais — gravamos em ambos para resiliência).
 */
export function recordGenerationRun(input: TelemetryRunInput): void {
  try {
    const ab = input.ab_bucket ?? assignAbBucket(input.user_id);
    const meta = {
      ...(input.metadata ?? {}),
      user_profile: input.user_profile ?? null,
      generation_mode: input.generation_mode ?? null,
      batch_count: input.batch_count ?? null,
      batch_error_rate: input.batch_error_rate ?? null,
      ab_bucket: ab,
    };
    logGeneratorRun({
      ...input,
      metadata: meta,
    });

    // Persistência adicional nas colunas dedicadas (best-effort).
    // Usamos uma segunda escrita só se houver alguma das colunas, para
    // facilitar consultas agregadas sem precisar abrir o JSON.
    void persistColumns({
      pipeline_used: input.pipeline_used,
      banca: input.banca ?? null,
      endpoint: input.endpoint,
      user_profile: input.user_profile ?? null,
      generation_mode: (input.generation_mode as string) ?? null,
      batch_count: input.batch_count ?? null,
      batch_error_rate: input.batch_error_rate ?? null,
      ab_bucket: ab,
      created_at_window_ms: 5000, // tenta encontrar a linha que acabamos de inserir
    });
  } catch (e) {
    console.warn("[generation-telemetry] threw:", (e as Error).message);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function persistColumns(opts: {
  pipeline_used: "granular" | "legacy";
  banca: string | null;
  endpoint: string;
  user_profile: string | null;
  generation_mode: string | null;
  batch_count: number | null;
  batch_error_rate: number | null;
  ab_bucket: "bucket_a" | "bucket_b";
  created_at_window_ms: number;
}): Promise<void> {
  try {
    // logGeneratorRun é fire-and-forget; pequena espera para a linha existir
    await new Promise((r) => setTimeout(r, 250));
    const sb = admin();
    const since = new Date(Date.now() - opts.created_at_window_ms).toISOString();

    const { data: row } = await sb
      .from("granular_generator_runs")
      .select("id")
      .eq("endpoint", opts.endpoint)
      .eq("pipeline_used", opts.pipeline_used)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row?.id) return;

    await sb.from("granular_generator_runs")
      .update({
        user_profile: opts.user_profile,
        generation_mode: opts.generation_mode,
        batch_count: opts.batch_count,
        batch_error_rate: opts.batch_error_rate,
        ab_bucket: opts.ab_bucket,
      })
      .eq("id", row.id);
  } catch (e) {
    console.warn("[generation-telemetry] persistColumns failed:", (e as Error).message);
  }
}
