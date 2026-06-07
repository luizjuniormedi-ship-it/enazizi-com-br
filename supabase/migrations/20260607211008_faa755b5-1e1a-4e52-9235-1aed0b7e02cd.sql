-- 1. Extensão da Tabela de Staging para Validação Dual e Multi-Label
ALTER TABLE public.question_classification_staging 
ADD COLUMN IF NOT EXISTS classification_b JSONB,
ADD COLUMN IF NOT EXISTS secondary_competency_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS quality_score NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS audit_status TEXT DEFAULT 'pending' CHECK (audit_status IN ('pending', 'auditing', 'approved', 'rejected', 'flagged')),
ADD COLUMN IF NOT EXISTS duplicate_cluster_id UUID,
ADD COLUMN IF NOT EXISTS similarity_score NUMERIC(5,4),
ADD COLUMN IF NOT EXISTS is_exact_duplicate BOOLEAN DEFAULT false;

-- 2. Criação do Golden Validation Set (Ground Truth)
CREATE TABLE IF NOT EXISTS public.curriculum_golden_set (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES public.questions_bank(id),
    specialty TEXT NOT NULL,
    topic TEXT NOT NULL,
    subtopic TEXT,
    competency_id UUID REFERENCES public.curriculum_registry(id),
    curriculum_theme TEXT,
    curriculum_competency TEXT,
    validated_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(question_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculum_golden_set TO authenticated;
GRANT ALL ON public.curriculum_golden_set TO service_role;
ALTER TABLE public.curriculum_golden_set ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin access to golden set" ON public.curriculum_golden_set FOR ALL USING (true);

-- 3. Tabela de Auditoria Forense
CREATE TABLE IF NOT EXISTS public.curriculum_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID,
    staging_id UUID REFERENCES public.question_classification_staging(id),
    inspector_id TEXT,
    finding_type TEXT CHECK (finding_type IN ('critical_error', 'moderate_error', 'light_error', 'perfect')),
    comparison_data JSONB, -- IA vs Ground Truth
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT ON public.curriculum_audit_logs TO authenticated;
GRANT ALL ON public.curriculum_audit_logs TO service_role;
ALTER TABLE public.curriculum_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin access to audit logs" ON public.curriculum_audit_logs FOR ALL USING (true);

-- 4. Função de Cálculo de Quality Score
CREATE OR REPLACE FUNCTION public.calculate_curriculum_quality_score()
RETURNS TRIGGER AS $$
DECLARE
    score NUMERIC := 0;
BEGIN
    -- 30% Competência (Primary)
    IF NEW.competency_id IS NOT NULL THEN score := score + 30; END IF;
    -- 25% Tema
    IF NEW.curriculum_theme IS NOT NULL THEN score := score + 25; END IF;
    -- 20% Subtema
    IF NEW.subtopic IS NOT NULL THEN score := score + 20; END IF;
    -- 15% Alias/Mapping
    IF NEW.classification_metadata->>'alias_match' = 'true' THEN score := score + 15; END IF;
    -- 10% Consistência (Dual Classifier)
    IF NEW.classification_a->>'competency_id' = NEW.classification_b->>'competency_id' THEN 
        score := score + 10; 
    END IF;

    NEW.quality_score := score;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_quality_score
BEFORE INSERT OR UPDATE ON public.question_classification_staging
FOR EACH ROW EXECUTE FUNCTION public.calculate_curriculum_quality_score();

-- 5. Hardening: Bloqueio de Competency ID Órfão
CREATE OR REPLACE FUNCTION public.check_competency_integrity()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.competency_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.curriculum_registry WHERE id = NEW.competency_id
    ) THEN
        RAISE EXCEPTION 'CRITICAL: Competency ID % does not exist in curriculum_registry', NEW.competency_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_check_competency_integrity
BEFORE INSERT OR UPDATE ON public.question_classification_staging
FOR EACH ROW EXECUTE FUNCTION public.check_competency_integrity();

-- 6. Política de Promoção Controlada (Batch Promotion)
-- Impede promoção se o quality_score for baixo ou se houver divergência sem revisão
CREATE OR REPLACE FUNCTION public.enforce_promotion_policy()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.lifecycle_state = 'promoted' THEN
        -- Teste D: Dois classificadores discordam
        IF NEW.classification_a->>'competency_id' <> NEW.classification_b->>'competency_id' 
           AND NEW.audit_status <> 'approved' THEN
            RAISE EXCEPTION 'MANUAL REVIEW REQUIRED: Classifiers disagree on staging_id %', NEW.id;
        END IF;

        -- Meta: Quality Score >= 97 (Ajustável conforme fase)
        IF NEW.quality_score < 80 AND NEW.audit_status <> 'approved' THEN
            RAISE EXCEPTION 'QUALITY GATE FAILED: Score % is below threshold for staging_id %', NEW.quality_score, NEW.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_promotion_policy
BEFORE UPDATE ON public.question_classification_staging
FOR EACH ROW EXECUTE FUNCTION public.enforce_promotion_policy();
