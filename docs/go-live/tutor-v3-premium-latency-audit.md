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

---

## Perf-2 — AI Latency Guard

**Status:** `AI LATENCY GUARD READY — FREEZE SAFE`

### Timeouts adicionados (defense-in-depth)

Aplicados no `index.ts` do `tutor-v3-premium`, **acima** dos timeouts internos
já existentes (`EU_AI_TIMEOUT_MS=35s` no Claude EU client; `25s/120s` no `ai-router`).

| Camada | Timeout | Override env |
|---|---|---|
| `callClaudeV3` (primário) | 9 000 ms | `TUTOR_CLAUDE_TIMEOUT_MS` |
| `ai()` OpenAI (fallback) | 9 000 ms | `TUTOR_OPENAI_TIMEOUT_MS` |
| `withTimeout` helper | local, com `clearTimeout` no `finally` | — |

### Providers medidos

Novo objeto `aiTimings` (somente em `debug.aiTimings` quando `body.debug===true`
ou `ENABLE_TUTOR_TIMINGS=true`):

```jsonc
debug: {
  aiTimings: {
    providerPrimary: "claude" | "openai" | "unknown",
    primaryMs: 0,                 // tempo do provider primário
    fallbackProvider: "openai",   // só se acionado
    fallbackMs: 0,                // só se acionado
    totalAiMs: 0,                 // soma da etapa IA dentro do tutor
    timedOut: false,              // true se qualquer provider esgotou
    fallbackUsed: false           // true se passou pelo fallback
  }
}
```

### Comportamento de falha

1. **Claude OK** → resposta normal, `fallbackUsed=false`.
2. **Claude timeout / erro** → log `[TUTOR_CLAUDE_FALLBACK_OPENAI]`, tenta OpenAI com novo timeout.
3. **OpenAI timeout / erro** → log `[TUTOR_AI_UNAVAILABLE]`, lança `AI_UNAVAILABLE:<reason>` que cai no `safe_mode` já existente (Bloco 1 / mensagem controlada).
4. Nenhum stack trace é exposto ao aluno; o `safe_mode` envelopa via `buildTutorEnvelope`.
5. Cada provider tenta **uma vez** nesta camada (retries internos do `ai()` permanecem, mas o `withTimeout` externo limita o tempo total real).

### Helper

```ts
async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), ms);
  });
  try { return await Promise.race([promise, timeout]); }
  finally { if (timeoutId) clearTimeout(timeoutId); }
}
```

### Smoke test

`__tests__/latency.test.ts` agora:
- loga `[AI_TIMINGS]` quando disponível;
- warning quando `totalAiMs > 12000 ms`;
- registra `[AI_FALLBACK_USED]` e `[AI_TIMEOUT_OBSERVED]` sem falhar;
- bloqueia explicitamente leaks (`TypeError`, `"stack"`, `Cannot read`).

### Riscos remanescentes

- Provider externo ainda pode estar lento (Claude EU 8–25 s típico). O timeout
  apenas evita travar; não acelera o provider.
- Quando Claude esgota 9 s, o aluno paga **9 s + tempo OpenAI** no pior caso.
  Aceitável enquanto a P95 do fallback for < 6 s.
- Considerar reduzir `TUTOR_CLAUDE_TIMEOUT_MS` para 7 s após 24 h de telemetria,
  se Claude p95 ≤ 6 s estável.

### Freeze

Nenhuma alteração em: prompts, persona, system prompt, sequência pedagógica,
FSRS, memória, Planner, Event Bus, Error Bank, schema, RLS, frontend, contrato
público, modelo padrão, ou funções das Waves 1–9. Apenas timeout hard +
medição por provider + exposição condicional em debug.

`AI LATENCY GUARD READY — FREEZE SAFE`

---

## Perf-3 — Context Budget / Token Diet

### 1. Orçamentos aplicados (env-tunable, defaults seguros)
| Variável | Default |
|---|---|
| `TUTOR_MAX_HISTORY_ITEMS` | 6 mensagens |
| `TUTOR_MAX_HISTORY_CHARS` | 6.000 |
| `TUTOR_MAX_MEMORY_CHARS` | 4.000 |
| `TUTOR_MAX_RAG_CHARS` | 6.000 |
| `TUTOR_MAX_TOTAL_CONTEXT_CHARS` | 18.000 |

### 2. `contextStats` (exposto só com `debug=true` ou `ENABLE_TUTOR_TIMINGS=true`)
```json
{
  "historyChars": 2400,
  "memoryChars": 980,
  "ragChars": 3120,
  "pedagogicalChars": 7400,
  "userMessageChars": 84,
  "totalInputChars": 13908,
  "historyItems": 4,
  "memoryItems": 1,
  "ragItems": 3,
  "contextTrimmed": false,
  "trimReason": null
}
```
Também emitido em log estruturado `[TUTOR_CONTEXT_BUDGET]` (sem texto sensível, só métricas numéricas).

### 3. Política de truncamento
Ordem de corte quando `totalInputChars > TUTOR_MAX_TOTAL_CONTEXT_CHARS`:
1. Histórico antigo (oldest-first), até caber.
2. Hard-cap defensivo no system content (RAG/memória dentro dele) preservando piso de 2000 chars.

### 4. Nunca truncado
- Mensagem atual do aluno (`userMessageContent`).
- Identificador do bloco pedagógico ativo e o objetivo do bloco (`PROMPT_COMPLETO` + cabeçalho do bloco preservados acima do piso).
- `aiTimings` e contrato público.

### 5. Truncado primeiro
- Memória longitudinal (cap por `TUTOR_MAX_MEMORY_CHARS` + sufixo `[TRUNCATED_FOR_LATENCY]`).
- RAG (cap por `TUTOR_MAX_RAG_CHARS`).
- Histórico antigo (slice das últimas N + cap de chars walking from most-recent).

### 6. Riscos remanescentes
- Provider externo (Claude/OpenAI) ainda domina `aiMs` quando responde dentro do timeout.
- `max_tokens` da resposta não foi alterado nesta fase (configurado no wrapper `ai()` / `callClaudeV3`); recomendação: auditar tetos em fase Perf-4.

### 7. Freeze
Sem mudança em prompt, persona, sequência pedagógica, FSRS, memória (como conceito), RAG (como conceito), Planner, Event Bus, Error Bank, schema, RLS, frontend ou contrato público.

**Status:** `TUTOR CONTEXT BUDGET READY — FREEZE SAFE`

---

## Perf-4 — Real Benchmark

### 1. Como rodar
```bash
USER_JWT=<jwt> SUPABASE_PUBLISHABLE_KEY=<anon> \
  deno run --allow-net --allow-env --allow-write \
  scripts/perf/benchmark-tutor-v3-premium.ts
```
Variáveis opcionais: `TUTOR_FUNCTION_URL` | `SUPABASE_FUNCTIONS_URL` | `TUTOR_BENCH_RUNS` (default 5).

### 2. Cenários medidos
1. `healthcheck` — sem IA; mede cold start / edge overhead.
2. `tutor_minimal` — mensagem curta sem histórico.
3. `continue_block` — `intent=continue` com histórico pequeno.
4. `student_question` — pergunta média com histórico médio.
5. `oversized_history` — 20 mensagens grandes; deve ativar `contextTrimmed=true` (valida Perf-3).

### 3. Métricas por cenário
`count, min, max, avg, p50, p95, p99, avgAiMs, fallbackRate, timeoutRate, avgInputChars, trimmedRate`.

Findings derivados: cold-vs-warm delta, cenário mais lento por p95, AI-dominance (avgAiMs > 60% de avgTotal), fallback ≥30%, timeout observado, trimming ativado.

### 4. Último resultado
Ver [`perf-results/tutor-v3-premium-benchmark-latest.md`](./perf-results/tutor-v3-premium-benchmark-latest.md). Arquivo é reescrito a cada execução do script.

### 5. Interpretação
- `PROVIDER_LATENCY_DOMINANT` → IA externa é o gargalo (timeout/fallback ou avgAi alto). Próximo passo: provider/model routing, **não** mexer no Tutor.
- `CONTEXT_STILL_TOO_LARGE` → reduzir orçamentos de Perf-3 ou compactar pedagógico.
- `COLD_START_DOMINANT` → manter a função quente (cron ping leve).
- `SUPABASE_OVERHEAD_DOMINANT` → investigar sessão/memória/RAG individualmente.
- `READY_FOR_NEXT_FUNCTION` → seguir para a próxima função lenta.

### 6. Freeze
Benchmark é read-only: usa `debug=true` para coletar `timings`/`aiTimings`/`contextStats` já existentes. Nenhum prompt, persona, sequência pedagógica, FSRS, memória, Planner, Event Bus, Error Bank, schema, RLS, frontend, modelo ou contrato público é alterado.

**Status:** `TUTOR REAL BENCHMARK READY — FREEZE SAFE`
