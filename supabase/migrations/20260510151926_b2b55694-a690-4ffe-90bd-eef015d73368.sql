-- Standardize tutor_sessions
ALTER TABLE public.tutor_sessions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Standardize tutor_messages
ALTER TABLE public.tutor_messages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create tutor_v2_events for observability
CREATE TABLE IF NOT EXISTS public.tutor_v2_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.tutor_sessions(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    latency_ms INTEGER,
    model TEXT,
    provider TEXT,
    tokens INTEGER,
    cost NUMERIC,
    success BOOLEAN DEFAULT true,
    error_code TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tutor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_v2_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tutor_sessions
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tutor_sessions' AND policyname = 'Users can manage their own tutor sessions') THEN
        CREATE POLICY "Users can manage their own tutor sessions" ON public.tutor_sessions
        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- RLS Policies for tutor_messages
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tutor_messages' AND policyname = 'Users can manage their own tutor messages') THEN
        CREATE POLICY "Users can manage their own tutor messages" ON public.tutor_messages
        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- RLS Policies for tutor_lessons
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tutor_lessons' AND policyname = 'Users can manage their own tutor lessons') THEN
        CREATE POLICY "Users can manage their own tutor lessons" ON public.tutor_lessons
        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- RLS Policies for tutor_v2_events
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tutor_v2_events' AND policyname = 'Users can view their own tutor events') THEN
        CREATE POLICY "Users can view their own tutor events" ON public.tutor_v2_events
        FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tutor_v2_events' AND policyname = 'System can insert tutor events') THEN
        CREATE POLICY "System can insert tutor events" ON public.tutor_v2_events
        FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;
