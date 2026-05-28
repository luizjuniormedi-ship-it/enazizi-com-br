# ENAZIZI — Safe Rollback Contract (Ontology)

**Status:** Active · **Freeze:** v25 · **Contract version:** v25.1

No ontology-backed feature ships to production without a tested rollback path.
This document is the binding contract.

---

## Rollback Requirements (per feature)

Every feature that reads `ontology.*` in production MUST have, before shipping:

1. **Tested rollback procedure** — documented and executed at least once in
   staging. Recorded in `ontology.consumer_certifications.rollback_tested`.
2. **Legacy fallback path** — the consumer must behave correctly when ontology
   is unavailable, returns empty, or the kill switch is off.
3. **Disable path** — at least one of:
   - per-consumer flag row in `ontology.consumer_feature_flags.enabled = false`,
   - rollout percentage forced to 0,
   - master kill switch `ontology.system_flags.ontology_runtime_enabled = false`.
4. **Operational timeout** — every ontology read must have a strict client
   timeout. On timeout, the consumer falls back to legacy without surfacing
   the failure to the user.
5. **Observability** — request logs in `ontology.ontology_access_log`,
   error counters, fallback counters.

**Sem rollback → sem rollout.** A feature without all five gates is not eligible
for L3+ promotion.

---

## Kill Switch Contract

`ontology.system_flags.ontology_runtime_enabled` is the global kill switch.

```ts
// Required pattern for every ontology consumer
const { data: killFlag } = await supabase
  .schema('ontology')
  .from('system_flags')
  .select('enabled')
  .eq('flag_name', 'ontology_runtime_enabled')
  .maybeSingle();

if (!killFlag?.enabled) {
  return runLegacyPath();   // hard fallback, no error to user
}
```

Operators may flip the flag at any time with no coordination required.
All consumers must respect it within one request cycle.

---

## Rollback Drill Cadence

| Maturity | Drill required                       |
| -------- | ------------------------------------ |
| L0 – L2  | None.                                |
| L3       | At certification + every 90 days.    |
| L4       | At certification + every 30 days.    |
| L5       | Not applicable while Freeze v25 holds. |

Each drill must be recorded as an entry in `ontology.semantic_change_audit`
with `change_type = 'rollback'` and a populated `rollback_reference`.

---

## Guiding Principle

> An enterprise ontology is only safe when it can be completely turned off
> without production noticing.
