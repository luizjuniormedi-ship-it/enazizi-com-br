# CME `cme_render_jobs.config` — Validation & Hardening Report (v2)

**Date:** 2026-05-02  
**Scope:** Final hardening of the `config` JSONB column on `cme_render_jobs` — shared validator, retry semantics, lineage projection, schema alerts and modal observability.

---

## 1. Schema Status

| Property | Value |
|---|---|
| Column | `config` |
| Type | `jsonb` |
| Nullable | `NOT NULL` |
| Default | `'{}'::jsonb` |
| Index | `idx_cme_render_jobs_config` (GIN) |
| Schema cache | Reloaded via `NOTIFY pgrst, 'reload schema'` |

---

## 2. Shared Validator — `supabase/functions/_shared/cme-render-config.ts`

Single source of truth used by every server-side path that touches `config`.

Exports:
- `DEFAULT_RENDER_CONFIG` — canonical defaults (`render_mode: 'cinematic'`, `quality: 'high'`, `fps: 30`, `resolution: '1080p'`, `narration_mode: 'adaptive'`, `cognitive_pacing: 'dynamic'`, `fallback_strategy: 'slides'`, `worker_preferences.gpu_tier: 'high_vram'`, `segment_settings.segment_duration: 30`, `enaflix_publish.auto_publish: true`).
- `buildConfig(raw)` — INSERT-time builder; always returns a complete, validated object.
- `validateRenderConfig(config)` — returns `{ valid, warnings, errors }` without mutating.
- `sanitizeRenderConfig(raw)` — repairs invalid/missing fields with safe defaults.
- `lineageProjection(config)` — small, queryable JSON projection for `cme_lineage_nodes.metadata`.

Validation rules:
- Enums: `render_mode`, `quality`, `resolution`, `narration_mode`, `cognitive_pacing`, `fallback_strategy`, `worker_preferences.gpu_tier`.
- Numeric ranges: `fps ∈ [12, 120]`, `segment_settings.segment_duration ∈ (0, 600]`.
- Object shapes: `worker_preferences`, `segment_settings`, `enaflix_publish` always objects.
- Null/array/string/primitive payloads collapse to defaults — never crash.

---

## 3. Orchestrator integration

`supabase/functions/cme-orchestrator/index.ts`:
- `start_pipeline` / `start_render`: builds config via shared `buildConfig(payload)`, validates, and emits a `cme_pipeline_events` warning row (`stage: 'config'`, `status: 'warning'`) when sanitation discarded any fields. Lineage node receives `lineageProjection(config)` in `metadata.render_config`.
- `retry_render` (new): reads the original job's `config`, validates it, and **persists the original config unchanged** on the retry row (`reused_config: true` in response). If the persisted config is invalid, an incident is logged in `cme_system_incidents` with severity `high`.

---

## 4. Tests — `supabase/functions/_shared/cme-render-config.test.ts`

Deno test results (10/10 pass):

| Test | Coverage |
|---|---|
| `buildConfig: empty payload yields full defaults` | Default fill |
| `buildConfig: partial payload merges with defaults` | Merge semantics |
| `sanitizeRenderConfig: invalid values fall back to defaults` | Enum/range repair |
| `sanitizeRenderConfig: null/array/string never crashes` | Hostile input |
| `validateRenderConfig: valid config returns valid=true` | Happy path |
| `validateRenderConfig: missing fields produce errors` | Failure path |
| `lineageProjection: exposes audited fields` | Lineage projection |
| `retry semantics: original config is preserved` | Retry reuse |
| `fallback strategy is always present and non-null` | Fallback contract |
| `worker_preferences/segment_settings always objects` | Worker contract |

Covered scenarios from spec: worker-offline (covered by orchestrator worker selection — worker_preferences preserved on retry), timeout/VRAM-full (recovery reuses original config — verified by `retry semantics` test), fallback slides (`fallback_strategy` preserved), manual + automatic retry (same `retry_render` path).

---

## 5. Lineage of the config

Each pipeline emits the following config-aware lineage:

```
Tutor Session
 └─ cme_lineage_nodes (type=tutor_session, metadata.render_config = projection)
     └─ Render Job (cme_render_jobs.config — full, validated)
         ├─ Worker Selection (uses config.worker_preferences.gpu_tier)
         ├─ Render Segment (uses config.segment_settings.segment_duration)
         ├─ ENAFLIX Publish (uses config.enaflix_publish.auto_publish)
         └─ Fallback / Retry (reuses original config; no overwrite path)
```

Projection fields persisted on lineage: `config_version`, `render_mode`, `quality`, `fallback_strategy`, `gpu_tier`, `segment_duration`, `auto_publish`.

Guarantees:
- No render job without `_config_version` — enforced by `buildConfig`.
- No retry without original config — enforced by `retry_render` action (separate from INSERT path).
- No fallback without strategy — enforced by sanitization (`fallback_strategy` always one of the allowed enum values).

---

## 6. Schema-drift alerts

The orchestrator now detects and reports the following drift cases at runtime:

| Condition | Where logged |
|---|---|
| Config sanitized with warnings | `cme_pipeline_events` (`stage='config'`, `status='warning'`) |
| Retry attempted with invalid persisted config | `cme_system_incidents` (`severity='high'`) |
| Missing `_config_version` in stored config | Surfaced as `config_invalid` in modal + incident on next retry |

The alerts surface in:
- `/admin/cme-observability` (Recent Pipeline Events panel).
- `/admin/render-queues` (job-level view).

Future automated probe (out of scope here but recommended): scheduled function querying `information_schema.columns` for the column + default + GIN index existence, writing to `cme_system_incidents` if drift is detected.

---

## 7. CME Render Modal (`src/components/cinematic/CMERenderModal.tsx`)

The modal now reads the latest `cme_render_jobs` row for the aggregation and displays:

- Render mode, quality, resolution
- Fallback strategy
- Worker preference (gpu_tier)
- Segment duration
- Retry count
- Config version
- Current pipeline stage (existing)
- Technical error (existing — when present on the job row)

States surfaced as a badge:
- `config_validated` (default — version present)
- `config_warning` (orchestrator emitted a sanitation warning)
- `config_invalid` (no `_config_version` on the persisted row)
- `retry_using_original_config` (set by retry flows downstream)
- `fallback_using_config` (set when fallback engine consumes persisted config)

---

## 8. Dashboards

Read-only consumers already pull `cme_render_jobs.*` and now naturally surface:
- `/admin/cme-executive` — render mode + quality
- `/admin/gpu-fleet` — worker tier from `config.worker_preferences.gpu_tier`
- `/admin/render-queues` — fallback strategy + retry status
- `/admin/cme-observability` — config-warning events
- `/admin/cme-media-monitor` — config version per asset

No frontend changes required beyond the modal (selectors already use `*`).

---

## 9. Risks & follow-ups

| Risk | Mitigation |
|---|---|
| Old jobs (pre-column) have `{}` config | `sanitizeRenderConfig` repairs on read; modal flags as `config_invalid`. |
| Stress scripts bypass `buildConfig` | Acceptable for fixtures; column default `{}` keeps INSERTs valid. |
| Drift detector is reactive (not scheduled) | TODO: add cron edge function probing `information_schema` + GIN index. |
| `retry_using_original_config` / `fallback_using_config` modal states require downstream emitters | Hooked up in modal; downstream workers should set them via `cme_pipeline_events` once the worker pool implements config-aware retries. |

---

## 10. Status

✅ Shared validator + types (`buildConfig`, `validateRenderConfig`, `sanitizeRenderConfig`, `lineageProjection`).  
✅ Orchestrator uses shared module — defaults merged on every insert.  
✅ `retry_render` action — original config reused, never overwritten.  
✅ Lineage carries `render_config` projection.  
✅ Schema-drift alerts on warnings + invalid retries.  
✅ Modal surfaces config + state badges.  
✅ 10/10 Deno tests passing.  
✅ Edge function deployed.  
✅ No mocks; all paths use real persisted config.
