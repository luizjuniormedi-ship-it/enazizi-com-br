-- Hardening assistant_decisions policies
DO $$ 
BEGIN
    -- Ensure UPDATE policy exists
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own decisions' AND tablename = 'assistant_decisions') THEN
        CREATE POLICY "Users can update own decisions"
        ON public.assistant_decisions
        FOR UPDATE
        TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;

    -- Ensure SELECT policy exists
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own decisions' AND tablename = 'assistant_decisions') THEN
        CREATE POLICY "Users can view own decisions"
        ON public.assistant_decisions
        FOR SELECT
        TO authenticated
        USING (auth.uid() = user_id);
    END IF;
END $$;

-- Hardening pedagogical_events
ALTER TABLE public.pedagogical_events ADD CONSTRAINT pedagogical_events_idempotency_key_key UNIQUE (idempotency_key);

DO $$ 
BEGIN
    -- Ensure UPDATE policy exists
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own pedagogical events' AND tablename = 'pedagogical_events') THEN
        CREATE POLICY "Users can update own pedagogical events"
        ON public.pedagogical_events
        FOR UPDATE
        TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;

    -- Ensure SELECT policy exists
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own events' AND tablename = 'pedagogical_events') THEN
        CREATE POLICY "Users can view their own events"
        ON public.pedagogical_events
        FOR SELECT
        TO authenticated
        USING (auth.uid() = user_id);
    END IF;
END $$;
