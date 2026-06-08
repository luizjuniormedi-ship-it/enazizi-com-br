-- 1. Alterar a tabela questions_bank para incluir novas métricas GCF se não existirem
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions_bank' AND column_name = 'gold_fidelity_score') THEN
        ALTER TABLE public.questions_bank ADD COLUMN gold_fidelity_score DOUBLE PRECISION DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions_bank' AND column_name = 'survival_validation_score') THEN
        ALTER TABLE public.questions_bank ADD COLUMN survival_validation_score DOUBLE PRECISION DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions_bank' AND column_name = 'impact_validation_score') THEN
        ALTER TABLE public.questions_bank ADD COLUMN impact_validation_score DOUBLE PRECISION DEFAULT 0;
    END IF;
END $$;

-- 2. Criar tabela de Auditorias Forenses
CREATE TABLE IF NOT EXISTS public.gold_certification_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'running', -- 'running', 'completed', 'failed'
    sample_size INTEGER DEFAULT 300,
    gold_fidelity_avg DOUBLE PRECISION,
    gold_inflation_rate DOUBLE PRECISION,
    survival_validation_avg DOUBLE PRECISION,
    impact_validation_avg DOUBLE PRECISION,
    enare_fidelity_avg DOUBLE PRECISION,
    decision TEXT, -- 'GOLD CERTIFICATION APPROVED', 'NEEDS RECALIBRATION'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Criar tabela de Candidatos a Promoção/Rebaixamento
CREATE TABLE IF NOT EXISTS public.gold_promotion_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID REFERENCES public.gold_certification_audits(id),
    question_id UUID REFERENCES public.questions_bank(id),
    current_tier TEXT,
    suggested_tier TEXT,
    reason TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gold_certification_audits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gold_promotion_candidates TO authenticated;
GRANT ALL ON public.gold_certification_audits TO service_role;
GRANT ALL ON public.gold_promotion_candidates TO service_role;

-- 5. RLS
ALTER TABLE public.gold_certification_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gold_promotion_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage audits" ON public.gold_certification_audits FOR ALL USING (true);
CREATE POLICY "Admins can manage promotion candidates" ON public.gold_promotion_candidates FOR ALL USING (true);

-- 6. Telemetria Trigger Function
CREATE OR REPLACE FUNCTION public.log_gcf_event()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.system_telemetry (event_name, metadata)
    VALUES (
        CASE 
            WHEN TG_TABLE_NAME = 'gold_certification_audits' AND TG_OP = 'INSERT' THEN 'GCF_AUDIT_STARTED'
            WHEN TG_TABLE_NAME = 'gold_certification_audits' AND NEW.status = 'completed' THEN 'GCF_AUDIT_COMPLETED'
            WHEN TG_TABLE_NAME = 'gold_promotion_candidates' AND NEW.status = 'approved' THEN 
                CASE WHEN NEW.suggested_tier = 'GOLD' THEN 'GCF_PROMOTION_APPROVED' ELSE 'GCF_DEMOTION_APPROVED' END
            ELSE 'GCF_GENERIC_EVENT'
        END,
        jsonb_build_object('id', NEW.id, 'audit_id', CASE WHEN TG_TABLE_NAME = 'gold_promotion_candidates' THEN NEW.audit_id ELSE NEW.id END)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_gcf_audit_telemetry
AFTER INSERT OR UPDATE ON public.gold_certification_audits
FOR EACH ROW EXECUTE FUNCTION public.log_gcf_event();

CREATE TRIGGER tr_gcf_promotion_telemetry
AFTER UPDATE ON public.gold_promotion_candidates
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.log_gcf_event();
