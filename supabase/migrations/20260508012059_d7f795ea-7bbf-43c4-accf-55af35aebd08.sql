-- Tabela de Auditoria Clínica
CREATE TABLE public.exam_clinical_audits (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    question_hash TEXT NOT NULL,
    exam_key TEXT NOT NULL,
    specialty TEXT NOT NULL,
    topic TEXT NOT NULL,
    medical_accuracy_score DECIMAL(3,2), -- 0.00 a 1.00
    distractor_quality_score DECIMAL(3,2),
    explanation_quality_score DECIMAL(3,2),
    exam_style_score DECIMAL(3,2),
    final_quality_score DECIMAL(3,2),
    audit_notes TEXT,
    audited_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_approved BOOLEAN DEFAULT false,
    
    UNIQUE(question_hash)
);

-- Habilitar RLS
ALTER TABLE public.exam_clinical_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access clinical audits" ON public.exam_clinical_audits FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Teacher read clinical audits" ON public.exam_clinical_audits FOR SELECT USING (public.has_role(auth.uid(), 'professor'));

-- Adicionar colunas de rastreio de qualidade em simulações
ALTER TABLE public.simulation_history 
ADD COLUMN IF NOT EXISTS audit_score DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS audit_status TEXT DEFAULT 'pending';

-- Função para registrar auditoria e marcar reprovadas
CREATE OR REPLACE FUNCTION public.record_clinical_audit(
    p_hash TEXT,
    p_exam_key TEXT,
    p_specialty TEXT,
    p_topic TEXT,
    p_accuracy DECIMAL,
    p_distractor DECIMAL,
    p_explanation DECIMAL,
    p_style DECIMAL
) RETURNS BOOLEAN AS $$
DECLARE
    v_final DECIMAL;
    v_approved BOOLEAN;
BEGIN
    v_final := (p_accuracy * 0.4 + p_distractor * 0.2 + p_explanation * 0.2 + p_style * 0.2);
    v_approved := v_final >= 0.85;

    INSERT INTO public.exam_clinical_audits 
    (question_hash, exam_key, specialty, topic, medical_accuracy_score, distractor_quality_score, explanation_quality_score, exam_style_score, final_quality_score, is_approved)
    VALUES 
    (p_hash, p_exam_key, p_specialty, p_topic, p_accuracy, p_distractor, p_explanation, p_style, v_final, v_approved)
    ON CONFLICT (question_hash) DO UPDATE SET
        medical_accuracy_score = EXCLUDED.medical_accuracy_score,
        final_quality_score = EXCLUDED.final_quality_score,
        is_approved = EXCLUDED.is_approved;

    RETURN v_approved;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
