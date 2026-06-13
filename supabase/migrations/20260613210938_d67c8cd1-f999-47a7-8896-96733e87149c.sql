
ALTER TABLE public.rag_documents
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'global_rag',
  ADD COLUMN IF NOT EXISTS drive_file_id TEXT,
  ADD COLUMN IF NOT EXISTS specialty TEXT;

ALTER TABLE public.rag_documents
  DROP CONSTRAINT IF EXISTS rag_documents_source_type_check;
ALTER TABLE public.rag_documents
  ADD CONSTRAINT rag_documents_source_type_check
  CHECK (source_type IN ('global_rag','drive_corpus'));

CREATE UNIQUE INDEX IF NOT EXISTS rag_documents_drive_file_id_uniq
  ON public.rag_documents (drive_file_id)
  WHERE drive_file_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS rag_documents_source_specialty_idx
  ON public.rag_documents (source_type, specialty);
