CREATE TABLE IF NOT EXISTS public.pedagogical_evidence_metrics (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    learning_yield_score FLOAT DEFAULT 0,
    transfer_score FLOAT DEFAULT 0,
    retention_d30 FLOAT DEFAULT 0,
    retention_d90 FLOAT DEFAULT 0,
    false_positive_rate FLOAT DEFAULT 0,
    false_negative_rate FLOAT DEFAULT 0,
    audit_log JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedagogical_evidence_metrics TO authenticated;
GRANT ALL ON public.pedagogical_evidence_metrics TO service_role;

ALTER TABLE public.pedagogical_evidence_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own evidence metrics" 
ON public.pedagogical_evidence_metrics FOR SELECT 
USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.pedagogical_recovery_tracking (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    original_error_id UUID,
    recovery_action_type TEXT, -- 'enare_question', 'mini_osce', 'recovery_case'
    status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'mastered'
    initial_score FLOAT,
    final_score FLOAT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedagogical_recovery_tracking TO authenticated;
GRANT ALL ON public.pedagogical_recovery_tracking TO service_role;

ALTER TABLE public.pedagogical_recovery_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their recovery tracking" 
ON public.pedagogical_recovery_tracking FOR ALL 
USING (auth.uid() = user_id);