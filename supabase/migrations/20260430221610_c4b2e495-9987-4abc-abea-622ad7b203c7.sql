-- Tabela de Notebooks NotebookLM
CREATE TABLE IF NOT EXISTS public.notebooklm_notebooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES public.master_content_library(id) ON DELETE CASCADE,
    notebook_title TEXT NOT NULL,
    specialty TEXT,
    notebook_url TEXT,
    audio_url TEXT,
    video_url TEXT,
    notes_url TEXT,
    media_status TEXT DEFAULT 'none', -- none, exported_to_notebooklm, notebook_created, audio_generated, notes_generated, reviewed, ready_for_students
    exported_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Logs de Exportação
CREATE TABLE IF NOT EXISTS public.notebooklm_export_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES public.master_content_library(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    status TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.notebooklm_notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebooklm_export_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para Admin/Professor (Acesso total)
CREATE POLICY "Admins/Professors full access on notebooks" 
ON public.notebooklm_notebooks 
FOR ALL 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type IN ('admin', 'professor')));

CREATE POLICY "Admins/Professors full access on export logs" 
ON public.notebooklm_export_logs 
FOR ALL 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type IN ('admin', 'professor')));

-- Políticas para Alunos (Apenas visualização de mídias prontas)
CREATE POLICY "Students can view ready notebooks" 
ON public.notebooklm_notebooks 
FOR SELECT 
USING (media_status = 'ready_for_students');

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_notebooklm_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER tr_update_notebooklm_updated_at
    BEFORE UPDATE ON public.notebooklm_notebooks
    FOR EACH ROW
    EXECUTE FUNCTION update_notebooklm_updated_at();

-- Garantir que media_status na master_content_library esteja sincronizado ou disponível
-- (Já existe na tabela master_content_library conforme verificação anterior)
