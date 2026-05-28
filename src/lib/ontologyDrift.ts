/**
 * ENAZIZI — Ontology Drift Evaluator (Fase 2 — Drift Analytics)
 *
 * Freeze v25. Read-only. Observation-only. Legacy-first.
 *
 * This module COMPARES legacy specialty data against the ontology semantic
 * map and produces a drift report. It NEVER mutates anything pedagogical
 * and NEVER corrects drift automatically. Findings are RFC candidates only.
 *
 * No imports from Planner / FSRS / Tutor / TRI / Simulados are allowed.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  fallbackLegacySpecialty,
  isOntologyRuntimeEnabled,
  safeReadOntology,
  type ConsumerContext,
  type LegacyQuestionLike,
} from "./ontologyRuntime";

export type DriftType =
  | "no_drift"
  | "specialty_mismatch"
  | "multiple_specialty_links"
  | "deprecated_node_link"
  | "version_mismatch"
  | "ontology_empty"
  | "ontology_unavailable";

export interface DriftReport {
  questionId: string;
  legacySpecialtyId: string | null;
  ontologySpecialtyIds: string[];
  driftType: DriftType;
  latencyMs: number;
  semanticSource: "legacy" | "ontology" | "both" | "none";
  fallbackUsed: boolean;
}

/**
 * Evaluate drift for a single question. Always safe; never throws.
 *
 * IMPORTANT: callers MUST NOT use the drift result to alter pedagogical
 * behavior. It exists only to populate dashboards and RFC candidates.
 */
export async function evaluateQuestionDrift(
  question: LegacyQuestionLike & { id: string },
  ctx: ConsumerContext,
): Promise<DriftReport> {
  const start = performance.now();
  const legacy = fallbackLegacySpecialty(question);

  if (!(await isOntologyRuntimeEnabled())) {
    return {
      questionId: question.id,
      legacySpecialtyId: legacy,
      ontologySpecialtyIds: [],
      driftType: "ontology_unavailable",
      latencyMs: Math.round(performance.now() - start),
      semanticSource: legacy ? "legacy" : "none",
      fallbackUsed: true,
    };
  }

  const ontology = await safeReadOntology(question.id, ctx);
  if (!ontology.ok || !ontology.data) {
    return {
      questionId: question.id,
      legacySpecialtyId: legacy,
      ontologySpecialtyIds: [],
      driftType: ontology.fallbackReason === "empty"
        ? "ontology_empty"
        : "ontology_unavailable",
      latencyMs: Math.round(performance.now() - start),
      semanticSource: legacy ? "legacy" : "none",
      fallbackUsed: true,
    };
  }

  // Pull the drift classification from the canonical view rather than
  // re-implementing it client-side. This keeps a single source of truth.
  try {
    const { data, error } = await supabase
      .schema("ontology" as never)
      .from("v_semantic_drift" as never)
      .select("drift_type, ontology_specialty_names")
      .eq("question_id", question.id)
      .maybeSingle();

    if (error || !data) {
      return {
        questionId: question.id,
        legacySpecialtyId: legacy,
        ontologySpecialtyIds: [],
        driftType: "no_drift",
        latencyMs: Math.round(performance.now() - start),
        semanticSource: legacy ? "both" : "ontology",
        fallbackUsed: false,
      };
    }

    const row = data as {
      drift_type?: DriftType | null;
      ontology_specialty_names?: string[] | null;
    };

    return {
      questionId: question.id,
      legacySpecialtyId: legacy,
      ontologySpecialtyIds: row.ontology_specialty_names ?? [],
      driftType: (row.drift_type as DriftType) ?? "no_drift",
      latencyMs: Math.round(performance.now() - start),
      semanticSource: legacy ? "both" : "ontology",
      fallbackUsed: false,
    };
  } catch {
    return {
      questionId: question.id,
      legacySpecialtyId: legacy,
      ontologySpecialtyIds: [],
      driftType: "ontology_unavailable",
      latencyMs: Math.round(performance.now() - start),
      semanticSource: legacy ? "legacy" : "none",
      fallbackUsed: true,
    };
  }
}

export interface DriftMetricsSnapshot {
  sampleSize: number;
  mismatchRate: number;       // drift != no_drift && != ontology_*
  fallbackRate: number;       // any ontology_unavailable / empty
  nullResolutionRate: number; // legacy NULL but ontology has specialty
  semanticConflictRate: number; // specialty_mismatch + multiple_specialty_links
  latencyP95Ms: number;
}

/**
 * Aggregate drift metrics across a batch. Pure function; no side effects.
 */
export function aggregateDriftMetrics(
  reports: DriftReport[],
): DriftMetricsSnapshot {
  const n = reports.length;
  if (n === 0) {
    return {
      sampleSize: 0,
      mismatchRate: 0,
      fallbackRate: 0,
      nullResolutionRate: 0,
      semanticConflictRate: 0,
      latencyP95Ms: 0,
    };
  }

  let mismatches = 0;
  let fallbacks = 0;
  let nullResolved = 0;
  let conflicts = 0;
  const latencies: number[] = [];

  for (const r of reports) {
    latencies.push(r.latencyMs);
    if (r.fallbackUsed) fallbacks++;
    if (
      r.driftType !== "no_drift" &&
      r.driftType !== "ontology_unavailable" &&
      r.driftType !== "ontology_empty"
    ) {
      mismatches++;
    }
    if (
      r.driftType === "specialty_mismatch" ||
      r.driftType === "multiple_specialty_links"
    ) {
      conflicts++;
    }
    if (!r.legacySpecialtyId && r.ontologySpecialtyIds.length > 0) {
      nullResolved++;
    }
  }

  latencies.sort((a, b) => a - b);
  const p95Index = Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95));

  return {
    sampleSize: n,
    mismatchRate: mismatches / n,
    fallbackRate: fallbacks / n,
    nullResolutionRate: nullResolved / n,
    semanticConflictRate: conflicts / n,
    latencyP95Ms: latencies[p95Index] ?? 0,
  };
}
