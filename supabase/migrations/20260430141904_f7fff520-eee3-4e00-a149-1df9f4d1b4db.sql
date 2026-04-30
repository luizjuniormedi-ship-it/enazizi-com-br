-- 1. Tabelas de Auditoria e Uso
CREATE TABLE IF NOT EXISTS public.ai_content_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES public.master_content_library(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id),
    tenant_id UUID,
    action TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    user_id UUID REFERENCES auth.users(id),
    content_id UUID REFERENCES public.master_content_library(id) ON DELETE SET NULL,
    model TEXT NOT NULL,
    input_tokens INT,
    output_tokens INT,
    estimated_cost NUMERIC(10, 6),
    reused_from_cache BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Atualizar master_content_library para suporte a fila e retries
ALTER TABLE public.master_content_library 
ADD COLUMN IF NOT EXISTS content_hash TEXT,
ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_retries INT DEFAULT 3,
ADD COLUMN IF NOT EXISTS last_error TEXT,
ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_master_content_hash ON public.master_content_library(content_hash);

-- 3. Configuração de Storage Protegido
DO $$ 
BEGIN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
        'ai_production_materials', 
        'ai_production_materials', 
        false, 
        52428800, -- 50MB
        ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'text/plain']
    )
    ON CONFLICT (id) DO UPDATE SET 
        public = false,
        file_size_limit = 52428800,
        allowed_mime_types = ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'text/plain'];
END $$;

-- Políticas de RLS para Storage (Ajustadas para user_type)
DROP POLICY IF EXISTS "Admins can upload materials" ON storage.objects;
CREATE POLICY "Admins can upload materials"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'ai_production_materials' AND 
    (
        (auth.jwt() ->> 'role') = 'service_role' OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type IN ('admin', 'professor'))
    )
);

DROP POLICY IF EXISTS "Admins can read materials" ON storage.objects;
CREATE POLICY "Admins can read materials"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'ai_production_materials' AND 
    (
        (auth.jwt() ->> 'role') = 'service_role' OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type IN ('admin', 'professor'))
    )
);

-- 4. Função e Trigger para Auditoria Automática
CREATE OR REPLACE FUNCTION public.audit_ai_content_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.ai_content_audit_logs (
            content_id,
            user_id,
            action,
            previous_status,
            new_status,
            metadata
        ) VALUES (
            NEW.id,
            auth.uid(),
            'status_change',
            OLD.status,
            NEW.status,
            jsonb_build_object('trigger', 'status_change_monitor')
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_audit_ai_content_status ON public.master_content_library;
CREATE TRIGGER tr_audit_ai_content_status
AFTER UPDATE ON public.master_content_library
FOR EACH ROW
EXECUTE FUNCTION public.audit_ai_content_status_change();

-- 5. Habilitar RLS
ALTER TABLE public.ai_content_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
ON public.ai_content_audit_logs FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type IN ('admin', 'professor')));

CREATE POLICY "Admins can view usage logs"
ON public.ai_usage_logs FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type IN ('admin', 'professor')));
