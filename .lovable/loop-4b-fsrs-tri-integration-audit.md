# Loop 4B — Auditoria Integrada FSRS + TRI / Approval Score

Data: 2026-05-09
Escopo: somente auditoria (sem alterar prompts, modelos, lógica pedagógica ou UI).
Tipo: leitura de schema, RLS, índices, dados reais e código das edge functions.

---

## 1. Inventário

### Tabelas envolvidas (14)
`fsrs_cards`, `fsrs_review_log`, `approval_scores`, `chance_by_exam`,
`performance_unified`, `practice_attempts`, `simulation_sessions`,
`error_bank`, `assistant_decisions`, `daily_plan_tasks`, `daily_plans`,
`dashboard_snapshots`, `study_engine_snapshots`, `video_segment_fsrs`.

### Edge functions que tocam FSRS/TRI (21)
`schedule-review`, `calculate-approval-score`, `study-complete`,
`study-next`, `study-orchestrator`, `cockpit-data`, `dashboard-snapshot`,
`tutor-context-builder`, `simulado-assistant`, `analytics-snapshot`,
`mentor-intelligence`, `proficiency-planner`, `planner-orchestrator-v1`,
`trajectory-engine-v1`, `system-daily-monitor`, `system-health-check`,
`generate-adaptive-question`, `generate-map-flashcards`, `qa-autocorrect`,
`whatsapp-agent`, `daily-bi-whatsapp`.

### Volume real
| Tabela | Linhas | Usuários |
|---|---:|---:|
| fsrs_cards | 429 | 27 |
| fsrs_review_log | 25 | 3 |
| approval_scores | 9 | 3 |
| chance_by_exam | **5** | **1** |
| practice_attempts | 114 | 8 |
| simulation_sessions | 45 | 11 |
| error_bank | 355 | 25 |
| assistant_decisions | **4 567** | 19 |
| performance_unified | 400 | 26 |

---

## 2. Resultado por critério

| Item | Status | Observação |
|---|---|---|
| FSRS review atualiza `due` | sim | `schedule-review` insere log e cards são atualizados via `useFsrs` |
| `fsrs_review_log` criado | sim | 25 linhas, sem duplicação |
| Unique `(user_id, card_type, card_ref_id)` em fsrs_cards | sim | índice ativo, 0 duplicatas |
| TRI/Approval recalcula | parcial | `calculate-approval-score` insere snapshot; nunca dá update — acumula |
| `chance_by_exam` atualiza | sim (quando chamado) | upsert por `(user_id, banca)` OK, mas só **1 usuário** com dados → função pouco invocada |
| Erro alimenta `error_bank` | sim | `study-complete` linhas 84–121 |
| Erro cria/reforça FSRS | sim | `study-complete` linhas 129–161 |
| Planner reprioriza | sim | `proficiency-planner` + `planner-orchestrator-v1` lêem `error_bank` e `fsrs_cards` |
| ENAFLIX mostra ação | sim | `cockpit-data` agrega `fsrs_cards` (due) + `error_bank` |
| Tutor recebe contexto | **NÃO** | `tutor-context-builder:195` lê `user_fsrs_cards` (tabela inexistente) — silencia erro, contexto vazio |
| Duplicações encontradas | **3 frentes** | ver §3 |
| RLS OK | **NÃO** | `performance_unified` está com RLS **desabilitada** |
| Timezone OK | sim | `due` em `timestamptz`, comparado com `now()` UTC; UI converte para America/Sao_Paulo |
| E2E criado | não | não criado nesta passagem (auditoria-only) |

---

## 3. Bugs e riscos detectados

### 🔴 BUG-1 — `performance_unified` sem RLS
```
relname             | relrowsecurity
performance_unified | f
```
A tabela tem `user_id` mas RLS está desligada. Qualquer usuário autenticado consegue ler dados de outros. **Bloquea aprovação do loop integrado.** Correção: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + policy `(user_id = auth.uid())`.

### 🔴 BUG-2 — Tutor IA não recebe FSRS
`supabase/functions/tutor-context-builder/index.ts:195`
```ts
.from("user_fsrs_cards")   // tabela não existe; o nome correto é fsrs_cards
```
Há um catch silencioso (linha 206 comentada como "pode não existir em todos os ambientes"). Resultado: o Tutor IA nunca recebe contexto FSRS — quebra o fluxo "Erro → FSRS → Tutor sugere missão".

### 🟠 BUG-3 — `error_bank` sem unique e com check-then-insert
- Sem índice único em `(user_id, tema, subtema)`.
- `study-complete` faz `select existing → update OU insert` → corrida em duas finalizações simultâneas duplica.
- Dados reais confirmam: até **5 linhas duplicadas** por usuário em mesmo tema (Cardiologia, Neurologia, Asma, ITU…).

Correção sugerida: unique `(user_id, lower(tema), coalesce(lower(subtema),''))` + `INSERT … ON CONFLICT DO UPDATE` em `study-complete`.

### 🟠 BUG-4 — `approval_scores` sem idempotência
- `calculate-approval-score:169` faz `insert(...)` sempre (não upsert, sem event_hash).
- Snapshots acumulam mesmo quando nada mudou desde o último cálculo.
- Risco: dashboard pode "piorar/melhorar" sem evento real só por re-cálculo.

Correção sugerida: insere apenas se `score`/`prep_index`/`chance_score` mudou ≥0.5 vs último snapshot, ou usa hash determinístico.

### 🟠 BUG-5 — `assistant_decisions` sem dedup (4 567 linhas / 19 users ≈ 240 por user)
Sem índice único nem `event_hash`. Sequência de chamadas do orchestrator pode gravar a mesma recomendação múltiplas vezes. Custo de armazenamento crescente e ruído no Tutor.

Correção sugerida: coluna `event_hash text` + unique `(user_id, decision_type, event_hash)`.

### 🟡 BUG-6 — Duplicidade de policies
`fsrs_cards` tem 3 policies SELECT/ALL equivalentes; `error_bank` tem 5 policies sobrepostas. Não vaza dado, mas confunde manutenção. Limpar redundância.

### 🟡 BUG-7 — `practice_attempts` sem unique `(user_id, question_id, created_at)`
Mesmo usuário, mesma questão aparece 7× para 8 questões diferentes (sempre o mesmo user `ddcdd818…`). Pode ser legítimo (re-attempt), mas hoje não há como distinguir reattempt intencional de double-submit. Recomendado: adicionar `event_hash` ou `attempt_index` + unique `(user_id, question_id, attempt_index)`.

### 🟡 BUG-8 — `chance_by_exam` adoção crítica
Apenas 5 linhas, 1 usuário. A função `calculate-approval-score` recalcula `chance_by_exam`, mas raramente é invocada após simulado. Investigar se `study-complete` ou `simulado-assistant` deveriam disparar `calculate-approval-score` ao finalizar.

---

## 4. Cadeia integrada — estado atual

```
Simulado finaliza
   │
   ├─► practice_attempts.insert       ✅ ok
   ├─► simulation_sessions.update     ✅ ok
   ├─► error_bank (check-then-insert) ⚠️ pode duplicar (BUG-3)
   ├─► fsrs_cards (check-then-upd/ins)✅ ok (unique protege)
   ├─► study-complete dispara         ✅ ok
   │
   ├─► calculate-approval-score        ⚠️ não é chamado automaticamente após simulado (BUG-8)
   │      └─► approval_scores.insert   ⚠️ acumula (BUG-4)
   │      └─► chance_by_exam.upsert    ✅ idempotente quando chamado
   │
   ├─► dashboard-snapshot              ✅ refresca prep_index/chance/pending_reviews
   ├─► cockpit-data (ENAFLIX)          ✅ lê fsrs_cards + error_bank
   ├─► planner-orchestrator-v1         ✅ prioriza error_bank>=3 e FSRS críticos
   └─► tutor-context-builder           🔴 lê tabela inexistente (BUG-2)
```

**Veredito:** o pipeline existe ponta-a-ponta, mas **não está fechado** porque (a) o Tutor não recebe FSRS, (b) `calculate-approval-score` não é chamado automaticamente após simulado, e (c) `error_bank`/`approval_scores` não são idempotentes.

---

## 5. Idempotência — resumo

| Tabela | Mecanismo atual | Robusto? |
|---|---|---|
| fsrs_cards | unique `(user_id, card_type, card_ref_id)` | ✅ |
| chance_by_exam | unique `(user_id, banca)` + upsert | ✅ |
| fsrs_review_log | append-only por design | ✅ |
| error_bank | check-then-insert | ❌ |
| approval_scores | append-only sem dedup | ❌ |
| assistant_decisions | append-only sem dedup | ❌ |
| practice_attempts | nenhum | ❌ |

---

## 6. RLS — resumo

| Tabela | RLS | Política aluno |
|---|---|---|
| fsrs_cards | ✅ | `auth.uid() = user_id` |
| fsrs_review_log | ✅ | `auth.uid() = user_id` |
| approval_scores | ✅ | SELECT `user_id = auth.uid()` |
| chance_by_exam | ✅ | SELECT `user_id = auth.uid()` |
| practice_attempts | ✅ | ALL `user_id = auth.uid()` |
| simulation_sessions | ✅ | ALL `user_id = auth.uid()` |
| error_bank | ✅ | múltiplas (redundantes) |
| assistant_decisions | ✅ | aluno vê só as suas; admin vê todas |
| daily_plan_tasks | ✅ | ALL `user_id = auth.uid()` |
| **performance_unified** | **❌** | **vazamento entre usuários** |

---

## 7. Timezone

- Todas as colunas `due`, `last_review`, `created_at`, `reviewed_at` são `timestamptz`.
- Comparações no servidor usam `now()` (UTC) — correto.
- Conversão para `America/Sao_Paulo` ocorre na UI (cliente). Sem evidência de off-by-one observada nos dados.

---

## 8. Cache global × user-scope

- `ai_content_cache` (Loop 4A) tem CHECK constraint que impede `scope='global'` com `user_id`. ✅
- `getCachedAIResponse` decide `scope='user'` automaticamente quando há `userId`/`history`/`errors`/`performance`. ✅
- Nenhuma função FSRS/TRI cacheia resposta personalizada em escopo global. ✅

---

## 9. Observabilidade (eventos esperados)

| Evento | Hoje | Onde |
|---|---|---|
| `fsrs_review_completed` | parcial | gravado em `fsrs_review_log`, sem evento explícito em `study_action_events` |
| `tri_score_recalculated` | não | `calculate-approval-score` não emite |
| `approval_score_updated` | sim | implícito no insert de `approval_scores` |
| `error_bank_updated` | sim | `study-complete:84-121` |
| `cognitive_priority_changed` | não | sem hook |
| `planner_reprioritized` | sim | `planner-orchestrator-v1` registra em `assistant_decisions` |
| `enaflix_next_action_changed` | parcial | `dashboard_snapshots.current_objective` muda, mas sem log de delta |

---

## 10. Próximos passos recomendados (Loop 4B-fix)

Ordem sugerida (todos cirúrgicos, sem mexer em prompt/modelo):

1. **4B-fix-1 (segurança, urgente):** habilitar RLS em `performance_unified` + policy `(user_id = auth.uid())` + policy admin via `has_role`.
2. **4B-fix-2 (Tutor):** trocar `user_fsrs_cards` → `fsrs_cards` em `tutor-context-builder` e remover catch silencioso.
3. **4B-fix-3 (idempotência error_bank):** unique `(user_id, lower(tema), coalesce(lower(subtema),''))` + `ON CONFLICT DO UPDATE` em `study-complete`. Antes, deduplicar dados existentes.
4. **4B-fix-4 (cadeia simulado→TRI):** `study-complete` invoca `calculate-approval-score` ao final do simulado (atrás de `requireAuth`), e essa por sua vez decide se é necessário emitir snapshot novo (delta ≥ 0.5).
5. **4B-fix-5 (assistant_decisions):** adicionar `event_hash` + unique e dedup retroativa.
6. **4B-fix-6:** limpar policies redundantes em `fsrs_cards` e `error_bank`.
7. **4B-fix-7 (E2E):** `tests/e2e/fsrs-tri-integration.spec.ts` rodando os 8 passos do plano.

---

## Critério de aprovação do Loop 4B

❌ **Não aprovado.** Um erro real em simulado hoje:
- alimenta `error_bank` ✅ (mas pode duplicar)
- alimenta `fsrs_cards` ✅
- **não dispara** `calculate-approval-score` automaticamente ❌
- **não chega** ao Tutor IA via FSRS ❌
- alimenta Planner ✅
- alimenta ENAFLIX (`cockpit-data`) ✅

Para aprovar, executar pelo menos 4B-fix-1, 4B-fix-2 e 4B-fix-4.
