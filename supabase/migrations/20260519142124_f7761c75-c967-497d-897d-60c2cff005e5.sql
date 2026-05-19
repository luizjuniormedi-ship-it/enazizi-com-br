-- Check if tutor_learning_memory exists and update/create it
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tutor_learning_memory') THEN
        CREATE TABLE public.tutor_learning_memory (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) NOT NULL,
            session_id UUID,
            topic TEXT NOT NULL,
            subtopic TEXT,
            specialization TEXT,
            pedagogical_mode TEXT,
            block_number INTEGER,
            block_type TEXT,
            block_title TEXT,
            explanation_summary TEXT,
            analogy_used TEXT,
            misconceptions_detected TEXT[],
            mastery_level TEXT,
            understanding_score FLOAT,
            cognitive_state JSONB,
            reinforcement_needed BOOLEAN DEFAULT FALSE,
            generated_content TEXT,
            simplified_version TEXT,
            mastery_version TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        );
    END IF;
END $$;

-- Create tutor_analogy_memory
CREATE TABLE IF NOT EXISTS public.tutor_analogy_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    analogy TEXT NOT NULL,
    topic TEXT NOT NULL,
    efficacy_score FLOAT,
    understanding_impact TEXT,
    recovery_success BOOLEAN,
    mastery_impact FLOAT,
    cognitive_profile_match TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create tutor_session_summary
CREATE TABLE IF NOT EXISTS public.tutor_session_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    session_id UUID NOT NULL,
    summary_compact TEXT,
    concepts_mastered TEXT[],
    concepts_fragile TEXT[],
    misconceptions_identified TEXT[],
    effective_analogies UUID[],
    next_steps TEXT[],
    token_usage_total INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tutor_learning_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_analogy_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_session_summary ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own learning memory" ON public.tutor_learning_memory
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own analogy memory" ON public.tutor_analogy_memory
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own session summaries" ON public.tutor_session_summary
    FOR ALL USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tutor_learning_memory_user_topic ON public.tutor_learning_memory(user_id, topic);
CREATE INDEX IF NOT EXISTS idx_tutor_analogy_memory_topic ON public.tutor_analogy_memory(topic);
CREATE INDEX IF NOT EXISTS idx_tutor_session_summary_user_session ON public.tutor_session_summary(user_id, session_id);
