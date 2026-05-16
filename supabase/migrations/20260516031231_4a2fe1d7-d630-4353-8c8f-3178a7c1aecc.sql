-- Function to calculate theta from user responses in a session
CREATE OR REPLACE FUNCTION public.recalculate_user_theta(p_user_id UUID, p_session_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_theta NUMERIC := 0;
    v_accuracy NUMERIC;
BEGIN
    -- This would ideally call an external engine or use a simplified internal logic
    -- For now, we update based on weighted difficulty of correct answers
    SELECT AVG(CASE WHEN q.tri_difficulty_score > 70 THEN 1.2 WHEN q.tri_difficulty_score < 30 THEN 0.8 ELSE 1.0 END * (CASE WHEN sa.correct THEN 1 ELSE -1 END))
    INTO v_theta
    FROM public.simulation_history sa
    JOIN public.questions_bank q ON sa.question_id = q.id
    WHERE sa.user_id = p_user_id;

    -- Update user theta history
    INSERT INTO public.theta_history (user_id, theta_score, source_session_id)
    VALUES (p_user_id, v_theta, p_session_id);

    RETURN v_theta;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
