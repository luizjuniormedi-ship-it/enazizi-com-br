-- Fail-closed editorial barrier for canonical question promotion.
-- AI/import pipelines may propose quality, but only an identified editorial
-- review can authorize GOLD + approved + approved_for_generation.

CREATE OR REPLACE FUNCTION public.enforce_gold_editorial_evidence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.gold_status = 'ouro' THEN
    IF NEW.reviewed_by IS NULL
       OR COALESCE(NEW.quality_score_method, '') NOT IN ('manual', 'hybrid')
       OR length(trim(COALESCE(NEW.review_notes, ''))) < 20 THEN
      RAISE EXCEPTION 'EDITORIAL_EVIDENCE_REQUIRED: reviewer, manual/hybrid method and review notes are mandatory';
    END IF;
    NEW.reviewed_at = COALESCE(NEW.reviewed_at, now());
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_gold_editorial_evidence() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_gold_editorial_evidence_trigger ON public.gold_questions_metadata;
CREATE TRIGGER enforce_gold_editorial_evidence_trigger
BEFORE INSERT OR UPDATE OF gold_status, reviewed_by, quality_score_method, review_notes
ON public.gold_questions_metadata
FOR EACH ROW EXECUTE FUNCTION public.enforce_gold_editorial_evidence();

CREATE OR REPLACE FUNCTION public.log_gold_editorial_evidence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.gold_status = 'ouro' AND (TG_OP = 'INSERT' OR OLD.gold_status IS DISTINCT FROM 'ouro') THEN
    INSERT INTO public.pipeline_governance (
      pipeline_name, function_name, status, user_id, quality_score, completed_at, metadata
    ) VALUES (
      'question-review-pipeline', 'editorial-gold-promotion', 'editorial_approved',
      NEW.reviewed_by, NEW.quality_score, now(),
      jsonb_build_object(
        'question_id', NEW.question_id,
        'question_source', NEW.question_source,
        'editorial_evidence', true,
        'reviewed_at', NEW.reviewed_at,
        'quality_score_method', NEW.quality_score_method
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_gold_editorial_evidence() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS log_gold_editorial_evidence_trigger ON public.gold_questions_metadata;
CREATE TRIGGER log_gold_editorial_evidence_trigger
AFTER INSERT OR UPDATE OF gold_status
ON public.gold_questions_metadata
FOR EACH ROW EXECUTE FUNCTION public.log_gold_editorial_evidence();

CREATE OR REPLACE FUNCTION public.enforce_question_generation_editorial_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF upper(COALESCE(NEW.quality_tier, '')) IN ('GOLD', 'GOLDEN')
     AND NEW.review_status = 'approved'
     AND NEW.approved_for_generation IS TRUE
     AND NOT EXISTS (
       SELECT 1
       FROM public.gold_questions_metadata g
       WHERE g.question_id = NEW.id
         AND g.question_source = 'questions_bank'
         AND g.gold_status = 'ouro'
         AND g.reviewed_by IS NOT NULL
         AND g.reviewed_at IS NOT NULL
         AND g.quality_score_method IN ('manual', 'hybrid')
         AND length(trim(COALESCE(g.review_notes, ''))) >= 20
     ) THEN
    RAISE EXCEPTION 'EDITORIAL_EVIDENCE_REQUIRED: GOLD questions cannot be approved for generation without editorial review';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_question_generation_editorial_gate() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_question_generation_editorial_gate_trigger ON public.questions_bank;
CREATE TRIGGER enforce_question_generation_editorial_gate_trigger
BEFORE INSERT OR UPDATE OF quality_tier, review_status, approved_for_generation
ON public.questions_bank
FOR EACH ROW EXECUTE FUNCTION public.enforce_question_generation_editorial_gate();