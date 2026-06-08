CREATE TABLE IF NOT EXISTS public.etgc_certification_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competency_id TEXT REFERENCES public.curriculum_registry(competency_id),
    competency_name TEXT,
    returned_10_count INTEGER DEFAULT 0,
    returned_20_count INTEGER DEFAULT 0,
    returned_50_count INTEGER DEFAULT 0,
    tps NUMERIC DEFAULT 0,
    leakage_count INTEGER DEFAULT 0,
    status TEXT, -- 'VERDE', 'AMARELO', 'VERMELHO'
    failure_reason TEXT,
    execution_time_ms INTEGER DEFAULT 0,
    trace_ids JSONB DEFAULT '[]'::jsonb,
    metrics JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.etgc_certification_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    total_competencies INTEGER,
    green_count INTEGER,
    yellow_count INTEGER,
    red_count INTEGER,
    cts NUMERIC,
    tps_avg NUMERIC,
    topic_leakage_avg NUMERIC,
    avg_execution_time NUMERIC,
    is_certified BOOLEAN,
    full_report JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.etgc_certification_results TO authenticated;
GRANT ALL ON public.etgc_certification_results TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.etgc_certification_summary TO authenticated;
GRANT ALL ON public.etgc_certification_summary TO service_role;

ALTER TABLE public.etgc_certification_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etgc_certification_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for authenticated" ON public.etgc_certification_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read for authenticated" ON public.etgc_certification_summary FOR SELECT TO authenticated USING (true);
