-- Add versioning and publication control to rag_documents
ALTER TABLE public.rag_documents 
ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS replaced_by UUID REFERENCES public.rag_documents(id);

-- Create publication logs for auditing
CREATE TABLE IF NOT EXISTS public.rag_publication_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.rag_documents(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'publish', 'unpublish', 'version_bump'
    user_id UUID REFERENCES auth.users(id),
    organization_id UUID,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rag_publication_logs ENABLE ROW LEVEL SECURITY;

-- Policies for rag_publication_logs using profiles for organization_id
CREATE POLICY "Admins/Professors can view logs for their organization"
ON public.rag_publication_logs
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.user_roles ur ON p.user_id = ur.user_id
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'professor')
        AND (p.organization_id = rag_publication_logs.organization_id OR ur.role = 'admin')
    )
);

CREATE POLICY "Admins/Professors can insert logs"
ON public.rag_publication_logs
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'professor')
    )
);

-- Update RLS for rag_documents to consider is_published for non-admins
-- Students can only see published and active documents
CREATE POLICY "Students can only see published and active documents"
ON public.rag_documents
FOR SELECT
USING (
    (is_published = true AND is_active = true) OR
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'professor')
    )
);
