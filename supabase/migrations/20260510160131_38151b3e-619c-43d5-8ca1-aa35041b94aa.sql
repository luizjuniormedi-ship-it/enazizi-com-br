ALTER TABLE public.tutor_v2_audits 
ADD COLUMN IF NOT EXISTS planner_signals JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS error_signals JSONB DEFAULT '[]'::jsonb;
