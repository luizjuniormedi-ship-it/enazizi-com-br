ALTER TABLE assistant_decisions
ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS assistant_decisions_idempotency_key_idx
ON assistant_decisions(idempotency_key);

ALTER TABLE assistant_decisions
ADD COLUMN IF NOT EXISTS event_hash text;

-- Ensure user_id index exists for performance
CREATE INDEX IF NOT EXISTS assistant_decisions_user_id_idx
ON assistant_decisions(user_id);

-- Enable RLS (already enabled but good practice to ensure)
ALTER TABLE assistant_decisions ENABLE ROW LEVEL SECURITY;

-- Refine policies for UPSERT support (must allow INSERT and UPDATE)
DROP POLICY IF EXISTS "Users can insert own decisions" ON assistant_decisions;
DROP POLICY IF EXISTS "Users can update own decisions" ON assistant_decisions;
DROP POLICY IF EXISTS assistant_decisions_insert ON assistant_decisions;
DROP POLICY IF EXISTS assistant_decisions_update ON assistant_decisions;

CREATE POLICY assistant_decisions_insert
ON assistant_decisions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY assistant_decisions_update
ON assistant_decisions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);