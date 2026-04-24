-- Fase 2: symptom_keywords + Fase 8: telemetry table

ALTER TABLE public.tutor_knowledge_memory
  ADD COLUMN IF NOT EXISTS symptom_keywords text[] DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_tutor_memory_symptom_keywords
  ON public.tutor_knowledge_memory USING GIN (symptom_keywords);

CREATE TABLE IF NOT EXISTS public.tutor_memory_search_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  query text NOT NULL,
  query_normalized text,
  semantic_score numeric(6,4),
  hybrid_score numeric(6,4),
  matched_memory_id uuid REFERENCES public.tutor_knowledge_memory(id) ON DELETE SET NULL,
  fallback_tier text,
  topic_overlap boolean DEFAULT false,
  symptom_overlap_count int DEFAULT 0,
  abbreviation_overlap_count int DEFAULT 0,
  duration_ms int,
  reused boolean DEFAULT false,
  created_new_memory boolean DEFAULT false,
  threshold_used numeric(4,3),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutor_memory_search_logs_created_at
  ON public.tutor_memory_search_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tutor_memory_search_logs_user
  ON public.tutor_memory_search_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tutor_memory_search_logs_tier
  ON public.tutor_memory_search_logs (fallback_tier);

ALTER TABLE public.tutor_memory_search_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read all tutor memory search logs" ON public.tutor_memory_search_logs;
CREATE POLICY "admins read all tutor memory search logs"
  ON public.tutor_memory_search_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "users read own tutor memory search logs" ON public.tutor_memory_search_logs;
CREATE POLICY "users read own tutor memory search logs"
  ON public.tutor_memory_search_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- RPC híbrida
CREATE OR REPLACE FUNCTION public.match_tutor_memory_hybrid(
  query_embedding vector(1536),
  query_topic text DEFAULT NULL,
  query_subtopic text DEFAULT NULL,
  query_symptoms text[] DEFAULT '{}'::text[],
  query_abbrev text[] DEFAULT '{}'::text[],
  match_threshold numeric DEFAULT 0.35,
  match_count int DEFAULT 8,
  user_id_filter uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  scope text,
  question_original text,
  question_normalized text,
  topic text,
  subtopic text,
  specialty text,
  intent text,
  difficulty_level text,
  answer_summary text,
  blocks jsonb,
  block_types text[],
  symptom_keywords text[],
  quality_score numeric,
  reuse_count int,
  source text,
  model_used text,
  created_at timestamptz,
  updated_at timestamptz,
  last_used_at timestamptz,
  similarity numeric,
  topic_overlap boolean,
  symptom_overlap_count int,
  abbreviation_overlap_count int,
  hybrid_score numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      m.*,
      (1 - (m.embedding <=> query_embedding))::numeric AS sim
    FROM public.tutor_knowledge_memory m
    WHERE m.embedding IS NOT NULL
      AND m.embedding_status = 'ready'
      AND (m.scope = 'global' OR (user_id_filter IS NOT NULL AND m.user_id = user_id_filter))
      AND (1 - (m.embedding <=> query_embedding))::numeric >= match_threshold
  ),
  scored AS (
    SELECT
      b.*,
      (b.topic IS NOT NULL AND query_topic IS NOT NULL
         AND lower(b.topic) = lower(query_topic)) AS t_overlap,
      COALESCE(
        (SELECT count(*)::int FROM (
           SELECT unnest(COALESCE(b.symptom_keywords, '{}'::text[]))
           INTERSECT
           SELECT unnest(COALESCE(query_symptoms, '{}'::text[]))
        ) s), 0
      ) AS s_overlap,
      COALESCE(
        (SELECT count(*)::int FROM (
           SELECT unnest(COALESCE(query_abbrev, '{}'::text[]))
           INTERSECT
           SELECT unnest(string_to_array(lower(coalesce(b.question_normalized, '')), ' '))
        ) s), 0
      ) AS a_overlap
    FROM base b
  )
  SELECT
    s.id,
    s.user_id,
    s.scope::text,
    s.question_original,
    s.question_normalized,
    s.topic,
    s.subtopic,
    s.specialty,
    s.intent,
    s.difficulty_level,
    s.answer_summary,
    s.blocks,
    s.block_types,
    COALESCE(s.symptom_keywords, '{}'::text[]),
    s.quality_score,
    s.reuse_count,
    s.source,
    s.model_used,
    s.created_at,
    s.updated_at,
    s.last_used_at,
    s.sim AS similarity,
    s.t_overlap AS topic_overlap,
    s.s_overlap AS symptom_overlap_count,
    s.a_overlap AS abbreviation_overlap_count,
    LEAST(1.0, (
      0.55 * s.sim
      + 0.20 * (CASE WHEN s.t_overlap THEN 1 ELSE 0 END)
      + 0.15 * LEAST(1.0, s.s_overlap::numeric / 3.0)
      + 0.10 * LEAST(1.0, s.a_overlap::numeric / 2.0)
    ))::numeric AS hybrid_score
  FROM scored s
  ORDER BY hybrid_score DESC, similarity DESC
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_tutor_memory_hybrid(
  vector, text, text, text[], text[], numeric, int, uuid
) TO authenticated, anon;
