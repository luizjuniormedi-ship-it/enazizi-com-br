
-- ============================================================
-- VIEW UNIFICADA DE DESEMPENHO
-- Consolida fontes vivas (error_bank + simulado_question_analytics + fsrs_review_log)
-- em um schema compatível com os leitores legados de desempenho_questoes.
-- READ-ONLY. Não altera nenhuma tabela existente.
-- ============================================================

CREATE OR REPLACE VIEW public.performance_unified
WITH (security_invoker = true)
AS
-- Fonte 1: Banco de Erros (já agregado por tema)
SELECT
  eb.user_id,
  eb.tema::text                                           AS tema,
  eb.subtema::text                                        AS subtema,
  COALESCE(eb.vezes_errado, 1)::int                       AS questoes_feitas,
  COALESCE(eb.vezes_errado, 1)::int                       AS questoes_erradas,
  0::numeric                                              AS taxa_acerto,
  COALESCE(eb.updated_at, eb.created_at)                  AS data_registro,
  'error_bank'::text                                      AS source,
  eb.id                                                   AS source_id
FROM public.error_bank eb
WHERE eb.user_id IS NOT NULL

UNION ALL

-- Fonte 2: Simulados (1 linha = 1 questão respondida)
SELECT
  sqa.user_id,
  COALESCE(sqa.specialty, 'desconhecido')::text           AS tema,
  sqa.subtopic::text                                      AS subtema,
  1::int                                                  AS questoes_feitas,
  CASE WHEN sqa.is_correct THEN 0 ELSE 1 END::int         AS questoes_erradas,
  CASE WHEN sqa.is_correct THEN 100 ELSE 0 END::numeric   AS taxa_acerto,
  sqa.created_at                                          AS data_registro,
  'simulado'::text                                        AS source,
  sqa.id                                                  AS source_id
FROM public.simulado_question_analytics sqa
WHERE sqa.user_id IS NOT NULL

UNION ALL

-- Fonte 3: Revisões FSRS (rating 1 = "Again" = errou; >=2 = acertou)
SELECT
  fsl.user_id,
  'fsrs'::text                                            AS tema,
  NULL::text                                              AS subtema,
  1::int                                                  AS questoes_feitas,
  CASE WHEN fsl.rating <= 1 THEN 1 ELSE 0 END::int        AS questoes_erradas,
  CASE WHEN fsl.rating <= 1 THEN 0 ELSE 100 END::numeric  AS taxa_acerto,
  fsl.reviewed_at                                         AS data_registro,
  'fsrs'::text                                            AS source,
  fsl.id                                                  AS source_id
FROM public.fsrs_review_log fsl
WHERE fsl.user_id IS NOT NULL;

COMMENT ON VIEW public.performance_unified IS
'Visão unificada de desempenho do aluno. Consolida error_bank + simulado_question_analytics + fsrs_review_log em schema compatível com leitores de desempenho_questoes. READ-ONLY. RLS herdada (security_invoker).';
