-- ========================================================================
-- 1. CURRICULUM_MICROTOPICS
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.curriculum_microtopics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subtopic_id uuid NOT NULL REFERENCES public.curriculum_subtopics(id) ON DELETE CASCADE,
  nome text NOT NULL,
  slug text,
  descricao text,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_curriculum_microtopics_subtopic
  ON public.curriculum_microtopics(subtopic_id) WHERE ativo = true;

ALTER TABLE public.curriculum_microtopics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Microtopics readable by authenticated"
  ON public.curriculum_microtopics FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Microtopics admins manage"
  ON public.curriculum_microtopics FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_microtopics_updated_at
  BEFORE UPDATE ON public.curriculum_microtopics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========================================================================
-- 2. QUESTION_TOPIC_LINKS
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.question_topic_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL,
  question_source text NOT NULL CHECK (question_source IN ('questions_bank','real_exam_questions','medical_image_questions')),
  subtopic_id uuid REFERENCES public.curriculum_subtopics(id) ON DELETE CASCADE,
  microtopic_id uuid REFERENCES public.curriculum_microtopics(id) ON DELETE CASCADE,
  match_confidence numeric DEFAULT 1.0 CHECK (match_confidence >= 0 AND match_confidence <= 1),
  match_method text DEFAULT 'manual' CHECK (match_method IN ('manual','text','ai','imported')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_at_least_one_target CHECK (subtopic_id IS NOT NULL OR microtopic_id IS NOT NULL),
  CONSTRAINT uq_question_subtopic UNIQUE (question_id, question_source, subtopic_id, microtopic_id)
);

CREATE INDEX IF NOT EXISTS idx_qtl_subtopic ON public.question_topic_links(subtopic_id);
CREATE INDEX IF NOT EXISTS idx_qtl_microtopic ON public.question_topic_links(microtopic_id);
CREATE INDEX IF NOT EXISTS idx_qtl_question ON public.question_topic_links(question_id, question_source);

ALTER TABLE public.question_topic_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Question links readable by authenticated"
  ON public.question_topic_links FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Question links admins manage"
  ON public.question_topic_links FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ========================================================================
-- 3. CONTENT_COVERAGE_AUDIT
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.content_coverage_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subtopic_id uuid REFERENCES public.curriculum_subtopics(id) ON DELETE CASCADE,
  microtopic_id uuid REFERENCES public.curriculum_microtopics(id) ON DELETE CASCADE,
  scope_level text NOT NULL CHECK (scope_level IN ('subtopic','microtopic')),
  status text NOT NULL CHECK (status IN ('complete','partial','critical','missing')),
  questions_count integer NOT NULL DEFAULT 0,
  materials_count integer NOT NULL DEFAULT 0,
  flashcards_count integer NOT NULL DEFAULT 0,
  banca_coverage_count integer NOT NULL DEFAULT 0,
  importance_level text,
  rule_applied text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_audit_target CHECK (
    (scope_level = 'subtopic' AND subtopic_id IS NOT NULL) OR
    (scope_level = 'microtopic' AND microtopic_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_cca_subtopic ON public.content_coverage_audit(subtopic_id);
CREATE INDEX IF NOT EXISTS idx_cca_microtopic ON public.content_coverage_audit(microtopic_id);
CREATE INDEX IF NOT EXISTS idx_cca_status ON public.content_coverage_audit(status);
CREATE INDEX IF NOT EXISTS idx_cca_computed_at ON public.content_coverage_audit(computed_at DESC);

ALTER TABLE public.content_coverage_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coverage audit readable by authenticated"
  ON public.content_coverage_audit FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Coverage audit admins manage"
  ON public.content_coverage_audit FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ========================================================================
-- 4. CURRICULUM_WEIGHTS — extensão
-- ========================================================================
ALTER TABLE public.curriculum_weights
  ADD COLUMN IF NOT EXISTS incidence_weight numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frequency_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS importance_level text CHECK (importance_level IN ('muito_cobrado','cobrado','pouco_cobrado','raro')),
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_cw_banca_subtopic ON public.curriculum_weights(banca, subtopic_id);
CREATE INDEX IF NOT EXISTS idx_cw_importance ON public.curriculum_weights(importance_level) WHERE importance_level IS NOT NULL;