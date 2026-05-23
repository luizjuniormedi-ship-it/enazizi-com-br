ALTER TABLE public.assistant_decisions
ADD COLUMN IF NOT EXISTS event_hash text;

DROP INDEX IF EXISTS assistant_decisions_user_event_hash_idx;
CREATE UNIQUE INDEX assistant_decisions_user_event_hash_idx
ON public.assistant_decisions(user_id, event_hash);