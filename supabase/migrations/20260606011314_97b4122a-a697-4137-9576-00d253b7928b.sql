-- 1. Verificar divergências de domínio (Practice Attempts vs Medical Domain Map)
CREATE OR REPLACE VIEW public.audit_domain_consistency AS
WITH actual_stats AS (
    SELECT 
        pa.user_id, 
        q.topic as especialidade,
        count(*) as total,
        count(*) FILTER (WHERE pa.correct) as correct
    FROM public.practice_attempts pa
    JOIN public.questions_bank q ON pa.question_id = q.id
    GROUP BY 1, 2
),
mapped_stats AS (
    SELECT 
        user_id, 
        specialty, 
        questions_answered, 
        correct_answers
    FROM public.medical_domain_map
)
SELECT 
    a.user_id,
    a.especialidade,
    a.total as actual_total,
    m.questions_answered as mapped_total,
    a.correct as actual_correct,
    m.correct_answers as mapped_correct,
    ABS(a.total - m.questions_answered) as diff_total
FROM actual_stats a
JOIN mapped_stats m ON a.user_id = m.user_id AND a.especialidade = m.specialty
WHERE ABS(a.total - m.questions_answered) > 0;

-- 2. Função de Diagnóstico de Integridade Pedagógica
CREATE OR REPLACE FUNCTION public.diagnose_pedagogical_integrity(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_error_count INT;
    v_fsrs_count INT;
    v_planner_tasks INT;
    v_result JSONB;
BEGIN
    SELECT count(*) INTO v_error_count FROM public.error_bank WHERE user_id = p_user_id;
    SELECT count(*) INTO v_fsrs_count FROM public.fsrs_cards WHERE user_id = p_user_id;
    SELECT count(*) INTO v_planner_tasks FROM public.daily_plan_tasks WHERE user_id = p_user_id;
    
    v_result := jsonb_build_object(
        'error_bank_size', v_error_count,
        'fsrs_active_cards', v_fsrs_count,
        'planner_total_tasks', v_planner_tasks,
        'sync_health', CASE 
            WHEN v_error_count > 0 AND v_fsrs_count = 0 THEN 'desincronizado_fsrs'
            WHEN v_error_count > 0 AND v_planner_tasks = 0 THEN 'planner_estatico'
            ELSE 'saudavel'
        END
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.diagnose_pedagogical_integrity(UUID) TO authenticated;
GRANT SELECT ON public.audit_domain_consistency TO authenticated;
