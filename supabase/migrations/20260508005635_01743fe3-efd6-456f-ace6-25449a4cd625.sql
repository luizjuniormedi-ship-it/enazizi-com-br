-- Adicionar campos de confiabilidade à tabela principal
ALTER TABLE public.exam_blueprints 
ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3,2) DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS sample_size INTEGER DEFAULT 0;

-- Tabela para armazenar dados brutos de provas (para Rolling Window)
CREATE TABLE public.exam_raw_data (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    exam_key TEXT NOT NULL,
    exam_year INTEGER NOT NULL,
    specialty TEXT NOT NULL,
    topic TEXT NOT NULL,
    occurrence_count INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Versões de Blueprint (Snapshots para Rollback)
CREATE TABLE public.exam_blueprint_versions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    version_label TEXT NOT NULL, -- Ex: ENARE_v2026_05
    exam_key TEXT NOT NULL,
    blueprint_json JSONB NOT NULL, -- Snapshot completo dos pesos
    confidence_avg DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    is_active BOOLEAN DEFAULT false
);

-- Habilitar RLS
ALTER TABLE public.exam_raw_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_blueprint_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura de versões por usuários autenticados" ON public.exam_blueprint_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role gerencia versões" ON public.exam_blueprint_versions FOR ALL USING (true) WITH CHECK (true);

-- Função para reconciliação e suavização (Weight Smoothing)
CREATE OR REPLACE FUNCTION public.reconcile_and_smooth_weights(
    p_exam_key TEXT,
    p_smoothing_factor DECIMAL DEFAULT 0.3 -- 30% novo dado, 70% histórico
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r RECORD;
    v_new_weight DECIMAL;
    v_avg_weight DECIMAL;
    v_version TEXT;
BEGIN
    v_version := 'v_reconciled_' || to_char(now(), 'YYYYMMDD_HH24MI');

    -- Para cada especialidade/tópico no raw_data (últimas provas)
    FOR r IN 
        SELECT specialty, topic, 
               (occurrence_count::decimal / SUM(occurrence_count) OVER ()) * 100 as calculated_weight,
               SUM(occurrence_count) OVER () as total_sample
        FROM public.exam_raw_data
        WHERE exam_key = p_exam_key
    LOOP
        -- Buscar peso atual
        SELECT weight INTO v_avg_weight 
        FROM public.exam_blueprints 
        WHERE exam_key = p_exam_key AND specialty = r.specialty AND topic = r.topic AND is_active = true;

        IF v_avg_weight IS NULL THEN
            v_new_weight := r.calculated_weight; -- Novo tema
        ELSE
            -- Aplica Smoothing: (Novo * Factor) + (Atual * (1-Factor))
            v_new_weight := (r.calculated_weight * p_smoothing_factor) + (v_avg_weight * (1 - p_smoothing_factor));
        END IF;

        -- Atualizar Blueprint
        UPDATE public.exam_blueprints
        SET weight = v_new_weight,
            confidence_score = LEAST(1.0, 0.5 + (r.total_sample / 1000.0)), -- Score sobe com a amostra
            sample_size = r.total_sample,
            last_recalculated_at = now(),
            version = v_version
        WHERE exam_key = p_exam_key AND specialty = r.specialty AND topic = r.topic AND is_active = true;
        
        -- Se não existia, insere
        IF NOT FOUND THEN
            INSERT INTO public.exam_blueprints (exam_key, specialty, topic, weight, confidence_score, sample_size, version, is_active)
            VALUES (p_exam_key, r.specialty, r.topic, r.calculated_weight, 0.5, r.total_sample, v_version, true);
        END IF;
    END LOOP;
END;
$$;
