-- 1. Cache de Recomendação por Sessão
CREATE TABLE IF NOT EXISTS public.tutor_recommendation_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    normalized_topic TEXT NOT NULL,
    lesson_id UUID, -- NULL se não encontrado (negativo cache)
    confidence INTEGER,
    lesson_data JSONB,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '15 minutes'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutor_rec_cache_lookup ON public.tutor_recommendation_cache (session_id, normalized_topic);
CREATE INDEX IF NOT EXISTS idx_tutor_rec_cache_expiry ON public.tutor_recommendation_cache (expires_at);

ALTER TABLE public.tutor_recommendation_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own cache" 
ON public.tutor_recommendation_cache FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cache" 
ON public.tutor_recommendation_cache FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 2. Telemetria Avançada do Tutor IA
CREATE TABLE IF NOT EXISTS public.tutor_ia_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL, 
    topic TEXT,
    lesson_id UUID,
    confidence INTEGER,
    model_used TEXT,
    fallback_used BOOLEAN DEFAULT false,
    parse_strategy TEXT,
    duration_ms INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutor_telemetry_session ON public.tutor_ia_telemetry (session_id);
CREATE INDEX IF NOT EXISTS idx_tutor_telemetry_event ON public.tutor_ia_telemetry (event_type);

ALTER TABLE public.tutor_ia_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all telemetry" 
ON public.tutor_ia_telemetry FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role IN ('admin', 'coordinator')
    )
);

CREATE POLICY "Users can insert telemetry" 
ON public.tutor_ia_telemetry FOR INSERT 
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

-- 3. View de Saúde do Tutor (Dashboard Admin)
CREATE OR REPLACE VIEW public.tutor_health_metrics AS
WITH daily_stats AS (
    SELECT 
        date_trunc('day', created_at) as day,
        COUNT(*) FILTER (WHERE event_type = 'message_received') as total_messages,
        COUNT(*) FILTER (WHERE event_type = 'video_found') as matches_found,
        COUNT(*) FILTER (WHERE event_type = 'video_clicked') as total_clicks,
        COUNT(*) FILTER (WHERE event_type = 'answer_generation_failed') as total_errors,
        AVG(duration_ms) FILTER (WHERE event_type = 'answer_generation_completed') as avg_latency
    FROM public.tutor_ia_telemetry
    WHERE created_at > now() - interval '7 days'
    GROUP BY 1
)
SELECT 
    day,
    total_messages,
    matches_found,
    ROUND((matches_found::float / NULLIF(total_messages, 0) * 100)::numeric, 2) as match_rate_pct,
    total_clicks,
    ROUND((total_clicks::float / NULLIF(matches_found, 0) * 100)::numeric, 2) as ctr_pct,
    total_errors,
    ROUND((total_errors::float / NULLIF(total_messages, 0) * 100)::numeric, 2) as error_rate_pct,
    ROUND(avg_latency::numeric, 0) as avg_latency_ms
FROM daily_stats;

-- 4. Função de Limpeza Automática
CREATE OR REPLACE FUNCTION public.cleanup_tutor_cache() 
RETURNS void AS $$
BEGIN
    DELETE FROM public.tutor_recommendation_cache WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para limpar cache antigo ocasionalmente
CREATE OR REPLACE FUNCTION public.trigger_cleanup_tutor_cache()
RETURNS TRIGGER AS $$
BEGIN
    IF (random() < 0.05) THEN
        PERFORM public.cleanup_tutor_cache();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cleanup_tutor_cache_trigger
AFTER INSERT ON public.tutor_recommendation_cache
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_cleanup_tutor_cache();
