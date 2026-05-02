ALTER TABLE public.cme_session_aggregations 
ADD COLUMN IF NOT EXISTS manual_video_url TEXT,
ADD COLUMN IF NOT EXISTS is_manual_upload BOOLEAN DEFAULT FALSE;

-- Update aggregation_status type if needed (checking if it exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'aggregation_status') THEN
        CREATE TYPE aggregation_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'waiting_manual_upload');
    ELSE
        -- Add waiting_manual_upload if it doesn't exist in the enum
        BEGIN
            ALTER TYPE aggregation_status ADD VALUE 'waiting_manual_upload';
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END;
    END IF;
END $$;