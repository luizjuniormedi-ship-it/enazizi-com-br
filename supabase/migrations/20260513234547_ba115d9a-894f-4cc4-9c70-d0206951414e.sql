-- Adicionar colunas de rastreabilidade na tabela de flashcards
ALTER TABLE public.flashcards 
ADD COLUMN IF NOT EXISTS decision_id UUID REFERENCES public.assistant_decisions(id),
ADD COLUMN IF NOT EXISTS session_id UUID;

-- Criar índice para performance em buscas de telemetria
CREATE INDEX IF NOT EXISTS idx_flashcards_decision_id ON public.flashcards(decision_id);

-- Função RPC para consolidar dados do dashboard (Fase 4)
CREATE OR REPLACE FUNCTION public.get_unified_dashboard_data(p_user_id UUID, p_reset_at TIMESTAMPTZ, p_today_iso TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
    v_flashcards_count BIGINT;
    v_uploads_count BIGINT;
    v_daily_plan JSONB;
    v_metrics JSONB;
    v_profile JSONB;
BEGIN
    -- Contagem básica
    SELECT count(*) INTO v_flashcards_count FROM flashcards WHERE user_id = p_user_id;
    SELECT count(*) INTO v_uploads_count FROM uploads WHERE user_id = p_user_id;

    -- Plano diário e tarefas (versão otimizada)
    SELECT jsonb_build_object(
        'plan', (SELECT row_to_json(dp) FROM daily_plans dp WHERE user_id = p_user_id AND plan_date >= (now() - interval '7 days')::date ORDER BY plan_date DESC LIMIT 1),
        'tasks', (SELECT jsonb_agg(row_to_json(dt)) FROM daily_plan_tasks dt WHERE user_id = p_user_id AND (created_at > p_reset_at OR created_at >= p_today_iso))
    ) INTO v_daily_plan;

    -- Perfil e Metadados
    SELECT row_to_json(p) INTO v_profile FROM profiles p WHERE user_id = p_user_id;

    -- Consolidar resultado
    v_result := jsonb_build_object(
        'flashcards_count', v_flashcards_count,
        'uploads_count', v_uploads_count,
        'daily_plan', v_daily_plan,
        'profile', v_profile,
        'server_time', now()
    );

    RETURN v_result;
END;
$$;

-- Função RPC para criar decisão adaptativa com fallback (Fase 1)
CREATE OR REPLACE FUNCTION public.create_adaptive_decision(
    p_user_id UUID,
    p_module_source TEXT,
    p_context JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_decision_id UUID;
    v_hash TEXT;
BEGIN
    v_hash := encode(digest(p_user_id::text || p_module_source || now()::text, 'sha256'), 'hex');
    
    INSERT INTO public.assistant_decisions (
        user_id,
        module_source,
        context,
        user_hash,
        created_at
    ) VALUES (
        p_user_id,
        p_module_source,
        p_context,
        v_hash,
        now()
    )
    ON CONFLICT (user_hash) DO UPDATE SET 
        created_at = now() -- Touch the timestamp on conflict for idempotency
    RETURNING id INTO v_decision_id;

    RETURN v_decision_id;
END;
$$;
