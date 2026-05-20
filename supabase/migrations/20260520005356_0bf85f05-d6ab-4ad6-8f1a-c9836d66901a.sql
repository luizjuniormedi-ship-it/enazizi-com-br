-- Update cognitive_state_type enum
-- Since we can't easily remove labels from enums in Postgres, we just add the new ones.
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'cognitive_state_type' AND e.enumlabel = 'novato') THEN
        ALTER TYPE public.cognitive_state_type ADD VALUE 'novato';
        ALTER TYPE public.cognitive_state_type ADD VALUE 'exposto';
        ALTER TYPE public.cognitive_state_type ADD VALUE 'retencao_fraca';
        ALTER TYPE public.cognitive_state_type ADD VALUE 'praticando';
        ALTER TYPE public.cognitive_state_type ADD VALUE 'consolidacao';
        ALTER TYPE public.cognitive_state_type ADD VALUE 'dominio';
        ALTER TYPE public.cognitive_state_type ADD VALUE 'risco_esquecimento';
    END IF;
END $$;

-- Create a view for pedagogical event propagation (Lineage)
CREATE OR REPLACE VIEW public.pedagogical_lineage AS
SELECT 
    pe.id as event_id,
    pe.user_id,
    pe.event_type,
    pe.module,
    pe.created_at as timestamp,
    pe.metadata->>'correlation_id' as correlation_id,
    pe.metadata->>'request_id' as request_id,
    pe.status,
    pe.retry_count,
    pe.recursion_depth,
    (pe.updated_at - pe.created_at) as propagation_latency,
    pe.consumed_by,
    cs.state as resulting_cognitive_state,
    cs.metadata->>'last_event_id' as matching_event_id
FROM public.pedagogical_events pe
LEFT JOIN public.cognitive_states cs ON pe.user_id = cs.user_id AND (cs.metadata->>'last_event_id' = pe.id::text);

-- Ensure pedagogical_events has correlation_id for easier querying
ALTER TABLE public.pedagogical_events ADD COLUMN IF NOT EXISTS correlation_id uuid;
CREATE INDEX IF NOT EXISTS idx_ped_events_correlation ON public.pedagogical_events(correlation_id);

-- Migration to sync correlation_id from metadata if possible
UPDATE public.pedagogical_events 
SET correlation_id = (metadata->>'correlation_id')::uuid 
WHERE correlation_id IS NULL AND (metadata->>'correlation_id') IS NOT NULL;
