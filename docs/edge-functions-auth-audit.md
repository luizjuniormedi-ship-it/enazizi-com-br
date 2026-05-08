# Edge Functions — Auth Audit (Sprint 1 hardening)

Updated: 2026-05-08
Scope: every function under `supabase/functions/*` is exposed publicly via
`https://<project>.functions.supabase.co/<name>`. The `verify_jwt`
declaration in `supabase/config.toml` only controls whether Supabase's
gateway pre-validates the JWT before invoking the function. It does **not**
control authorization inside the function code.

## TL;DR

- All sensitive functions that accept user input and call paid AI gateways
  **must validate the JWT in code** when deployed with `verify_jwt = false`.
- Functions that already use `_shared/standard-handler.ts` are now
  protected by real JWT validation (Sprint 1 patch — `getClaims()`).
- Webhook receivers (auth-email-hook, whatsapp-*, telegram-classroom)
  intentionally skip JWT and **must** validate the upstream signature/secret.
- Cron / system functions (system-daily-monitor, etc.) are intended to be
  called only by the platform scheduler and should reject calls that don't
  carry the configured secret.

## Categories

### 1. AI generation — auth REQUIRED in code

These functions burn workspace AI credits and must never accept anonymous
calls. They have `verify_jwt = false` historically (compatible with the
signing-keys system), so each one is responsible for validating the JWT
itself or using `handleStandardEdgeFunction`.

| Function | verify_jwt | Auth strategy | Status |
|---|---|---|---|
| `question-generator` | false | manual check + service-role client | ✅ verified writes user_id |
| `mentor-chat` | false | manual check | ⚠️ Sprint 2: confirm rate limit per user_id |
| `tutor-context-builder` | n/a (default) | uses Authorization header | ✅ |
| `tutor-lesson-structure` | n/a | uses Authorization header | ✅ |
| `tutor-memory-search` | n/a | uses Authorization header | ✅ |
| `tutor-memory-embedder` | n/a | uses Authorization header | ✅ |
| `learning-optimizer` | false | manual check needed | ⚠️ migrate to standard-handler |
| `generate-study-plan` | false | manual check needed | ⚠️ migrate to standard-handler |
| `generate-content-ai` | n/a | uses Authorization header | ✅ |
| `generate-flashcards` | n/a | uses Authorization header | ✅ |
| `generate-image-questions-secure` | n/a | uses Authorization header | ✅ (the `-secure` variant exists for this reason) |
| `generate-medical-mnemonic` | n/a | uses Authorization header | ✅ |
| `generate-mnemonic` | n/a | uses Authorization header | ✅ |
| `generate-medical-images` | n/a | uses Authorization header | ✅ |
| `generate-mind-map` | n/a | uses Authorization header | ✅ |
| `generate-map-flashcards` | n/a | uses Authorization header | ✅ |
| `generate-map-questions` | n/a | uses Authorization header | ✅ |
| `clinical-simulation` | false | manual check needed | ⚠️ migrate to standard-handler |
| `discursive-questions` | false | manual check needed | ⚠️ migrate to standard-handler |
| `enamed-generator` | false | service role-only path | ✅ used by admin/cron |
| `daily-question-generator` | false | cron, secret-gated | ✅ |
| `medical-reviewer` | n/a | uses Authorization header | ✅ |
| `medical-chronicle` | n/a | uses Authorization header | ✅ |
| `feynman-trainer` | false | manual check needed | ⚠️ migrate to standard-handler |
| `interview-simulator` | n/a | uses Authorization header | ✅ |
| `motivational-coach` | false | manual check needed | ⚠️ migrate to standard-handler |
| `anamnesis-trainer` | false | manual check needed | ⚠️ migrate to standard-handler |
| `medical-term-lookup` | false | manual check needed | ⚠️ low risk (lookup), migrate next sprint |
| `mnemonic-studio` | n/a | uses Authorization header | ✅ |
| `suggest-mnemonic-items` | n/a | uses Authorization header | ✅ |
| `suggest-mnemonic-subtopics` | n/a | uses Authorization header | ✅ |
| `summarize-topic` | n/a | uses Authorization header | ✅ |
| `explain-deep` | n/a | uses Authorization header | ✅ |
| `explain-simple` | n/a | uses Authorization header | ✅ |
| `chatgpt-agent` | n/a | uses Authorization header | ✅ |

### 2. Orchestration — auth REQUIRED in code

| Function | verify_jwt | Auth strategy | Status |
|---|---|---|---|
| `study-orchestrator` | n/a | uses Authorization header | ✅ |
| `study-next` | n/a | uses Authorization header | ✅ |
| `study-complete` | n/a | uses Authorization header | ✅ |
| `study-session` | n/a | uses Authorization header | ✅ |
| `planner-orchestrator-v1` | n/a | uses Authorization header | ✅ |
| `proficiency-planner` | n/a | uses Authorization header | ✅ |
| `proficiency-progress-recalc` | n/a | uses Authorization header | ✅ |
| `replan-overdue-tasks` | n/a | uses Authorization header | ✅ |
| `schedule-review` | n/a | uses Authorization header | ✅ |
| `reinforce-error` | n/a | uses Authorization header | ✅ |
| `micro-quiz` | n/a | uses Authorization header | ✅ |
| `practical-exam` | n/a | uses Authorization header | ✅ |

### 3. Data dashboards / analytics — auth REQUIRED

| Function | verify_jwt | Status |
|---|---|---|
| `dashboard-snapshot` | false | ⚠️ migrate to standard-handler |
| `mentor-intelligence` | n/a | ✅ admin-only logic |
| `system-health-check` | false | ⚠️ admin-only check needed |
| `cockpit-data` | n/a | ✅ admin-only logic |
| `performance-predictor` | false | ⚠️ migrate to standard-handler |
| `analytics-snapshot` | n/a | ✅ |
| `benchmark-percentile` | false | ⚠️ low risk read, migrate next sprint |

### 4. Pipelines / CME / batch jobs — service role only

These functions are intended to be invoked by other backend pieces (cron,
queues, admin actions) and write to operational tables that are now locked
to service-role (Sprint 1 RLS migration).

`bulk-generate-content`, `bulk-upload-assets`, `populate-questions`,
`process-docx-questions`, `process-rag-document`, `process-upload`,
`process-email-queue`, `cme-orchestrator`, `cme-dev-worker`,
`cme-start-pipeline`, `cme-status`, `run-pipeline`, `auto-curate-assets`,
`auto-gap-pipeline`, `auto-generate-image-questions`,
`auto-process-real-images`, `repopulate-image-assets`, `upgrade-questions`,
`upgrade-image-questions`, `validate-image-assets`,
`validate-medical-image-ai`, `cleanup-contaminated-assets`,
`hygiene-block-contaminated-assets`, `consolidate-audit-pipeline`,
`audit-multimodal-pedagogical`, `audit-multimodal-questions`,
`audit-answer`, `qa-agent`, `qa-autocorrect`, `analyze-isic-images`,
`backfill-temas-estudados-ids`, `baseline-freeze-check`,
`classify-question-hierarchy`, `extract-exam-questions`,
`extract-exam-visual`, `ingest-questions`, `ingest-nih-xrays`,
`official-exam-ingestion`, `pubmed-search`, `search-rag-context`,
`search-real-medical-images`, `search-real-questions`,
`seed-proficiency-pilot`, `summarize-topic`, `system-daily-monitor`,
`auto-assign-simulados`, `calculate-approval-score`, `calculate-rankings`,
`exam-intelligence-engine`, `generate-adaptive-question`,
`generate-adaptive-simulado`, `generate-chronicle-osce`,
`generate-image-questions`, `generate-image-questions-batch`,
`generate-lesson-from-real-study`, `generate-study-guide`,
`learning-optimizer`, `medical-reviewer`, `simulado-assistant`,
`tutor-lesson-export`, `tutor-lesson-signed-url`, `video-segmenter`,
`assistant-log-decision`, `admin-actions`, `ai-proxy`,
`orchestrator-record-outcome`, `orchestrator-tune-weights`,
`plan-next-batch`, `professor-reminder`, `professor-simulado`,
`curate-medical-images`.

**Action item (Sprint 2):** ensure each of these uses the
`SERVICE_ROLE_KEY` env var server-side and never echoes back data the
caller didn't already own.

### 5. Webhooks / external — auth via signature

These intentionally skip JWT validation. They MUST validate the upstream
secret/signature in code.

| Function | verify_jwt | Required check |
|---|---|---|
| `auth-email-hook` | false | Supabase webhook secret |
| `whatsapp-agent` | n/a | webhook secret |
| `whatsapp-auto-send` | n/a | internal cron secret |
| `whatsapp-opt-out` | n/a | webhook secret |
| `whatsapp-queue` | n/a | internal cron secret |
| `daily-bi-whatsapp` | n/a | internal cron secret |
| `telegram-classroom` | false | bot token verification |

## Migration plan

1. **Now (this sprint):** `_shared/standard-handler.ts` patched to call
   `getClaims()`. Any function already importing it is now properly
   authenticated.
2. **Sprint 2:** migrate the 8 functions tagged `⚠️ migrate to standard-handler`
   above. Add per-`user_id` rate limit on the AI generators.
3. **Sprint 2:** add Zod payload validation to every AI generator entry
   point. Reject early with 400 on invalid input to save AI spend.
4. **Sprint 2:** add unit tests in `supabase/functions/_shared/` exercising:
   - missing Authorization header → 401
   - malformed JWT → 401
   - expired JWT → 401
   - valid JWT → handler called with the real `userId`
