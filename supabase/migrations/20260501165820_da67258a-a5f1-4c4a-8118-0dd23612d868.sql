-- Expand adaptive_interventions to support the Closed Loop
ALTER TABLE public.adaptive_interventions 
ADD COLUMN IF NOT EXISTS post_intervention_outcome TEXT CHECK (post_intervention_outcome IN ('improved', 'stagnant', 'declined')),
ADD COLUMN IF NOT EXISTS outcome_metrics JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;

-- Create student_mastery_metrics for the Medical Mastery Model
CREATE TABLE IF NOT EXISTS public.student_mastery_metrics (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    node_id UUID REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE NOT NULL,
    theoretical_score DOUBLE PRECISION DEFAULT 0, -- Based on quiz performance
    clinical_score DOUBLE PRECISION DEFAULT 0,    -- Based on simulation/case performance
    retention_stability DOUBLE PRECISION DEFAULT 0, -- Based on FSRS stability
    speed_factor DOUBLE PRECISION DEFAULT 0,      -- Response/Consumption speed
    dependency_factor DOUBLE PRECISION DEFAULT 0, -- Usage of Tutor IA/NotebookLM
    transfer_score DOUBLE PRECISION DEFAULT 0,    -- Performance in related nodes
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, node_id)
);

-- Create adaptive_path_logs for Adaptive Clinical Pathways
CREATE TABLE IF NOT EXISTS public.adaptive_path_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    trigger_reason TEXT NOT NULL, -- e.g., 'low_mastery_in_prerequisite', 'friction_spike'
    original_path_node_id UUID REFERENCES public.knowledge_nodes(id),
    new_path_node_id UUID REFERENCES public.knowledge_nodes(id),
    adjustment_type TEXT NOT NULL, -- 'reroute', 'reorder', 'insert_remediation'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.student_mastery_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adaptive_path_logs ENABLE ROW LEVEL SECURITY;

-- Policies for student_mastery_metrics
CREATE POLICY "Students can view their own mastery metrics" 
ON public.student_mastery_metrics FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all mastery metrics" 
ON public.student_mastery_metrics FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type IN ('admin', 'professor')));

-- Policies for adaptive_path_logs
CREATE POLICY "Students can view their own path logs" 
ON public.adaptive_path_logs FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all path logs" 
ON public.adaptive_path_logs FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type IN ('admin', 'professor')));

-- Function to update the mastery metrics automatically
CREATE OR REPLACE FUNCTION public.update_node_mastery_metrics()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.student_mastery_metrics (user_id, node_id, last_updated_at)
    VALUES (NEW.user_id, NEW.node_id, now())
    ON CONFLICT (user_id, node_id) DO UPDATE 
    SET last_updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
