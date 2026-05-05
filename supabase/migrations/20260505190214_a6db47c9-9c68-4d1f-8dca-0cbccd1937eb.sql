CREATE OR REPLACE FUNCTION public.append_questions_to_job(
    p_job_id UUID,
    p_new_questions JSONB,
    p_status public.simulation_job_status
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.simulation_generation_jobs
    SET 
        results = results || p_new_questions,
        generated_questions = generated_questions + jsonb_array_length(p_new_questions),
        status = CASE 
            WHEN generated_questions + jsonb_array_length(p_new_questions) >= total_questions THEN 'completed'::public.simulation_job_status
            ELSE p_status
        END,
        updated_at = now()
    WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;