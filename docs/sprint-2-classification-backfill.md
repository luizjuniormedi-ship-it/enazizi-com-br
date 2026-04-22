# Sprint 2 — Backfill de Classificação Hierárquica

Pipeline incremental e seguro para popular `specialty_id / topic_id / subtopic_id / microtopic_id` em `questions_bank` e `real_exam_questions`, **sem mexer no gerador atual** e sem substituir os campos `topic`/`subtopic` textuais.

## Como executar

1. Acesse `/admin/classification` (rota protegida por `AdminRoute`).
2. Selecione tabela alvo, lote (10–500) e mantenha **dry-run ligado** na primeira execução.
3. Confira aplicações esperadas, métodos e amostra de ambíguos.
4. Desligue dry-run e rode lotes pequenos (recomendado: 100–200).
5. Use a aba **Fila de revisão** para aprovar/rejeitar manualmente itens com confiança 0.7–0.9.

## Pipeline

| Etapa | Quando dispara | Confidence típica | Ação |
|-------|----------------|-------------------|------|
| `exact_text` | `topic` da questão = nome de specialty (com normalização + sinônimos) | 0.95 | Aplica direto |
| `heuristic` | Subset de tokens ≥ 0.5 com nome de specialty | 0.42–0.85 | Aplica se ≥ 0.9, senão fila |
| `ai` | (não habilitado neste sprint) | — | Fica para Sprint 2.1 |

## Regras de segurança

- **Idempotente**: só atualiza se `confidence` for ≥ ao já existente.
- **Não toca** `topic`/`subtopic` textuais (preservados como fallback).
- **Não interfere** no gerador atual nem em `EXAM_PROFILES`.
- RLS: edge function exige `admin` no `user_roles`.
- `dry_run = true` por padrão na UI.
- Limite por execução: 500 questões.

## Queries de validação

```sql
-- Progresso global
SELECT 
  'questions_bank' AS tbl,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE specialty_id IS NOT NULL) AS classified,
  ROUND(100.0 * COUNT(*) FILTER (WHERE specialty_id IS NOT NULL) / NULLIF(COUNT(*),0), 2) AS pct
FROM questions_bank
UNION ALL
SELECT 'real_exam_questions', COUNT(*), 
       COUNT(*) FILTER (WHERE specialty_id IS NOT NULL),
       ROUND(100.0 * COUNT(*) FILTER (WHERE specialty_id IS NOT NULL) / NULLIF(COUNT(*),0), 2)
FROM real_exam_questions;

-- Distribuição por método e confiança
SELECT classification_method,
       COUNT(*) AS n,
       ROUND(AVG(classification_confidence)::numeric, 3) AS avg_conf,
       MIN(classification_confidence) AS min_conf
FROM questions_bank
WHERE classification_method IS NOT NULL
GROUP BY 1 ORDER BY 1;

-- Itens pendentes de revisão por specialty sugerida
SELECT cs.nome AS sugerido,
       q.classification_method,
       COUNT(*) AS n,
       ROUND(AVG(q.confidence_score)::numeric, 3) AS avg_conf
FROM question_classification_queue q
LEFT JOIN curriculum_specialties cs ON cs.id = q.suggested_specialty_id
WHERE q.status = 'pending'
GROUP BY 1, 2 ORDER BY n DESC;

-- Runs recentes
SELECT id, table_source, batch_size, dry_run, status,
       total_processed, total_applied, total_queued_review, total_skipped,
       method_breakdown, started_at
FROM question_classification_runs
ORDER BY started_at DESC LIMIT 20;
```

## Rollback lógico (por run)

```sql
-- 1) Identifica o run
SELECT * FROM question_classification_runs WHERE id = '<RUN_ID>';

-- 2) Reverte ids aplicados por aquele run
UPDATE questions_bank
SET specialty_id = NULL, topic_id = NULL, subtopic_id = NULL, microtopic_id = NULL,
    classification_confidence = NULL, classification_method = NULL,
    classification_reviewed_by_human = false, classified_at = NULL
WHERE id IN (
  SELECT question_id FROM question_classification_queue
  WHERE run_id = '<RUN_ID>' AND table_source = 'questions_bank'
);

-- 3) Marca run
UPDATE question_classification_runs SET status = 'rolled_back' WHERE id = '<RUN_ID>';
```

> Nota: o rollback acima cobre apenas as questões que passaram pela fila (média confiança).
> Para reverter aplicações de alta confiança que não geraram queue, é preciso usar
> `classified_at >= '<run.started_at>' AND classified_at <= '<run.finished_at>'`
> como filtro adicional. Nunca reverte a questão sem checar `classification_reviewed_by_human = false`.

## Pré-flight (executado em 22/04/2026)

Em `questions_bank` (14.869 questões):
- **10.773 (~72%)** baterão por `exact_text` na specialty (estimativa SQL).
- **~3.500** devem cair via sinônimos (Clínica Médica, Ginecologia, Emergência, Cirurgia Geral).
- **~600** ficarão para fila/heurística.

## O que ficou pendente (escopo futuro)

- Etapa de **embeddings + IA** (cair só em ambiguidade) — fica para Sprint 2.1.
- **Microtópico**: ainda não classificado (depende da estrutura de microtopics estar mais densa).
- **Topic curricular** dentro de specialty: só populado quando o `subtopic` textual da questão bater literalmente com um topic do currículo. Maioria dos casos vai ter apenas `specialty_id` populado neste sprint.
- **Sinônimos** estão hardcoded na edge function — futuramente migrar para tabela `curriculum_aliases`.
