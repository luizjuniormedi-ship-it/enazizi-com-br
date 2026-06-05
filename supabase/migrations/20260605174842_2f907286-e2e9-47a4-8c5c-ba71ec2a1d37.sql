-- Step 1: Update curriculum_matrix
ALTER TABLE curriculum_matrix 
ADD COLUMN IF NOT EXISTS grande_area TEXT,
ADD COLUMN IF NOT EXISTS competencia TEXT;

-- Step 2: Update enamed_theme_weights
ALTER TABLE enamed_theme_weights
ADD COLUMN IF NOT EXISTS global_weight NUMERIC DEFAULT 0;

-- Step 3: Update question tables
DO $$ 
BEGIN
    -- questions_bank
    ALTER TABLE questions_bank 
    ADD COLUMN IF NOT EXISTS curriculum_area TEXT,
    ADD COLUMN IF NOT EXISTS curriculum_discipline TEXT,
    ADD COLUMN IF NOT EXISTS curriculum_theme TEXT,
    ADD COLUMN IF NOT EXISTS curriculum_subtheme TEXT,
    ADD COLUMN IF NOT EXISTS curriculum_competency TEXT,
    ADD COLUMN IF NOT EXISTS enamed_weight NUMERIC;

    -- real_exam_questions
    ALTER TABLE real_exam_questions 
    ADD COLUMN IF NOT EXISTS curriculum_area TEXT,
    ADD COLUMN IF NOT EXISTS curriculum_discipline TEXT,
    ADD COLUMN IF NOT EXISTS curriculum_theme TEXT,
    ADD COLUMN IF NOT EXISTS curriculum_subtheme TEXT,
    ADD COLUMN IF NOT EXISTS curriculum_competency TEXT,
    ADD COLUMN IF NOT EXISTS enamed_weight NUMERIC;

    -- medical_image_questions
    ALTER TABLE medical_image_questions 
    ADD COLUMN IF NOT EXISTS curriculum_area TEXT,
    ADD COLUMN IF NOT EXISTS curriculum_discipline TEXT,
    ADD COLUMN IF NOT EXISTS curriculum_theme TEXT,
    ADD COLUMN IF NOT EXISTS curriculum_subtheme TEXT,
    ADD COLUMN IF NOT EXISTS curriculum_competency TEXT,
    ADD COLUMN IF NOT EXISTS enamed_weight NUMERIC;
END $$;

-- Step 4: Create/Update Readiness Score V2 Function
-- Readiness Score = 40% domínio + 25% incidência dominada + 20% retenção FSRS + 15% desempenho simulados
CREATE OR REPLACE FUNCTION calculate_readiness_score_v2(
    p_user_id UUID
) RETURNS NUMERIC AS $$
DECLARE
    v_domino NUMERIC := 0;
    v_incidencia_dominada NUMERIC := 0;
    v_fsrs_retencao NUMERIC := 0;
    v_desempenho_simulados NUMERIC := 0;
    v_final_score NUMERIC := 0;
BEGIN
    -- 1. Domínio (0-100)
    -- Simplified: average correct rate in the last 100 questions
    SELECT COALESCE(AVG(CASE WHEN is_correct THEN 100 ELSE 0 END), 0)
    INTO v_domino
    FROM study_performance
    WHERE user_id = p_user_id;

    -- 2. Incidência Dominada (0-100)
    -- Simplified: Mastery of high incidence themes
    SELECT COALESCE(AVG(mastery_score), 0)
    INTO v_incidencia_dominada
    FROM student_mastery_metrics smm
    JOIN enamed_theme_weights etw ON smm.theme_id = etw.theme_id
    WHERE smm.user_id = p_user_id AND etw.historical_incidence > 7;

    -- 3. Retenção FSRS (0-100)
    -- Simplified: Average recall probability from flashcards
    SELECT COALESCE(AVG(retention_rate * 100), 0)
    INTO v_fsrs_retencao
    FROM (
        SELECT (metadata->>'retention')::numeric as retention_rate
        FROM pedagogical_events
        WHERE user_id = p_user_id AND event_type = 'fsrs_review'
        ORDER BY created_at DESC
        LIMIT 50
    ) sub;

    -- 4. Desempenho Simulados (0-100)
    SELECT COALESCE(AVG(score), 0)
    INTO v_desempenho_simulados
    FROM simulation_sessions
    WHERE user_id = p_user_id AND status = 'completed';

    -- Final calculation
    v_final_score := (v_domino * 0.40) + 
                     (v_incidencia_dominada * 0.25) + 
                     (v_fsrs_retencao * 0.20) + 
                     (v_desempenho_simulados * 0.15);

    RETURN v_final_score;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION calculate_readiness_score_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_readiness_score_v2 TO service_role;
