-- Drop existing constraints
ALTER TABLE public.questions_bank DROP CONSTRAINT IF EXISTS check_options_count;
ALTER TABLE public.questions_bank DROP CONSTRAINT IF EXISTS check_options_length;
ALTER TABLE public.questions_bank DROP CONSTRAINT IF EXISTS check_correct_index_range;

-- Add updated constraints to allow 4 or 5 options
ALTER TABLE public.questions_bank ADD CONSTRAINT check_options_count CHECK (jsonb_array_length(options) IN (4, 5));
ALTER TABLE public.questions_bank ADD CONSTRAINT check_options_length CHECK (jsonb_array_length(options) IN (4, 5));
ALTER TABLE public.questions_bank ADD CONSTRAINT check_correct_index_range CHECK (correct_index >= 0 AND correct_index <= 4);
