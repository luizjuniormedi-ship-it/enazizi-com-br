-- Flags for ACE
INSERT INTO public.system_flags (flag_key, enabled, description, category)
VALUES 
('adaptive_decisions_enabled', true, 'Habilita o motor de decisões adaptativas do ACE.', 'adaptive'),
('adaptive_shadow_mode', true, 'Mantém as intervenções em modo observacional (shadow) sem aplicar automaticamente.', 'adaptive')
ON CONFLICT (flag_key) DO NOTHING;

-- Enhance adaptive_interventions
ALTER TABLE public.adaptive_interventions 
ADD COLUMN IF NOT EXISTS recommendation_text TEXT,
ADD COLUMN IF NOT EXISTS action_payload JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'shadow' CHECK (status IN ('shadow', 'pending', 'accepted', 'ignored')),
ADD COLUMN IF NOT EXISTS estimated_time_min INTEGER;

-- Ensure relationship_type has more semantic options
-- Note: relationship_type is TEXT, so no need for ALTER TYPE unless it was an ENUM. 
-- Adding check constraint if not exists or just documenting usage.

-- Link between interventions and analytics
ALTER TABLE public.adaptive_interventions
ADD COLUMN IF NOT EXISTS friction_score_snapshot FLOAT;

-- Function to evaluate and create a shadow intervention
CREATE OR REPLACE FUNCTION public.evaluate_adaptive_intervention(
    p_user_id UUID,
    p_trigger_type TEXT,
    p_node_id UUID,
    p_lesson_id UUID,
    p_friction_score FLOAT,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
    v_intervention_id UUID;
    v_rec_text TEXT;
    v_action TEXT;
    v_payload JSONB;
BEGIN
    -- Basic logic for determining intervention based on trigger
    IF p_trigger_type = 'high_friction' THEN
        v_rec_text := 'Detectamos que você teve dificuldade neste trecho. Deseja uma explicação Feynman simplificada?';
        v_action := 'suggest_feynman';
        v_payload := jsonb_build_object('type', 'feynman', 'node_id', p_node_id);
    ELSIF p_trigger_type = 'quiz_fail_streak' THEN
        v_rec_text := 'Você errou conceitos fundamentais. Deseja revisar o pré-requisito antes de continuar?';
        v_action := 'inject_micro_review';
        v_payload := jsonb_build_object('type', 'micro_review', 'node_id', p_node_id);
    ELSE
        v_rec_text := 'Recomendação contextual adaptativa disponível.';
        v_action := 'suggest_tutor';
        v_payload := jsonb_build_object('type', 'tutor_open');
    END IF;

    INSERT INTO public.adaptive_interventions (
        user_id, 
        trigger_type, 
        action_taken, 
        context_node_id, 
        video_lesson_id, 
        recommendation_text, 
        action_payload, 
        friction_score_snapshot,
        metadata,
        status
    )
    VALUES (
        p_user_id, 
        p_trigger_type, 
        v_action, 
        p_node_id, 
        p_lesson_id, 
        v_rec_text, 
        v_payload, 
        p_friction_score,
        p_metadata,
        'shadow'
    )
    RETURNING id INTO v_intervention_id;

    RETURN v_intervention_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
