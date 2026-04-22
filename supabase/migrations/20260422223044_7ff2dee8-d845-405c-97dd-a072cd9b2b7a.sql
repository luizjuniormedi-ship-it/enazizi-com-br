-- ─────────────────────────────────────────────────────────────────────
-- Sprint 5 — Observabilidade & Telemetria do Gerador
-- Estende a tabela existente granular_generator_runs (Sprint 4) sem
-- quebrar nada já gravado. Todas as colunas são NULLABLE.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.granular_generator_runs
  ADD COLUMN IF NOT EXISTS user_profile      text,
  ADD COLUMN IF NOT EXISTS generation_mode   text,
  ADD COLUMN IF NOT EXISTS batch_count       integer,
  ADD COLUMN IF NOT EXISTS batch_error_rate  numeric(5,4),
  ADD COLUMN IF NOT EXISTS ab_bucket         text
    CHECK (ab_bucket IS NULL OR ab_bucket IN ('bucket_a','bucket_b'));

CREATE INDEX IF NOT EXISTS idx_ggr_pipeline_created
  ON public.granular_generator_runs (pipeline_used, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ggr_banca_created
  ON public.granular_generator_runs (banca, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ggr_ab_bucket
  ON public.granular_generator_runs (ab_bucket, created_at DESC)
  WHERE ab_bucket IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- View agregada para o painel admin (últimos 14 dias)
-- security_invoker: respeita as policies da tabela base.
-- ─────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.v_generator_telemetry_summary;

CREATE VIEW public.v_generator_telemetry_summary
WITH (security_invoker = true) AS
SELECT
  pipeline_used,
  COALESCE(banca, 'sem_banca')                AS banca,
  COALESCE(user_profile, 'sem_perfil')        AS user_profile,
  COALESCE(generation_mode, 'sem_modo')       AS generation_mode,
  COALESCE(ab_bucket, 'sem_bucket')           AS ab_bucket,
  COUNT(*)                                                                  AS total_runs,
  COUNT(*) FILTER (WHERE status = 'success')                                 AS success_runs,
  COUNT(*) FILTER (WHERE status = 'error')                                   AS error_runs,
  COUNT(*) FILTER (WHERE fallback_triggered = true)                          AS fallback_runs,
  ROUND(AVG(duration_ms)::numeric, 0)                                        AS avg_duration_ms,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE fallback_triggered = true)
        / NULLIF(COUNT(*), 0)::numeric, 2)                                   AS fallback_rate_pct,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'error')
        / NULLIF(COUNT(*), 0)::numeric, 2)                                   AS error_rate_pct,
  ROUND(AVG(batch_error_rate) FILTER (WHERE batch_error_rate IS NOT NULL)::numeric, 4)
                                                                             AS avg_batch_error_rate,
  SUM(generated_count)                                                       AS total_questions_generated,
  MAX(created_at)                                                            AS last_run_at
FROM public.granular_generator_runs
WHERE created_at > now() - interval '14 days'
GROUP BY pipeline_used, banca, user_profile, generation_mode, ab_bucket;

COMMENT ON VIEW public.v_generator_telemetry_summary IS
  'Sprint 5 — agregação de telemetria do gerador (últimos 14 dias). Usada pelo painel /admin/generator-telemetry.';