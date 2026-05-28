# ENAZIZI — Ontology Governance Contract

**Status:** Active · **Freeze:** v25 · **Contract version:** v25.1

This document is the **authoritative governance contract** for how the multi-axis
ontology (`ontology.*`) coexists with the legacy pedagogical runtime
(`questions_bank.specialty_id` + `curriculum_specialties` + `curriculum_aliases`).

It is binding for every consumer (Planner, FSRS, Tutor IA, TRI, simulados,
dashboards, analytics, edge functions, future modules).

---

## 1. Legacy Runtime Authority Contract

| Layer                                  | Authority                                |
| -------------------------------------- | ---------------------------------------- |
| `questions_bank.specialty_id`          | **Official production truth**            |
| `curriculum_specialties` / `_aliases`  | **Official curricular truth**            |
| `ontology.*` (nodes/edges/links)       | Parallel semantic enrichment (opt-in)    |
| `ontology.question_semantic_links`     | Experimental, governed, RFC-driven       |
| `cross_domain` / `knowledge_dimension` | Complementary, never authoritative       |
| `specialty_id IS NULL`                 | **Semantically valid** (do not backfill) |

**Hard rules:**

- The ontology **NEVER** overrides `specialty_id`.
- Consumers must treat `ontology.*` as **opt-in** enrichment.
- **No consumer may infer `specialty_id` automatically** from ontology links.
- The 5,032 intentional NULLs are pedagogically correct — surface them as
  RFC candidates, never as classification errors.

---

## 2. Versioning Governance

Each consumer MUST:

1. **Declare** the `ontology_version` (slug) it supports in code.
2. **Validate** that version exists and is active before reading.
3. **Fail explicitly** if the declared version is missing or inactive.
4. **Never** consume `active = true` implicitly without version pinning.

Official accessor view:

```sql
SELECT id, slug, semantic_contract_version
FROM ontology.v_active_ontology_version;
```

Pattern:

```ts
const { data, error } = await supabase
  .schema('ontology')
  .from('v_active_ontology_version')
  .select('id, slug, semantic_contract_version')
  .eq('slug', MY_DECLARED_VERSION)   // pinned constant in the consumer
  .single();
if (error || !data) throw new Error('Unsupported ontology version');
```

---

## 3. Read Contracts

**Allowed consumers** (read-only, opt-in):

- Analytics dashboards
- Curricular dashboards
- RFC tooling and review queues
- Semantic exploration tools
- Future planners explicitly designed against a pinned ontology version

**Forbidden consumers** (must remain on legacy runtime):

- Automatic scoring
- Ranking
- `specialty_id` override or repair
- Automatic classification of new questions
- Silent pedagogical fallback (e.g. "if no specialty, infer from ontology")

Any module attempting to perform a forbidden operation against `ontology.*`
must be rejected in review.

---

## 4. Semantic Drift Detection

Drift is monitored read-only via:

```sql
SELECT * FROM ontology.v_semantic_drift;
```

Drift types surfaced:

| `drift_type`               | Meaning                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| `specialty_mismatch`       | Legacy specialty name != ontology specialty node name              |
| `multiple_specialty_links` | A question is linked to >1 specialty in the ontology               |
| `deprecated_node_link`     | A question links to a node that has been deprecated                |
| `version_mismatch`         | A link points to a non-active ontology version                     |

**Rules:**

- This view is **read-only**. No auto-correction is allowed.
- Drift entries become **RFC candidates** for human curricular review.
- Drift > 0 is **not** an incident — it is expected during ontology growth.

---

## 5. RFC Gate (mandatory for every curricular change)

No mutation to `curriculum_nodes`, `curriculum_edges`, `ontology_versions`,
`allowed_edge_matrix`, `question_semantic_links`, `curriculum_specialties`, or
`curriculum_aliases` is permitted without a formal RFC containing:

1. **RFC ID** (tracked artifact)
2. **Human reviewer** (named, with curricular authority)
3. **Target `ontology_version`** (pinned slug, never "active")
4. **Rollback plan** (explicit SQL or `replaced_by` / `deprecated_at` strategy)
5. **Expected impact** (consumers affected, drift expected, RFC candidates produced)

Any mutation submitted without these five elements must be rejected.

---

## 6. Feature Flag Contract

No module may consume `ontology.*` in production without:

- An **explicit feature flag** (per module, per environment)
- A **controlled rollout** (percentage or allowlist)
- **Metrics** (read latency, drift count seen, version pinned)
- **A rollback path** (flag off = consumer falls back to legacy runtime)
- **Observability** (logs of `ontology_version` used per request)

**Permanently legacy-only modules (no flag, no ontology reads ever):**

- Planner
- FSRS
- Tutor IA
- TRI
- Simulados (motor de geração + scoring)
- Quality tier pipeline
- Ingestão de questões

---

## Absolute Prohibitions

- Do not alter `specialty_id`.
- Do not create new specialties or aliases without RFC.
- Do not change `curriculum_specialties` / `curriculum_aliases` without RFC.
- Do not run AI or heuristics against ontology mutations.
- Do not alter existing pipelines or consumers to read ontology silently.
- Do not auto-sync legacy <-> ontology.
- Do not dual-write.
- Do not migrate runtime.
- Do not backfill NULLs.

---

## Guiding Principle

> The legacy runtime remains the operational truth.
> The ontology is a governed layer of semantic enrichment.
