-- ─────────────────────────────────────────────────────────────────────
-- Sprint 6 — Telemetria de seleção real de questões + Guard granular
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.simulado_selection_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- contexto
  endpoint text NOT NULL DEFAULT 'simulados-page',
  mode text,                      -- 'estudo' | 'prova_real' | 'tri' | 'adaptativo'
  banca text,
  user_profile text,              -- 'iniciante' | 'intermediario' | 'avancado' (quando disponível)
  requested_count int,
  final_count int,

  -- mix de fontes (quantas questões vieram de cada origem)
  source_pool_textual int NOT NULL DEFAULT 0,    -- questions_bank via topic.ilike
  source_pool_structural int NOT NULL DEFAULT 0, -- questions_bank via specialty_id/topic_id (futuro)
  source_image_pipeline int NOT NULL DEFAULT 0,  -- selectImageQuestions
  source_ai_generated int NOT NULL DEFAULT 0,    -- generateBatch
  source_fallback int NOT NULL DEFAULT 0,        -- fallback genérico

  -- elegibilidade granular
  granular_eligible boolean NOT NULL DEFAULT false,
  granular_fallback_reason text,  -- flag_off | banca_nao_pronta | coverage_insufficient
                                  -- | questions_not_classified | empty_distribution | no_banca_provided
  classification_pct_specialty numeric,
  classification_pct_topic numeric,
  classification_pct_subtopic numeric,

  duration_ms int,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_simsel_user_created ON public.simulado_selection_runs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_simsel_banca_created ON public.simulado_selection_runs (banca, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_simsel_reason ON public.simulado_selection_runs (granular_fallback_reason);

ALTER TABLE public.simulado_selection_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own selection runs"
  ON public.simulado_selection_runs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "users read own selection runs"
  ON public.simulado_selection_runs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admins read all selection runs"
  ON public.simulado_selection_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ─────────────────────────────────────────────────────────────────────
-- Visão admin: overview agregado (mix médio + fallback rate)
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_simulado_selection_overview(_days int DEFAULT 7)
RETURNS TABLE (
  total_runs bigint,
  avg_textual numeric,
  avg_structural numeric,
  avg_image numeric,
  avg_ai numeric,
  avg_fallback numeric,
  granular_eligible_pct numeric,
  top_fallback_reasons jsonb,
  by_banca jsonb,
  by_mode jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _since timestamptz := now() - make_interval(days => GREATEST(_days, 1));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT * FROM public.simulado_selection_runs WHERE created_at >= _since
  ),
  reasons AS (
    SELECT granular_fallback_reason AS reason, COUNT(*) AS cnt
    FROM base
    WHERE granular_fallback_reason IS NOT NULL
    GROUP BY granular_fallback_reason
    ORDER BY cnt DESC
    LIMIT 10
  ),
  by_b AS (
    SELECT COALESCE(banca,'(sem banca)') AS banca,
           COUNT(*) AS runs,
           AVG(source_pool_textual)::numeric AS textual,
           AVG(source_ai_generated)::numeric AS ai
    FROM base GROUP BY banca ORDER BY runs DESC LIMIT 20
  ),
  by_m AS (
    SELECT COALESCE(mode,'(sem modo)') AS mode,
           COUNT(*) AS runs,
           AVG(final_count)::numeric AS final_avg
    FROM base GROUP BY mode ORDER BY runs DESC
  )
  SELECT
    (SELECT COUNT(*) FROM base),
    ROUND(COALESCE((SELECT AVG(source_pool_textual)    FROM base),0), 2),
    ROUND(COALESCE((SELECT AVG(source_pool_structural) FROM base),0), 2),
    ROUND(COALESCE((SELECT AVG(source_image_pipeline)  FROM base),0), 2),
    ROUND(COALESCE((SELECT AVG(source_ai_generated)    FROM base),0), 2),
    ROUND(COALESCE((SELECT AVG(source_fallback)        FROM base),0), 2),
    ROUND(100.0 * COALESCE((SELECT AVG(CASE WHEN granular_eligible THEN 1 ELSE 0 END) FROM base),0), 2),
    COALESCE((SELECT jsonb_agg(jsonb_build_object('reason',reason,'count',cnt)) FROM reasons), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(jsonb_build_object('banca',banca,'runs',runs,'avg_textual',ROUND(textual,2),'avg_ai',ROUND(ai,2))) FROM by_b), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(jsonb_build_object('mode',mode,'runs',runs,'avg_final',ROUND(final_avg,2))) FROM by_m), '[]'::jsonb);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- Função: prontidão de classificação (questions_bank)
-- Usada pelo guard granular tanto no backend quanto no admin.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.granular_classification_readiness()
RETURNS TABLE (
  total_questions bigint,
  with_specialty_id bigint,
  with_topic_id bigint,
  with_subtopic_id bigint,
  pct_specialty numeric,
  pct_topic numeric,
  pct_subtopic numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT specialty_id, topic_id, subtopic_id
    FROM public.questions_bank
    WHERE COALESCE(review_status,'approved') = 'approved'
  )
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE specialty_id IS NOT NULL),
    COUNT(*) FILTER (WHERE topic_id IS NOT NULL),
    COUNT(*) FILTER (WHERE subtopic_id IS NOT NULL),
    ROUND(100.0 * COUNT(*) FILTER (WHERE specialty_id IS NOT NULL)::numeric / NULLIF(COUNT(*),0), 2),
    ROUND(100.0 * COUNT(*) FILTER (WHERE topic_id IS NOT NULL)::numeric     / NULLIF(COUNT(*),0), 2),
    ROUND(100.0 * COUNT(*) FILTER (WHERE subtopic_id IS NOT NULL)::numeric  / NULLIF(COUNT(*),0), 2)
  FROM base;
$$;