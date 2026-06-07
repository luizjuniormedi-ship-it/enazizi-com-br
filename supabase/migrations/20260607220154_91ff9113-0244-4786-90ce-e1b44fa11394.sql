
-- View to calculate OCR by Specialty
CREATE OR REPLACE VIEW public.cvrp_specialty_stats AS
WITH physical_counts AS (
    SELECT 
        COALESCE(curriculum_discipline, topic, 'N/A') as specialty, 
        COUNT(*) as physical_count
    FROM public.questions_bank
    GROUP BY 1
),
visible_counts AS (
    SELECT 
        COALESCE(q.curriculum_discipline, q.topic, 'N/A') as specialty, 
        COUNT(*) as visible_count
    FROM public.questions_bank q
    JOIN public.legacy_to_curriculum_map m ON q.id::text = m.legacy_string OR q.competency_id = m.competency_id::text
    GROUP BY 1
)
SELECT 
    p.specialty,
    p.physical_count,
    COALESCE(v.visible_count, 0) as visible_count,
    p.physical_count - COALESCE(v.visible_count, 0) as lost_count,
    CASE 
        WHEN p.physical_count = 0 THEN 0
        ELSE ROUND((COALESCE(v.visible_count, 0)::numeric / p.physical_count::numeric) * 100, 2)
    END as ocr_percentage,
    CASE 
        WHEN (COALESCE(v.visible_count, 0)::numeric / NULLIF(p.physical_count, 0)::numeric) < 0.25 THEN 'CRITICAL'
        WHEN (COALESCE(v.visible_count, 0)::numeric / NULLIF(p.physical_count, 0)::numeric) < 0.50 THEN 'POOR'
        WHEN (COALESCE(v.visible_count, 0)::numeric / NULLIF(p.physical_count, 0)::numeric) < 0.80 THEN 'PARTIAL'
        ELSE 'OPERATIONAL'
    END as status
FROM physical_counts p
LEFT JOIN visible_counts v ON p.specialty = v.specialty
WHERE p.specialty IS NOT NULL;

-- View to identify "Ghost" Competencies
CREATE OR REPLACE VIEW public.cvrp_ghost_competencies AS
SELECT 
    COALESCE(curriculum_competency, topic, 'N/A') as competency,
    COALESCE(curriculum_discipline, 'N/A') as specialty,
    COUNT(*) as physical_count,
    'MISSING_MAPPING' as root_cause
FROM public.questions_bank q
LEFT JOIN public.legacy_to_curriculum_map m ON q.id::text = m.legacy_string OR q.competency_id = m.competency_id::text
WHERE m.id IS NULL
GROUP BY 1, 2;

-- Table for Top 100 User Requests Impact Analysis
CREATE TABLE IF NOT EXISTS public.cvrp_user_requests_impact (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competency_name TEXT NOT NULL,
    request_count INTEGER DEFAULT 0,
    physical_available INTEGER DEFAULT 0,
    visible_available INTEGER DEFAULT 0,
    ocr_percentage NUMERIC(5,2),
    user_impact_score TEXT, -- GREEN, YELLOW, RED
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT ON public.cvrp_specialty_stats TO authenticated;
GRANT SELECT ON public.cvrp_specialty_stats TO service_role;
GRANT SELECT ON public.cvrp_ghost_competencies TO authenticated;
GRANT SELECT ON public.cvrp_ghost_competencies TO service_role;
GRANT ALL ON public.cvrp_user_requests_impact TO authenticated;
GRANT ALL ON public.cvrp_user_requests_impact TO service_role;

ALTER TABLE public.cvrp_user_requests_impact ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read for all users" ON public.cvrp_user_requests_impact FOR SELECT USING (true);
