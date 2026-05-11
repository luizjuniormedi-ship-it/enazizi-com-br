ALTER TABLE public.study_plans 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed',
ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS current_step TEXT,
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Atualizar planos existentes para status completed
UPDATE public.study_plans SET status = 'completed', progress = 100 WHERE status IS NULL;