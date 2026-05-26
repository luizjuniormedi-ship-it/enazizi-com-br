
-- ============================================================
-- Memory Governance Layer v22.1
-- ============================================================

-- 1) Novos campos em tutor_knowledge_memory
ALTER TABLE public.tutor_knowledge_memory
  ADD COLUMN IF NOT EXISTS cognitive_stage     text,
  ADD COLUMN IF NOT EXISTS teaching_mode       text,
  ADD COLUMN IF NOT EXISTS target_profile      jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS promotion_status    text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS reuse_success_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reuse_failure_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hallucination_flag  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS decay_score         numeric NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS last_validated_at   timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS pedagogical_depth   smallint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_bibliography    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS language_purity     boolean NOT NULL DEFAULT true;

ALTER TABLE public.tutor_knowledge_memory
  DROP CONSTRAINT IF EXISTS tutor_memory_promotion_status_chk;
ALTER TABLE public.tutor_knowledge_memory
  ADD CONSTRAINT tutor_memory_promotion_status_chk
    CHECK (promotion_status IN ('draft','validated','promoted','canonical','quarantined'));

CREATE INDEX IF NOT EXISTS idx_tutor_memory_promotion_status
  ON public.tutor_knowledge_memory(promotion_status);
CREATE INDEX IF NOT EXISTS idx_tutor_memory_decay
  ON public.tutor_knowledge_memory(decay_score DESC);
CREATE INDEX IF NOT EXISTS idx_tutor_memory_cognitive_stage
  ON public.tutor_knowledge_memory(cognitive_stage);

-- 2) Feedback do aluno
CREATE TABLE IF NOT EXISTS public.tutor_memory_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id uuid NOT NULL REFERENCES public.tutor_knowledge_memory(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  feedback text NOT NULL CHECK (feedback IN ('up','down','hallucination')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tutor_memory_feedback_memory ON public.tutor_memory_feedback(memory_id);
CREATE INDEX IF NOT EXISTS idx_tutor_memory_feedback_user ON public.tutor_memory_feedback(user_id);

ALTER TABLE public.tutor_memory_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can view their own memory feedback" ON public.tutor_memory_feedback;
CREATE POLICY "users can view their own memory feedback"
  ON public.tutor_memory_feedback FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can insert their own memory feedback" ON public.tutor_memory_feedback;
CREATE POLICY "users can insert their own memory feedback"
  ON public.tutor_memory_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 3) Métricas diárias de governança
CREATE TABLE IF NOT EXISTS public.memory_governance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day date NOT NULL UNIQUE,
  total_lookups integer NOT NULL DEFAULT 0,
  exact_hits integer NOT NULL DEFAULT 0,
  semantic_hits integer NOT NULL DEFAULT 0,
  rag_hits integer NOT NULL DEFAULT 0,
  openai_calls integer NOT NULL DEFAULT 0,
  saves integer NOT NULL DEFAULT 0,
  rejected_saves integer NOT NULL DEFAULT 0,
  feedback_up integer NOT NULL DEFAULT 0,
  feedback_down integer NOT NULL DEFAULT 0,
  feedback_halluc integer NOT NULL DEFAULT 0,
  quarantined_total integer NOT NULL DEFAULT 0,
  poisoning_rate numeric NOT NULL DEFAULT 0,
  hit_rate numeric NOT NULL DEFAULT 0,
  cost_saved_usd numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.memory_governance_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins can view memory governance metrics" ON public.memory_governance_metrics;
CREATE POLICY "admins can view memory governance metrics"
  ON public.memory_governance_metrics FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- 4) RPC: registrar feedback + efeito automático
CREATE OR REPLACE FUNCTION public.tutor_memory_register_feedback(
  _memory_id uuid,
  _user_id uuid,
  _feedback text,
  _note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF _feedback NOT IN ('up','down','hallucination') THEN
    RAISE EXCEPTION 'invalid feedback';
  END IF;

  INSERT INTO public.tutor_memory_feedback(memory_id, user_id, feedback, note)
  VALUES (_memory_id, _user_id, _feedback, _note);

  IF _feedback = 'up' THEN
    UPDATE public.tutor_knowledge_memory
      SET reuse_success_count = reuse_success_count + 1,
          decay_score = LEAST(1.0, decay_score + 0.05),
          updated_at = now()
      WHERE id = _memory_id;
  ELSIF _feedback = 'down' THEN
    UPDATE public.tutor_knowledge_memory
      SET reuse_failure_count = reuse_failure_count + 1,
          decay_score = GREATEST(0, decay_score - 0.15),
          updated_at = now()
      WHERE id = _memory_id;
  ELSIF _feedback = 'hallucination' THEN
    UPDATE public.tutor_knowledge_memory
      SET hallucination_flag = true,
          promotion_status = 'quarantined',
          decay_score = 0,
          updated_at = now()
      WHERE id = _memory_id;
  END IF;
END;
$$;

-- 5) RPC: promoção / decay (rodada por cron)
CREATE OR REPLACE FUNCTION public.tutor_memory_run_promotion_cycle()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_promoted int := 0;
  v_validated int := 0;
  v_canonical int := 0;
  v_decayed int := 0;
BEGIN
  -- decay por idade desde última validação
  UPDATE public.tutor_knowledge_memory
  SET decay_score = GREATEST(0,
        1.0
        - LEAST(1.0, EXTRACT(EPOCH FROM (now() - COALESCE(last_validated_at, created_at))) / (60*60*24*180))
        - (reuse_failure_count * 0.1)
      )
  WHERE promotion_status <> 'quarantined';
  GET DIAGNOSTICS v_decayed = ROW_COUNT;

  -- draft -> validated: 3 reuses bem-sucedidos, sem falhas, decay > 0.6
  UPDATE public.tutor_knowledge_memory
  SET promotion_status = 'validated', last_validated_at = now()
  WHERE promotion_status = 'draft'
    AND reuse_success_count >= 3
    AND reuse_failure_count = 0
    AND decay_score > 0.6
    AND quality_score >= 0.80;
  GET DIAGNOSTICS v_validated = ROW_COUNT;

  -- validated -> promoted: 10 reuses bem-sucedidos
  UPDATE public.tutor_knowledge_memory
  SET promotion_status = 'promoted', last_validated_at = now()
  WHERE promotion_status = 'validated'
    AND reuse_success_count >= 10
    AND reuse_failure_count <= 1
    AND decay_score > 0.7
    AND quality_score >= 0.85;
  GET DIAGNOSTICS v_promoted = ROW_COUNT;

  -- promoted -> canonical: 30 reuses limpos
  UPDATE public.tutor_knowledge_memory
  SET promotion_status = 'canonical', last_validated_at = now()
  WHERE promotion_status = 'promoted'
    AND reuse_success_count >= 30
    AND reuse_failure_count <= 2
    AND decay_score > 0.8;
  GET DIAGNOSTICS v_canonical = ROW_COUNT;

  RETURN jsonb_build_object(
    'decayed', v_decayed,
    'validated', v_validated,
    'promoted', v_promoted,
    'canonical', v_canonical,
    'run_at', now()
  );
END;
$$;

-- 6) RPC atualizada de match: filtra quarentena + ordena por promoção/decay
CREATE OR REPLACE FUNCTION public.match_tutor_memory_hybrid(
  query_embedding extensions.vector(1536),
  query_topic text,
  query_subtopic text,
  query_symptoms text[],
  query_abbrev text[],
  match_threshold double precision,
  match_count integer,
  user_id_filter uuid,
  cognitive_stage_filter text DEFAULT NULL,
  difficulty_filter text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  question_original text,
  answer_summary text,
  blocks jsonb,
  topic text,
  subtopic text,
  specialty text,
  quality_score numeric,
  reuse_count integer,
  scope text,
  source text,
  promotion_status text,
  decay_score numeric,
  cognitive_stage text,
  difficulty_level text,
  similarity double precision
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id, t.question_original, t.answer_summary, t.blocks, t.topic, t.subtopic,
    t.specialty, t.quality_score, t.reuse_count, t.scope, t.source,
    t.promotion_status, t.decay_score, t.cognitive_stage, t.difficulty_level,
    (1 - (t.embedding <=> query_embedding))::double precision AS similarity
  FROM public.tutor_knowledge_memory t
  WHERE t.embedding IS NOT NULL
    AND t.promotion_status <> 'quarantined'
    AND t.hallucination_flag = false
    AND t.decay_score > 0.3
    AND (t.scope = 'global' OR (user_id_filter IS NOT NULL AND t.user_id = user_id_filter))
    AND (cognitive_stage_filter IS NULL OR t.cognitive_stage IS NULL OR t.cognitive_stage = cognitive_stage_filter)
    AND (difficulty_filter IS NULL OR t.difficulty_level IS NULL OR t.difficulty_level = difficulty_filter)
    AND (1 - (t.embedding <=> query_embedding)) >= match_threshold
  ORDER BY
    CASE t.promotion_status
      WHEN 'canonical' THEN 4
      WHEN 'promoted'  THEN 3
      WHEN 'validated' THEN 2
      WHEN 'draft'     THEN 1
      ELSE 0
    END DESC,
    (1 - (t.embedding <=> query_embedding)) DESC,
    t.decay_score DESC,
    t.quality_score DESC
  LIMIT match_count;
END;
$$;

-- 7) RPC para incrementar métricas diárias (chamada pelas edge functions)
CREATE OR REPLACE FUNCTION public.memory_metrics_increment(
  _day date,
  _field text,
  _delta integer DEFAULT 1
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.memory_governance_metrics(day) VALUES (_day)
  ON CONFLICT (day) DO NOTHING;

  EXECUTE format(
    'UPDATE public.memory_governance_metrics SET %I = %I + $1, updated_at = now() WHERE day = $2',
    _field, _field
  ) USING _delta, _day;
END;
$$;
