# Planner Core — Hardening Evidence (Wave 7)

## 1. Status executivo

`PLANNER-CORE CONTRACT GATE READY — FREEZE SAFE`

Quatro funções P0 do Planner Core protegidas com bateria de contrato HTTP
e CI gate único. Nenhum patch produtivo necessário — todas já são defensivas.

## 2. Funções cobertas

| Função | Status | Caminho |
|---|---|---|
| `generate-daily-plan` | `GO-LIVE READY` | `supabase/functions/generate-daily-plan` |
| `autonomous-planner-engine` | `GO-LIVE READY` | `supabase/functions/autonomous-planner-engine` |
| `planner-orchestrator-v1` | `GO-LIVE READY` | `supabase/functions/planner-orchestrator-v1` |
| `replan-overdue-tasks` | `GO-LIVE READY` | `supabase/functions/replan-overdue-tasks` |

## 3. Bugs encontrados

Nenhum. Inspeção:

- `generate-daily-plan` — `requireAuth` + `try { body = await req.json() } catch {}`, idempotência por `(user_id, plan_date)`, top-level `try/catch` via `enterpriseEdgeHandler`.
- `autonomous-planner-engine` — usa `service_role`; top-level catch retorna `200 { success: false, error: error.message }` sem stack; `user_id` ausente vira erro controlado.
- `planner-orchestrator-v1` — valida método (405), auth (401), body inválido (400 via `try/catch`), payload incompleto (400). Admission rules dedupe/cooldown/cap/content_lock intactas.
- `replan-overdue-tasks` — `requireAuth`, sem parse de body necessário, lê `revisoes` `lt(data_revisao, today)` e itera vazio sem erro; top-level `try/catch` no padrão Deno.serve.

## 4. Patches aplicados

Nenhum. **Zero alteração em `index.ts` produtivo.**

## 5. Cenários testados

`generate-daily-plan` (9):
OPTIONS · 401 anônimo · JSON malformado · body vazio · payload vazio (defaults) · timezone inválido · timezone não-string · `force` não-boolean · idempotência (sem `force`).

`autonomous-planner-engine` (8):
OPTIONS · JSON malformado · body vazio · `user_id` ausente · `user_id` não-string · `user_id` vazio · uuid desconhecido · autenticado controlado.

`planner-orchestrator-v1` (9):
OPTIONS · método errado (405) · 401 anônimo · JSON malformado · body vazio · payload vazio (400) · payload parcial · `actionType` inválido · `action: null`.

`replan-overdue-tasks` (7):
OPTIONS · 401 anônimo · JSON malformado · body vazio · autenticado vazio · repetição idempotente · campos adversariais (`tasks: "oops"`, `date: 12345`).

**Total: 33 cenários.**

## 6. Invariantes protegidos

- Nunca 5xx.
- Nunca vaza `TypeError`, `Cannot read`, `toLowerCase`, `trim`, `"stack"`.
- Sempre retorna JSON com shape controlado (`success|error|message|planId|tasks|rescheduled|accepted|reason|...`).
- Payloads inválidos NÃO criam tarefas, NÃO duplicam, NÃO recalculam plano.
- Fórmula de prioridade (`calculatePremiumPriority`, FSRS risk, exam proximity) intocada.
- Admission rules do orquestrador (dedupe / cooldown 6h / cap 12 / content_lock) intocadas.
- Idempotência por `(user_id, plan_date)` preservada.

## 7. Riscos remanescentes

- Cobertura é de contrato HTTP; efeitos colaterais profundos (FSRS, Error Bank, daily_plan_tasks) ficam fora deste gate e dependem de telemetria + auditoria pedagógica já vigente.
- `autonomous-planner-engine` retorna `200` mesmo em erro (padrão atual da função) — testes apenas validam que nenhuma resposta vaza stack/TypeError.

## 8. Confirmação de freeze

Nenhuma alteração em:

- prompts;
- lógica pedagógica do planner;
- fórmula de prioridade;
- FSRS;
- memória pedagógica;
- Bank Guard;
- Event Bus;
- Error Bank;
- Tutor;
- frontend;
- schema;
- RLS;
- `index.ts` produtivo de qualquer função do Planner Core;
- funções já travadas Waves 1–6.

Arquivos criados:

- `supabase/functions/generate-daily-plan/__tests__/contract.test.ts` + `README.md`
- `supabase/functions/autonomous-planner-engine/__tests__/contract.test.ts` + `README.md`
- `supabase/functions/planner-orchestrator-v1/__tests__/contract.test.ts` + `README.md`
- `supabase/functions/replan-overdue-tasks/__tests__/contract.test.ts` + `README.md`
- `.github/workflows/planner-core-contract.yml`
- `docs/go-live/planner-core-hardening-evidence.md`

Arquivos atualizados:

- `docs/go-live/edge-functions-go-live-index.md`
- `docs/go-live/edge-functions-risk-triage-wave-1.md`

## 9. Status final

`PLANNER-CORE CONTRACT GATE READY — FREEZE SAFE`
