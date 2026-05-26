/**
 * ENAZIZI — Memory Orchestrator (v22.1)
 *
 * Decide, dado um lookup, QUAL ação tomar:
 *   - use_as_is              : usar memória direto (canonical/promoted, decay alto, perfil exato)
 *   - use_with_rag           : usar memória + enriquecer com RAG (draft/validated)
 *   - partial_reuse          : memória existe mas perfil divergente — usar como skeleton, regenerar
 *   - regenerate_fresh       : sem memória ou similaridade insuficiente
 *   - regenerate_and_compare : A/B silencioso (15% das vezes, evita staleness)
 *   - block_and_alert        : hit em memória quarentinada (não deve acontecer; guardrail)
 *
 * Também emite logs:
 *   [MEMORY_ORCH_DECISION] action=... reason=...
 *   [MEMORY_AB_REGEN]      forçando regeneração para comparar diversidade
 */

import type { TutorMemoryHit, RagHit } from "./tutor-memory.ts";

export type MemoryAction =
  | "use_as_is"
  | "use_with_rag"
  | "partial_reuse"
  | "regenerate_fresh"
  | "regenerate_and_compare"
  | "block_and_alert";

export interface OrchestratorInput {
  memoryHit: TutorMemoryHit | null;
  ragHits: RagHit[];
  userProfile?: {
    cognitiveStage?: string | null;
    difficultyLevel?: string | null;
  };
  /** Fração [0..1] para A/B silencioso. Default 0.15. */
  diversityRate?: number;
}

export interface OrchestratorDecision {
  action: MemoryAction;
  reason: string;
  memoryId?: string;
  useRagContext: boolean;
}

const DEFAULT_DIVERSITY_RATE = 0.15;

export function decideMemoryAction(input: OrchestratorInput): OrchestratorDecision {
  const { memoryHit, ragHits, userProfile } = input;
  const diversityRate = input.diversityRate ?? DEFAULT_DIVERSITY_RATE;

  // Sem memória ou similaridade baixa
  if (!memoryHit) {
    const decision: OrchestratorDecision = {
      action: "regenerate_fresh",
      reason: "no_memory_hit",
      useRagContext: ragHits.length > 0,
    };
    console.log("[MEMORY_ORCH_DECISION]", decision);
    return decision;
  }

  // Guardrail: nunca deveria chegar aqui (lookup filtra), mas se chegar, alerta
  if (memoryHit.promotionStatus === "quarantined") {
    const decision: OrchestratorDecision = {
      action: "block_and_alert",
      reason: "quarantined_hit_unexpected",
      memoryId: memoryHit.id,
      useRagContext: true,
    };
    console.warn("[MEMORY_ORCH_ALERT]", decision);
    return decision;
  }

  // Perfil divergente forte (stage e difficulty ambos batem mas memória tem perfil diferente)
  const stageMismatch =
    userProfile?.cognitiveStage &&
    memoryHit.cognitiveStage &&
    userProfile.cognitiveStage !== memoryHit.cognitiveStage;
  const diffMismatch =
    userProfile?.difficultyLevel &&
    memoryHit.difficultyLevel &&
    userProfile.difficultyLevel !== memoryHit.difficultyLevel;

  if (stageMismatch && diffMismatch) {
    const decision: OrchestratorDecision = {
      action: "partial_reuse",
      reason: "profile_divergent",
      memoryId: memoryHit.id,
      useRagContext: true,
    };
    console.log("[MEMORY_ORCH_DECISION]", decision);
    return decision;
  }

  // A/B silencioso para diversidade — só em draft/validated, nunca em canonical
  const eligibleForAB =
    memoryHit.promotionStatus === "draft" || memoryHit.promotionStatus === "validated";
  if (eligibleForAB && Math.random() < diversityRate) {
    const decision: OrchestratorDecision = {
      action: "regenerate_and_compare",
      reason: "diversity_ab",
      memoryId: memoryHit.id,
      useRagContext: ragHits.length > 0,
    };
    console.log("[MEMORY_AB_REGEN]", decision);
    return decision;
  }

  // Canonical/promoted com decay alto → usar direto
  if (
    (memoryHit.promotionStatus === "canonical" || memoryHit.promotionStatus === "promoted") &&
    memoryHit.decayScore >= 0.7
  ) {
    const decision: OrchestratorDecision = {
      action: "use_as_is",
      reason: `${memoryHit.promotionStatus}_decay_${memoryHit.decayScore.toFixed(2)}`,
      memoryId: memoryHit.id,
      useRagContext: false,
    };
    console.log("[MEMORY_ORCH_DECISION]", decision);
    return decision;
  }

  // Default: draft/validated → usar com RAG como reforço
  const decision: OrchestratorDecision = {
    action: "use_with_rag",
    reason: `${memoryHit.promotionStatus}_with_context`,
    memoryId: memoryHit.id,
    useRagContext: ragHits.length > 0,
  };
  console.log("[MEMORY_ORCH_DECISION]", decision);
  return decision;
}
