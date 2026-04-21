/**
 * Coverage Boost Telemetry (Fase 1.7)
 * ───────────────────────────────────
 * Camada fina, defensiva e assíncrona para gravar eventos de boost
 * em `coverage_boost_events`. Nunca lança, nunca bloqueia o motor.
 *
 * - Gravação: `logBoostEvents(userId, recs)` — chamada após o engine produzir
 *   recomendações; envia em lote apenas quem teve `coverageBoostApplied > 0`.
 * - Atualização: `markRecommendationClicked` / `markRecommendationExecuted`
 *   — atualizam o evento mais recente do usuário para um `recommendation_id`.
 * - Dedup: usa um Set em memória por sessão para evitar gravar o mesmo
 *   `userId+recommendationId` duas vezes seguidas (ex.: refetch do React Query).
 */
import { supabase } from "@/integrations/supabase/client";
import type { StudyRecommendation } from "@/lib/studyEngine";

const sessionDedup = new Set<string>();

function dedupKey(userId: string, recId: string | undefined): string {
  return `${userId}::${recId ?? "anon"}`;
}

/** Grava eventos de boost em lote. Tolerante a falhas. */
export async function logBoostEvents(userId: string, recs: StudyRecommendation[]): Promise<void> {
  if (!userId || !Array.isArray(recs) || recs.length === 0) return;
  try {
    const rows = recs
      .filter((r) => (r.coverageBoostApplied ?? 0) > 0)
      .filter((r) => {
        const k = dedupKey(userId, r.id);
        if (sessionDedup.has(k)) return false;
        sessionDedup.add(k);
        return true;
      })
      .map((r) => ({
        user_id: userId,
        recommendation_id: r.id ?? null,
        recommendation_type: r.type ?? null,
        topic: r.topic ?? null,
        subtopic: r.subtopic ?? null,
        specialty: r.specialty ?? null,
        subtopic_id: r.subtopicId ?? null,
        topic_id: r.topicId ?? null,
        specialty_id: r.specialtyId ?? null,
        coverage_boost_score: r.coverageBoostScore ?? 0,
        coverage_boost_applied: r.coverageBoostApplied ?? 0,
        coverage_boost_level: r.coverageBoostLevel ?? null,
        coverage_boost_reason: r.coverageBoostReason ?? null,
        coverage_boost_match_method: r.coverageBoostMatchMethod ?? null,
        boost_breakdown: r.coverageBoostBreakdown ?? {},
      }));
    if (rows.length === 0) return;
    const { error } = await supabase.from("coverage_boost_events" as any).insert(rows);
    if (error) {
      console.warn("[coverageBoostTelemetry] insert failed:", error.message);
    } else {
      console.log(`[coverageBoostTelemetry] logged ${rows.length} boost events`);
    }
  } catch (e) {
    console.warn("[coverageBoostTelemetry] unexpected:", e);
  }
}

/** Marca o evento mais recente desta recomendação como `clicked`. */
export async function markRecommendationClicked(userId: string, recommendationId: string | undefined | null): Promise<void> {
  if (!userId || !recommendationId) return;
  try {
    const { data } = await supabase
      .from("coverage_boost_events" as any)
      .select("id")
      .eq("user_id", userId)
      .eq("recommendation_id", recommendationId)
      .eq("clicked", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const id = (data as any)?.id as string | undefined;
    if (!id) return;
    await supabase
      .from("coverage_boost_events" as any)
      .update({ clicked: true, clicked_at: new Date().toISOString() })
      .eq("id", id);
  } catch (e) {
    console.warn("[coverageBoostTelemetry] markClicked failed:", e);
  }
}

/** Marca o evento mais recente desta recomendação como `executed`. */
export async function markRecommendationExecuted(userId: string, recommendationId: string | undefined | null): Promise<void> {
  if (!userId || !recommendationId) return;
  try {
    const { data } = await supabase
      .from("coverage_boost_events" as any)
      .select("id, clicked")
      .eq("user_id", userId)
      .eq("recommendation_id", recommendationId)
      .eq("executed", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const id = (data as any)?.id as string | undefined;
    if (!id) return;
    const patch: Record<string, unknown> = { executed: true, executed_at: new Date().toISOString() };
    // Se ainda não havia sido clicado, considera clique implícito ao executar
    if (!(data as any)?.clicked) {
      patch.clicked = true;
      patch.clicked_at = new Date().toISOString();
    }
    await supabase.from("coverage_boost_events" as any).update(patch).eq("id", id);
  } catch (e) {
    console.warn("[coverageBoostTelemetry] markExecuted failed:", e);
  }
}

/** Limpa o dedup em memória — útil para testes / logout. */
export function resetTelemetryDedup() {
  sessionDedup.clear();
}
