-- Phase 1: Ghost Competency Scanning (Using correct column names)
CREATE OR REPLACE VIEW public.ghost_competency_registry AS
WITH physical_stats AS (
    SELECT 
        topic as legacy_topic,
        subtopic as legacy_subtopic,
        count(*) as physical_count
    FROM public.questions_bank
    GROUP BY topic, subtopic
),
mapping_stats AS (
    SELECT 
        cr.id as competency_id,
        cr.curriculum_competency as competency_name,
        count(qb.id) as visible_count
    FROM public.curriculum_registry cr
    LEFT JOIN public.questions_bank qb ON qb.competency_id = cr.id::text
    GROUP BY cr.id, cr.curriculum_competency
)
SELECT 
    cr.id as competency_id,
    cr.curriculum_competency as competency_name,
    COALESCE(ps.physical_count, 0) as physical_questions,
    COALESCE(ms.visible_count, 0) as visible_questions,
    CASE 
        WHEN COALESCE(ps.physical_count, 0) > 0 
        THEN (COALESCE(ms.visible_count, 0)::float / ps.physical_count::float) * 100 
        ELSE 100 
    END as visibility_ratio
FROM public.curriculum_registry cr
LEFT JOIN mapping_stats ms ON ms.competency_id = cr.id
LEFT JOIN physical_stats ps ON ps.legacy_topic = cr.curriculum_competency;

GRANT SELECT ON public.ghost_competency_registry TO authenticated, service_role;

-- Phase 2: Legacy String Mapping
CREATE TABLE IF NOT EXISTS public.legacy_to_curriculum_map (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_string TEXT NOT NULL UNIQUE,
    competency_id UUID REFERENCES public.curriculum_registry(id),
    mapping_type TEXT DEFAULT 'exact',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT ALL ON public.legacy_to_curriculum_map TO authenticated, service_role;
ALTER TABLE public.legacy_to_curriculum_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage mapping" ON public.legacy_to_curriculum_map FOR ALL USING (true);

-- Phase 4: Constraint Enforcement & Tracking
ALTER TABLE public.questions_bank 
ADD COLUMN IF NOT EXISTS reconciliation_data JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_questions_bank_topic_subtopic ON public.questions_bank(topic, subtopic);
CREATE INDEX IF NOT EXISTS idx_questions_bank_competency_id ON public.questions_bank(competency_id);

-- OCR Calculation Function
CREATE OR REPLACE FUNCTION public.calculate_ocr() 
RETURNS TABLE (ocr_rate FLOAT) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        CASE 
            WHEN count(id) = 0 THEN 0.0
            ELSE (count(id) FILTER (WHERE competency_id IS NOT NULL)::float / count(id)::float) * 100
        END
    FROM public.questions_bank;
END;
$$ LANGUAGE plpgsql;