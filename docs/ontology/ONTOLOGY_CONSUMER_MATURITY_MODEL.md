# ENAZIZI — Ontology Consumer Maturity Model

**Status:** Active · **Freeze:** v25 · **Contract version:** v25.1

Complements `GOVERNANCE_CONTRACT.md` and `OBSERVABILITY_CONTRACT.md`.
Defines how consumers progress from "does not use ontology" to deeper
integration, and the gates between each level.

---

## Maturity Levels

| Level | Name                              | What it may do                                                                  |
| ----- | --------------------------------- | ------------------------------------------------------------------------------- |
| **L0** | Does not use ontology             | No reads, no writes. Pure legacy runtime.                                       |
| **L1** | Read-only analytics               | May read `ontology.v_*` for dashboards / reporting. No user-facing decisions.   |
| **L2** | Optional semantic enrichment      | May display ontology-derived chips/labels alongside legacy data. UI only.       |
| **L3** | Feature-flagged production assist | May influence non-critical UX (e.g. filter hints) behind per-consumer flag.     |
| **L4** | Runtime-assisted                  | May contribute to a production decision **after** legacy ran first.             |
| **L5** | Ontology-native                   | Ontology is primary source for the consumer. Legacy is fallback only.           |

---

## Hard Rules

- **Mandatory L0**: Planner, FSRS, Tutor IA, TRI, Simulados engine, Quality tier
  pipeline, Ingestão. These modules are permanently L0 while Freeze v25 holds.
- **No level skipping.** Every promotion is L<sub>n</sub> → L<sub>n+1</sub>.
- **Every promotion requires an RFC** referenced in
  `ontology.consumer_certifications` and `ontology.semantic_change_audit`.
- Promotion to L3 or above additionally requires:
  - `rollback_tested = true`
  - `production_approved = true`
  - An entry in `ontology.consumer_feature_flags` with `rollout_percentage <= 10`
    for the first 14 days, then a documented ramp.
- **Demotion is always allowed and never requires approval.** Operators may
  drop any consumer back to L0 instantly via the kill switch
  (`ontology.system_flags.ontology_runtime_enabled = false`) or by disabling
  the consumer's flag row.

---

## Promotion Gates

| From → To | Required artifacts                                                                                       |
| --------- | -------------------------------------------------------------------------------------------------------- |
| L0 → L1   | RFC, ownership recorded in `ontology.registered_consumers`, pinned `ontology_version`.                   |
| L1 → L2   | 30+ days of clean access logs, zero `view_not_allowed` or `version_not_pinned` violations.               |
| L2 → L3   | Feature flag row created, `rollback_tested = true`, observability dashboards in place.                   |
| L3 → L4   | 60+ days at L3 with `drift_count` stable, rollback drill executed in last 30 days.                       |
| L4 → L5   | Explicit lift of Freeze v25 for that consumer + business sign-off. Currently unreachable.                |

---

## Forbidden Dependencies (while Freeze v25 is active)

- Planner MUST NOT depend on `ontology.*`.
- FSRS MUST NOT depend on `ontology.*`.
- Tutor IA MUST NOT depend on `ontology.*`.
- TRI MUST NOT depend on `ontology.*`.
- Simulados engine MUST NOT depend on `ontology.*`.
- `questions_bank.specialty_id` MUST NEVER be derived from ontology.

---

## Guiding Principle

> Promotion is opt-in, slow, RFC-gated, and reversible.
> Demotion is always one flag away.
