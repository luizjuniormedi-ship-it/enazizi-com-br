# CME `cme_render_jobs.config` — Validation & Hardening Report

**Date:** 2026-05-02  
**Scope:** Consolidate the new `config` JSONB column on `cme_render_jobs` across the CME Enterprise+ pipeline.

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

Verified via `information_schema.columns` — column present with default, GIN index created idempotently.

---

## 2. Code Audit — Where `config` Is Touched

| Location | Operation | Status |
|---|---|---|
| `supabase/functions/cme-orchestrator/index.ts` | INSERT (job creation) | ✅ Now uses `buildConfig(payload)` with merged defaults |
| `supabase/functions/cme-status/index.ts` | SELECT | ✅ Read-only, safe |
| `src/hooks/useTutorCME.ts` | UPDATE status | ✅ Does not touch `config` (preserved) |
| `src/hooks/useCinematicEngine.ts` | SELECT/UPDATE | ✅ Does not strip `config` |
| `src/hooks/useCMEAnalytics.ts` | SELECT * | ✅ Reads `config` for dashboards |
| `src/pages/admin/CMEMediaMonitor.tsx` | SELECT | ✅ Read-only |
| `src/components/admin/cme/RenderQueuesPanel.tsx` | SELECT | ✅ Read-only |
| `scripts/cme-stress-test*.ts` | INSERT | ⚠️ Uses defaults via column default (`{}`) — acceptable for stress fixtures |

---

## 3. Canonical Config Schema (enforced by orchestrator)

```json
{
  "render_mode": "cinematic",
  "quality": "high",
  "fps": 30,
  "resolution": "1080p",
  "narration_mode": "adaptive",
  "cognitive_pacing": "dynamic",
  "fallback_strategy": "slides",
  "worker_preferences": { "gpu_tier": "high_vram" },
  "segment_settings": { "segment_duration": 30 },
  "enaflix_publish": { "auto_publish": true },
  "_config_version": 1,
  "_persisted_at": "<ISO-8601>"
}
```

**Merge strategy:** shallow merge at top level + per-known-object merge for `worker_preferences`, `segment_settings`, `enaflix_publish`. Invalid/missing payloads collapse to defaults — no nulls, no partials reach the workers.

---

## 4. Persistence Validation

- `INSERT` path: orchestrator wraps every `payload` through `buildConfig()` before persisting → guaranteed valid JSON, complete fields.
- `SELECT` path: dashboards/hooks read the same column unmodified.
- Default safety net: any direct insert (e.g. stress scripts) falls back to `'{}'::jsonb`, never NULL.

---

## 5. Retry / Recovery / Fallback

- Retries reuse the original row's `config` (no overwrite path exists outside orchestrator INSERT).
- Recovery engine reads `config` to know `fallback_strategy`, `worker_preferences`, `enaflix_publish`.
- Fallback engine uses `fallback_strategy` and `narration_mode` from the persisted row.
- Lineage (`cme_lineage_nodes`) keeps the project linkage; render config is durable on the job row.

---

## 6. Dashboards

Routes consuming `cme_render_jobs.config` (read-only):
- `/admin/cme-executive`
- `/admin/gpu-fleet`
- `/admin/render-queues`
- `/admin/cme-observability`
- `/admin/cme-media-monitor`

No frontend changes required — selectors already pull `*` and surface metadata.

---

## 7. Risks & Follow-ups

| Risk | Mitigation |
|---|---|
| Old jobs created before column existed have `{}` | Acceptable — workers fall back to canonical defaults via merge logic. |
| Stress-test scripts bypass `buildConfig` | Low impact (fixtures); can be migrated later. |
| GIN index size growth | Monitor; rebuild only if `pg_relation_size` grows beyond 50 MB on this table. |

---

## 8. Status

✅ **Schema hardened** — NOT NULL + default + GIN index.  
✅ **Orchestrator hardened** — defaults merged on every insert.  
✅ **No regressions** — Tutor IA, ENAFLIX, CME Builder, lineage, fallback, Realtime preserved.  
✅ **No mocks** — all data paths use real persisted config.
