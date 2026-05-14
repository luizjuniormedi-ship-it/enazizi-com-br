-- Tabela para armazenar as referências de ouro (Golden Dataset)
CREATE TABLE IF NOT EXISTS public.golden_question_reference (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES public.questions_bank(id) ON DELETE CASCADE,
    embeddings VECTOR(1536), -- Para busca semântica e detecção de duplicatas/drift
    complexity_level INTEGER CHECK (complexity_level BETWEEN 1 AND 5),
    explanation_depth_score FLOAT,
    hallucination_risk_score FLOAT,
    reasoning_pattern TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela para a baseline agregada de qualidade cognitiva
CREATE TABLE IF NOT EXISTS public.cognitive_quality_baseline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version TEXT UNIQUE NOT NULL, -- e.g., 'v11_warmup'
    avg_cognitive_score FLOAT,
    avg_clinical_depth FLOAT,
    target_distribution JSONB, -- Distribuição ideal por área
    quality_thresholds JSONB, -- Limites mínimos para aceitação
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.golden_question_reference ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cognitive_quality_baseline ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (apenas leitura para usuários, escrita para o sistema/admin)
CREATE POLICY "Golden references are viewable by everyone" ON public.golden_question_reference FOR SELECT USING (true);
CREATE POLICY "Quality baseline is viewable by everyone" ON public.cognitive_quality_baseline FOR SELECT USING (true);

-- Popular a baseline inicial baseada no Warm-Up (v11)
INSERT INTO public.cognitive_quality_baseline (version, avg_cognitive_score, avg_clinical_depth, target_distribution, quality_thresholds, is_active)
VALUES (
    'v12_official',
    0.95,
    4.5,
    '{"Clinica": 20, "Cirurgia": 20, "Pediatria": 20, "GO": 20, "Preventiva": 20}'::jsonb,
    '{"min_cognitive_score": 0.85, "max_hallucination_risk": 0.15, "min_explanation_length": 300}'::jsonb,
    true
) ON CONFLICT (version) DO UPDATE SET is_active = true;

-- Registrar as questões GOLDEN atuais na tabela de referência
INSERT INTO public.golden_question_reference (question_id, complexity_level, explanation_depth_score, hallucination_risk_score, reasoning_pattern)
SELECT 
    id, 
    difficulty, 
    cognitive_quality_score, 
    hallucination_risk_score, 
    'Clinical reasoning with structured explanation'
FROM public.questions_bank
WHERE quality_tier = 'GOLDEN';
