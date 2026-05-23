-- ENAZIZI Enterprise Hardening v9
-- Stabilizes pedagogical_events upserts from authenticated frontend clients.
-- Root cause: INSERT/SELECT existed, but authenticated UPDATE was missing; PostgREST
-- upsert on_conflict=idempotency_key may require UPDATE + SELECT visibility.

ALTER TABLE public.pedagogical_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pedagogical_events_select_own ON public.pedagogical_events;
DROP POLICY IF EXISTS pedagogical_events_insert_own ON public.pedagogical_events;
DROP POLICY IF EXISTS pedagogical_events_update_own ON public.pedagogical_events;

CREATE POLICY pedagogical_events_select_own
ON public.pedagogical_events
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY pedagogical_events_insert_own
ON public.pedagogical_events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY pedagogical_events_update_own
ON public.pedagogical_events
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Ensure conflict target is valid for upsert on_conflict=idempotency_key.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pedagogical_events_idempotency_key
ON public.pedagogical_events (idempotency_key)
WHERE idempotency_key IS NOT NULL;
