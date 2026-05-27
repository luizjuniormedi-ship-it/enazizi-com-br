
-- 1. Snapshot column (idempotente)
ALTER TABLE public.questions_bank
  ADD COLUMN IF NOT EXISTS previous_version jsonb;

-- 2. Tabela de controle do cron (kill switch)
CREATE TABLE IF NOT EXISTS public.enrichment_control (
  id int PRIMARY KEY DEFAULT 1,
  is_paused boolean NOT NULL DEFAULT false,
  pause_reason text,
  last_batch_at timestamptz,
  processed_today int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enrichment_control_singleton CHECK (id = 1)
);

INSERT INTO public.enrichment_control (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.enrichment_control TO authenticated;
GRANT ALL ON public.enrichment_control TO service_role;
ALTER TABLE public.enrichment_control ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read enrichment_control" ON public.enrichment_control;
CREATE POLICY "admins read enrichment_control"
ON public.enrichment_control FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3. Função de marcação em massa
CREATE OR REPLACE FUNCTION public.mark_questions_for_upgrade()
RETURNS TABLE(marked_count int, total_in_queue int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_marked int;
  v_total int;
BEGIN
  WITH updated AS (
    UPDATE public.questions_bank q
       SET quality_tier  = 'needs_upgrade',
           lifecycle_state = 'queued_for_enrichment'
     WHERE q.is_global = true
       AND COALESCE(lower(q.quality_tier),'') NOT IN ('gold','golden','exam_standard')
       AND (
            length(coalesce(q.statement,''))   < 400
         OR length(coalesce(q.explanation,'')) < 200
         OR coalesce(q.guideline_reference,'') = ''
         OR q.is_clinical_case IS NOT TRUE
         OR coalesce(q.clinical_density_score, 0) < 70
         OR lower(coalesce(q.quality_tier,'')) IN ('basic','silver','rejected')
       )
       AND COALESCE(lower(q.quality_tier),'') <> 'needs_upgrade'
    RETURNING 1
  )
  SELECT count(*) INTO v_marked FROM updated;

  SELECT count(*) INTO v_total
    FROM public.questions_bank
   WHERE is_global = true
     AND lower(coalesce(quality_tier,'')) = 'needs_upgrade';

  RETURN QUERY SELECT v_marked, v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_questions_for_upgrade() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_questions_for_upgrade() TO service_role;

-- 4. Execução inicial — snapshot da fila
SELECT * FROM public.mark_questions_for_upgrade();

-- 5. Índice parcial para o cron varrer rápido
CREATE INDEX IF NOT EXISTS idx_qb_needs_upgrade
  ON public.questions_bank (created_at)
  WHERE is_global = true
    AND lower(coalesce(quality_tier,'')) = 'needs_upgrade';

-- 6. View de progresso
CREATE OR REPLACE VIEW public.v_enrichment_progress AS
WITH base AS (
  SELECT * FROM public.questions_bank WHERE is_global = true
)
SELECT
  count(*) FILTER (WHERE lower(coalesce(quality_tier,'')) = 'needs_upgrade')                  AS queue_remaining,
  count(*) FILTER (WHERE updated_at > now() - interval '24 hours' AND lower(coalesce(quality_tier,'')) IN ('gold','golden','exam_standard')) AS enriched_24h,
  count(*) FILTER (WHERE length(coalesce(statement,''))   >= 400)                              AS stem_ok,
  count(*) FILTER (WHERE length(coalesce(explanation,'')) >= 200)                              AS expl_ok,
  count(*) FILTER (WHERE coalesce(guideline_reference,'') <> '')                                AS has_biblio,
  count(*) FILTER (WHERE is_clinical_case IS TRUE)                                              AS has_case,
  count(*) FILTER (WHERE lower(coalesce(quality_tier,'')) IN ('gold','golden','exam_standard')) AS gold_total,
  count(*)                                                                                      AS total,
  round(100.0 * count(*) FILTER (WHERE length(coalesce(statement,'')) >= 400) / nullif(count(*),0), 1)   AS pct_stem_ok,
  round(100.0 * count(*) FILTER (WHERE length(coalesce(explanation,'')) >= 200) / nullif(count(*),0), 1) AS pct_expl_ok,
  round(100.0 * count(*) FILTER (WHERE coalesce(guideline_reference,'') <> '') / nullif(count(*),0), 1)  AS pct_biblio
FROM base;

GRANT SELECT ON public.v_enrichment_progress TO authenticated;
GRANT SELECT ON public.v_enrichment_progress TO service_role;
