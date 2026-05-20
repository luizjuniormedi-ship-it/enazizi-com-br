-- Add question_id to error_bank for better tracking
ALTER TABLE public.error_bank ADD COLUMN IF NOT EXISTS question_id UUID;

-- Create a unique constraint to allow UPSERTs
-- We use COALESCE for nullable fields in the unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_error_bank_unique_entry 
ON public.error_bank (user_id, tema, COALESCE(subtema, ''), COALESCE(question_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Function to handle FSRS card creation/update on error_bank change
CREATE OR REPLACE FUNCTION public.sync_error_to_fsrs()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create/update FSRS for errors that are not dominated
    IF NOT NEW.dominado THEN
        INSERT INTO public.fsrs_cards (
            user_id,
            card_type,
            card_ref_id,
            topic,
            stability,
            difficulty,
            elapsed_days,
            scheduled_days,
            reps,
            lapses,
            state,
            due
        )
        VALUES (
            NEW.user_id,
            'error_bank',
            NEW.id::text,
            NEW.tema,
            0, -- New card stability
            0, -- New card difficulty
            0,
            0,
            0,
            0,
            0, -- State: New
            now()
        )
        ON CONFLICT (user_id, card_type, card_ref_id) DO UPDATE
        SET 
            updated_at = now(),
            due = LEAST(fsrs_cards.due, now()); -- Ensure it's due if re-erred
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for FSRS sync
DROP TRIGGER IF EXISTS tr_sync_error_to_fsrs ON public.error_bank;
CREATE TRIGGER tr_sync_error_to_fsrs
AFTER INSERT OR UPDATE OF vezes_errado, dominado ON public.error_bank
FOR EACH ROW
EXECUTE FUNCTION public.sync_error_to_fsrs();
