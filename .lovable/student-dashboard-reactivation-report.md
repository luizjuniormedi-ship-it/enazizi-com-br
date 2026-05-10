# Reativação do Painel do Aluno — Etapa 1 (Fases 1+2)

Data: 2026-05-10
Status: ✅ **Aprovação + Perfis de Tópicos reativados**

---

## Diagnóstico (real)

| Tabela | Antes | Última escrita | Causa |
|---|---|---|---|
| `approval_scores` | 9 linhas / 3 users | 2026-04-04 | `study-complete` só disparava em `simulado_complete`; sem cron, sem backfill |
| `user_topic_profiles` | 65 linhas / 4 users | 2026-04-14 | Só `dualWriteUserTopicProfile` (fluxo clássico); sem derivação de `error_bank` / `fsrs_cards` |
| `chance_by_exam` | dependente de approval_scores | dead | — |

---

## Fase 1 — approval_scores ✅

### Mudanças
- **`calculate-approval-score/index.ts`** refatorado:
  - Lógica extraída em `computeAndPersist(admin, userId, source)`.
  - Aceita modo **JWT** (usuário recalcula a si) **e modo service-role** (`{ target_user_id }`) para cron/backfill.
  - `details_json.source` agora rastreia quem disparou (`study-complete:simulado`, `approval-snapshot-cron`, etc).
- **`study-complete/index.ts`** — gatilho ampliado:
  - Continua disparando sempre em `simulado_complete`.
  - **Novo**: também dispara em qualquer ação com outcome (`review`, `error_review`, `lesson_complete`, `chronicle_complete`, ou qualquer `wasCorrect: boolean`) — com **rate-limit de 2h** por usuário (consulta último `approval_scores.created_at`).
  - Mantém fire-and-forget (não bloqueia a finalização).
- **Nova edge function `approval-snapshot-cron`**:
  - Lista usuários ativos nos últimos 14 dias (`practice_attempts | error_bank | fsrs_review_log | exam_sessions`).
  - Dispara `calculate-approval-score` em paralelo (concurrency 4).
  - Idempotente.

### Cron agendado
- `approval-snapshot-daily` — `30 3 * * *` UTC

### Backfill imediato
- 1 usuário ativo recalculado → `approval_scores` saltou para 10 linhas, `chance_by_exam` para 5 bancas, todos `created_at = 2026-05-10`.

---

## Fase 2 — user_topic_profiles ✅

### Nova edge function `backfill-user-topic-profiles`
Deriva perfis a partir de:
- **`error_bank`**: `tema/subtema/vezes_errado/dominado/updated_at` → cada erro vira "tentativa errada"; `dominado=true` adiciona +1 acerto.
- **`fsrs_cards`** (ref_type=`tema`): `reps` como tentativas, `lapses` como erros; resolve nome via `temas_estudados`.
- Agrega por (user_id, topic), calcula `accuracy`, `mastery_level` (1–5) e `confidence_level` (low/med/high) determinísticos.

### Modos
- `{ user_id }` → 1 usuário
- `{ force_all: true }` → todos com qualquer dado (one-time histórico)
- `{}` → ativos em 14 dias (cron diário)

### Cron agendado
- `topic-profiles-backfill-daily` — `45 3 * * *` UTC

### Backfill imediato (`force_all: true`)
- **29 usuários processados** em 25s
- **262 linhas em `user_topic_profiles`** (vs. 65 antes — **+303%**)
- Top usuários: 40 temas (2 users), 26 temas, 25 temas, 18 temas
- 4 usuários sem dados aproveitáveis → 0 upserts (honestamente vazios)

---

## Validação pós-execução

```
approval_scores      | 10 linhas | last 2026-05-10 | 3 users
user_topic_profiles  | 262 linhas| last 2026-05-10 | 28 users
chance_by_exam       |  5 linhas | last 2026-05-10 | 1 user
```

Cron jobs ativos:
- `approval-snapshot-daily` (jobid 20)
- `topic-profiles-backfill-daily` (jobid 21)

---

## O que NÃO foi tocado

- Schema do banco (zero migração)
- Matemática do FSRS / TRI
- Prompts/modelos IA
- Componentes consumidores (`ApprovalScoreCard`, `WeakTopics`, `TopicEvolution`, `Predictor`) — leem direto das tabelas; agora têm dado real automaticamente
- `ranking_snapshots` (Etapa 2)
- Dashboard emocional vs Cockpit (Etapa 3)
- `practice_attempts` parado em 11/abr — fora do escopo desta etapa (não é dead pipeline, é uso decrescente do fluxo clássico)

---

## Risco residual / pendências

| Item | Severidade | Status |
|---|---|---|
| `chance_by_exam` ainda só tem 1 user (apenas o ativo recalculou) | baixa | ⚠️ próximo cron preenche; ou `force_all` no `approval-snapshot-cron` |
| Backfill histórico não roda chance_by_exam para inativos | baixa | ⚠️ aceitável — cron diário cobre quando voltarem |
| Auth dos crons usa anon key (padrão do projeto) — funções abertas | baixa | ✅ idempotentes, sem entrada de PII, write 100% via service-role interno |
| `medical_domain_map` ainda vazio para a maioria → `domain_score` zera no approval | média | ⚠️ Etapa 2 (precisa pipeline próprio) |
| `practice_attempts` parado em abril | média | fora do escopo Etapa 1 |

---

## Próximos passos sugeridos (Etapa 2)

1. Reativar `ranking_snapshots` (consistência + retenção + evolução, não volume)
2. UI premium FSRS/TRI (com `theta_proxy` claramente rotulado quando não houver TRI real)
3. Backfill `medical_domain_map` derivando de `user_topic_profiles` agora que está vivo

## Veredito

**Fases 1 e 2 ✅ fechadas.** Pipeline de aprovação + perfis de tópicos reativado, com cron diário e backfill histórico aplicado a 29 usuários. Nenhum mock, nenhum dado fake. Componentes consumidores passam a renderizar dado real sem alteração de código.
