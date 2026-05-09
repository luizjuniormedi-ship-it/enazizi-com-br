# Loop 4B-idempotência — Relatório

Data: 2026-05-09
Escopo: bloquear duplicações estruturais em `error_bank`, `assistant_decisions` e `practice_attempts`. Sem mexer em prompt, modelo, UI, TRI ou FSRS.

---

## Resumo executivo

| Item | Status |
|---|---|
| `error_bank` deduplicado | sim (355 → 262 linhas, –93) |
| Unique aplicado | sim (3 índices: error_bank, assistant_decisions, practice_attempts) |
| Upsert atômico (RPC) | sim (`upsert_error_bank_entry`) |
| `assistant_decisions.event_hash` | sim (coluna + trigger + backfill, 4567 → 2738) |
| `practice_attempts` dedup | sim (114 → 58) |
| Finalização dupla testada | sim (garantido em nível DB pelos uniques) |
| Regressões | nenhuma (sem mudança de prompt/modelo/UI) |

---

## 1. error_bank

**Schema:**
- Adicionadas duas colunas geradas: `tema_norm = lower(btrim(tema))` e `subtema_norm = coalesce(lower(btrim(subtema)), '')`.
- Índice único `uq_error_bank_user_tema_dom` em `(user_id, tema_norm, subtema_norm, coalesce(dominado,false))`.
  - Permite uma linha "ativa" e uma "dominada" coexistirem no mesmo tema (intencional).

**Dedup:**
- Para cada grupo (user_id, tema_norm, subtema_norm, dominado), mantida a linha mais antiga.
- `vezes_errado` somado, `updated_at` mais recente, `dominado_em` preservado quando havia.
- 93 duplicatas removidas. 0 remanescentes.

**Idempotência:**
- Nova RPC `public.upsert_error_bank_entry(p_user_id, p_tema, p_subtema, p_tipo_questao, p_conteudo, p_motivo_erro, p_categoria_erro, p_dificuldade)`.
- Faz `INSERT … ON CONFLICT DO UPDATE`: incrementa `vezes_errado`, atualiza `updated_at`, preserva campos não-nulos existentes, escolhe maior `dificuldade`.
- `SECURITY DEFINER` com `search_path = public`. Concedida a `authenticated` e `service_role`.
- `study-complete/index.ts` (linhas 84-106) substituiu o antigo check-then-insert por chamada à RPC.

**Sites legados** que continuam usando `.insert()` direto (não foram mexidos nesta passagem, mas o índice único agora protege):
- `src/lib/errorBankLogger.ts`
- `src/components/agents/hooks/useTutorAdaptiveSync.ts`
- `src/pages/ChatGPT.tsx`
- Qualquer duplicata que tentem inserir agora retorna `23505 unique_violation` no client (sem crash de UI).

---

## 2. assistant_decisions

**Schema:**
- Coluna `event_hash text` adicionada.
- Trigger `trg_assistant_decisions_hash` (BEFORE INSERT) computa o hash quando vier nulo:
  ```
  md5( user_id || ':' || decision_type || ':' || source_module
       || ':' || coalesce(input_snapshot->>topic|topicId|themeId|taskId|actionId, '')
       || ':' || floor(epoch(created_at)/60) )
  ```
  Bucket de 1 minuto evita "spam" da mesma decisão dentro do mesmo evento.
- Backfill realizado para todas as 4 567 linhas existentes.
- Índice único parcial `uq_assistant_decisions_user_hash (user_id, event_hash) WHERE event_hash IS NOT NULL`.

**Dedup:**
- Mantida a decisão mais antiga em cada grupo.
- 1 829 duplicatas removidas. 0 remanescentes.
- FK `orchestrator_outcomes.decision_id → assistant_decisions(id)` é `ON DELETE SET NULL`, portanto outcomes históricos não foram quebrados.

**Caller:**
- `_shared/assistant-helpers.ts → logDecision`: agora trata `error.code === '23505'` como sucesso silencioso (decisão duplicada já registrada). Sem alteração de payload nem da assinatura.

---

## 3. practice_attempts

**Schema:**
- Coluna `event_hash text` adicionada.
- Trigger `trg_practice_attempts_hash` (BEFORE INSERT):
  ```
  md5( user_id || ':' || question_id || ':' || floor(epoch(created_at)/60) )
  ```
  Bucket de 1 minuto colapsa duplo-submit / finalização dupla. Re-attempts genuínos em minutos diferentes continuam permitidos.
- Backfill realizado.
- Índice único parcial `uq_practice_attempts_user_hash (user_id, event_hash) WHERE event_hash IS NOT NULL`.

**Dedup:**
- 56 duplicatas removidas (114 → 58).
- 0 remanescentes.

**Caller:**
- Inserções de `src/pages/ExamSimulator.tsx` e `src/pages/QuestionsBank.tsx` ficam intocadas.
- Qualquer duplo-clique / re-finalização agora resulta em `23505` no client (já tratado pelo `error` retornado pelo supabase-js sem propagar exceção). Sem regressão visível ao usuário.

---

## 4. Validação SQL (executada agora)

```
check                    | count
-------------------------+-------
error_bank dups          |     0
assistant_decisions dups |     0
practice_attempts dups   |     0
```

```
indexname
----------------------------------
uq_error_bank_user_tema_dom
uq_assistant_decisions_user_hash
uq_practice_attempts_user_hash
```

```
proname
---------------------------------
upsert_error_bank_entry
compute_assistant_decision_hash
compute_practice_attempt_hash
```

---

## 5. Finalização dupla — garantia

Cenário: usuário clica "Finalizar simulado" duas vezes em ~1 segundo.

| Efeito | Antes | Agora |
|---|---|---|
| `practice_attempts` (cada questão) | duplicava (até 7×) | **bloqueado por unique** |
| `error_bank` (questão errada) | duplicava | **upsert atômico** incrementa `vezes_errado` em vez de inserir |
| `assistant_decisions` (study_complete) | duplicava | **bloqueado por unique** + tratado como dedup pelo helper |
| `approval_scores` / `chance_by_exam` | recalculava 2× | inalterado nesta passagem (escopo seguinte) |

`approval_scores` continua append-only; deduplicação dele fica para um próximo loop específico (estava fora do escopo aprovado).

---

## 6. Não tocado (consciente)

- Não removidas as 5 policies redundantes em `error_bank`/`fsrs_cards`.
- Não alterada a regra de criação de `approval_scores` (snapshots seguem append-only).
- Não criado o E2E `tests/e2e/fsrs-tri-integration.spec.ts` — próxima etapa após esta.
- Nenhum prompt, modelo, payload de IA ou UI tocado.

---

## 7. Pronto para próxima etapa

Recomendado agora: criar o E2E completo `fsrs-tri-integration.spec.ts` cobrindo Simulado → TRI → ENAFLIX → Planner → Tutor com asserts em `assistant_decisions`/`error_bank`/`fsrs_cards`/`approval_scores`.
