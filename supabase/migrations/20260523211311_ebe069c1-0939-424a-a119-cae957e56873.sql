-- Hardening assistant_decisions
ALTER TABLE public.assistant_decisions ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own decisions' AND tablename = 'assistant_decisions') THEN
        CREATE POLICY "Users can update own decisions"
        ON public.assistant_decisions
        FOR UPDATE
        TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Hardening pedagogical_events
ALTER TABLE public.pedagogical_events ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own pedagogical events' AND tablename = 'pedagogical_events') THEN
        CREATE POLICY "Users can update own pedagogical events"
        ON public.pedagogical_events
        FOR UPDATE
        TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Ensure SELECT and INSERT policies are also present and correct
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own pedagogical events' AND tablename = 'pedagogical_events') THEN
        CREATE POLICY "Users can insert their own pedagogical events"
        ON public.pedagogical_events
        FOR INSERT
        TO authenticated
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;
