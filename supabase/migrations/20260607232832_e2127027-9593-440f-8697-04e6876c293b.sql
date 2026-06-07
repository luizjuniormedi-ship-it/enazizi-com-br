
-- Add CEH columns to simulation_history
ALTER TABLE public.simulation_history 
ADD COLUMN IF NOT EXISTS dqi_inflation_penalty FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS transfer_confidence FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS case_difficulty_score FLOAT DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS attribution_confidence FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS evidence_quality_score FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS ceh_logs JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS audit_flag BOOLEAN DEFAULT FALSE;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulation_history TO authenticated;
GRANT ALL ON public.simulation_history TO service_role;

-- Index for evidence analysis
CREATE INDEX IF NOT EXISTS idx_simulation_history_evidence_quality ON public.simulation_history(evidence_quality_score);
CREATE INDEX IF NOT EXISTS idx_simulation_history_audit_flag ON public.simulation_history(audit_flag);
