ALTER TABLE public.assistant_decisions
ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Create a unique constraint on idempotency_key to allow upsert by it
ALTER TABLE public.assistant_decisions
ADD CONSTRAINT assistant_decisions_idempotency_key_key UNIQUE (idempotency_key);