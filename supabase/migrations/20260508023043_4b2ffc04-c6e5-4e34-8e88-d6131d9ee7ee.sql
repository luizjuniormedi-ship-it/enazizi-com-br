-- Add created_at if missing
ALTER TABLE public.exam_clinical_audits 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Recreate function with fix
CREATE OR REPLACE FUNCTION public.recalibrate_clinical_profiles()
RETURNS void AS $$
BEGIN
    WITH audit_stats AS (
        SELECT 
            specialty,
            AVG(final_quality_score) as avg_q,
            SUM(CASE WHEN NOT is_approved THEN 1 ELSE 0 END)::float / COUNT(*)::float as reg_rate,
            COUNT(*) as total
        FROM public.exam_clinical_audits
        WHERE created_at > now() - interval '30 days'
        GROUP BY specialty
    )
    UPDATE public.clinical_quality_profiles p
    SET 
        average_quality = COALESCE(s.avg_q, p.average_quality),
        regeneration_rate = COALESCE(s.reg_rate, p.regeneration_rate),
        total_audited = COALESCE(s.total, p.total_audited),
        updated_at = now(),
        -- Auto-routing logic
        preferred_model = CASE 
            WHEN s.reg_rate > 0.20 OR s.avg_q < 85 THEN p.fallback_model 
            ELSE p.preferred_model 
        END,
        explanation_depth = CASE 
            WHEN s.reg_rate > 0.15 THEN 'high'
            ELSE p.explanation_depth
        END
    FROM audit_stats s
    WHERE p.specialty = s.specialty;
END;
$$ LANGUAGE plpgsql SET search_path = public;
