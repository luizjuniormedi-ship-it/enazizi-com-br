CREATE TABLE IF NOT EXISTS public.occ_daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    occ_score DECIMAL(5,2) NOT NULL, -- The % of competencies with 50+ unique questions
    total_competencies INTEGER NOT NULL,
    operational_competencies INTEGER NOT NULL,
    critical_competencies INTEGER NOT NULL,
    recovered_today INTEGER DEFAULT 0,
    generated_today INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.occ_recovery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID REFERENCES public.curriculum_topics(id),
    phase TEXT NOT NULL, -- 'RECOVERY FIRST', 'RECOVERY SECOND', 'TARGETED GENERATION'
    action_taken TEXT,
    questions_before INTEGER,
    questions_after INTEGER,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.occ_daily_stats TO authenticated;
GRANT ALL ON public.occ_daily_stats TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.occ_recovery_logs TO authenticated;
GRANT ALL ON public.occ_recovery_logs TO service_role;

ALTER TABLE public.occ_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occ_recovery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view OCC stats" ON public.occ_daily_stats FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can view OCC logs" ON public.occ_recovery_logs FOR SELECT TO authenticated USING (true);
