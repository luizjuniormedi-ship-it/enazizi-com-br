-- High Impact Question Selection RPC
CREATE OR REPLACE FUNCTION public.get_high_impact_questions(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
    id UUID,
    statement TEXT,
    options JSONB,
    correct_index INTEGER,
    topic TEXT,
    explanation TEXT,
    source TEXT,
    potential_gain NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH target_themes AS (
        SELECT 
            eis.theme_id,
            eis.approval_impact_score * (1 - COALESCE(smm.theoretical_score, 0)) as gain
        FROM enamed_impact_scores eis
        LEFT JOIN student_mastery_metrics smm ON eis.theme_id = smm.node_id AND smm.user_id = p_user_id
        ORDER BY gain DESC
        LIMIT 15
    )
    SELECT 
        q.id, q.statement, q.options, q.correct_index, q.topic, q.explanation, q.source, tt.gain
    FROM questions_bank q
    JOIN curriculum_matrix cm ON (q.curriculum_theme = cm.tema OR q.topic = cm.tema)
    JOIN target_themes tt ON cm.id = tt.theme_id
    WHERE q.review_status = 'approved'
    ORDER BY tt.gain DESC, RANDOM()
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_high_impact_questions TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_high_impact_questions TO service_role;
