-- Fail-closed governance and atomic worker claims for the existing Drive corpus queue.
ALTER TABLE public.drive_corpus_queue
  ADD COLUMN IF NOT EXISTS source_root_id text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS source_purpose text NOT NULL DEFAULT 'unclassified',
  ADD COLUMN IF NOT EXISTS rights_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS rights_evidence_url text,
  ADD COLUMN IF NOT EXISTS answer_key_url text,
  ADD COLUMN IF NOT EXISTS source_checksum_sha256 text,
  ADD COLUMN IF NOT EXISTS ingestion_review_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by uuid,
  ADD COLUMN IF NOT EXISTS lease_until timestamptz,
  ADD COLUMN IF NOT EXISTS attempt_id uuid,
  ADD COLUMN IF NOT EXISTS processing_phase text,
  ADD COLUMN IF NOT EXISTS duplicate_of_queue_id uuid REFERENCES public.drive_corpus_queue(id),
  ADD COLUMN IF NOT EXISTS provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ingestion_version text NOT NULL DEFAULT 'drive-corpus-v2';

ALTER TABLE public.drive_corpus_queue
  DROP CONSTRAINT IF EXISTS drive_corpus_queue_status_check;

ALTER TABLE public.drive_corpus_queue
  ADD CONSTRAINT drive_corpus_queue_status_check CHECK (status IN (
    'pending', 'blocked', 'ready', 'processing', 'retry_wait',
    'staged', 'completed', 'failed', 'skipped', 'duplicate'
  ));

ALTER TABLE public.drive_corpus_queue
  ADD CONSTRAINT drive_corpus_queue_source_kind_check
  CHECK (source_kind IN ('official_public', 'commercial', 'unknown'));

ALTER TABLE public.drive_corpus_queue
  ADD CONSTRAINT drive_corpus_queue_source_purpose_check
  CHECK (source_purpose IN ('official_exam', 'clinical_reference', 'unclassified'));

ALTER TABLE public.drive_corpus_queue
  ADD CONSTRAINT drive_corpus_queue_rights_status_check
  CHECK (rights_status IN ('unverified', 'official_public', 'licensed', 'blocked'));

ALTER TABLE public.drive_corpus_queue
  ADD CONSTRAINT drive_corpus_queue_review_status_check
  CHECK (ingestion_review_status IN ('pending', 'approved', 'rejected'));

-- Existing rows did not capture provenance, rights, answer keys or a review.
-- They must not remain claimable after this migration.
UPDATE public.drive_corpus_queue
SET status = 'blocked',
    skip_reason = COALESCE(skip_reason, 'provenance_review_required'),
    next_retry_at = NULL,
    locked_at = NULL,
    locked_by = NULL,
    lease_until = NULL,
    attempt_id = NULL,
    processing_phase = NULL
WHERE status IN ('pending', 'processing', 'failed', 'completed');

CREATE UNIQUE INDEX IF NOT EXISTS drive_corpus_queue_source_checksum_version_uniq
  ON public.drive_corpus_queue (source_checksum_sha256, ingestion_version)
  WHERE source_checksum_sha256 IS NOT NULL
    AND status <> 'duplicate';

CREATE INDEX IF NOT EXISTS drive_corpus_queue_claim_idx
  ON public.drive_corpus_queue (next_retry_at, created_at)
  WHERE status IN ('ready', 'retry_wait') AND retry_count < 3;

CREATE INDEX IF NOT EXISTS drive_corpus_queue_expired_lease_idx
  ON public.drive_corpus_queue (lease_until)
  WHERE status = 'processing' AND retry_count < 3;

CREATE OR REPLACE FUNCTION public.enforce_drive_corpus_ready_gate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IN ('ready', 'processing', 'retry_wait', 'staged', 'completed') AND (
    NEW.source_kind <> 'official_public'
    OR NEW.rights_status NOT IN ('official_public', 'licensed')
    OR NEW.rights_evidence_url IS NULL
    OR (NEW.source_purpose = 'official_exam' AND NEW.answer_key_url IS NULL)
    OR NEW.ingestion_review_status <> 'approved'
    OR NEW.reviewed_by IS NULL
    OR NEW.reviewed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Drive queue source evidence and ingestion review are incomplete';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_drive_corpus_ready_gate_trigger
  ON public.drive_corpus_queue;
CREATE TRIGGER enforce_drive_corpus_ready_gate_trigger
  BEFORE INSERT OR UPDATE OF status, source_kind, rights_status,
    rights_evidence_url, answer_key_url, ingestion_review_status, reviewed_by, reviewed_at
  ON public.drive_corpus_queue
  FOR EACH ROW EXECUTE FUNCTION public.enforce_drive_corpus_ready_gate();

CREATE OR REPLACE FUNCTION public.claim_drive_corpus_jobs(
  p_worker_id uuid,
  p_limit integer DEFAULT 1
)
RETURNS SETOF public.drive_corpus_queue
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT q.id
    FROM public.drive_corpus_queue q
    WHERE (
        (q.status IN ('ready', 'retry_wait') AND (q.next_retry_at IS NULL OR q.next_retry_at <= now()))
        OR (q.status = 'processing' AND q.lease_until <= now())
      )
      AND q.retry_count < 3
      AND q.source_kind = 'official_public'
      AND q.source_purpose = 'official_exam'
      AND q.rights_status IN ('official_public', 'licensed')
      AND q.rights_evidence_url IS NOT NULL
      AND q.answer_key_url IS NOT NULL
      AND q.ingestion_review_status = 'approved'
      AND q.reviewed_by IS NOT NULL
      AND q.reviewed_at IS NOT NULL
    ORDER BY q.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(p_limit, 1), 2)
  )
  UPDATE public.drive_corpus_queue q
  SET status = 'processing',
      retry_count = q.retry_count + 1,
      locked_at = now(),
      locked_by = p_worker_id,
      lease_until = now() + interval '10 minutes',
      attempt_id = gen_random_uuid(),
      processing_phase = 'claimed',
      error_message = NULL
  FROM candidates c
  WHERE q.id = c.id
  RETURNING q.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_drive_corpus_jobs(uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_drive_corpus_jobs(uuid, integer)
  TO service_role;

ALTER TABLE public.rag_documents
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_purpose text NOT NULL DEFAULT 'unclassified',
  ADD COLUMN IF NOT EXISTS source_checksum_sha256 text,
  ADD COLUMN IF NOT EXISTS rights_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS answer_key_url text,
  ADD COLUMN IF NOT EXISTS editorial_review_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS provenance jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Legacy Drive documents were published without the evidence introduced here.
UPDATE public.rag_documents
SET is_published = false,
    published_at = NULL,
    editorial_review_status = 'pending'
WHERE source_type = 'drive_corpus'
  AND (
    source_url IS NULL
    OR source_checksum_sha256 IS NULL
    OR rights_status NOT IN ('official_public', 'licensed')
    OR (source_purpose = 'official_exam' AND answer_key_url IS NULL)
    OR editorial_review_status <> 'approved'
  );

CREATE OR REPLACE FUNCTION public.enforce_drive_rag_publication_gate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.source_type = 'drive_corpus' AND NEW.is_published IS TRUE AND (
    NEW.source_url IS NULL
    OR NEW.source_checksum_sha256 IS NULL
    OR NEW.rights_status NOT IN ('official_public', 'licensed')
    OR (NEW.source_purpose = 'official_exam' AND NEW.answer_key_url IS NULL)
    OR NEW.editorial_review_status <> 'approved'
  ) THEN
    RAISE EXCEPTION 'Drive corpus cannot be published before provenance, rights, checksum, answer key and editorial review';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_drive_rag_publication_gate_trigger
  ON public.rag_documents;
CREATE TRIGGER enforce_drive_rag_publication_gate_trigger
  BEFORE INSERT OR UPDATE OF is_published, source_url, source_purpose,
    source_checksum_sha256, rights_status, answer_key_url, editorial_review_status
  ON public.rag_documents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_drive_rag_publication_gate();

-- Semantic RAG searches must never see an unpublished or inactive document.
CREATE OR REPLACE FUNCTION public.match_rag_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  content text,
  document_id uuid,
  similarity float
)
LANGUAGE sql
STABLE
SET search_path = public, extensions, pg_temp
AS $$
  SELECT rc.id,
         rc.content,
         rc.document_id,
         1 - (re.embedding <=> query_embedding) AS similarity
  FROM public.rag_chunks rc
  JOIN public.rag_embeddings re ON re.chunk_id = rc.id
  JOIN public.rag_documents rd ON rd.id = rc.document_id
  WHERE rd.is_published IS TRUE
    AND rd.is_active IS TRUE
    AND 1 - (re.embedding <=> query_embedding) > match_threshold
  ORDER BY re.embedding <=> query_embedding
  LIMIT match_count;
$$;