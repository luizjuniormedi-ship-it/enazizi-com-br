-- Add missing columns to simulado_sessions
ALTER TABLE public.simulado_sessions 
ADD COLUMN IF NOT EXISTS discipline TEXT,
ADD COLUMN IF NOT EXISTS topic TEXT,
ADD COLUMN IF NOT EXISTS difficulty TEXT,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'mixed';

-- Ensure simulado_questions has everything needed if it's not a reference to questions_bank
ALTER TABLE public.simulado_questions
ADD COLUMN IF NOT EXISTS question_snapshot JSONB,
ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT false;

-- Create view for better monitoring using started_at
CREATE OR REPLACE VIEW public.simulado_health AS
SELECT 
  s.id as session_id,
  s.user_id,
  s.mode,
  s.status,
  s.total_questions,
  (SELECT count(*) FROM public.simulado_questions sq WHERE sq.session_id = s.id) as questions_loaded,
  s.started_at
FROM public.simulado_sessions s
ORDER BY s.started_at DESC;