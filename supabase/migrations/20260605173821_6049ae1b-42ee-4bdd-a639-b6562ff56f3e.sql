ALTER TABLE public.enamed_theme_weights 
ADD COLUMN IF NOT EXISTS frequency_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS recency_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS difficulty_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS approval_impact_score NUMERIC DEFAULT 0;

-- Refresh permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enamed_theme_weights TO authenticated;
GRANT ALL ON public.enamed_theme_weights TO service_role;
