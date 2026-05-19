ALTER TABLE public.mnemonic_results
ADD COLUMN memory_impact_score NUMERIC,
ADD COLUMN visual_strength NUMERIC,
ADD COLUMN emotional_strength NUMERIC,
ADD COLUMN clinical_relevance NUMERIC,
ADD COLUMN simplicity NUMERIC,
ADD COLUMN recall_speed NUMERIC,
ADD COLUMN retention_prediction NUMERIC,
ADD COLUMN layering_json JSONB,
ADD COLUMN auditor_medical_feedback TEXT,
ADD COLUMN auditor_pedagogical_feedback TEXT;

COMMENT ON COLUMN public.mnemonic_results.memory_impact_score IS 'Score oficial de impacto de memória (MemoryImpactScore).';
COMMENT ON COLUMN public.mnemonic_results.visual_strength IS 'Força visual e memorabilidade da cena (Pixar-style).';
COMMENT ON COLUMN public.mnemonic_results.emotional_strength IS 'Conexão emocional da associação cognitiva.';
COMMENT ON COLUMN public.mnemonic_results.clinical_relevance IS 'Relevância clínica e precisão do conceito.';
COMMENT ON COLUMN public.mnemonic_results.simplicity IS 'Simplicidade e facilidade de decodificação.';
COMMENT ON COLUMN public.mnemonic_results.recall_speed IS 'Velocidade prevista de recuperação da informação.';
COMMENT ON COLUMN public.mnemonic_results.retention_prediction IS 'Predição de retenção longitudinal.';
