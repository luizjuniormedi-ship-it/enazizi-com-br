# question-generator — Hardening Evidence (Wave 2)

## 1. Executive Status

| Item | Valor |
|---|---|
| Status final | `GO-LIVE READY — FREEZE SAFE` |
| Data | 2026-06-14 |
| Função | `supabase/functions/question-generator` |
| Prioridade | P0 — Critical Go-Live Blocker |
| Wave | 2 |

## 2. Bugs encontrados

| # | Bug | Antes | Depois |
|---|---|---|---|
| 1 | `count` negativo aceito | `Number(-5) \|\| 5 = -5` retornado | Clamp `Math.max(1, Math.min(...,100))` |
| 2 | `topics=[]` vazio | `topics[0]` vira `undefined` em insert/guard (crash potencial) | Filtra strings válidas; fallback `specialty` → `"Clínica Médica"` |
| 3 | `topics: [null,"","   "]` | Não filtrado | Filtro `typeof === "string" && .trim()` |
| 4 | `subtopics` com lixo | Repassado bruto | Mesmo filtro defensivo |

## 3. Patch aplicado (mínimo)

`supabase/functions/question-generator/index.ts` (linhas 54–58 → 54–76).
Sanitização defensiva apenas no parsing inicial do body. **Nenhum prompt,
nenhuma lógica de dedup, banca, topic guard, IA ou persistência alterada.**

## 4. Cenários testados (15)

OPTIONS · 401 · body vazio · count negativo/0/99999/string · `topics=[]` ·
`[null,"","   "]` · aliases `selected*` · specialty/board/difficulty
inválidos · `mode: ai_generation` · tipos errados · JSON inválido.

## 5. Invariantes protegidos

- `questions.length ∈ [0, 100]`
- `requestedCount ∈ [1, 100]`
- `generatedCount ∈ [0, 100]`
- Sem leak de `TypeError`, `Cannot read`, `toLowerCase`, stack trace
- 5xx só se `{success:false, error}` controlado

## 6. Riscos remanescentes

- Suíte depende de `USER_JWT` válido para 12 dos 15 cenários (MODO B).
- `mode: ai_generation` exercita IA — pode ficar lento em CI; aceitável dentro do timeout 10min.
- Bank pode estar insuficiente para algumas specialties; teste tolera via `insufficientQuestions`.

## 7. Freeze Integrity

Sem alteração em prompts, FSRS, memória, Bank Guard, frontend, schema, RLS,
Tutor, Planner, Event Bus, Error Bank, `generate-adaptive-simulado`.

## 8. CI Gate

| Item | Valor |
|---|---|
| Workflow | `.github/workflows/question-generator-contract.yml` |
| Name | `question-generator Contract Gate` |
| Job id | `contract` |
| Status check | `Question generator contract regression` |
| Secret | `SUPABASE_CONTRACT_USER_JWT` (opcional) |

## 9. Final Acceptance

`QUESTION-GENERATOR CONTRACT GATE READY — FREEZE SAFE`
