-- Drop the constraint first (the index will be dropped automatically if it was created as part of the constraint)
ALTER TABLE public.assistant_decisions DROP CONSTRAINT IF EXISTS assistant_decisions_idempotency_key_key;

-- Ensure we have a unique constraint on (user_id, event_hash) for true idempotency
DROP INDEX IF EXISTS public.assistant_decisions_user_event_hash_idx;
CREATE UNIQUE INDEX assistant_decisions_user_event_hash_idx ON public.assistant_decisions (user_id, event_hash);

-- Refresh RLS Policies to ensure INSERT and UPDATE work together for UPSERT
DROP POLICY IF EXISTS "Users can insert own decisions" ON public.assistant_decisions;
CREATE POLICY "Users can insert own decisions"
ON public.assistant_decisions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own decisions" ON public.assistant_decisions;
CREATE POLICY "Users can update own decisions"
ON public.assistant_decisions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Ensure public select for admins
DROP POLICY IF EXISTS "Admins can view all decisions" ON public.assistant_decisions;
CREATE POLICY "Admins can view all decisions"
ON public.assistant_decisions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Basic user select
DROP POLICY IF EXISTS "Users can view own decisions" ON public.assistant_decisions;
CREATE POLICY "Users can view own decisions"
ON public.assistant_decisions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);