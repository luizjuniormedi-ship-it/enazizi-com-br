-- Add missing columns to ai_video_lessons
ALTER TABLE public.ai_video_lessons ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false;
ALTER TABLE public.ai_video_lessons ADD COLUMN IF NOT EXISTS organization_id UUID;

-- Update seeded content to be global
UPDATE public.ai_video_lessons 
SET is_global = true 
WHERE title IN (
    'Insuficiência Cardíaca: Diagnóstico e Manejo',
    'Puericultura: Marcos do Desenvolvimento',
    'Atendimento Inicial ao Politraumatizado',
    'Sepse e Choque Séptico: Sepsis-3',
    'Crise Asmática na Emergência',
    'Pré-natal de Baixo Risco',
    'Diabetes Mellitus Tipo 2: Novas Drogas',
    'Antibioticoterapia nas Pneumonias Comunitárias',
    'Abdome Agudo Inflamatório: Apendicite',
    'Emergências Psiquiátricas: Agitação'
);
