-- Fase 4: preparar campos de embedding na memória pedagógica do Tutor IA.
-- Não geramos embeddings agora; apenas criamos a base para semantic similarity futura.

ALTER TABLE public.tutor_knowledge_memory
  ADD COLUMN IF NOT EXISTS embedding_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS embedding_model TEXT NULL,
  ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ NULL;

-- Constraint defensiva (idempotente). Se já existir com outro nome, ignoramos.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tutor_knowledge_memory_embedding_status_check'
  ) THEN
    ALTER TABLE public.tutor_knowledge_memory
      ADD CONSTRAINT tutor_knowledge_memory_embedding_status_check
      CHECK (embedding_status IN ('pending','ready','failed','skipped'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tutor_memory_embedding_status
  ON public.tutor_knowledge_memory(embedding_status);

-- Bonus: índice para acelerar a tela /admin/tutor-memory (top reused / low quality).
CREATE INDEX IF NOT EXISTS idx_tutor_memory_quality_score
  ON public.tutor_knowledge_memory(quality_score);

CREATE INDEX IF NOT EXISTS idx_tutor_memory_reuse_count
  ON public.tutor_knowledge_memory(reuse_count DESC);