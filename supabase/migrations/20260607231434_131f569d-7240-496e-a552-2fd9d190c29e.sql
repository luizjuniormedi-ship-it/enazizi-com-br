-- CSVP Tables

CREATE TABLE public.clinical_baseline_assessments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    simulation_id UUID,
    clinical_readiness_before FLOAT DEFAULT 0,
    diagnostic_accuracy_before FLOAT DEFAULT 0,
    therapeutic_accuracy_before FLOAT DEFAULT 0,
    critical_care_score_before FLOAT DEFAULT 0,
    decision_speed_before FLOAT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.clinical_action_log (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    simulation_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    action_type TEXT NOT NULL, -- 'exam', 'diagnosis', 'medication', etc.
    clinical_domain TEXT,
    action_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    decision_time_ms INTEGER,
    is_correct BOOLEAN,
    severity TEXT, -- 'low', 'medium', 'high', 'critical'
    impact_score FLOAT DEFAULT 0,
    physiology_state_snapshot JSONB, -- PA, FC, FR, SatO2, Temp, etc.
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.clinical_far_transfer (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    source_topic TEXT NOT NULL, -- Topic from quest/flashcard
    simulation_topic TEXT NOT NULL, -- Topic in simulation
    score_delta FLOAT DEFAULT 0,
    transfer_score FLOAT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.simulation_outcomes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    simulation_id UUID NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    readiness_before FLOAT DEFAULT 0,
    readiness_after FLOAT DEFAULT 0,
    clinical_gain FLOAT DEFAULT 0,
    clinical_error_score FLOAT DEFAULT 0,
    dqi FLOAT DEFAULT 0, -- Decision Quality Index
    far_transfer FLOAT DEFAULT 0,
    completion_time_seconds INTEGER,
    patient_outcome TEXT, -- 'death', 'discharge', 'icu', 'ward', 'complication', 'recovery'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_baseline_assessments TO authenticated;
GRANT ALL ON public.clinical_baseline_assessments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_action_log TO authenticated;
GRANT ALL ON public.clinical_action_log TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_far_transfer TO authenticated;
GRANT ALL ON public.clinical_far_transfer TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulation_outcomes TO authenticated;
GRANT ALL ON public.simulation_outcomes TO service_role;

-- RLS
ALTER TABLE public.clinical_baseline_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_action_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_far_transfer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own baseline" ON public.clinical_baseline_assessments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own action logs" ON public.clinical_action_log FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own far transfer" ON public.clinical_far_transfer FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own outcomes" ON public.simulation_outcomes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Functions
CREATE OR REPLACE FUNCTION public.calculate_clinical_dqi(
    diag_acc FLOAT,
    treat_acc FLOAT,
    time_eff FLOAT,
    safety_score FLOAT,
    outcome_val FLOAT
) RETURNS FLOAT AS $$
BEGIN
    -- DQI = weighted average of clinical dimensions
    RETURN (diag_acc * 0.3) + (treat_acc * 0.3) + (time_eff * 0.1) + (safety_score * 0.15) + (outcome_val * 0.15);
END;
$$ LANGUAGE plpgsql;
