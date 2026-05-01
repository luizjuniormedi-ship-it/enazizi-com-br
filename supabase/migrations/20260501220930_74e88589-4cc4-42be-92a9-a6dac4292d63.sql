-- Update cme_session_aggregations with status tracking
ALTER TABLE public.cme_session_aggregations 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'aggregating', 'blocks_generated', 'builder_ready', 'failed')),
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Create audit table for CME pipeline
CREATE TABLE IF NOT EXISTS public.cme_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregation_id UUID REFERENCES public.cme_session_aggregations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cme_audit_logs ENABLE ROW LEVEL SECURITY;

-- Secure access for staff only (using user_type based on profiles schema)
CREATE POLICY "Staff can view audit logs" ON public.cme_audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND user_type IN ('admin', 'professor', 'coordenador')
        )
    );

-- Restrict cinematic tools to staff
CREATE POLICY "Staff can manage cinematic blocks" ON public.cme_lesson_blocks
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND user_type IN ('admin', 'professor', 'coordenador')
        )
    );
