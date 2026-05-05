-- Habilitar extensão pgvector se não estiver disponível
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Tabela de Documentos RAG
CREATE TABLE IF NOT EXISTS public.rag_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL, -- Tenant
  uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, processed, error
  is_published BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 2. Tabela de Chunks (Trechos de Texto)
CREATE TABLE IF NOT EXISTS public.rag_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.rag_documents(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  page_number INTEGER,
  section_title TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 3. Tabela de Embeddings
CREATE TABLE IF NOT EXISTS public.rag_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id UUID REFERENCES public.rag_chunks(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID NOT NULL,
  embedding vector(1536), -- Compatível com OpenAI text-embedding-3-small/ada-002
  model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 4. Tabela de Jobs de Processamento
CREATE TABLE IF NOT EXISTS public.rag_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.rag_documents(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', -- queued, running, completed, failed
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  logs JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.rag_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_processing_jobs ENABLE ROW LEVEL SECURITY;

-- POLICIES (Multi-tenant)

-- RAG DOCUMENTS
CREATE POLICY "Users can view documents from their organization"
  ON public.rag_documents FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role IN ('admin', 'professor')
    ) AND organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Students can view published documents"
  ON public.rag_documents FOR SELECT
  USING (
    is_published = true AND
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and Professors can upload/manage"
  ON public.rag_documents FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role IN ('admin', 'professor')
    ) AND organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role IN ('admin', 'professor')
    ) AND organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- RAG CHUNKS (Deriva da política de documentos via query semântica ou direta)
CREATE POLICY "Tenant isolation for chunks"
  ON public.rag_chunks FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- RAG EMBEDDINGS
CREATE POLICY "Tenant isolation for embeddings"
  ON public.rag_embeddings FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- RAG PROCESSING JOBS
CREATE POLICY "Admins and Professors can view jobs"
  ON public.rag_processing_jobs FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role IN ('admin', 'professor')
    ) AND organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Funções Auxiliares
CREATE OR REPLACE FUNCTION public.update_rag_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rag_documents_timestamp
BEFORE UPDATE ON public.rag_documents
FOR EACH ROW EXECUTE FUNCTION public.update_rag_timestamp();
