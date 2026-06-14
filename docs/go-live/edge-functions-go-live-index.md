# Edge Functions — Go-Live Index

Mapa central de prontidão de release das Edge Functions críticas do projeto ENAZIZI.
Compatível com **Go-Live Structural Freeze**.

## Legenda de status

| Status | Significado |
|---|---|
| `GO-LIVE READY` | Bug fix + regressão + CI + release protection + evidência final |
| `UNDER REGRESSION` | Suíte de contrato existente; sem CI gate completo |
| `NEEDS HARDENING` | Sem suíte de contrato; risco identificado |
| `NEEDS TRIAGE` | Ainda não classificado nesta esteira |
| `BLOCKED` | Bug aberto, dependência externa ou freeze ativo |
| `LOCKED FOR GO-LIVE` | Congelada, só pode mudar com bug real |

## Colunas

| Coluna | Descrição |
|---|---|
| Contract test | Suíte de contrato em `__tests__/contract.test.ts` |
| CI gate | Workflow GitHub Actions dedicado |
| Release protection | Status check obrigatório + checklist em PR template |
| Final evidence | Documento em `docs/go-live/<fn>-final-evidence.md` |

---

## Funções consolidadas

### `generate-adaptive-simulado` — `GO-LIVE READY` / `LOCKED FOR GO-LIVE`

| Item | Valor |
|---|---|
| Caminho | `supabase/functions/generate-adaptive-simulado` |
| Contract test | ✅ `__tests__/contract.test.ts` (21/21) |
| CI gate | ✅ `.github/workflows/generate-adaptive-simulado-contract.yml` |
| Status check | ✅ `Contract regression (21 scenarios)` |
| Release protection | ✅ `.github/pull_request_template.md` |
| Final evidence | ✅ [`generate-adaptive-simulado-final-evidence.md`](./generate-adaptive-simulado-final-evidence.md) |
| Riscos pendentes | Nenhum conhecido |
| Próximo passo | Não alterar salvo bug real (`LOCKED FOR GO-LIVE`) |

### `question-generator` — `GO-LIVE READY` (Wave 2)

| Item | Valor |
|---|---|
| Caminho | `supabase/functions/question-generator` |
| Contract test | ✅ `__tests__/contract.test.ts` (15 cenários) |
| CI gate | ✅ `.github/workflows/question-generator-contract.yml` |
| Status check | ✅ `Question generator contract regression` |
| Release protection | ✅ via PR template global |
| Final evidence | ✅ [`question-generator-hardening-evidence.md`](./question-generator-hardening-evidence.md) |
| Patch aplicado | Sanitização defensiva `count` + `topics` |
| Próximo passo | Monitorar gate; promover a `LOCKED` após 1 ciclo verde |

### `tutor-v3-premium` — `GO-LIVE READY` (Wave 3)

| Item | Valor |
|---|---|
| Caminho | `supabase/functions/tutor-v3-premium` |
| Contract test | ✅ `__tests__/contract.test.ts` (13 cenários) |
| CI gate | ✅ `.github/workflows/tutor-v3-premium-contract.yml` |
| Status check | ✅ `Tutor V3 Premium contract regression` |
| Release protection | ✅ via PR template global |
| Final evidence | ✅ [`tutor-v3-premium-hardening-evidence.md`](./tutor-v3-premium-hardening-evidence.md) |
| Patch aplicado | Nenhum — função já defensiva |
| Próximo passo | Monitorar gate; promover a `LOCKED` após 1 ciclo verde |

### `generate-flashcards` — `GO-LIVE READY` (Wave 4)

| Item | Valor |
|---|---|
| Caminho | `supabase/functions/generate-flashcards` |
| Contract test | ✅ `__tests__/contract.test.ts` (13 cenários) |
| CI gate | ✅ `.github/workflows/generate-flashcards-contract.yml` |
| Status check | ✅ `Generate flashcards contract regression` |
| Release protection | ✅ via PR template global |
| Final evidence | ✅ [`generate-flashcards-hardening-evidence.md`](./generate-flashcards-hardening-evidence.md) |
| Patch aplicado | Nenhum — função já defensiva (`clampQuantity`, `requireAuth`, `parseAiJson`) |
| Próximo passo | Monitorar gate; promover a `LOCKED` após 1 ciclo verde |

### `process-upload` — `GO-LIVE READY` (Wave 5)

| Item | Valor |
|---|---|
| Caminho | `supabase/functions/process-upload` |
| Contract test | ✅ `__tests__/contract.test.ts` (12 cenários) |
| CI gate | ✅ `.github/workflows/process-upload-contract.yml` |
| Status check | ✅ `Process upload contract regression` |
| Release protection | ✅ via PR template global |
| Final evidence | ✅ [`process-upload-hardening-evidence.md`](./process-upload-hardening-evidence.md) |
| Patch aplicado | Sim — parse seguro de body, validação de `uploadId` (string + shape), catch top-level sem leak |
| Próximo passo | Monitorar gate; promover a `LOCKED` após 1 ciclo verde |

### `pedagogical-event-consumer` — `GO-LIVE READY` (Wave 6)

| Item | Valor |
|---|---|
| Caminho | `supabase/functions/pedagogical-event-consumer` |
| Contract test | ✅ `__tests__/contract.test.ts` (13 cenários) |
| CI gate | ✅ `.github/workflows/pedagogical-event-consumer-contract.yml` |
| Status check | ✅ `Pedagogical event consumer contract regression` |
| Release protection | ✅ via PR template global |
| Final evidence | ✅ [`pedagogical-event-consumer-hardening-evidence.md`](./pedagogical-event-consumer-hardening-evidence.md) |
| Patch aplicado | Nenhum — função já blind orchestrator v11 (sempre 200, parse seguro, waitUntil isolado) |
| Próximo passo | Monitorar gate; promover a `LOCKED` após 1 ciclo verde |

---


## Funções pendentes de triagem (`NEEDS TRIAGE`)

Listadas por domínio. Nenhuma alteração de código aplicada — apenas inventário.

### Tutor / Pedagogia
`tutor-v3-premium`, `tutor-v2-chat`, `tutor-v2-context-builder`, `tutor-v2-provider-health`,
`tutor-context-builder`, `tutor-orchestrator-v2`, `tutor-supervisor-agent`,
`tutor-lesson-export`, `tutor-lesson-signed-url`, `tutor-lesson-structure`,
`tutor-memory-embedder`, `tutor-memory-feedback`, `tutor-memory-search`,
`tutor-memory-promotion-cron`, `generate-tutor-lesson`, `generate-tutor-v2-lesson`,
`mentor-chat`, `mentor-intelligence`, `motivational-coach`, `feynman-trainer`,
`reinforce-error` (em deprecation controlada — ver memória).

### Simulados / Questões
`generate-adaptive-question`, `question-generator`, `question-explainer`,
`question-review-pipeline`, `discursive-questions`, `micro-quiz`,
`generate-image-questions`, `generate-image-questions-batch`,
`generate-image-questions-secure`, `auto-generate-image-questions`,
`upgrade-image-questions`, `upgrade-questions`, `ingest-questions`,
`populate-questions`, `process-docx-questions`, `reclassify-questions`,
`classify-question-hierarchy`, `extract-exam-questions`,
`extract-official-questions`, `extract-exam-visual`,
`search-real-questions`, `simulado-assistant`, `professor-simulado`,
`auto-assign-simulados`.

### Planner / Trajectory
`generate-daily-plan`, `generate-study-plan`, `plan-next-batch`,
`autonomous-planner-engine`, `planner-orchestrator-v1`, `replan-overdue-tasks`,
`trajectory-apply-v1`, `trajectory-complete-action-v1`, `trajectory-engine-v1`,
`trajectory-explain-v1`, `trajectory-telemetry-v1`, `trajectory-health-engine`,
`schedule-review`.

### Study Engine / Orchestrator
`study-orchestrator`, `study-session`, `study-next`, `study-complete`,
`orchestrator-record-outcome`, `orchestrator-tune-weights`,
`cognitive-orchestrator`, `cognitive-orchestrator-v2`,
`cognitive-analytics-engine`, `cognitive-executive-report`,
`cognitive-recovery-engine`, `recovery-agent`,
`generate-recovery-flashcard`.

### Conteúdo / Mnemônicos / Flashcards
`generate-flashcards`, `generate-map-flashcards`, `generate-map-questions`,
`generate-mind-map`, `generate-mnemonic`, `generate-medical-mnemonic`,
`mnemonic-studio`, `suggest-mnemonic-items`, `suggest-mnemonic-subtopics`,
`generate-content-ai`, `bulk-generate-content`, `content-summarizer`,
`summarize-topic`, `generate-study-guide`, `generate-lesson-from-real-study`,
`flashcard-sanitization`.

### Multimodal / Imagens
`analyze-isic-images`, `ingest-nih-xrays`, `curate-medical-images`,
`auto-curate-assets`, `auto-process-real-images`, `repopulate-image-assets`,
`search-real-medical-images`, `generate-medical-images`,
`medical-vision-engine`, `validate-image-assets`, `validate-medical-image-ai`,
`cleanup-contaminated-assets`, `hygiene-block-contaminated-assets`,
`bulk-upload-assets`, `audit-multimodal-questions`,
`audit-multimodal-pedagogical`.

### Clinical / Anamnese / OSCE
`clinical-simulation`, `anamnesis-trainer`, `practical-exam`,
`interview-simulator`, `generate-chronicle-osce`, `medical-chronicle`,
`medical-reviewer`, `medical-term-lookup`, `shadow-examiner`,
`audit-answer`.

### Drive / Ingestão de Provas
`drive-auth-test`, `drive-corpus-ingest`, `drive-corpus-scan`,
`drive-crawler-debug`, `drive-deep-crawler`, `drive-exam-ingestion`,
`drive-process-single-file`, `download-official-pdf`, `crawl-official-years`,
`scan-official-exams`, `official-exam-ingestion`,
`autonomous-medical-graph`, `pubmed-search`.

### Memória / RAG / Telemetria
`process-rag-document`, `process-upload`, `search-rag-context`,
`longitudinal-memory-engine`, `evidence-engine`, `error-pattern-engine`,
`predictive-engine`, `performance-predictor`,
`telemetry-summarizer`, `unified-telemetry`, `analytics-snapshot`,
`dashboard-snapshot`, `cockpit-data`, `assistant-log-decision`,
`approval-snapshot-cron`, `alpha-cohort-snapshot`, `benchmark-percentile`,
`baseline-freeze-check`, `compute-gold-heuristic-score`,
`compute-intelligence-index`, `consolidate-audit-pipeline`,
`pedagogical-event-consumer`, `pedagogical-health-governor`,
`pedagogical-warmup-audit`.

### AI Infra / Health / Quality
`ai-proxy`, `ai-benchmark-pipeline`, `ai-pipeline-test`,
`ai-provider-health`, `ai-quality-monitor`, `ai-test`, `eu-ai`,
`agent-question-quality`, `qa-agent`, `qa-autocorrect`,
`quality-lock-validator`, `self-healing-monitor`,
`system-daily-monitor`, `system-health-check`, `system-health-dashboard`,
`run-pipeline`, `framework-test`, `chatgpt-agent`, `claude-recovery-probe`,
`test-anthropic`, `test-gateway`, `debug-boot`, `debug-import-cors`,
`debug-models`, `debug-models-2`, `debug-models-v2`, `debug-top-level`,
`learning-optimizer`, `fatigue-detector`,
`audit-cognitive-system`, `exam-intelligence-engine`,
`enamed-generator`, `etgc-prod-runner`, `fase4-ai-drain`,
`auto-gap-pipeline`, `massive-scale-governance`, `seed-proficiency-pilot`,
`proficiency-planner`, `proficiency-progress-recalc`,
`calculate-rankings`, `calculate-approval-score`,
`daily-question-generator`, `daily-bi-whatsapp`,
`backfill-data`, `backfill-temas-estudados-ids`,
`backfill-user-topic-profiles`, `curriculum-reconstruction`,
`curriculum-reconstructor`, `professor-reminder`,
`telegram-classroom`, `whatsapp-agent`, `whatsapp-auto-send`,
`whatsapp-opt-out`, `whatsapp-queue`,
`process-email-queue`, `auth-email-hook`, `admin-actions`,
`video-segmenter`, `explain-deep`, `explain-simple`,
`cme-dev-worker`, `cme-orchestrator`, `cme-scene-builder`,
`cme-start-pipeline`, `cme-status`.

> Status default: `NEEDS TRIAGE`. Promover para `UNDER REGRESSION` /
> `NEEDS HARDENING` / `GO-LIVE READY` por triagem caso a caso,
> seguindo o mesmo ciclo:
> `PATCH → REGRESSION TEST → CI GATE → RELEASE PROTECTION → FINAL EVIDENCE`.

---

## Freeze confirmado

Nenhuma alteração em prompts, FSRS, memória pedagógica, Bank Guard,
frontend, schema, RLS, Tutor, Planner, Event Bus, Error Bank ou em
qualquer `index.ts` produtiva.

`EDGE FUNCTIONS GO-LIVE INDEX READY — FREEZE SAFE`
