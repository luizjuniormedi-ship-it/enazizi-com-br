# Loop 4A — AI Cache Governance (Fase 1)

## Status
✅ Migration aplicada (idempotente)
✅ Helper `_shared/ai-cache.ts` v2 retrocompatível
✅ Integração `generate-mnemonic` (cache global)
✅ Integração `question-generator` (cache global, modo genérico apenas)
✅ RPC `admin_ai_cache_report(p_window_hours)`
✅ Auth pós-3F-B preservado (401 sem token nas duas funções)

## Schema
- `ai_content_cache`: +`user_id (uuid → auth.users)`, +`scope ('global'|'user')`, +`semantic_hash`. CHECK `(scope='user' AND user_id NOT NULL) OR (scope='global' AND user_id NULL)` — DB bloqueia vazamento. Índice `(scope, user_id, semantic_hash)`. Política nova `admins_can_audit_ai_cache` (SELECT via `has_role`); escrita continua só service_role.
- `ai_usage_logs`: +`module`, +`cache_status (hit|miss|miss_expired|bypass|disabled)`, +`request_id`, +`tokens_saved`, +`cost_saved`, +colunas de compat (`function_name`, `success`, `cache_hit`, `model_tier`, `cost_estimate`, `error_message`, `actor_type`, `actor_key`, `response_time_ms`, `tokens_used`, `model_used`). Nada removido.
- RPC `public.admin_ai_cache_report(p_window_hours int default 24)`: SECURITY DEFINER + `has_role(auth.uid(),'admin')`. Retorna por módulo: total_calls, hits, miss, miss_expired, hit_rate, tokens_saved, cost_saved, global_leak_risk.

## Helper v2 (`supabase/functions/_shared/ai-cache.ts`)
- `buildPromptHash(payload)` — SHA-256 sobre JSON canonicalizado.
- `getCachedAIResponse({ module, scope, userId?, semanticHash, contentType? })` — retorna `{hit, expired, content, modelUsed, cachedAt}`. Recusa user-scope sem userId.
- `saveAIResponseToCache({ ..., ttlDays?, skip? })` — recusa: `skip=true`, response vazia, user-scope sem userId, global-scope com sinais pessoais detectados.
- `logAIUsage(...)` — agora alinhado ao schema real. Calcula `tokens_saved`/`cost_saved` automaticamente em hit.
- `CACHE_TTL_DAYS`: mnemonic 90, question_general 30, question_banca 15, tutor_user 7, planner 1, report 7, blueprint 30.
- `hasPersonalSignals()` — detecta `userId/history/errors/error_bank/performance/fsrs/studentProfile/dailyPlan/userContext/avoidStatements`.
- **Legacy** `buildCacheKey/getCachedContent/setCachedContent/logAiUsage` mantidos com mesma assinatura. `logAiUsage` agora delega para `logAIUsage` v2 — corrige bug silencioso (insert antigo falhava por colunas inexistentes).

## generate-mnemonic — integração
- Cache só quando `!regenerate_image_only && !auto_extract_terms && termos.length>0`.
- Hash global: `{tema, termos sorted, estilo, publico, lang:"pt-BR"}`.
- Hit → retorna 200 com `response_source:"cache_global"`, `cache_hit:true`. Sem chamar IA.
- Miss/expired → loga `cache_status` antes da geração.
- Save apenas após pipeline master concluir com sucesso (audit aprovada — fallback determinístico retorna antes e NÃO escreve cache; retorno de erro tampouco).
- Strip de campos por-request (`request_id`, `result_id`, `image_url`, `image_failed`) antes de salvar para manter escopo genérico.

## question-generator — integração
- **Modo genérico** (cacheável): `!jobId && !userContext && (!avoidStatements || vazio)`.
- Hash global: `{banca, specialty, difficulty, requestedCount, slots, dist, lang}`.
- Módulo do cache: `question_banca` se `targetExam !== "default"`, senão `question_general` (TTL 15d e 30d).
- Hit → retorna `source:"cache_global"`, `audit.cache_hit:true`. Sem IA.
- Bypass personalizado loga `cache_status:"bypass"` e segue pipeline normal (anti-repetição via `avoidStatements`/`prevSnapshot` intacta).
- Save apenas quando `allQuestions.length === requestedCount` (lote 100% completo). Lotes parciais ou audit-rejeitada nunca são cacheados.
- Auditoria adversarial existente continua filtrando antes de chegar ao save.

## Travas exigidas (todas atendidas)
1. ✅ Não cachear erro: writes só no caminho de sucesso. Mnemônico fallback determinístico retorna antes do save. Question-generator só salva se contagem == requested.
2. ✅ Anti-repetição preservada: `avoidStatements`/`prevSnapshot` rodam dentro de `runBatch` independentemente do cache, e a presença de `avoidStatements` força bypass do cache.
3. ✅ Scope seguro: helper recusa user-scope sem userId; recusa global com `hasPersonalSignals`; DB CHECK constraint bloqueia.

## Testes (curl produção)
| Cenário | Resultado |
|---|---|
| `POST /generate-mnemonic` sem auth | ✅ 401 JSON UNAUTHORIZED |
| `POST /question-generator` sem auth | ✅ 401 JSON UNAUTHORIZED |
| Migration: colunas `user_id/scope/semantic_hash` em ai_content_cache | ✅ |
| Migration: colunas `module/cache_status/tokens_saved/cost_saved` em ai_usage_logs | ✅ |
| RPC `admin_ai_cache_report` existe | ✅ |

Validação 2ª chamada hit/hit_rate real depende de tráfego autenticado (pendente de uso por aluno/admin logado).

## Arquivos
- migration `loop4a_ai_cache_governance` (aplicada)
- editado `supabase/functions/_shared/ai-cache.ts`
- editado `supabase/functions/generate-mnemonic/index.ts`
- editado `supabase/functions/question-generator/index.ts`

## Restrições respeitadas
- ❌ Prompts inalterados (Master Prompt mnemonic e systemPrompt question-generator intactos)
- ❌ Modelos inalterados
- ❌ Payloads de sucesso preservados (cache adiciona apenas marcador `response_source/cache_hit`)
- ❌ UI não tocada
- ❌ Anti-repetição não tocada
- ❌ Auditoria clínica não tocada

## Inventário de funções IA (40 funções com chamadas)
Mantidas inalteradas neste loop, candidatas a integração futura:
- **Tutor IA**: study-session, mentor-chat, motivational-coach, anamnesis-trainer, feynman-trainer, interview-simulator, clinical-simulation
- **Geradores**: generate-flashcards, generate-mind-map, generate-map-questions, generate-map-flashcards, generate-image-questions, auto-generate-image-questions, daily-question-generator, generate-content-ai, generate-adaptive-simulado, professor-simulado, micro-quiz, discursive-questions, practical-exam, generate-medical-mnemonic, populate-questions, bulk-generate-content
- **Planner/Coach**: generate-daily-plan, generate-study-plan, learning-optimizer, replan-overdue-tasks, schedule-review, performance-predictor, calculate-approval-score, proficiency-planner
- **Conteúdo/RAG**: medical-chronicle, medical-reviewer, medical-term-lookup, content-summarizer, generate-study-guide, search-rag-context, process-rag-document
- **Sistema**: qa-agent, qa-autocorrect, system-daily-monitor, system-health-check, dashboard-snapshot, cockpit-data, search-real-questions, upgrade-image-questions, process-upload, benchmark-percentile

## Próximos loops sugeridos
- **4B Tutor IA** — só após observar hit_rate real por alguns dias.
- **4C Planner / Simulados Adaptativos / Relatórios IA** — escopo user obrigatório.
- **4D Frontend** — exibir discretamente "Resposta recuperada da memória IA" quando `cache_hit:true`.

## Riscos
- Cache global pode acumular 1 entrada por hash; sem limpeza ativa hoje (TTL via `expires_at` cuida da expiração lógica, mas linhas vencidas continuam ocupando linhas até cleanup futuro).
- `qualityProfile.preferred_model` pode variar entre miss e save — aceitável (modelo registrado, não chave).
