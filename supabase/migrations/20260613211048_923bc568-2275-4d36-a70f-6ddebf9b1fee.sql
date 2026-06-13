
CREATE TABLE IF NOT EXISTS public.drive_corpus_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_file_id TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  folder_path TEXT,
  specialty TEXT,
  file_size BIGINT,
  mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed','skipped')),
  skip_reason TEXT,
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  rag_document_id UUID REFERENCES public.rag_documents(id) ON DELETE SET NULL,
  chunks_count INT,
  tokens_used INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

GRANT SELECT ON public.drive_corpus_queue TO authenticated;
GRANT ALL ON public.drive_corpus_queue TO service_role;

ALTER TABLE public.drive_corpus_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read corpus queue"
  ON public.drive_corpus_queue FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS drive_corpus_queue_status_idx
  ON public.drive_corpus_queue (status, created_at);
CREATE INDEX IF NOT EXISTS drive_corpus_queue_specialty_idx
  ON public.drive_corpus_queue (specialty);

CREATE TRIGGER drive_corpus_queue_updated_at
  BEFORE UPDATE ON public.drive_corpus_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
