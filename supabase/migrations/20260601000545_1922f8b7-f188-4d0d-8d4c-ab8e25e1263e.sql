-- Sprint Gold-1: Gold Dataset Metadata

CREATE TYPE public.gold_status_enum AS ENUM (
  'pending','needs_review','approved','gold','rejected'
);

CREATE TYPE public.quality_score_source_enum AS ENUM (
  'heuristic','ai','manual','hybrid'
);

CREATE TABLE public.gold_questions_metadata (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL UNIQUE REFERENCES public.questions_bank(id) ON DELETE CASCADE,
  gold_status public.gold_status_enum NOT NULL DEFAULT 'pending',
  quality_score INTEGER CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 100)),
  quality_score_source public.quality_score_source_enum,
  quality_score_computed_at TIMESTAMPTZ,
  review_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  promoted_to_gold_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gold_questions_metadata TO authenticated;
GRANT ALL ON public.gold_questions_metadata TO service_role;

ALTER TABLE public.gold_questions_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and professor can read gold metadata"
ON public.gold_questions_metadata FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'professor'));

CREATE POLICY "Admin and professor can insert gold metadata"
ON public.gold_questions_metadata FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'professor'));

CREATE POLICY "Admin and professor can update gold metadata"
ON public.gold_questions_metadata FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'professor'));

CREATE POLICY "Only admin can delete gold metadata"
ON public.gold_questions_metadata FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER update_gold_questions_metadata_updated_at
BEFORE UPDATE ON public.gold_questions_metadata
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.mark_gold_promotion()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.gold_status = 'gold' AND (OLD.gold_status IS NULL OR OLD.gold_status <> 'gold') THEN
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

CREATE INDEX idx_gold_metadata_status ON public.gold_questions_metadata(gold_status);
CREATE INDEX idx_gold_metadata_quality_score ON public.gold_questions_metadata(quality_score DESC NULLS LAST);
CREATE INDEX idx_gold_metadata_reviewed_by ON public.gold_questions_metadata(reviewed_by);
CREATE INDEX idx_gold_metadata_status_score ON public.gold_questions_metadata(gold_status, quality_score DESC NULLS LAST);

INSERT INTO public.gold_questions_metadata (question_id, gold_status)
SELECT id, 'pending'::public.gold_status_enum
FROM public.questions_bank
WHERE classification_method IS NOT NULL
ON CONFLICT (question_id) DO NOTHING;

COMMENT ON TABLE public.gold_questions_metadata IS 'Gold Dataset: camada de qualidade/curadoria sobre questoes_bank ja classificadas. NAO e fila de classificacao.';
COMMENT ON COLUMN public.gold_questions_metadata.quality_score IS 'Score inicial/operacional (0-100). NAO e verdade absoluta — heuristica + curadoria + dados reais + IA futura.';
COMMENT ON COLUMN public.gold_questions_metadata.gold_status IS 'Fluxo: pending -> needs_review/approved -> gold ou rejected.';