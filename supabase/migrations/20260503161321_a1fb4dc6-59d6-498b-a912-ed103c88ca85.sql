-- 1. Tabela de solicitações
CREATE TABLE IF NOT EXISTS public.mnemonic_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    tema TEXT NOT NULL,
    termos_json JSONB DEFAULT '[]'::jsonb,
    estilo TEXT,
    publico TEXT,
    status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
    source TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de resultados (Ativos de Mnemônicos)
CREATE TABLE IF NOT EXISTS public.mnemonic_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES public.mnemonic_requests(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    tema TEXT NOT NULL,
    sigla TEXT,
    frase_mnemonica TEXT NOT NULL,
    explicacao_tecnica TEXT,
    explicacao_didatica TEXT,
    cena_visual TEXT,
    prompt_imagem TEXT,
    score_medico INTEGER DEFAULT 0,
    score_pedagogico INTEGER DEFAULT 0,
    score_linguistico INTEGER DEFAULT 0,
    score_final INTEGER DEFAULT 0,
    aprovado BOOLEAN DEFAULT false,
    aprovado_medico BOOLEAN DEFAULT false,
    aprovado_pedagogico BOOLEAN DEFAULT false,
    image_url TEXT,
    associacoes_json JSONB DEFAULT '[]'::jsonb,
    associacoes_visuais_json JSONB DEFAULT '[]'::jsonb,
    alertas_json JSONB DEFAULT '[]'::jsonb,
    versao INTEGER DEFAULT 1,
    is_latest BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabela de vínculos (User-Asset Link) para o sistema adaptativo
CREATE TABLE IF NOT EXISTS public.user_mnemonic_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    mnemonic_asset_id UUID REFERENCES public.mnemonic_results(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    trigger_source TEXT, -- manual, error_bank, spaced_review
    times_shown INTEGER DEFAULT 0,
    last_shown_at TIMESTAMPTZ,
    next_review_at TIMESTAMPTZ,
    performance_score FLOAT, -- como o usuário se saiu após ver o mnemônico
    improvement_delta FLOAT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, mnemonic_asset_id)
);

-- 4. Tabela de telemetria de agentes
CREATE TABLE IF NOT EXISTS public.mnemonic_agent_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES public.mnemonic_requests(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    execution_order INTEGER NOT NULL,
    status TEXT NOT NULL, -- completed, failed, retry
    input_json JSONB,
    output_json JSONB,
    score INTEGER,
    duration_ms INTEGER,
    error_message TEXT,
    result_id UUID REFERENCES public.mnemonic_results(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Tabela de favoritos
CREATE TABLE IF NOT EXISTS public.mnemonic_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    result_id UUID REFERENCES public.mnemonic_results(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, result_id)
);

-- 6. Tabela de feedback
CREATE TABLE IF NOT EXISTS public.mnemonic_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    result_id UUID REFERENCES public.mnemonic_results(id) ON DELETE CASCADE,
    request_id UUID REFERENCES public.mnemonic_requests(id) ON DELETE SET NULL,
    rating_general INTEGER CHECK (rating_general BETWEEN 1 AND 5),
    rating_medical INTEGER CHECK (rating_medical BETWEEN 1 AND 5),
    rating_pedagogical INTEGER CHECK (rating_pedagogical BETWEEN 1 AND 5),
    comentario TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. RLS e Políticas de Segurança
ALTER TABLE public.mnemonic_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mnemonic_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_mnemonic_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mnemonic_agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mnemonic_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mnemonic_feedback ENABLE ROW LEVEL SECURITY;

-- Políticas para mnemonic_requests
DROP POLICY IF EXISTS "Users can view their own requests" ON public.mnemonic_requests;
CREATE POLICY "Users can view their own requests" ON public.mnemonic_requests FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create their own requests" ON public.mnemonic_requests;
CREATE POLICY "Users can create their own requests" ON public.mnemonic_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own requests" ON public.mnemonic_requests;
CREATE POLICY "Users can update their own requests" ON public.mnemonic_requests FOR UPDATE USING (auth.uid() = user_id);

-- Políticas para mnemonic_results
DROP POLICY IF EXISTS "Users can view results they requested or linked" ON public.mnemonic_results;
CREATE POLICY "Users can view results they requested or linked" ON public.mnemonic_results FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.user_mnemonic_links WHERE user_id = auth.uid() AND mnemonic_asset_id = public.mnemonic_results.id)
);
DROP POLICY IF EXISTS "Users can insert their own results" ON public.mnemonic_results;
CREATE POLICY "Users can insert their own results" ON public.mnemonic_results FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own results" ON public.mnemonic_results;
CREATE POLICY "Users can update their own results" ON public.mnemonic_results FOR UPDATE USING (auth.uid() = user_id);

-- Políticas para user_mnemonic_links
DROP POLICY IF EXISTS "Users can manage their own links" ON public.user_mnemonic_links;
CREATE POLICY "Users can manage their own links" ON public.user_mnemonic_links FOR ALL USING (auth.uid() = user_id);

-- Políticas para mnemonic_agent_logs
DROP POLICY IF EXISTS "Users can view their own agent logs" ON public.mnemonic_agent_logs;
CREATE POLICY "Users can view their own agent logs" ON public.mnemonic_agent_logs FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role can manage logs" ON public.mnemonic_agent_logs;
CREATE POLICY "Service role can manage logs" ON public.mnemonic_agent_logs FOR ALL USING (true) WITH CHECK (true);

-- Políticas para mnemonic_favorites
DROP POLICY IF EXISTS "Users can manage their own favorites" ON public.mnemonic_favorites;
CREATE POLICY "Users can manage their own favorites" ON public.mnemonic_favorites FOR ALL USING (auth.uid() = user_id);

-- Políticas para mnemonic_feedback
DROP POLICY IF EXISTS "Users can manage their own feedback" ON public.mnemonic_feedback;
CREATE POLICY "Users can manage their own feedback" ON public.mnemonic_feedback FOR ALL USING (auth.uid() = user_id);

-- 8. Gatilhos de updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_mnemonic_requests_updated_at ON public.mnemonic_requests;
CREATE TRIGGER update_mnemonic_requests_updated_at BEFORE UPDATE ON public.mnemonic_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_mnemonic_results_updated_at ON public.mnemonic_results;
CREATE TRIGGER update_mnemonic_results_updated_at BEFORE UPDATE ON public.mnemonic_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_user_mnemonic_links_updated_at ON public.user_mnemonic_links;
CREATE TRIGGER update_user_mnemonic_links_updated_at BEFORE UPDATE ON public.user_mnemonic_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
