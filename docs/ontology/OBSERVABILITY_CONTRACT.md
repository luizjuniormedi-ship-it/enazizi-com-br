# ENAZIZI — Ontology Observability Contract

**Status:** Active · **Freeze:** v25 · **Contract version:** v25.1

Complements `GOVERNANCE_CONTRACT.md`. This document defines how the ontology
layer is **observed, audited, and protected from informal adoption**.

---

## 1. Access Log

**Table:** `ontology.ontology_access_log` (RLS on, append via service role)

Every consumer that reads any `ontology.v_*` view MUST append a row:

```ts
await supabase.schema('ontology').from('ontology_access_log').insert({
  consumer_name:    'planner-analytics-dashboard',
  consumer_version: '1.4.0',
  ontology_version: ONTOLOGY_VERSION_PINNED,   // pinned constant
  accessed_view:    'v_question_curriculum',
  feature_flag:     'planner_ontology_read',
  user_id:          user?.id ?? null,
  request_id:       requestId,
  environment:      Deno.env.get('ENV'),
});
```

Logging is **opt-in by contract**, not by trigger. There is no global query
interception. Consumers that do not log themselves will be detected as
`not_registered` in `v_unregistered_consumers`.

---

## 2. Registered Consumers

**Table:** `ontology.registered_consumers`

| Field                     | Meaning                                                    |
| ------------------------- | ---------------------------------------------------------- |
| `consumer_name`           | Unique stable identifier                                   |
| `owner`                   | Team or individual responsible                             |
| `allowed_views`           | Whitelist of `ontology.v_*` views this consumer may read   |
| `ontology_version_pinned` | The version slug the consumer is built against             |
| `rollout_stage`           | `disabled \| internal \| beta \| canary \| ga`             |
| `active`                  | Master switch                                              |

**Rule:** A consumer that reads ontology in production without an `active = true`
registration is in **contract violation**. It will surface in
`v_unregistered_consumers` and must be removed or registered.

Registration is performed via service role with an RFC reference.

---

## 3. Unregistered / Drifting Consumers

**View:** `ontology.v_unregistered_consumers`

Surfaces 4 violation types:

| `violation_type`     | Meaning                                                |
| -------------------- | ------------------------------------------------------ |
| `not_registered`     | Consumer name has no entry in `registered_consumers`   |
| `consumer_inactive`  | Registered but `active = false`                        |
| `view_not_allowed`   | Reading a view outside its `allowed_views` whitelist   |
| `version_not_pinned` | Logged a version != `ontology_version_pinned`          |

Operators monitor this view; entries are RFC candidates or revocation triggers.

---

## 4. Feature Flag Governance

No module may, under any circumstance:

- Consume `ontology.*` without an explicit feature flag.
- Bypass a disabled flag in any environment.
- Use ontology data in **scoring**, **ranking**, or **priorização pedagógica**.
- Use ontology data to override or infer `specialty_id`.
- Promote rollout stage without RFC approval.

Permanently legacy-only modules (no flag may ever enable ontology reads for them):
Planner, FSRS, Tutor IA, TRI, Simulados engine, Quality tier, Ingestão.

---

## 5. Health Dashboard

**View:** `ontology.v_ontology_health` — single-row snapshot:

- `total_consumers`, `active_consumers`, `distinct_pinned_versions`
- `unregistered_access_groups` (from §3)
- `drift_count` (from `v_semantic_drift`)
- `deprecated_nodes`, `orphan_semantic_links`
- `pending_rfc_reviews`
- `active_version_slug`, `observed_at`

Consumed by ops dashboards only. Not used for any pedagogical decision.

---

## 6. Semantic Change Audit (append-only)

**Table:** `ontology.semantic_change_audit`
**Triggers:** `trg_block_audit_update`, `trg_block_audit_delete` — both raise
exceptions. The table is **physically append-only**.

Every mutation in `curriculum_nodes`, `curriculum_edges`,
`question_semantic_links`, `ontology_versions`, `allowed_edge_matrix`,
`curriculum_specialties`, or `curriculum_aliases` MUST be accompanied by an
audit insert containing:

| Field                | Required content                              |
| -------------------- | --------------------------------------------- |
| `rfc_id`             | Tracked RFC identifier                        |
| `actor`              | Human or service that executed the change     |
| `approved_by`        | Reviewer with curricular authority            |
| `ontology_version`   | Target version slug (never "active")          |
| `change_type`        | `create \| update \| deprecate \| rollback`   |
| `target_table`       | Affected table                                |
| `target_id`          | Affected row id                               |
| `before_state`       | JSON snapshot before the change               |
| `after_state`        | JSON snapshot after the change                |
| `rollback_reference` | Pointer to rollback plan / migration / RFC    |

A change without a corresponding audit row is an operational incident.

---

## Absolute Prohibitions

- Do not interpose global triggers or query interception on `ontology.*`.
- Do not alter legacy runtime (`specialty_id`, Planner, FSRS, Tutor, TRI).
- Do not create auto-sync, dual-write, AI heuristics, or backfills.
- Do not bypass feature flags.
- Do not mutate the change audit (it is append-only by trigger).

---

## Guiding Principle

> Without observability, every enterprise ontology inevitably degrades into
> multiple truths.
