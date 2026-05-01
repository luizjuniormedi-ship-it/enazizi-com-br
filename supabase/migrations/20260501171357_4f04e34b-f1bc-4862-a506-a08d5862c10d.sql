-- Structured explanations for students
ALTER TABLE public.adaptive_interventions 
ADD COLUMN IF NOT EXISTS explanation TEXT,
ADD COLUMN IF NOT EXISTS impact_summary TEXT,
ADD COLUMN IF NOT EXISTS cognitive_insight TEXT;

-- Cognitive History for the Transparency Dashboard
CREATE TABLE IF NOT EXISTS public.cognitive_state_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    stress_index DOUBLE PRECISION NOT NULL,
    load_index DOUBLE PRECISION NOT NULL,
    friction_index DOUBLE PRECISION NOT NULL,
    session_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Orchestration Settings
ALTER TABLE public.adaptive_student_profiles 
ADD COLUMN IF NOT EXISTS orchestration_intensity TEXT DEFAULT 'balanced' CHECK (orchestration_intensity IN ('low', 'balanced', 'intense')),
ADD COLUMN IF NOT EXISTS transparency_enabled BOOLEAN DEFAULT true;

-- Enable RLS
ALTER TABLE public.cognitive_state_history ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Students can view their own cognitive history" 
ON public.cognitive_state_history FOR SELECT 
USING (auth.uid() = user_id);

-- Update seed or triggers to populate explanations
CREATE OR REPLACE FUNCTION public.generate_intervention_explanation()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.explanation IS NULL THEN
        NEW.explanation := CASE 
            WHEN NEW.trigger_type = 'quiz_error' THEN 'Detectamos erros repetidos em temas fundamentais. Uma revisão direcionada ajudará a estabilizar sua base.'
            WHEN NEW.trigger_type = 'tutor_open' THEN 'Você consultou o Tutor IA várias vezes neste tema. Vamos consolidar esse conhecimento com uma micro-revisão.'
            WHEN NEW.trigger_type = 'replay_spike' THEN 'Você revisou trechos deste vídeo repetidamente, indicando alta carga cognitiva. Sugerimos uma abordagem alternativa.'
            WHEN NEW.trigger_type = 'low_retention' THEN 'Sua curva de esquecimento FSRS para este tema caiu abaixo do ideal. Hora de um reforço emergencial.'
            ELSE 'O ACE ajustou sua jornada para otimizar sua retenção e reduzir o atrito pedagógico.'
        END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_intervention_explanation
BEFORE INSERT ON public.adaptive_interventions
FOR EACH ROW
EXECUTE FUNCTION public.generate_intervention_explanation();
