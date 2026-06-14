# Edge Functions Risk Triage — Wave 1

Triagem de risco freeze-safe (Go-Live Structural Freeze). **Apenas
documentação**: nenhum código produtivo, teste, CI, prompt, FSRS,
memória, Bank Guard, frontend, schema ou RLS foi alterado.

## 1. Executive Summary

| Categoria | Qtd aprox. | Significado |
|---|---|---|
| **P0 — Critical Go-Live Blocker** | ~38 | Quebra o fluxo principal do aluno / IA produtiva / escrita crítica |
| **P1 — High Risk** | ~55 | Ingestão, analytics críticos, jobs operacionais, geração secundária |
| **P2 — Medium Risk** | ~50 | Auditorias, logs, ferramentas admin, suporte |
| **P3 — Low Risk / Defer** | ~35 | Debug, test, demos, legados |
| **UNKNOWN** | ~12 | Nome ambíguo — inspeção manual necessária |

`generate-adaptive-simulado` já está `GO-LIVE READY / LOCKED FOR GO-LIVE`
e fora desta fila.

## 2. P0 — Critical Go-Live Blockers

| Função | Caminho | Motivo do risco | Contrato mínimo recomendado | Status | Próximo passo |
|---|---|---|---|---|---|
| `tutor-v3-premium` | `supabase/functions/tutor-v3-premium` | IA do tutor + memória + RAG; fluxo principal | auth, OPTIONS, payload vazio, no-stack-leak, BLOCO obrigatório | ✅ `GO-LIVE READY` (Wave 3) | ver evidência |
| `tutor-v2-chat` | `tutor-v2-chat` | QR Mode + runtime orchestrator | auth, OPTIONS, payload vazio, modo QR | `NEEDS HARDENING` | contract test |
| `tutor-orchestrator-v2` | `tutor-orchestrator-v2` | Decisão entre 6 ações da memória | auth, idempotência | `NEEDS TRIAGE` | inspecionar |
| `question-generator` | `question-generator` | Geração de questões IA | auth, payload mínimo, dedup, ≤ N | ✅ `GO-LIVE READY` (Wave 2) | ver evidência |
| `generate-adaptive-question` | `generate-adaptive-question` | Adaptive IA por aluno | auth, payload, no-crash | `NEEDS HARDENING` | contract test |
| `generate-tutor-lesson` / `generate-tutor-v2-lesson` | idem | Aulas IA | auth, payload, no-stack-leak | `NEEDS HARDENING` | contract test |
| `generate-flashcards` | `generate-flashcards` | FSRS feed | auth, payload, dedup | ✅ `GO-LIVE READY` (Wave 4) | ver evidência |
| `generate-recovery-flashcard` | idem | Recuperação | auth, payload | ✅ `GO-LIVE READY` (Wave 8) | ver evidência |
| `generate-medical-mnemonic` / `generate-mnemonic` / `mnemonic-studio` | idem | Mnemônicos | auth, payload, no-text-in-image | `NEEDS HARDENING` | contract test |
| `generate-daily-plan` | idem | Planner | auth, idempotência, datas | ✅ `GO-LIVE READY` (Wave 7) | ver evidência |
| `autonomous-planner-engine` / `planner-orchestrator-v1` | idem | Planner core | auth, no-crash | ✅ `GO-LIVE READY` (Wave 7) | ver evidência |
| `replan-overdue-tasks` | idem | Planner jobs | auth, idempotência | ✅ `GO-LIVE READY` (Wave 7) | ver evidência |
| `generate-study-plan` / `plan-next-batch` | idem | Planner aux | auth, idempotência | `NEEDS TRIAGE` | inspecionar |
| `schedule-review` | idem | FSRS scheduling (DEPRECATED orphan) | auth, payload, datas válidas | ✅ `GO-LIVE READY` (Wave 8) | ver evidência |
| `study-orchestrator` / `study-session` / `study-next` / `study-complete` | idem | Hub de estudo | auth, payload, contrato de eventos | `NEEDS HARDENING` | contract test |
| `orchestrator-record-outcome` / `orchestrator-tune-weights` | idem | Pesos do orquestrador | auth, idempotência | `NEEDS TRIAGE` | inspecionar |
| `reinforce-error` | idem | Em deprecation controlada | auth, payload | `BLOCKED` (deprecation) | seguir plano 4 fases |
| `pedagogical-event-consumer` | idem | Event Bus → estado pedagógico | auth, idempotência, no-crash | ✅ `GO-LIVE READY` (Wave 6) | ver evidência |
| `pedagogical-health-governor` | idem | Governança crítica | auth, no-crash | `NEEDS TRIAGE` | inspecionar |
| `process-upload` / `process-rag-document` | idem | Upload aluno + RAG | auth, MIME, tamanho, no-stack-leak | ✅ `GO-LIVE READY` (Wave 5, process-upload) | ver evidência |
| `auth-email-hook` | idem | Auth / emails | assinatura, payload, idempotência | `NEEDS HARDENING` | contract test |
| `admin-actions` | idem | Privilégio admin | auth role, payload | `NEEDS HARDENING` | contract test |
| `tutor-memory-promotion-cron` | idem | Promotion LGPD | service-role only, PII sanitizer | `NEEDS HARDENING` | contract test |
| `tutor-memory-embedder` / `tutor-memory-search` / `tutor-memory-feedback` | idem | Memória semântica | auth, scope=user, no PII leak | `NEEDS HARDENING` | contract test |
| `official-exam-ingestion` / `extract-official-questions` / `extract-exam-questions` | idem | Banco de questões oficial | auth admin, dedup | `NEEDS HARDENING` | contract test |
| `ingest-questions` / `populate-questions` / `process-docx-questions` | idem | Escrita massiva no banco | auth admin, dedup hash | `NEEDS HARDENING` | contract test |
| `qa-agent` / `qa-autocorrect` / `quality-lock-validator` | idem | Quality gates de produção | auth, idempotência | `NEEDS HARDENING` | contract test |
| `simulado-assistant` / `professor-simulado` / `auto-assign-simulados` | idem | Simulado live | auth, payload, ≤ N | `NEEDS HARDENING` | contract test |

> Pagamento/subscription: **nenhuma Edge Function dedicada** detectada
> no inventário atual (Stripe é tratado via Lovable Cloud + frontend).
> Reavaliar se aparecer função futura.

## 3. P1 — High Risk

| Função | Motivo | Contrato mínimo | Status |
|---|---|---|---|
| `analytics-snapshot`, `dashboard-snapshot`, `cockpit-data`, `approval-snapshot-cron`, `alpha-cohort-snapshot` | Snapshots / dashboards críticos | auth, sem PII, shape estável | NEEDS TRIAGE |
| `telemetry-summarizer`, `unified-telemetry`, `assistant-log-decision` | Telemetria de decisão | auth, no-stack-leak | NEEDS TRIAGE |
| `cognitive-analytics-engine`, `cognitive-executive-report`, `cognitive-orchestrator`, `cognitive-orchestrator-v2`, `cognitive-recovery-engine`, `recovery-agent` | Engines de cognição | auth, payload, no-crash | NEEDS TRIAGE |
| `evidence-engine`, `error-pattern-engine`, `predictive-engine`, `performance-predictor`, `longitudinal-memory-engine` | Engines preditivas | auth, payload | NEEDS TRIAGE |
| `learning-optimizer`, `fatigue-detector`, `exam-intelligence-engine` | Inteligência adaptativa | auth | NEEDS TRIAGE |
| `compute-intelligence-index`, `compute-gold-heuristic-score`, `benchmark-percentile`, `baseline-freeze-check` | Métricas regulatórias | auth admin | NEEDS TRIAGE |
| `consolidate-audit-pipeline`, `audit-answer`, `audit-cognitive-system`, `audit-multimodal-questions`, `audit-multimodal-pedagogical` | Auditorias | auth | NEEDS TRIAGE |
| `pedagogical-warmup-audit`, `system-daily-monitor`, `system-health-check`, `system-health-dashboard`, `self-healing-monitor` | Health/monitor produção | auth | NEEDS TRIAGE |
| `ai-proxy`, `ai-quality-monitor`, `ai-provider-health`, `tutor-v2-provider-health` | Infra IA | auth admin | NEEDS TRIAGE |
| `discursive-questions`, `question-explainer`, `question-review-pipeline`, `classify-question-hierarchy`, `reclassify-questions`, `extract-exam-visual` | Pipeline de questões | auth, dedup | NEEDS TRIAGE |
| `generate-image-questions*`, `auto-generate-image-questions`, `upgrade-image-questions`, `upgrade-questions`, `repopulate-image-assets`, `auto-process-real-images`, `auto-curate-assets`, `curate-medical-images`, `analyze-isic-images`, `ingest-nih-xrays`, `medical-vision-engine`, `validate-image-assets`, `validate-medical-image-ai`, `search-real-medical-images`, `generate-medical-images`, `bulk-upload-assets`, `cleanup-contaminated-assets`, `hygiene-block-contaminated-assets` | Multimodal/assets | auth, MIME, no-fake, safety gate | NEEDS TRIAGE |
| `clinical-simulation`, `anamnesis-trainer`, `practical-exam`, `interview-simulator`, `generate-chronicle-osce`, `medical-chronicle`, `medical-reviewer`, `medical-term-lookup`, `shadow-examiner` | Clinical/OSCE | auth | NEEDS TRIAGE |
| `tutor-context-builder`, `tutor-v2-context-builder`, `tutor-lesson-structure`, `tutor-lesson-export`, `tutor-lesson-signed-url` | Tutor support | auth, signed URL TTL | NEEDS TRIAGE |
| `mentor-chat`, `mentor-intelligence`, `motivational-coach`, `feynman-trainer`, `micro-quiz`, `summarize-topic`, `content-summarizer`, `bulk-generate-content`, `generate-content-ai`, `generate-study-guide`, `generate-lesson-from-real-study`, `generate-map-flashcards`, `generate-map-questions`, `generate-mind-map`, `suggest-mnemonic-items`, `suggest-mnemonic-subtopics`, `flashcard-sanitization` | Conteúdo IA secundário | auth | NEEDS TRIAGE |
| `drive-*` (8 funções), `download-official-pdf`, `crawl-official-years`, `scan-official-exams` | Ingestão Drive/Oficial | auth admin | NEEDS TRIAGE |
| `pubmed-search`, `autonomous-medical-graph`, `search-rag-context`, `search-real-questions` | Busca externa | auth | NEEDS TRIAGE |
| `whatsapp-agent`, `whatsapp-auto-send`, `whatsapp-opt-out`, `whatsapp-queue`, `telegram-classroom`, `daily-bi-whatsapp`, `professor-reminder`, `process-email-queue` | Comunicação externa | auth, idempotência, opt-out | NEEDS TRIAGE |
| `seed-proficiency-pilot`, `proficiency-planner`, `proficiency-progress-recalc`, `calculate-rankings`, `calculate-approval-score`, `daily-question-generator` | Jobs de proficiência | auth admin | NEEDS TRIAGE |
| `backfill-data`, `backfill-temas-estudados-ids`, `backfill-user-topic-profiles`, `curriculum-reconstruction`, `curriculum-reconstructor` | Backfill / reconstrução | auth admin, idempotência | NEEDS TRIAGE |
| `cme-orchestrator`, `cme-start-pipeline`, `cme-scene-builder`, `cme-status`, `cme-dev-worker`, `video-segmenter`, `enamed-generator`, `etgc-prod-runner`, `fase4-ai-drain`, `auto-gap-pipeline`, `massive-scale-governance` | Pipelines pesados | auth admin | NEEDS TRIAGE |

## 4. P2 — Medium Risk

| Família | Funções |
|---|---|
| Logs/diag | `assistant-log-decision` (também P1), `ai-benchmark-pipeline`, `ai-pipeline-test`, `agent-question-quality` |
| Tools admin | `chatgpt-agent`, `tutor-supervisor-agent`, `explain-deep`, `explain-simple` |
| Trajectory | `trajectory-apply-v1`, `trajectory-complete-action-v1`, `trajectory-engine-v1`, `trajectory-explain-v1`, `trajectory-telemetry-v1`, `trajectory-health-engine` |
| Recovery | `claude-recovery-probe`, `recovery-agent` |
| Outros | `run-pipeline`, `framework-test`, `eu-ai`, `medical-term-lookup` (também aparece P1, escolher maior) |

Contrato mínimo: auth + OPTIONS + no-stack-leak. Promover a P1 se logs
mostrarem uso por usuário final.

## 5. P3 — Low Risk / Defer

| Função | Razão |
|---|---|
| `debug-boot`, `debug-import-cors`, `debug-models`, `debug-models-2`, `debug-models-v2`, `debug-top-level` | Debug puro |
| `ai-test`, `test-anthropic`, `test-gateway` | Testes manuais |
| `drive-auth-test`, `drive-crawler-debug` | Diagnóstico Drive |
| `edge-functions-all.test.ts`, `loop-validation.test.ts`, `run-alos-validation_test.ts`, `stress-test.test.ts` | Não são funções produtivas (arquivos de teste soltos no root) — revisar/realocar |

Ação: confirmar não-exposição em produção e congelar. Não testar.

## 6. UNKNOWN

| Função | Motivo |
|---|---|
| `eu-ai`, `framework-test`, `run-pipeline`, `etgc-prod-runner`, `fase4-ai-drain`, `massive-scale-governance`, `auto-gap-pipeline`, `enamed-generator`, `seed-proficiency-pilot`, `compute-gold-heuristic-score`, `agent-question-quality`, `chatgpt-agent` | Nome ambíguo / propósito não inferível pelo path |

Próximo passo: leitura manual rápida do `index.ts` (somente leitura,
sem alterar) para reclassificar.

## 7. Recommended Hardening Order (próximas ondas)

1. `question-generator`
2. `tutor-v3-premium`
3. `generate-flashcards`
4. `process-upload`
5. `pedagogical-event-consumer` — ✅ Wave 6 concluída
6. Planner core (`generate-daily-plan`, `autonomous-planner-engine`, `planner-orchestrator-v1`, `replan-overdue-tasks`) — ✅ Wave 7 concluída
7. FSRS (`schedule-review`, `generate-recovery-flashcard`)
8. Error Bank / Quality (`qa-agent`, `qa-autocorrect`, `quality-lock-validator`)
9. Auth / Profile (`auth-email-hook`, `admin-actions`)
10. Payments / Subscription (criar gate quando função existir)

Cada onda segue o ciclo já validado:
`PATCH → REGRESSION TEST → CI GATE → RELEASE PROTECTION → FINAL EVIDENCE`

## 8. Contract Test Template (genérico, não implementado)

```ts
// supabase/functions/<fn>/__tests__/contract.test.ts
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")
  ?? Deno.env.get("VITE_SUPABASE_ANON_KEY")!;
const USER_JWT =
  Deno.env.get("USER_JWT") ?? Deno.env.get("SUPABASE_CONTRACT_USER_JWT") ?? "";
const URL_FN = `${SUPABASE_URL}/functions/v1/<fn>`;

async function call(body: unknown, opts: { auth?: boolean } = { auth: true }) {
  const headers: Record<string, string> = { "Content-Type": "application/json", apikey: ANON };
  if (opts.auth !== false) headers["Authorization"] = `Bearer ${USER_JWT || ANON}`;
  const res = await fetch(URL_FN, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await res.text();
  let json: any = {}; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, raw: text };
}

function noLeak(raw: string) {
  assert(!raw.includes("TypeError"));
  assert(!raw.includes("at file://"));
  assert(!raw.includes("Deno."));
}

Deno.test("OPTIONS / CORS", async () => {
  const r = await fetch(URL_FN, { method: "OPTIONS" });
  await r.text();
  assert([200, 204].includes(r.status));
});

Deno.test("401 sem auth", async () => {
  const r = await call({}, { auth: false });
  assert([401, 403].includes(r.status));
});

Deno.test("payload vazio não crasha", async () => {
  const r = await call({}); noLeak(r.raw);
});

Deno.test("payload inválido não crasha", async () => {
  const r = await call({ __invalid: true }); noLeak(r.raw);
});

// Adicionar:
//  - payload mínimo válido
//  - invariantes específicos (length, shape, range)
//  - banco insuficiente / dado inexistente
//  - idempotência (quando aplicável: rodar 2x, comparar)
```

## 9. Freeze Integrity

Nenhuma alteração em código produtivo, prompts, FSRS, memória,
Bank Guard, frontend, schema, RLS, workflows ou testes existentes.
Esta fase é **somente documentação**.

`EDGE FUNCTIONS RISK TRIAGE WAVE 1 READY — FREEZE SAFE`
