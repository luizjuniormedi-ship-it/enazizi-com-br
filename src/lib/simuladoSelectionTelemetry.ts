// Sprint 6 — Telemetria de seleção real de questões (frontend)
// Fire-and-forget: nunca lança, nunca bloqueia o fluxo de geração.

import { supabase } from "@/integrations/supabase/client";

export type GranularFallbackReason =
  | "flag_off"
  | "no_banca_provided"
  | "banca_nao_pronta"
  | "questions_not_classified"
  | "coverage_insufficient"
  | "empty_distribution"
  | "guard_error"
  | "no_attempt";

export interface SimuladoSelectionTelemetry {
  endpoint?: string;                 // default: 'simulados-page'
  mode?: string | null;              // 'estudo' | 'prova_real' | 'tri' | 'adaptativo'
  banca?: string | null;
  user_profile?: string | null;
  requested_count?: number | null;
  final_count?: number | null;

  // mix de fontes — quantas questões vieram de cada origem
  source_pool_textual?: number;
  source_pool_structural?: number;
  source_image_pipeline?: number;
  source_ai_generated?: number;
  source_fallback?: number;

  // elegibilidade granular
  granular_eligible?: boolean;
  granular_fallback_reason?: GranularFallbackReason | null;
  classification_pct_specialty?: number | null;
  classification_pct_topic?: number | null;
  classification_pct_subtopic?: number | null;

  duration_ms?: number | null;
  metadata?: Record<string, unknown>;
}

/** Loga uma execução sem nunca bloquear o fluxo. */
export async function logSimuladoSelection(t: SimuladoSelectionTelemetry): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      user_id: user?.id ?? null,
      endpoint: t.endpoint ?? "simulados-page",
      mode: t.mode ?? null,
      banca: t.banca ?? null,
      user_profile: t.user_profile ?? null,
      requested_count: t.requested_count ?? null,
      final_count: t.final_count ?? null,
      source_pool_textual: t.source_pool_textual ?? 0,
      source_pool_structural: t.source_pool_structural ?? 0,
      source_image_pipeline: t.source_image_pipeline ?? 0,
      source_ai_generated: t.source_ai_generated ?? 0,
      source_fallback: t.source_fallback ?? 0,
      granular_eligible: t.granular_eligible ?? false,
      granular_fallback_reason: t.granular_fallback_reason ?? null,
      classification_pct_specialty: t.classification_pct_specialty ?? null,
      classification_pct_topic: t.classification_pct_topic ?? null,
      classification_pct_subtopic: t.classification_pct_subtopic ?? null,
      duration_ms: t.duration_ms ?? null,
      metadata: t.metadata ?? {},
    };

    // Console estruturado para debug local (sempre)
    console.info("[simulado-selection]", payload);

    const { error } = await supabase
      .from("simulado_selection_runs")
      .insert(payload as any);
    if (error) {
      console.warn("[SIMULADO_SELECTION_LOG_FAIL]", error.message, error);
    } else {
      console.info("[SIMULADO_SELECTION_LOG_OK]", { endpoint: payload.endpoint, mode: payload.mode, final: payload.final_count });
    }
  } catch (e) {
    console.warn("[SIMULADO_SELECTION_LOG_FAIL] threw:", (e as Error).message);

  }
}
