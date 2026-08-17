-- Staging contract for questions extracted from validated official Drive exams.
ALTER TABLE public.questions_bank
  ADD COLUMN IF NOT EXISTS provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_queue_id uuid REFERENCES public.drive_corpus_queue(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_document_checksum text,
  ADD COLUMN IF NOT EXISTS source_question_hash text,
  ADD COLUMN IF NOT EXISTS source_question_number integer;

ALTER TABLE public.drive_corpus_queue
  ADD COLUMN IF NOT EXISTS questions_count integer;

CREATE UNIQUE INDEX IF NOT EXISTS questions_bank_drive_source_question_uniq
  ON public.questions_bank (
    source_document_checksum,
    source_question_hash,
    ingestion_version
  );

CREATE INDEX IF NOT EXISTS questions_bank_drive_review_queue_idx
  ON public.questions_bank (source_queue_id, created_at DESC)
  WHERE source_type = 'official_exam_drive'
    AND lifecycle_state = 'quarantined'
    AND review_status = 'needs_review'
    AND approved_for_generation IS FALSE;

CREATE OR REPLACE FUNCTION public.enforce_official_drive_question_staging()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.source_type = 'official_exam_drive'
     AND NEW.source_type IS DISTINCT FROM 'official_exam_drive' THEN
    RAISE EXCEPTION 'OFFICIAL_DRIVE_SOURCE_TYPE_IMMUTABLE';
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.source_type = 'official_exam_drive'
     AND (
       NEW.statement IS DISTINCT FROM OLD.statement
       OR NEW.options IS DISTINCT FROM OLD.options
       OR NEW.correct_index IS DISTINCT FROM OLD.correct_index
       OR NEW.board IS DISTINCT FROM OLD.board
     ) THEN
    RAISE EXCEPTION 'OFFICIAL_DRIVE_CONTENT_IMMUTABLE';
  END IF;

  IF NEW.source_type IS DISTINCT FROM 'official_exam_drive' THEN
    RETURN NEW;
  END IF;

  IF NEW.source_queue_id IS NULL
     OR NEW.source_document_checksum IS NULL
     OR NEW.source_question_hash IS NULL
     OR NEW.source_url IS NULL
     OR NEW.ingestion_version IS NULL
     OR NEW.permission_type IS DISTINCT FROM 'official_public'
     OR COALESCE(NEW.provenance->>'drive_file_id', '') = ''
     OR COALESCE(NEW.provenance->>'answer_key_url', '') = ''
     OR COALESCE(NEW.provenance->>'answer_key_checksum_sha256', '') = ''
     OR COALESCE(NEW.provenance->>'rights_evidence_url', '') = '' THEN
    RAISE EXCEPTION 'OFFICIAL_DRIVE_PROVENANCE_REQUIRED';
  END IF;

  IF TG_OP = 'INSERT' AND (
    NEW.lifecycle_state IS DISTINCT FROM 'quarantined'
    OR NEW.review_status IS DISTINCT FROM 'needs_review'
    OR NEW.approved_for_generation IS DISTINCT FROM FALSE
  ) THEN
    RAISE EXCEPTION 'OFFICIAL_DRIVE_QUESTION_MUST_ENTER_QUARANTINE';
  END IF;

  IF (NEW.approved_for_generation IS TRUE OR NEW.lifecycle_state IS DISTINCT FROM 'quarantined')
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
    RAISE EXCEPTION 'OFFICIAL_DRIVE_EDITORIAL_APPROVAL_REQUIRED';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_official_drive_question_staging()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_official_drive_question_staging_trigger
  ON public.questions_bank;
CREATE TRIGGER enforce_official_drive_question_staging_trigger
  BEFORE INSERT OR UPDATE OF source_type, source_queue_id, source_document_checksum,
    source_question_hash, source_url, ingestion_version, permission_type,
    provenance, lifecycle_state, review_status, approved_for_generation,
    statement, options, correct_index, board
  ON public.questions_bank
  FOR EACH ROW EXECUTE FUNCTION public.enforce_official_drive_question_staging();
