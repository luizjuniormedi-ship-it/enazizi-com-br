-- 1. Inserir o experimento na tabela de experimentos adaptativos usando WHERE NOT EXISTS
INSERT INTO public.adaptive_experiments (name, description, target_metric, variants, status, start_date)
SELECT 
    'ENAZIZI V6.1 Scientific Validation',
    'Protocolo de validação científica comparando o uso do Hospital Virtual (Experimental) contra o método tradicional de questões/flashcards (Controle).',
    'retention_d30',
    '[{"id": "control", "name": "Grupo Controle", "description": "Usa Questões, Flashcards e Tutor IA. Sem acesso ao Hospital Virtual."}, {"id": "experimental", "name": "Grupo Experimental", "description": "Acesso total ao Hospital Virtual e ecossistema V6."}]'::jsonb,
    'active',
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM public.adaptive_experiments WHERE name = 'ENAZIZI V6.1 Scientific Validation'
);

-- 2. Função para atribuir usuário a um grupo se ainda não tiver um
CREATE OR REPLACE FUNCTION public.assign_user_to_v6_experiment(target_user_id UUID)
RETURNS TEXT AS $$
DECLARE
    exp_id UUID;
    v_id TEXT;
    existing_assignment UUID;
BEGIN
    -- Obter o ID do experimento V6.1
    SELECT id INTO exp_id FROM public.adaptive_experiments WHERE name = 'ENAZIZI V6.1 Scientific Validation' LIMIT 1;
    
    IF exp_id IS NULL THEN
        RETURN 'Experiment not found';
    END IF;

    -- Verificar se já está atribuído
    SELECT id INTO existing_assignment FROM public.user_experiment_assignments 
    WHERE user_id = target_user_id AND experiment_id = exp_id LIMIT 1;

    IF existing_assignment IS NOT NULL THEN
        SELECT variant_id INTO v_id FROM public.user_experiment_assignments WHERE id = existing_assignment;
        RETURN v_id;
    END IF;

    -- Atribuição baseada em hash do ID do usuário para garantir split 50/50 determinístico
    IF (hashtext(target_user_id::text) % 2 = 0) THEN
        v_id := 'experimental';
    ELSE
        v_id := 'control';
    END IF;

    INSERT INTO public.user_experiment_assignments (user_id, experiment_id, variant_id)
    VALUES (target_user_id, exp_id, v_id);

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Grants e Políticas para user_experiment_assignments
GRANT ALL ON public.user_experiment_assignments TO authenticated;
GRANT ALL ON public.user_experiment_assignments TO service_role;

-- Garantir que RLS está ativado
ALTER TABLE public.user_experiment_assignments ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem para evitar conflito
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view their own experiment assignments" ON public.user_experiment_assignments;
END $$;

CREATE POLICY "Users can view their own experiment assignments" 
ON public.user_experiment_assignments FOR SELECT 
USING (auth.uid() = user_id);
