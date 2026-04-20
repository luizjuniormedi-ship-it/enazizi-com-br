/**
 * useRadarPlannerOverlay
 * ──────────────────────
 * Cruza recomendações ATIVAS do Radar de Trajetória com tasks do Planner
 * para produzir um overlay leve (apenas frontend) que:
 *  - sinaliza visualmente quais tasks foram "tocadas" pelo Radar
 *  - sugere prioridade +1/-1 com base em risco / oportunidade
 *
 * NÃO escreve no backend. NÃO altera daily_plan_tasks. NÃO reordena fisicamente.
 * Apenas devolve um Map<topicLowercased, OverlayHint> para a UI consumir.
 *
 * Rastreabilidade: cada hint carrega `recommendationId` + `recommendationKey`
 * + `rationale` + `priorityDelta` para tooltip/auditoria.
 */
import { useMemo } from "react";
import { useRadarTrajetoria } from "@/hooks/useRadarTrajetoria";
import type { TrajectoryRecommendation } from "@/types/trajectory";

export type RadarOverlayKind =
  | "weak_topic_boost"      // tema fraco → +1 prioridade
  | "review_priority"       // backlog alto → revisão antes
  | "error_reinforce"       // erro recorrente → reforço
  | "simulado_suggested"    // baixa exposição → sugerir simulado
  | "strong_topic_lower";   // tema forte → -1 prioridade

export interface RadarOverlayHint {
  topic: string;            // chave normalizada (lowercase trim)
  kind: RadarOverlayKind;
  label: string;            // badge curto para a UI
  priorityDelta: -1 | 0 | 1;
  rationale: string;
  recommendationId: string;
  recommendationKey: string;
  origin: "radar_trajetoria";
}

function normalizeTopic(t: string | null | undefined): string {
  return (t || "").trim().toLowerCase();
}

/**
 * Mapeia recommendation_key (vindo do backend trajectory-engine) em um
 * tipo de overlay visual. Mantemos defensivo: chaves desconhecidas viram
 * weak_topic_boost (default neutro), nunca quebram a UI.
 */
function classify(rec: TrajectoryRecommendation): RadarOverlayKind {
  const key = (rec.recommendationKey || "").toLowerCase();
  if (key.includes("review") || key.includes("backlog")) return "review_priority";
  if (key.includes("error") || key.includes("reinforce")) return "error_reinforce";
  if (key.includes("simulado") || key.includes("exposure")) return "simulado_suggested";
  if (key.includes("strong") || key.includes("reduce")) return "strong_topic_lower";
  return "weak_topic_boost";
}

function labelFor(kind: RadarOverlayKind): { label: string; delta: -1 | 0 | 1 } {
  switch (kind) {
    case "weak_topic_boost":   return { label: "Priorizado pelo Radar", delta: 1 };
    case "review_priority":    return { label: "Revisão sugerida pelo Radar", delta: 1 };
    case "error_reinforce":    return { label: "Reforço por erro (Radar)", delta: 1 };
    case "simulado_suggested": return { label: "Simulado sugerido (Radar)", delta: 0 };
    case "strong_topic_lower": return { label: "Tema forte — Radar", delta: -1 };
  }
}

export function useRadarPlannerOverlay() {
  const { data, isLoading } = useRadarTrajetoria();

  const overlay = useMemo(() => {
    const map = new Map<string, RadarOverlayHint>();
    if (!data?.recommendations?.length) return map;

    // Considera apenas recomendações da snapshot atual (já filtrado no hook)
    for (const rec of data.recommendations) {
      const payload = rec.payload || {};
      const topicRaw =
        (payload as { topic?: string; tema?: string }).topic ??
        (payload as { tema?: string }).tema ??
        rec.title;
      const topicKey = normalizeTopic(topicRaw);
      if (!topicKey) continue;

      const kind = classify(rec);
      const { label, delta } = labelFor(kind);

      // Mantém o de maior prioridade (priority menor = mais prioritário no schema)
      const existing = map.get(topicKey);
      if (existing) {
        // se já existe, não sobrescreve (estabilidade visual)
        continue;
      }

      map.set(topicKey, {
        topic: topicKey,
        kind,
        label,
        priorityDelta: delta,
        rationale: rec.rationale || rec.description || "Recomendação do Radar de Trajetória",
        recommendationId: rec.id,
        recommendationKey: rec.recommendationKey,
        origin: "radar_trajetoria",
      });
    }
    return map;
  }, [data]);

  /** Helper: lookup rápido por tema da task. */
  const getHint = (topic: string | null | undefined): RadarOverlayHint | null => {
    const key = normalizeTopic(topic);
    if (!key) return null;
    return overlay.get(key) ?? null;
  };

  return { overlay, getHint, isLoading };
}
