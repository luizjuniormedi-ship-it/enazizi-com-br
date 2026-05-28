# ENAZIZI — Ontology Transition Plan (Fases 1 – 5)

**Status:** Active · **Freeze:** v25 · **Contract version:** v25.1

Operational contract for the gradual, reversible, auditable transition from
the legacy pedagogical runtime to an ontology-aware future, without any big
bang. Read alongside `GOVERNANCE_CONTRACT.md`, `OBSERVABILITY_CONTRACT.md`,
`ONTOLOGY_CONSUMER_MATURITY_MODEL.md`, `SAFE_ROLLBACK_CONTRACT.md`.

---

## Absolute Principles

1. **Legacy-first.** `questions_bank.specialty_id` is the authoritative source
   until any consumer reaches L5 (currently unreachable).
2. **Read-only first.** Consumers may only read ontology. No pedagogical
   behavior may change as a result.
3. **No dual-write.** No automatic sync from ontology → legacy (or reverse).
4. **Instant rollback.** Every consumer can be disabled via feature flag in
   one step. Master kill switch overrides everything.
5. **No silent heuristics.** AI and fuzzy matching remain forbidden. Every
   semantic change requires an RFC.
6. **Zero breaking change.** No legacy payload, contract, or pipeline is
   modified.

---

## Phase 1 — Shadow Mode (current)

**Goal:** consumers read ontology in parallel with legacy, with zero user
impact.

Helper: `src/lib/ontologyRuntime.ts`.

Required pattern for any shadow consumer:

```ts
import {
  isOntologyEnabled,
  safeReadOntology,
  fallbackLegacySpecialty,
} from "@/lib/ontologyRuntime";

const CTX = {
  consumerName: "admin-curriculum-dashboard",
  featureName: "shadow_read_specialty_map",
  ontologyVersionPinned: "ontology_v1",
};

// Legacy path always runs first and decides UI.
const legacySpecialty = fallbackLegacySpecialty(question);
renderLegacy(legacySpecialty);

// Shadow read — observation only, MUST NOT influence rendering.
if (await isOntologyEnabled(CTX)) {
  const shadow = await safeReadOntology(question.id, CTX);
  recordShadowObservation(shadow); // analytics only
}
```

Shadow consumers MUST NOT:

- alter UI based on ontology results,
- alter scoring, ranking, scheduling, FSRS, TRI, or simulados outputs,
- write to the ontology,
- block on ontology errors.

Logging is automatic via `safeReadOntology` (writes to
`ontology.ontology_access_log`).

Master kill switch: `ontology.system_flags.ontology_runtime_enabled`.
Currently **off**. Flip to on only when at least one consumer is registered
and approved.

---

## Phase 2 — Drift Analytics

**Goal:** measure divergence between ontology and legacy.

Helper: `src/lib/ontologyDrift.ts`.

```ts
import { evaluateQuestionDrift, aggregateDriftMetrics } from "@/lib/ontologyDrift";

const reports = await Promise.all(
  questions.map((q) => evaluateQuestionDrift(q, CTX)),
);
const metrics = aggregateDriftMetrics(reports);
```

The drift evaluator reads `ontology.v_semantic_drift` and never re-classifies
client-side. Metrics produced (`mismatchRate`, `fallbackRate`,
`nullResolutionRate`, `semanticConflictRate`, `latencyP95Ms`) feed admin
dashboards only.

Drift findings are **RFC candidates**. They are never used to auto-correct
legacy data.

---

## Phase 3 — Consumer Certification

Promotion gates per maturity level live in
`ONTOLOGY_CONSUMER_MATURITY_MODEL.md`. Persisted in
`ontology.consumer_certifications`.

Required for any promotion to L3+:
- `rollback_tested = true`
- `production_approved = true`
- 30+ days of clean shadow logs
- `drift_count` trend documented in RFC
- Observability dashboards in place
- Human reviewer signature in RFC

---

## Phase 4 — First Allowed Consumer

The first and only consumer permitted to graduate from L0 is an **analytics
dashboard** reading exclusively:

- `ontology.v_unclassified_analysis`
- `ontology.v_pending_curriculum_rfc`
- `ontology.v_question_curriculum` (read-only, display only)

Permanently forbidden from this phase (and beyond, while Freeze v25 holds):
Planner, FSRS, Tutor IA, TRI, Simulados engine.

---

## Phase 5 — Controlled Canary

Allowed only when **all** of the following are true for the candidate consumer:

- 30 days in shadow mode without incident
- drift metrics stable (RFC reviewer judgement, not a fixed threshold)
- rollback drill executed in last 30 days
- consumer certified at L3+
- feature flag row exists with `rollout_percentage <= 5`
- real-time observability dashboards green

Demotion is always one flag flip away. The master kill switch overrides
all consumer flags.

---

## Guiding Principle

> Slow, governed evolution beats fast, irreversible migration.
