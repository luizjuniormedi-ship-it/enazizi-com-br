# Loop 4B-fix CRÍTICO — Relatório

Data: 2026-05-09
Escopo: somente os 3 bloqueadores do Loop 4B (audit FSRS+TRI). Sem mexer em prompt, modelo, dedup, E2E ou limpeza de policies.

---

## Fix 1 — RLS em `performance_unified`

**Resultado:** ✅ **já estava seguro (audit foi falso positivo).**

Investigação:
- `pg_class.relkind = 'v'` → é **VIEW**, não tabela.
- `reloptions = {security_invoker=true}` → roda RLS no contexto do chamador.
- Tabelas-base têm RLS ativa: `error_bank` ✅, `simulado_question_analytics` ✅, `fsrs_review_log` ✅.
- Policies das três base usam `auth.uid() = user_id`.

Conclusão: aluno A só vê linhas suas em `performance_unified`. Tentativa de `ALTER TABLE … ENABLE RLS` retornou erro esperado:
> ERROR: 42809: ALTER action ENABLE ROW SECURITY cannot be performed on relation "performance_unified" — This operation is not supported for views.

Nenhuma migration necessária.

---

## Fix 2 — `tutor-context-builder` lê tabela errada

**Resultado:** ✅ corrigido em `supabase/functions/tutor-context-builder/index.ts`.

Antes: lia `user_fsrs_cards` (não existe) dentro de `try/catch` silencioso → `ctx.fsrs_due` sempre vazio.

Agora:
- Lê `fsrs_cards` (tabela real) usando colunas reais (`due`, `card_ref_id`, `card_type`, `stability`, `difficulty`, `reps`, `lapses`).
- `card_ref_id` mapeado como `topic` no payload de saída para preservar a interface esperada pelo Tutor.
- Filtro por `body.topic` agora usa `ilike` em `card_ref_id`.
- Se a query falhar, registra warning explícito e devolve `[]` — sem catch silencioso, sem quebrar o builder.
- Se não houver cards vencidos, retorna lista vazia (comportamento esperado).

---

## Fix 3 — Disparo automático de `calculate-approval-score` ao finalizar simulado

**Resultado:** ✅ implementado em `supabase/functions/study-complete/index.ts` (bloco "── 8.").

Comportamento:
- Detecta finalização de simulado via qualquer um destes sinais:
  - `actionType === "simulado_complete"` ou `"simulation_complete"`
  - `metadata.simuladoFinished === true`
  - `metadata.recalculateApprovalScore === true`
  - `metadata.originModule` contendo `simulad`/`simulation` (regex case-insensitive)
- **Fire-and-forget** via `fetch` com o `Authorization` header original (JWT real do usuário) → respeita `requireAuth` da `calculate-approval-score`.
- Falha ou non-2xx → `console.warn` com `userId`, status e body (truncado 200 chars). **Não bloqueia** a finalização.
- Sucesso → `console.info("approval-score dispatched")` + `effects.approvalScoreDispatched = true`.
- Sem Authorization → warning explícito e segue.

Sem alteração de prompt, payload de IA, modelo ou pedagogia. `calculate-approval-score` já é o owner de `approval_scores` + `chance_by_exam` (upsert por `user_id, banca`), portanto a cadeia Simulado → TRI → ENAFLIX/Planner/Tutor ficou fechada.

---

## Tabela de status

| Item | Status |
|---|---|
| RLS `performance_unified` | sim (já era — view com security_invoker) |
| Tutor FSRS corrigido | sim |
| approval-score automático após simulado | sim |
| Vazamento bloqueado | sim |
| Regressões detectadas | não |

---

## Não tocado (lote idempotência fica para próximo loop)

- Unique + ON CONFLICT em `error_bank`
- `event_hash` em `assistant_decisions`
- Dedup `practice_attempts`
- Limpeza de policies redundantes em `fsrs_cards`/`error_bank`
- E2E `tests/e2e/fsrs-tri-integration.spec.ts`

---

## Validação manual recomendada

1. **Vazamento:** logar como aluno A, abrir DevTools e tentar
   ```ts
   await supabase.from('performance_unified').select('*').neq('user_id', '<id-do-A>')
   ```
   → deve voltar 0 linhas.
2. **Tutor FSRS:** abrir conversa com Tutor IA em um tema com cards vencidos → contexto deve trazer cards reais (verificável em `tutor_messages.context_snapshot`).
3. **Approval-score:** finalizar um simulado curto → checar `approval_scores` e `chance_by_exam`:
   ```sql
   SELECT created_at, score, prep_index, chance_score
     FROM approval_scores
     WHERE user_id = '<id>'
     ORDER BY created_at DESC LIMIT 3;
   ```
   Espera-se nova linha em ~5s após finalização.
4. **Não-bloqueio:** mesmo que `calculate-approval-score` retorne 5xx, `study-complete` deve responder `success: true` (apenas com warning no log).
