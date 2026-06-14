# tutor-v3-premium — Latency Audit (Wave Perf-1)

**Status executivo:** `TUTOR-V3-PREMIUM LATENCY OPTIMIZED — FREEZE SAFE`
(Instrumentação passiva ativa; principal latência remanescente é a chamada IA externa.)

## 1. Inspeção (etapas por request)

| # | Etapa | Status atual | Observação |
|---|---|---|---|
| 0 | CORS/OPTIONS | OK | `enterpriseEdgeHandler` resolve antes do corpo |
| 1 | Parse do body | OK | `req.json().catch(()=>({}))` defensivo |
| 2 | Auth | OK | `correlation.userId` resolvido pelo wrapper enterprise |
| 3 | Healthcheck | OK | Early return antes de qualquer leitura/IA |
| 4 | Recuperação de sessão | OK (1 query) | `tutor_sessions.select('*').eq(id).maybeSingle()` |
| 5 | Topic fidelity | OK | Já não-bloqueante (`waitUntil`) |
| 6 | QR Mode (Question Review) | Variável | Curto-circuita 9 blocos quando detectado — já otimizado |
| 7 | Memory + RAG lookup | OK | **Paralelizado** via `Promise.all` (Wave v22) |
| 8 | Orquestrador de memória | OK (puro) | Decisão em memória, sem I/O extra |
| 9 | Trace de orquestração | OK | `waitUntil` (não bloqueia) |
| 10 | Montagem de contexto | OK | Em memória |
| 11 | **Chamada IA (Claude → OpenAI)** | **P0 latency** | Maior gasto; fallback automático já existe |
| 12 | Normalização + quality gate | OK | Em memória, regex barata |
| 13 | Persistência (`tutor_sessions`, `tutor_messages`, `tutor_learning_memory`) | OK | **Todo em `waitUntil`** |
| 14 | `ai_usage_logs` | OK | `waitUntil` |
| 15 | `saveTutorMemory` | OK | Dentro do mesmo `waitUntil` da persistência |
| 16 | Métricas (`bumpMetric`) | OK | `waitUntil` |
| 17 | Retorno HTTP | OK | Único `corsResponse` |

## 2. Patches aplicados (mínimos, freeze-safe)

1. Adicionada instrumentação `performance.now()` com 4 marcos:
   - `parseBodyMs`
   - `sessionMs`
   - `memoryLookupMs`
   - `aiMs`
   - `totalMs`
2. Timings são expostos **apenas** quando:
   - `body.debug === true`, **ou**
   - env var `ENABLE_TUTOR_TIMINGS=true`
3. Nenhuma alteração em: prompts, sequência pedagógica, FSRS, memória semântica,
   Event Bus, schema, RLS, contrato público, frontend, Planner, Error Bank, ou
   funções travadas nas Waves 1–9.

**Nenhum patch funcional aplicado** — função já estava bem otimizada:
- Escritas não críticas em `waitUntil` (12 ocorrências).
- Memória + RAG **já paralelizados** em `Promise.all`.
- Fallback Claude→OpenAI já implementado.
- Healthcheck early-return já presente.

## 3. Gargalo principal identificado

**Chamada IA (`ai()` + `callClaudeV3`)** é a etapa dominante (>80% do tempo
total em requests reais). Otimizações futuras seguras (fora do freeze):

- Modelo mais rápido para `studentIntent === "shortcut_summary"` (já bypassa memória).
- Streaming SSE end-to-end (hoje `stream=true` chega na função mas resposta é JSON única).
- Hard timeout explícito em `callClaudeV3` (hoje depende do cliente).

## 4. Background tasks (já existentes)

Confirmadas em `waitUntil`:
- `tutor_sessions.update` (não-bloqueante quando não há `sessionId` novo)
- `tutor_messages.insert` (assistant + user)
- `ai_usage_logs.insert` (Claude e OpenAI)
- `tutor_learning_memory.upsert`
- `memory_orchestration_traces.insert`
- `bumpMetric` (todas as métricas)
- `saveTutorMemory` (memória semântica)
- `recordTopicFidelity` (topic fidelity)

## 5. Timeouts

| Etapa | Timeout atual | Recomendação |
|---|---|---|
| Memória + RAG | try/catch soft (falha → `[]`) | Adequado |
| `callClaudeV3` | Definido no cliente compartilhado | Validar 12s |
| `ai()` (fallback OpenAI) | Definido no wrapper enterprise (`retries: 2`) | Validar timeout por tentativa |
| Persistência | `waitUntil` (não bloqueia request) | OK |

Nenhum timeout foi alterado nesta auditoria para preservar o freeze; recomendação
fica registrada para próxima janela.

## 6. Smoke test de latência

Arquivo: `supabase/functions/tutor-v3-premium/__tests__/latency.test.ts`

Sem token (somente healthcheck):
```bash
deno test --allow-net --allow-env \
  supabase/functions/tutor-v3-premium/__tests__/latency.test.ts
```

Com token (full request com `debug=true` e timings):
```bash
USER_JWT="<jwt>" deno test --allow-net --allow-env \
  supabase/functions/tutor-v3-premium/__tests__/latency.test.ts
```

Thresholds são **warning-only** (não falha o build):
- healthcheck: warn > 1500 ms
- full request: warn > 12000 ms

## 7. Latência antes / depois

**Antes:** sem instrumentação por etapa — apenas tempo total opaco.
**Depois:** 5 timings por request (`parseBody/session/memoryLookup/ai/total`)
acessíveis via `debug.timings` para diagnóstico em produção.

A próxima medição P95 oficial será feita em produção após 24h coletando
`[LATENCY_TIMINGS]` no smoke + `debug=true` em requests reais autorizados.

## 8. Riscos remanescentes

- Latência IA continua dominante e fora do controle direto.
- `bumpMetric` chama RPC isolada; em ambientes com muita carga, considerar batch.
- `callClaudeV3` e `ai()` carecem de timeout hard explícito visível no `index.ts`.

## 9. Próximas funções para auditoria

1. `question-generator` (gera várias questões + valida).
2. `generate-flashcards`.
3. `generate-adaptive-simulado` (lote pesado).
4. `process-upload` (chunking + embeddings).

## 10. Freeze

Nenhuma alteração em prompts, FSRS, memória pedagógica, Bank Guard, frontend,
schema, RLS, Tutor logic, Planner, Event Bus, Error Bank ou contrato público.
Único impacto: 5 marcos `performance.now()` e exposição condicional de `timings`.

`TUTOR-V3-PREMIUM LATENCY OPTIMIZED — FREEZE SAFE`
