-- Create tutor_v2_audits table
CREATE TABLE IF NOT EXISTS public.tutor_v2_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.tutor_sessions(id) ON DELETE CASCADE,
    message_id UUID REFERENCES public.tutor_messages(id) ON DELETE CASCADE,
    
    -- Phase 0 Context
    phase_0_context JSONB DEFAULT '{}'::jsonb,
    
    -- Pedagogical Scores
    pedagogical_score INTEGER DEFAULT 0,
    feynman_score INTEGER DEFAULT 0,
    
    -- Structure validation
    blocks_found TEXT[] DEFAULT '{}',
    blocks_missing TEXT[] DEFAULT '{}',
    
    -- Safety and Quality
    hallucination_warning BOOLEAN DEFAULT false,
    medical_safety_score FLOAT DEFAULT 1.0,
    
    -- Student Metrics
    cognitive_load FLOAT DEFAULT 0.0,
    detected_gaps TEXT[] DEFAULT '{}',
    
    -- Performance
    latency_ms INTEGER,
    model_used TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tutor_v2_audits ENABLE ROW LEVEL SECURITY;

-- Policies (Admins only for now, or users for their own data)
CREATE POLICY "Admins can view all audits" 
ON public.tutor_v2_audits 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Users can view their own audits" 
ON public.tutor_v2_audits 
FOR SELECT 
USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_tutor_v2_audits_user_id ON public.tutor_v2_audits(user_id);
CREATE INDEX idx_tutor_v2_audits_session_id ON public.tutor_v2_audits(session_id);
CREATE INDEX idx_tutor_v2_audits_created_at ON public.tutor_v2_audits(created_at);
