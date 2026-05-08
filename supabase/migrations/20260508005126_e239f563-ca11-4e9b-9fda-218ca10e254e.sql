-- Tabela de Blueprints de Provas
CREATE TABLE public.exam_blueprints (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    exam_key TEXT NOT NULL, -- enare, usp-sp, etc
    specialty TEXT NOT NULL,
    topic TEXT NOT NULL,
    weight DECIMAL(5,2) NOT NULL DEFAULT 0.0,
    version TEXT NOT NULL DEFAULT '1.0.0',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_recalculated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    UNIQUE(exam_key, specialty, topic, version)
);

-- Habilitar RLS
ALTER TABLE public.exam_blueprints ENABLE ROW LEVEL SECURITY;

-- Políticas de leitura pública (usuários precisam ver os temas)
CREATE POLICY "Leitura pública de blueprints" ON public.exam_blueprints FOR SELECT USING (true);

-- Apenas service_role pode editar (via scripts de ingestão/IA)
CREATE POLICY "Service role pode gerenciar blueprints" ON public.exam_blueprints FOR ALL USING (true) WITH CHECK (true);

-- Tabela de Logs de Drift (Detecção de Mudança de Tendência)
CREATE TABLE public.exam_drift_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    exam_key TEXT NOT NULL,
    topic TEXT NOT NULL,
    old_weight DECIMAL(5,2),
    new_weight DECIMAL(5,2),
    delta DECIMAL(5,2),
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    reason TEXT
);

ALTER TABLE public.exam_drift_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura de logs de drift por usuários autenticados" ON public.exam_drift_logs FOR SELECT TO authenticated USING (true);

-- Função RPC para buscar blueprint formatado (eficiência para o gerador)
CREATE OR REPLACE FUNCTION public.get_active_blueprint(p_exam_key TEXT)
RETURNS TABLE (specialty TEXT, topic TEXT, weight DECIMAL) 
LANGUAGE sql
STABLE
AS $$
    SELECT specialty, topic, weight
    FROM public.exam_blueprints
    WHERE exam_key = p_exam_key AND is_active = true
    ORDER BY weight DESC;
$$;

-- Triggers para updated_at
CREATE TRIGGER update_exam_blueprints_updated_at
BEFORE UPDATE ON public.exam_blueprints
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
