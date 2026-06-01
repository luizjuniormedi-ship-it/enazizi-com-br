-- Reset: tabela tem apenas backfill em 'pending', nenhuma curadoria feita
DROP TABLE IF EXISTS public.gold_questions_metadata CASCADE;
DROP TYPE IF EXISTS public.gold_status_enum CASCADE;
DROP TYPE IF EXISTS public.quality_score_source_enum CASCADE;

-- Tabela final (text + check, conforme spec)
CREATE TABLE public.gold_questions_metadata (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL,
  question_source TEXT NOT NULL CHECK (question_source IN ('questions_bank','real_exam_questions')),
  gold_status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (gold_status IN ('pendente','aprovado','ouro','rejeitado','precisa_revisao')),
  quality_score NUMERIC CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 100)),
  quality_score_method TEXT DEFAULT 'heuristic'
    CHECK (quality_score_method IN ('manual','heuristic','ai','hybrid')),
  quality_score_computed_at TIMESTAMPTZ,
  clinical_reasoning_level TEXT,
  evidence_level TEXT,
  source_type TEXT,
  review_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  promoted_to_gold_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (question_id, question_source)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gold_questions_metadata TO authenticated;
GRANT ALL ON public.gold_questions_metadata TO service_role;

ALTER TABLE public.gold_questions_metadata ENABLE ROW LEVEL SECURITY;

-- Admin: tudo
CREATE POLICY "Admin full access gold metadata"
ON public.gold_questions_metadata FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Professor: leitura
CREATE POLICY "Professor can read gold metadata"
ON public.gold_questions_metadata FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'professor'));

-- Professor: update (apenas review_notes + sugerir 'precisa_revisao')
-- Restrição completa de colunas é feita na UI/edge; aqui garantimos que professor não exclui
CREATE POLICY "Professor can update gold metadata notes"
ON public.gold_questions_metadata FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'professor'))
WITH CHECK (public.has_role(auth.uid(),'professor'));

-- Triggers
CREATE TRIGGER update_gold_questions_metadata_updated_at
BEFORE UPDATE ON public.gold_questions_metadata
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.mark_gold_promotion()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.gold_status = 'ouro' AND (OLD.gold_status IS NULL OR OLD.gold_status <> 'ouro') THEN
    NEW.promoted_to_gold_at = now();
  END IF;
  IF NEW.reviewed_by IS NOT NULL AND NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by THEN
    NEW.reviewed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mark_gold_promotion_trigger
BEFORE UPDATE ON public.gold_questions_metadata
FOR EACH ROW EXECUTE FUNCTION public.mark_gold_promotion();

-- Índices
CREATE INDEX idx_gold_meta_status ON public.gold_questions_metadata(gold_status);
CREATE INDEX idx_gold_meta_source ON public.gold_questions_metadata(question_source);
CREATE INDEX idx_gold_meta_score ON public.gold_questions_metadata(quality_score DESC NULLS LAST);
CREATE INDEX idx_gold_meta_reviewer ON public.gold_questions_metadata(reviewed_by);
CREATE INDEX idx_gold_meta_qid_src ON public.gold_questions_metadata(question_id, question_source);

-- Backfill: questões já processadas em questions_bank (classification_method IS NOT NULL)
INSERT INTO public.gold_questions_metadata (question_id, question_source, gold_status)
SELECT id, 'questions_bank', 'pendente'
FROM public.questions_bank
WHERE classification_method IS NOT NULL
ON CONFLICT (question_id, question_source) DO NOTHING;

COMMENT ON TABLE public.gold_questions_metadata IS 'Gold Dataset: camada de qualidade/curadoria. NAO e fila de classificacao. Entram apenas questoes ja classificadas ou skipped.';
COMMENT ON COLUMN public.gold_questions_metadata.quality_score IS 'Score inicial/operacional (0-100). NAO e verdade absoluta — heuristica + curadoria + dados reais + IA futura.';