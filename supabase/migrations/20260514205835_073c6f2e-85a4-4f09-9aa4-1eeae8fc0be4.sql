-- Create fsrs_parameters table
CREATE TABLE IF NOT EXISTS public.fsrs_parameters (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    weights DOUBLE PRECISION[] DEFAULT '{0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.26, 2.05}',
    retention_request DOUBLE PRECISION DEFAULT 0.9,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fsrs_parameters ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own FSRS parameters"
ON public.fsrs_parameters FOR SELECT
USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update their own FSRS parameters"
ON public.fsrs_parameters FOR UPDATE
USING (auth.uid() = user_id);

-- Insert global baseline parameters
INSERT INTO public.fsrs_parameters (user_id, is_active)
VALUES (NULL, TRUE);
