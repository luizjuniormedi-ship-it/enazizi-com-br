-- Sprint 2: estrutura de apoio ao backfill incremental de classificação hierárquica
-- Não altera topic/subtopic textuais existentes; só adiciona auditoria e fila de revisão

-- =============================================================================
-- 1) Colunas auxiliares de auditoria nas tabelas-alvo
-- =============================================================================

ALTER TABLE public.questions_bank
  ADD COLUMN IF NOT EXISTS classification_confidence numeric,
  ADD COLUMN IF NOT EXISTS classification_method text,
  ADD COLUMN IF NOT EXISTS classification_reviewed_by_human boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS classified_at timestamptz;

ALTER TABLE public.real_exam_questions
  ADD COLUMN IF NOT EXISTS classification_confidence numeric,
  ADD COLUMN IF NOT EXISTS classification_method text,
  ADD COLUMN IF NOT EXISTS classification_reviewed_by_human boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS classified_at timestamptz;

-- Constraints de domínio para classification_method
ALTER TABLE public.questions_bank
  DROP CONSTRAINT IF EXISTS questions_bank_classification_method_check;
ALTER TABLE public.questions_bank
  ADD CONSTRAINT questions_bank_classification_method_check
  CHECK (classification_method IS NULL OR classification_method IN ('exact_text','heuristic','ai','manual'));

ALTER TABLE public.real_exam_questions
  DROP CONSTRAINT IF EXISTS real_exam_questions_classification_method_check;
ALTER TABLE public.real_exam_questions
  ADD CONSTRAINT real_exam_questions_classification_method_check
  CHECK (classification_method IS NULL OR classification_method IN ('exact_text','heuristic','ai','manual'));

-- Índices úteis para queries de progresso
CREATE INDEX IF NOT EXISTS idx_qb_classification_status
  ON public.questions_bank (classification_method, classification_confidence)
  WHERE specialty_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_req_classification_status
  ON public.real_exam_questions (classification_method, classification_confidence)
  WHERE specialty_id IS NOT NULL;

-- =============================================================================
-- 2) Tabela de runs (lote/execução)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.question_classification_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_source text NOT NULL CHECK (table_source IN ('questions_bank','real_exam_questions')),
  batch_size integer NOT NULL,
  dry_run boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','rolled_back')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  triggered_by uuid,
  total_processed integer NOT NULL DEFAULT 0,
  total_applied integer NOT NULL DEFAULT 0,
  total_queued_review integer NOT NULL DEFAULT 0,
  total_skipped integer NOT NULL DEFAULT 0,
  method_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_classification_runs_started ON public.question_classification_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_classification_runs_status ON public.question_classification_runs (status);

ALTER TABLE public.question_classification_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view classification runs"
  ON public.question_classification_runs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages classification runs"
  ON public.question_classification_runs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- =============================================================================
-- 3) Fila de revisão para classificações de baixa/média confiança
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.question_classification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.question_classification_runs(id) ON DELETE SET NULL,
  table_source text NOT NULL CHECK (table_source IN ('questions_bank','real_exam_questions')),
  question_id uuid NOT NULL,

  -- snapshot do texto original (para auditoria)
  original_topic text,
  original_subtopic text,

  -- sugestões da classificação automática
  suggested_specialty_id uuid REFERENCES public.curriculum_specialties(id) ON DELETE SET NULL,
  suggested_topic_id uuid REFERENCES public.curriculum_topics(id) ON DELETE SET NULL,
  suggested_subtopic_id uuid REFERENCES public.curriculum_subtopics(id) ON DELETE SET NULL,
  suggested_microtopic_id uuid REFERENCES public.curriculum_microtopics(id) ON DELETE SET NULL,

  classification_method text NOT NULL CHECK (classification_method IN ('exact_text','heuristic','ai')),
  confidence_score numeric NOT NULL,
  reason text,

  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','superseded')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Não duplicar entradas pendentes para a mesma questão
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_queue_per_question
  ON public.question_classification_queue (table_source, question_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_class_queue_status ON public.question_classification_queue (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_class_queue_run ON public.question_classification_queue (run_id);
CREATE INDEX IF NOT EXISTS idx_class_queue_confidence ON public.question_classification_queue (confidence_score);

ALTER TABLE public.question_classification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view classification queue"
  ON public.question_classification_queue FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update classification queue"
  ON public.question_classification_queue FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages classification queue"
  ON public.question_classification_queue FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_class_queue_updated_at ON public.question_classification_queue;
CREATE TRIGGER trg_class_queue_updated_at
  BEFORE UPDATE ON public.question_classification_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();