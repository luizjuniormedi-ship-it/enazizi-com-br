# pedagogical-event-consumer — Hardening Evidence (Wave 6)

## 1. Status executivo

`PEDAGOGICAL-EVENT-CONSUMER CONTRACT GATE READY — FREEZE SAFE`

Função classificada como **GO-LIVE READY (Wave 6)**. Já implementa padrão
"blind orchestrator v11": nunca retorna 4xx/5xx, sempre 200 com payload
controlado; processamento de estado cognitivo via `waitUntil` (async,
non-blocking). Nenhum patch produtivo necessário.

## 2. Bugs encontrados

Nenhum. A função:

- usa `req.json().catch(() => ({}))` (parse seguro);
- aceita chamada anônima (system events) sem crash;
- valida ausência de `event` e ausência de `userId` com early-return 200;
- isola o pipeline de estado cognitivo num bloco `try/catch` interno dentro de `waitUntil`;
- catch top-level retorna `{ success: false, silent: true, error, log: "[EDGE_SAFE_FAIL]" }` em 200;
- delega CORS ao `enterpriseEdgeHandler` + `corsResponse`.

## 3. Patch aplicado

Nenhum. Função intocada.

## 4. Cenários testados (`__tests__/contract.test.ts`)

Sem token (anônimo):

1. OPTIONS/CORS → 200/204.
2. Chamada anônima sem payload → 200 controlado.
3. JSON malformado → sem stack/TypeError.
4. Body vazio → controlado.
5. `event` ausente → 200 silent.
6. `event` sem user context → 200 silent.
7. `event_type` não-string → sem crash.
8. `metadata` null → sem crash.
9. `metadata` não-object → sem crash.
10. `event: null` → sem crash.
11. `event: "oops"` → sem crash.

Com token (`USER_JWT`):

12. Evento autenticado válido → 200 `blind_ok`.
13. Evento duplicado (mesmo `id`) → ambos os requests controlados.

## 5. Invariantes protegidos

- Nunca 5xx.
- Nunca vaza `TypeError`, `Cannot read`, `toLowerCase`, `trim`, `"stack"`.
- Sempre JSON com `success|ignored|blind_ok|error|status|message|processed|result`.
- Anônimo NÃO quebra (rota usada por system events).
- Payloads inválidos NÃO disparam escritas (early-return antes do `waitUntil`).
- Event Bus / FSRS / Planner / Error Bank / Cognitive State **não alterados**.

## 6. Riscos remanescentes

- Processamento real do `waitUntil` é assíncrono e não observável via HTTP — cobertura de regressão de efeito colateral fica fora do contract gate (depende de telemetria + integração).
- Idempotência completa depende da RPC `mark_pedagogical_event_consumed`; o teste de duplicata só valida que o contrato HTTP permanece controlado.

## 7. Confirmação de freeze

Nenhuma alteração em:

- prompts;
- lógica pedagógica;
- FSRS;
- memória pedagógica;
- Bank Guard;
- frontend;
- schema;
- RLS;
- Tutor;
- Planner;
- Error Bank;
- Event Bus;
- `index.ts` produtiva da função;
- funções já travadas (`generate-adaptive-simulado`, `question-generator`,
  `tutor-v3-premium`, `generate-flashcards`, `process-upload`).

Arquivos criados:

- `supabase/functions/pedagogical-event-consumer/__tests__/contract.test.ts`
- `supabase/functions/pedagogical-event-consumer/__tests__/README.md`
- `.github/workflows/pedagogical-event-consumer-contract.yml`
- `docs/go-live/pedagogical-event-consumer-hardening-evidence.md`

Arquivos atualizados:

- `docs/go-live/edge-functions-go-live-index.md`
- `docs/go-live/edge-functions-risk-triage-wave-1.md`

## 8. Status final

`PEDAGOGICAL-EVENT-CONSUMER CONTRACT GATE READY — FREEZE SAFE`
