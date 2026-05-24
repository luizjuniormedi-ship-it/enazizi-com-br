-- Set all existing questions as global and approved
UPDATE public.questions_bank 
SET 
    is_global = true, 
    review_status = 'approved',
    approved_for_generation = true
WHERE is_global = false OR review_status != 'approved' OR approved_for_generation = false;

-- Ensure RLS policies allow authenticated users to see global questions
-- (The policy usually already exists but we ensure it covers is_global=true)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'questions_bank' AND policyname = 'Users can view global questions'
    ) THEN
        CREATE POLICY "Users can view global questions" 
        ON public.questions_bank 
        FOR SELECT 
        USING (is_global = true);
    END IF;
END $$;