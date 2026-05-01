-- 1. Ingestion Network Schema
CREATE TABLE IF NOT EXISTS public.official_exam_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.official_exam_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES public.official_exam_sources(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    storage_path TEXT,
    checksum_sha256 TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'downloaded', 'processed', 'error')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.official_exam_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES public.official_exam_files(id) ON DELETE CASCADE,
    question_number INTEGER,
    enunciado TEXT NOT NULL,
    alternativas JSONB NOT NULL,
    resposta TEXT NOT NULL,
    disciplina TEXT,
    confidence_score NUMERIC,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ingestion_pipeline_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES public.official_exam_sources(id) ON DELETE SET NULL,
    run_type TEXT NOT NULL, -- 'discovery', 'full'
    status TEXT DEFAULT 'running',
    stats JSONB DEFAULT '{}'::jsonb,
    logs TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    finished_at TIMESTAMP WITH TIME ZONE
);

-- 2. Adaptive Multimodal Schema (Phase 3)
CREATE TABLE IF NOT EXISTS public.video_cognitive_heatmaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_lesson_id UUID REFERENCES public.ai_video_lessons(id) ON DELETE CASCADE,
    segment_id UUID REFERENCES public.lesson_segments(id) ON DELETE CASCADE,
    friction_score NUMERIC DEFAULT 0, -- Agregado de abandonos + replays + tutor_opens
    avg_retention NUMERIC,
    total_replays INTEGER DEFAULT 0,
    total_abandons INTEGER DEFAULT 0,
    total_tutor_opens INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(video_lesson_id, segment_id)
);

-- Habilitar RLS
ALTER TABLE public.official_exam_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_exam_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_cognitive_heatmaps ENABLE ROW LEVEL SECURITY;

-- Políticas Ingestion (Admin Only por padrão para escrita)
CREATE POLICY "Admins manage exam sources" ON public.official_exam_sources FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Everyone can view active sources" ON public.official_exam_sources FOR SELECT USING (is_active = true);

CREATE POLICY "Admins manage exam files" ON public.official_exam_files FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage exam questions" ON public.official_exam_questions FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Everyone can view exam questions" ON public.official_exam_questions FOR SELECT USING (true);

CREATE POLICY "Admins manage pipeline runs" ON public.ingestion_pipeline_runs FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Políticas Heatmap
CREATE POLICY "Admins can view heatmaps" ON public.video_cognitive_heatmaps FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Professors can view heatmaps" ON public.video_cognitive_heatmaps FOR SELECT USING (public.has_role(auth.uid(), 'professor'));

-- Adicionar Flag Fase 3
INSERT INTO public.system_flags (flag_key, enabled, description, category)
VALUES 
('adaptive_decisions_enabled', false, 'Habilita tomada de decisão autônoma baseada em eventos multimodais.', 'video'),
('preventive_tutor_enabled', false, 'Habilita sugestões proativas do Tutor IA antes da dúvida do aluno.', 'tutor')
ON CONFLICT (flag_key) DO NOTHING;

-- Função para atualizar heatmap cognitivo
CREATE OR REPLACE FUNCTION public.refresh_video_cognitive_heatmap(p_video_lesson_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.video_cognitive_heatmaps (video_lesson_id, segment_id, friction_score, total_replays, total_abandons, total_tutor_opens, last_updated)
    SELECT 
        video_lesson_id, 
        segment_id,
        (COUNT(*) FILTER (WHERE event_type = 'replay') * 0.5) + 
        (COUNT(*) FILTER (WHERE event_type = 'abandon') * 1.0) + 
        (COUNT(*) FILTER (WHERE event_type = 'tutor_open') * 0.3) as friction,
        COUNT(*) FILTER (WHERE event_type = 'replay'),
        COUNT(*) FILTER (WHERE event_type = 'abandon'),
        COUNT(*) FILTER (WHERE event_type = 'tutor_open'),
        now()
    FROM public.video_segment_events
    WHERE video_lesson_id = p_video_lesson_id
    GROUP BY video_lesson_id, segment_id
    ON CONFLICT (video_lesson_id, segment_id) DO UPDATE SET
        friction_score = EXCLUDED.friction_score,
        total_replays = EXCLUDED.total_replays,
        total_abandons = EXCLUDED.total_abandons,
        total_tutor_opens = EXCLUDED.total_tutor_opens,
        last_updated = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;