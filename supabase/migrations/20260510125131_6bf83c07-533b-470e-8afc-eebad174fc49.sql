-- 1. Function to ensure medical_domain_map exists for a user
CREATE OR REPLACE FUNCTION public.ensure_user_medical_domain_map(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    specialties TEXT[] := ARRAY[
        'Clínica Médica', 'Cirurgia', 'Pediatria', 
        'Ginecologia e Obstetrícia', 'Medicina Preventiva',
        'Cardiologia', 'Neurologia', 'Pneumologia', 
        'Ortopedia', 'Psiquiatria', 'Infectologia',
        'Nefrologia', 'Gastroenterologia', 'Endocrinologia',
        'Hematologia', 'Oncologia', 'Dermatologia',
        'Reumatologia', 'Urologia', 'Otorrinolaringologia',
        'Angiologia', 'Oftalmologia', 'Terapia Intensiva',
        'Medicina de Emergência'
    ];
    s TEXT;
BEGIN
    FOR s IN SELECT unnest(specialties) LOOP
        INSERT INTO public.medical_domain_map (user_id, specialty, domain_score, questions_answered, correct_answers)
        VALUES (p_user_id, s, 0, 0, 0)
        ON CONFLICT (user_id, specialty) DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger to initialize medical_domain_map on profile creation
CREATE OR REPLACE FUNCTION public.on_profile_created_init_map()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.ensure_user_medical_domain_map(NEW.user_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_init_medical_map ON public.profiles;
CREATE TRIGGER tr_init_medical_map
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.on_profile_created_init_map();

-- 3. Unified view for legacy revisions and FSRS cards
CREATE OR REPLACE VIEW public.legacy_fsrs_bridge AS
SELECT 
    id, 
    user_id, 
    due, 
    card_type, 
    card_ref_id, 
    'fsrs' as source
FROM public.fsrs_cards
UNION ALL
SELECT 
    id::uuid, 
    user_id, 
    data_revisao as due, 
    'legacy' as card_type, 
    NULL as card_ref_id, 
    'revisoes' as source
FROM public.revisoes
WHERE status = 'pendente'
AND NOT EXISTS (SELECT 1 FROM public.fsrs_cards f WHERE f.user_id = public.revisoes.user_id);

-- 4. Dashboard card diagnostics table
CREATE TABLE IF NOT EXISTS public.dashboard_card_diagnostics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    card_name TEXT NOT NULL,
    status TEXT NOT NULL, -- 'ready', 'loading', 'error', 'empty', 'no_history'
    data_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.dashboard_card_diagnostics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own diagnostics" ON public.dashboard_card_diagnostics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own diagnostics" ON public.dashboard_card_diagnostics FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. Fix RLS policies to be more explicit (avoiding implicit 0 from failed policies)
DO $$ 
BEGIN
    -- Ensure policies allow authenticated users to see their own data
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can select their own approval scores') THEN
        CREATE POLICY "Users can select their own approval scores" ON public.approval_scores FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can select their own domain map') THEN
        CREATE POLICY "Users can select their own domain map" ON public.medical_domain_map FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

-- 6. Initialize map for existing users
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT user_id FROM public.profiles LOOP
        PERFORM public.ensure_user_medical_domain_map(r.user_id);
    END LOOP;
END $$;
